import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { Priority, RequisitionFilter, RequisitionStatus, RequisitionSummary, Section } from '../../../core/lab/lab.models';
import { Clock } from '../../../core/time/clock';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { priorityTag, requisitionTag } from '../lab-status';
import { scanFields, worklistFilterFields } from '../lab.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Liste de travail du laboratoire : les demandes d'analyses, les plus urgentes en tête (STAT, urgent, routine), avec leur avancement et le
 * temps écoulé depuis la demande. Le laboratoire voit toutes les demandes, un prescripteur les siennes. Un champ de scan retrouve la
 * demande d'un échantillon d'après son code-barres (réception).
 */
@Component({
  selector: 'app-worklist-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('lab.worklist.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t(bench() ? 'lab.worklist.lead' : 'lab.worklist.leadOwn') }}</p>
      </header>

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <app-form-builder [fields]="filterFields" formId="worklist-filter" (submitted)="apply($event)" />
        @if (bench()) {
          <section class="flex flex-col gap-3 border border-border bg-card p-4" aria-labelledby="scan-title">
            <h2 id="scan-title" class="text-sm leading-6 font-semibold text-foreground">{{ i18n.t('lab.worklist.scanTitle') }}</h2>
            <app-form-builder #scan [fields]="scanForm()" [busy]="scanning()" formId="worklist-scan" (submitted)="find($event)" />
          </section>
        }
      </div>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="worklist-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('lab.worklist.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.priority') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.patient') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.tests') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.ordered') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.status') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('lab.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (r of requisitions(); track r.id) {
                <tr class="border-b border-border align-top last:border-b-0">
                  <td class="px-4 py-3"><app-status-tag [text]="priority(r).label" [tone]="priority(r).tone" /></td>
                  <td class="px-4 py-3 font-mono text-xs">{{ r.number }}<span class="block font-sans text-muted-foreground">{{ i18n.t('lab.source.' + r.source) }}</span></td>
                  <td class="px-4 py-3">
                    @if (r.patient; as p) {
                      <span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span>
                      <span class="block font-mono text-xs text-muted-foreground">{{ p.number }}</span>
                    }
                  </td>
                  <td class="px-4 py-3"><span class="font-mono text-xs">{{ r.testCodes.join(', ') }}</span></td>
                  <td class="px-4 py-3 whitespace-nowrap">{{ when(r.orderedAt) }}<span class="block text-xs text-muted-foreground">{{ elapsed(r) }}</span></td>
                  <td class="px-4 py-3"><app-status-tag [text]="status(r).label" [tone]="status(r).tone" /></td>
                  <td class="px-4 py-3 text-right">
                    <a [routerLink]="['/lab/requisitions', r.id]" [class]="link" [attr.aria-label]="i18n.t('lab.worklist.openOf', { number: r.number })">{{ i18n.t('lab.worklist.open') }}</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('lab.worklist.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('lab.worklist.pagination')">
            <p class="text-muted-foreground">{{ i18n.t('lab.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
            <div class="flex gap-4">
              <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('lab.previous') }}</button>
              <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('lab.next') }}</button>
            </div>
          </nav>
        }
      }
    </div>
  `,
})
export class WorklistPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(LabGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly user = inject(SessionStore).user;
  private readonly scanner = viewChild<FormBuilderComponent>('scan');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = worklistFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly requisitions = signal<readonly RequisitionSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly scanning = signal(false);
  private readonly scanNotice = signal<string | null>(null);
  private filter: RequisitionFilter = {};

  /** Le laboratoire (qui voit toutes les demandes et peut prélever ou recevoir) a le champ de scan. */
  protected readonly bench = computed(() => hasPermission(this.user()?.permissions ?? [], 'lab.requisitions:read:all'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly scanForm = computed(() => scanFields({ notice: this.scanNotice() }));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const text = (name: string) => String(value[name] ?? '').trim();
    this.filter = {
      ...(text('status') ? { status: text('status') as RequisitionStatus } : {}),
      ...(text('priority') ? { priority: text('priority') as Priority } : {}),
      ...(text('section') ? { section: text('section') as Section } : {}),
      ...(text('number') ? { number: text('number') } : {}),
    };
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.requisitions().length === 0);
    try {
      const page = await this.gateway.listRequisitions(this.filter, this.offset(), PAGE_SIZE);
      this.requisitions.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  /** Scan : la demande qui porte l'échantillon s'ouvre, l'échantillon scanné en évidence. */
  protected async find(value: Record<string, unknown>): Promise<void> {
    this.scanNotice.set(null);
    this.scanning.set(true);
    try {
      const found = await this.gateway.findByBarcode(String(value['barcode']).trim());
      await this.router.navigate(['/lab/requisitions', found.id], { queryParams: { specimen: found.specimenId } });
    } catch (error) {
      this.scanNotice.set(failureMessage(error, this.i18n, this.scanner()));
    } finally {
      this.scanning.set(false);
    }
  }

  protected priority(r: RequisitionSummary) {
    return priorityTag(this.i18n, r.priority);
  }

  protected status(r: RequisitionSummary) {
    return requisitionTag(this.i18n, r.status);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  /** Temps écoulé depuis la demande (une demande terminée n'en a plus besoin). */
  protected elapsed(r: RequisitionSummary): string {
    if (r.status === 'RECEIVED' || r.status === 'CANCELLED') return '';
    const minutes = Math.max(0, Math.floor((this.clock.nowMs() - Date.parse(r.orderedAt)) / 60_000));
    return this.i18n.t('lab.worklist.elapsed', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  }
}

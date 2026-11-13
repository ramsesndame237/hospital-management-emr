import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import { Modality, OrderFilter, OrderStatus, OrderSummary, Priority } from '../../../core/imaging/imaging.models';
import { Clock } from '../../../core/time/clock';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { orderTag, priorityTag } from '../imaging-status';
import { worklistFilterFields } from '../imaging.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Liste de travail de l'imagerie : les demandes d'examens, les plus urgentes en tête (STAT, urgent, routine), avec leur avancement, le créneau prévu et le
 * temps écoulé depuis la demande. Le service d'imagerie voit toutes les demandes, un prescripteur les siennes.
 */
@Component({
  selector: 'app-imaging-worklist-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('imaging.worklist.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t(service() ? 'imaging.worklist.lead' : 'imaging.worklist.leadOwn') }}</p>
      </header>

      <app-form-builder [fields]="filterFields" formId="imaging-worklist-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="imaging-worklist-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('imaging.worklist.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.priority') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.patient') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.exam') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.ordered') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.status') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('imaging.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (o of orders(); track o.id) {
                <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="o.number">
                  <td class="px-4 py-3"><app-status-tag [text]="priority(o).label" [tone]="priority(o).tone" /></td>
                  <td class="px-4 py-3 font-mono text-xs">{{ o.number }}<span class="block font-sans text-muted-foreground">{{ i18n.t('imaging.source.' + o.source) }}</span></td>
                  <td class="px-4 py-3">
                    @if (o.patient; as p) {
                      <span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span>
                      <span class="block font-mono text-xs text-muted-foreground">{{ p.number }}</span>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <span class="font-medium">{{ o.examName }}</span>
                    <span class="block text-xs text-muted-foreground"><span class="font-mono">{{ o.examCode }}</span> · {{ i18n.t('imaging.modality.' + o.modality) }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    {{ when(o.orderedAt) }}
                    @if (o.scheduledFor && o.status === 'SCHEDULED') {
                      <span class="block text-xs text-muted-foreground">{{ i18n.t('imaging.worklist.scheduledFor', { when: when(o.scheduledFor) }) }}</span>
                    } @else if (elapsed(o); as e) {
                      <span class="block text-xs text-muted-foreground">{{ e }}</span>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <app-status-tag [text]="status(o).label" [tone]="status(o).tone" />
                    @if (o.critical) { <app-status-tag class="mt-1 block" tone="critical" [text]="i18n.t('imaging.worklist.critical')" /> }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <a [routerLink]="['/imaging/orders', o.id]" [class]="link" [attr.aria-label]="i18n.t('imaging.worklist.openOf', { number: o.number })">{{ i18n.t('imaging.worklist.open') }}</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('imaging.worklist.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('imaging.worklist.pagination')">
            <p class="text-muted-foreground">{{ i18n.t('imaging.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
            <div class="flex gap-4">
              <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('imaging.previous') }}</button>
              <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('imaging.next') }}</button>
            </div>
          </nav>
        }
      }
    </div>
  `,
})
export class ImagingWorklistPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ImagingGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly clock = inject(Clock);
  private readonly user = inject(SessionStore).user;

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = worklistFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly orders = signal<readonly OrderSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  private filter: OrderFilter = {};

  /** Le service d'imagerie voit toutes les demandes ; un prescripteur, les siennes. */
  protected readonly service = computed(() => hasPermission(this.user()?.permissions ?? [], 'imaging.orders:read:all'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const text = (name: string) => String(value[name] ?? '').trim();
    this.filter = {
      ...(text('status') ? { status: text('status') as OrderStatus } : {}),
      ...(text('priority') ? { priority: text('priority') as Priority } : {}),
      ...(text('modality') ? { modality: text('modality') as Modality } : {}),
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
    this.loading.set(this.orders().length === 0);
    try {
      const page = await this.gateway.listOrders(this.filter, this.offset(), PAGE_SIZE);
      this.orders.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected priority(o: OrderSummary) {
    return priorityTag(this.i18n, o.priority);
  }

  protected status(o: OrderSummary) {
    return orderTag(this.i18n, o.status);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  /** Temps écoulé depuis la demande (une demande terminée ou planifiée n'en a plus besoin). */
  protected elapsed(o: OrderSummary): string {
    if (o.status !== 'ORDERED' && o.status !== 'PERFORMED') return '';
    const minutes = Math.max(0, Math.floor((this.clock.nowMs() - Date.parse(o.orderedAt)) / 60_000));
    return this.i18n.t('imaging.worklist.elapsed', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Translator } from '../../../core/i18n/translator';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { RequisitionSummary } from '../../../core/lab/lab.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { priorityTag } from '../lab-status';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Résultats : les analyses que le médecin a prescrites et dont les résultats sont PUBLIÉS (validés par le laboratoire), les plus récentes d'abord. Le rapport
 * s'ouvre d'un clic ; une valeur critique y est signalée. Les demandes encore en cours restent dans la liste de travail du laboratoire.
 */
@Component({
  selector: 'app-results-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('lab.results.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('lab.results.lead') }}</p>
        </div>
        <a routerLink="/lab/worklist" [class]="link" class="text-sm">{{ i18n.t('lab.results.pending') }}</a>
      </header>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="results-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('lab.results.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.patient') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.tests') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.worklist.ordered') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('lab.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (r of items(); track r.id) {
                <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="r.number">
                  <td class="px-4 py-3 font-mono text-xs">{{ r.number }}@if (r.priority !== 'ROUTINE') { <span class="mt-1 block"><app-status-tag [text]="priority(r).label" [tone]="priority(r).tone" /></span> }</td>
                  <td class="px-4 py-3">@if (r.patient; as p) { <span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span><span class="block font-mono text-xs text-muted-foreground">{{ p.number }}</span> }</td>
                  <td class="px-4 py-3"><span class="font-mono text-xs">{{ r.testCodes.join(', ') }}</span></td>
                  <td class="px-4 py-3 whitespace-nowrap">{{ when(r.orderedAt) }}</td>
                  <td class="px-4 py-3 text-right"><a [routerLink]="['/lab/requisitions', r.id, 'report']" [class]="link" [attr.aria-label]="i18n.t('lab.results.openOf', { number: r.number })">{{ i18n.t('lab.results.open') }}</a></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('lab.results.empty') }}</td></tr>
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
export class ResultsPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(LabGateway);
  private readonly dates = inject(DateTimeFormatter);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<readonly RequisitionSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);

  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  constructor() {
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const page = await this.gateway.listRequisitions({ status: 'RELEASED' }, this.offset(), PAGE_SIZE);
      this.items.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected priority(r: RequisitionSummary) {
    return priorityTag(this.i18n, r.priority);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}

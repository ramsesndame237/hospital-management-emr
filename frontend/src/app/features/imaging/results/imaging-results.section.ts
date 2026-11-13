import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Translator } from '../../../core/i18n/translator';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import { OrderSummary } from '../../../core/imaging/imaging.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage } from '../../../shared/failure-message';
import { StatusTag } from '../../../shared/status-tag';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Comptes rendus d'imagerie signés des examens que le médecin a demandés, les plus récents d'abord. Un examen dont le compte rendu n'est pas signé reste dans
 * la liste de travail de l'imagerie ; une découverte critique est signalée.
 */
@Component({
  selector: 'app-imaging-results-section',
  imports: [RouterLink, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="imaging-results-title">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h2 id="imaging-results-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('imaging.results.title') }}</h2>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('imaging.results.lead') }}</p>
        </div>
        <a routerLink="/imaging/worklist" [class]="link" class="text-sm">{{ i18n.t('imaging.results.pending') }}</a>
      </div>

      @if (error()) {
        <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('imaging.results.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.patient') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.exam') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.worklist.ordered') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('imaging.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (o of items(); track o.id) {
                <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="o.number">
                  <td class="px-4 py-3 font-mono text-xs">{{ o.number }}@if (o.critical) { <span class="mt-1 block"><app-status-tag tone="critical" [text]="i18n.t('imaging.worklist.critical')" /></span> }</td>
                  <td class="px-4 py-3">@if (o.patient; as p) { <span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span><span class="block font-mono text-xs text-muted-foreground">{{ p.number }}</span> }</td>
                  <td class="px-4 py-3">{{ o.examName }}<span class="block font-mono text-xs text-muted-foreground">{{ o.examCode }}</span></td>
                  <td class="px-4 py-3 whitespace-nowrap">{{ when(o.orderedAt) }}</td>
                  <td class="px-4 py-3 text-right"><a [routerLink]="['/imaging/orders', o.id]" [class]="link" [attr.aria-label]="i18n.t('imaging.results.openOf', { number: o.number })">{{ i18n.t('imaging.results.open') }}</a></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('imaging.results.empty') }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class ImagingResultsSection implements OnInit {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ImagingGateway);
  private readonly dates = inject(DateTimeFormatter);

  protected readonly link = LINK;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<readonly OrderSummary[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.items.set((await this.gateway.listOrders({ status: 'REPORTED' }, 0, 25)).items);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}

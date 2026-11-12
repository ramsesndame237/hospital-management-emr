import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { QueueRow } from '../../../core/pharmacy/pharmacy.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Ordonnances à délivrer : celles que les médecins ont émises et que la pharmacie n'a pas (entièrement) servies, les plus anciennes d'abord,
 * tous services confondus. Une allergie connue que le médecin n'a pas levée est signalée avant même d'ouvrir l'ordonnance.
 */
@Component({
  selector: 'app-dispensing-queue-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.dispensing.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.dispensing.lead') }}</p>
        </div>
        <button type="button" [class]="link" (click)="refresh()">{{ i18n.t('pharmacy.dispensing.refresh') }}</button>
      </header>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="dispensing-queue-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('pharmacy.dispensing.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.dispensing.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.dispensing.patient') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.dispensing.issued') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.dispensing.remaining') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.dispensing.state') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.dispensing.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.id) {
                <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="r.number">
                  <td class="px-4 py-3 font-mono text-xs">{{ r.number }}</td>
                  <td class="px-4 py-3">@if (r.patient; as p) { <span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span><span class="block font-mono text-xs text-muted-foreground">{{ p.number }}</span> }</td>
                  <td class="px-4 py-3 whitespace-nowrap">{{ when(r.issuedAt) }}</td>
                  <td class="px-4 py-3 text-right font-mono">{{ i18n.t('pharmacy.dispensing.units', { n: r.remainingUnits, lines: r.lines }) }}</td>
                  <td class="px-4 py-3">
                    <app-status-tag [tone]="r.dispensing === 'PARTIAL' ? 'warning' : 'neutral'" [text]="i18n.t('pharmacy.dispensing.states.' + r.dispensing)" />
                    @if (r.allergyWarning) { <app-status-tag tone="critical" [text]="i18n.t('pharmacy.dispensing.allergyTag')" /> }
                  </td>
                  <td class="px-4 py-3 text-right"><a [routerLink]="['/pharmacy/prescriptions', r.id]" [class]="link" [attr.aria-label]="i18n.t('pharmacy.dispensing.openOf', { number: r.number })">{{ i18n.t('pharmacy.dispensing.open') }}</a></td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.dispensing.none') }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class DispensingQueuePage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly dates = inject(DateTimeFormatter);

  protected readonly link = LINK;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<readonly QueueRow[]>([]);
  protected readonly failure = computed(() => failureNotice(this.error()));

  constructor() {
    void this.load();
  }

  protected refresh(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.rows.set(await this.gateway.getDispensingQueue());
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

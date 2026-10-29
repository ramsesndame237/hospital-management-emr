import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { Receipt } from '../../../core/pharmacy/pharmacy.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/** Une réception de marchandises : le fournisseur, le bon de livraison, et chaque ligne (médicament, lot, péremption, quantité, coût). */
@Component({
  selector: 'app-receipt-page',
  imports: [RouterLink, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/pharmacy/receipts" [class]="link" class="w-fit text-sm">← {{ i18n.t('pharmacy.receipts.back') }}</a>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="receipt-error" />
      }

      @if (receipt(); as r) {
        <header class="flex flex-col">
          <h1 class="font-mono text-[28px] leading-9 font-semibold text-foreground">{{ r.number }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">
            {{ i18n.t('pharmacy.receipts.summary', { supplier: r.supplier, when: when(r.receivedAt), who: r.receivedBy?.username ?? '' }) }}
          </p>
          @if (r.deliveryNote) {
            <p class="text-sm text-muted-foreground">{{ i18n.t('pharmacy.receipts.deliveryNoteOf', { note: r.deliveryNote }) }}</p>
          }
          @if (r.notes) {
            <p class="text-sm text-muted-foreground">{{ r.notes }}</p>
          }
        </header>

        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('pharmacy.receipts.linesTitle') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.drug') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.batch') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.expiry') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.drug.quantity') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.drug.unitCost') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.receipts.value') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (l of r.lines; track l.batchId) {
                <tr class="border-b border-border align-top last:border-b-0">
                  <td class="px-4 py-3">
                    @if (l.drug; as d) {
                      <a [routerLink]="['/pharmacy/drugs', d.id]" [class]="link">{{ d.name }}</a>
                      <span class="block text-xs text-muted-foreground">{{ d.genericName }}@if (d.strength) { · {{ d.strength }}}</span>
                    }
                  </td>
                  <td class="px-4 py-3 font-mono text-xs">{{ l.batchNumber }}</td>
                  <td class="px-4 py-3 font-mono text-xs whitespace-nowrap">{{ l.expiry }}</td>
                  <td class="px-4 py-3 text-right font-mono">{{ l.quantity }}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(l.unitCost, r.currency) }}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(l.value, r.currency) }}</td>
                </tr>
              }
            </tbody>
            <tfoot class="border-t border-border bg-muted text-sm font-semibold">
              <tr>
                <th scope="row" colspan="3" class="px-4 py-2 text-left">{{ i18n.t('pharmacy.receipts.total') }}</th>
                <td class="px-4 py-2 text-right font-mono">{{ r.units }}</td>
                <td></td>
                <td class="px-4 py-2 text-right whitespace-nowrap">{{ money(r.value, r.currency) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      } @else if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
})
export class ReceiptPage implements OnInit {
  readonly id = input.required<string>();

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);

  protected readonly link = LINK;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly receipt = signal<Receipt | null>(null);
  protected readonly failure = computed(() => failureNotice(this.error()));

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.receipt.set(await this.gateway.getReceipt(this.id()));
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  protected money(amount: number, currency: string): string {
    return this.formatter.format(amount, currency, minorDigitsOf(currency));
  }
}

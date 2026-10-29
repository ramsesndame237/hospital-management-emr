import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MoneyFormatter, minorDigitsOf, toMinorUnits } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { Drug, ReceiptLineInput } from '../../../core/pharmacy/pharmacy.models';
import { failureMessage } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { ToastService } from '../../../shared/toast/toast.service';
import { drugSearchFields, receiptHeaderFields } from '../pharmacy.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const CELL = 'h-9 w-full min-w-24 border border-input bg-background px-2 font-mono text-sm rounded-[2px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
const FIELDS = ['batchNumber', 'expiry', 'quantity', 'unitCost'] as const;

/** Une ligne en cours de saisie : tout est du texte tant que la réception n'est pas enregistrée. */
interface Line {
  readonly drug: Drug;
  batchNumber: string;
  expiry: string;
  quantity: string;
  unitCost: string;
}

/**
 * Réception de marchandises : on cherche chaque médicament livré, puis on saisit son lot (numéro du fabricant), sa péremption, la quantité et le
 * coût d'achat. Tout est enregistré ou rien : un lot déjà périmé, ou une péremption qui contredit un lot déjà en stock, fait tout refuser.
 */
@Component({
  selector: 'app-new-receipt-page',
  imports: [RouterLink, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.receipt.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.receipt.lead') }}</p>
      </header>

      <section class="flex flex-col gap-3 border border-border bg-card p-4" aria-labelledby="receipt-search-title">
        <h2 id="receipt-search-title" class="text-sm leading-6 font-semibold text-foreground">{{ i18n.t('pharmacy.receipt.searchTitle') }}</h2>
        <app-form-builder [fields]="searchFields" [busy]="searching()" formId="receipt-search" (submitted)="search($event)" />
        @if (searched()) {
          <ul class="flex flex-col divide-y divide-border border border-border" [attr.aria-label]="i18n.t('pharmacy.receipt.results')">
            @for (d of results(); track d.id) {
              <li class="flex items-center justify-between gap-4 px-3 py-2 text-sm" [attr.data-test]="d.code">
                <span><span class="font-medium">{{ d.name }}</span> <span class="text-muted-foreground">{{ d.genericName }}@if (d.strength) { · {{ d.strength }}} · {{ d.code }}</span></span>
                <button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.receipt.addOf', { name: d.name })" (click)="add(d)">{{ i18n.t('pharmacy.receipt.add') }}</button>
              </li>
            } @empty {
              <li class="px-3 py-3 text-sm text-muted-foreground">{{ i18n.t('pharmacy.receipt.noResult') }}</li>
            }
          </ul>
        }
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="receipt-lines-title">
        <h2 id="receipt-lines-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('pharmacy.receipt.linesTitle') }}</h2>
        @if (lines().length === 0) {
          <p class="text-sm text-muted-foreground">{{ i18n.t('pharmacy.receipt.noLines') }}</p>
        } @else {
          <div class="overflow-x-auto border border-border bg-card">
            <table class="w-full text-left text-sm leading-6">
              <caption class="sr-only">{{ i18n.t('pharmacy.receipt.linesTitle') }}</caption>
              <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                <tr>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.drug') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.batch') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.expiry') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.quantity') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.receipt.unitCostIn', { currency: currency() }) }}</th>
                  <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (line of lines(); track $index; let i = $index) {
                  <tr class="border-b border-border align-top last:border-b-0">
                    <td class="px-4 py-3"><span class="font-medium">{{ line.drug.name }}</span><span class="block text-xs text-muted-foreground">{{ line.drug.genericName }} · {{ line.drug.unit }}</span></td>
                    <td class="px-4 py-3"><input [class]="cell" [id]="'line-' + i + '-batchNumber'" type="text" [attr.aria-label]="i18n.t('pharmacy.receipt.batchOf', { n: i + 1 })" [value]="line.batchNumber" (input)="set(i, 'batchNumber', $any($event.target).value)" /></td>
                    <td class="px-4 py-3"><input [class]="cell" [id]="'line-' + i + '-expiry'" type="date" [attr.aria-label]="i18n.t('pharmacy.receipt.expiryOf', { n: i + 1 })" [value]="line.expiry" (input)="set(i, 'expiry', $any($event.target).value)" /></td>
                    <td class="px-4 py-3"><input [class]="cell" [id]="'line-' + i + '-quantity'" type="text" inputmode="numeric" [attr.aria-label]="i18n.t('pharmacy.receipt.quantityOf', { n: i + 1 })" [value]="line.quantity" (input)="set(i, 'quantity', $any($event.target).value)" /></td>
                    <td class="px-4 py-3"><input [class]="cell" [id]="'line-' + i + '-unitCost'" type="text" inputmode="decimal" [attr.aria-label]="i18n.t('pharmacy.receipt.costOf', { n: i + 1 })" [value]="line.unitCost" (input)="set(i, 'unitCost', $any($event.target).value)" /></td>
                    <td class="px-4 py-3 text-right"><button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.receipt.removeOf', { n: i + 1 })" (click)="remove(i)">{{ i18n.t('pharmacy.receipt.remove') }}</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (lineError()) {
          <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ lineError() }}</p>
        }
      </section>

      <section class="flex max-w-3xl flex-col gap-3 border border-border bg-card p-6" aria-labelledby="receipt-header-title">
        <h2 id="receipt-header-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('pharmacy.receipt.headerTitle') }}</h2>
        <app-form-builder #header [fields]="headerFields()" [busy]="busy()" formId="receipt-header" (submitted)="submit($event)" />
        <a routerLink="/pharmacy/receipts" [class]="link" class="w-fit text-sm">{{ i18n.t('pharmacy.receipts.back') }}</a>
      </section>
    </div>
  `,
})
export class NewReceiptPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly formatter = inject(MoneyFormatter);
  private readonly header = viewChild<FormBuilderComponent>('header');

  protected readonly link = LINK;
  protected readonly cell = CELL;
  protected readonly searchFields = drugSearchFields();
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly results = signal<readonly Drug[]>([]);
  protected readonly lines = signal<readonly Line[]>([]);
  protected readonly lineError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly currency = signal('XAF');
  private readonly notice = signal<string | null>(null);

  protected readonly headerFields = computed(() => receiptHeaderFields({ notice: this.notice() }));

  protected async search(value: Record<string, unknown>): Promise<void> {
    this.searching.set(true);
    try {
      const page = await this.gateway.listDrugs({ search: String(value['q'] ?? '').trim() || undefined }, 0, 10);
      this.results.set(page.items);
      this.currency.set(page.currency);
      this.searched.set(true);
    } catch (error) {
      this.lineError.set(failureMessage(error, this.i18n));
    } finally {
      this.searching.set(false);
    }
  }

  protected add(drug: Drug): void {
    this.lineError.set(null);
    this.lines.update((lines) => [...lines, { drug, batchNumber: '', expiry: '', quantity: '', unitCost: '' }]);
  }

  protected remove(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
  }

  protected set(index: number, field: (typeof FIELDS)[number], value: string): void {
    this.lines.update((lines) => lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  /** Contrôle des lignes avant l'envoi : le premier défaut est dit avec le numéro de ligne ; l'API refait les mêmes contrôles. */
  private parse(): ReceiptLineInput[] | null {
    const digits = minorDigitsOf(this.currency());
    const out: ReceiptLineInput[] = [];
    if (this.lines().length === 0) {
      this.lineError.set(this.i18n.t('pharmacy.receipt.noLines'));
      return null;
    }
    for (const [i, l] of this.lines().entries()) {
      const n = i + 1;
      const batchNumber = l.batchNumber.trim();
      const quantity = Number(l.quantity.trim());
      const cost = l.unitCost.trim() === '' ? 0 : toMinorUnits(l.unitCost, digits);
      if (batchNumber === '') return this.fail('pharmacy.receipt.batchRequired', n);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(l.expiry.trim())) return this.fail('pharmacy.receipt.expiryRequired', n);
      if (!/^\d+$/.test(l.quantity.trim()) || quantity < 1 || quantity > 1_000_000) return this.fail('pharmacy.receipt.quantityInvalid', n);
      if (cost === null) return this.fail('pharmacy.receipt.costInvalid', n);
      out.push({ drugId: l.drug.id, batchNumber, expiry: l.expiry.trim(), quantity, unitCost: cost });
    }
    this.lineError.set(null);
    return out;
  }

  private fail(key: string, n: number): null {
    this.lineError.set(this.i18n.t(key, { n }));
    return null;
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const lines = this.parse();
    if (!lines) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      const deliveryNote = String(value['deliveryNote'] ?? '').trim();
      const notes = String(value['notes'] ?? '').trim();
      const posted = await this.gateway.postReceipt({ supplier: String(value['supplier']).trim(), ...(deliveryNote ? { deliveryNote } : {}), ...(notes ? { notes } : {}), lines });
      this.toast.show(this.i18n.t('pharmacy.receipt.done', { number: posted.number, total: this.formatter.format(posted.value, posted.currency, minorDigitsOf(posted.currency)) }));
      await this.router.navigate(['/pharmacy/receipts', posted.id]);
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.header()));
    } finally {
      this.busy.set(false);
    }
  }
}

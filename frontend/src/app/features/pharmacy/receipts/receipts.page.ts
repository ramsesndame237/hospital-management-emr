import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { ReceiptFilter, ReceiptSummary } from '../../../core/pharmacy/pharmacy.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { receiptFilterFields } from '../pharmacy.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/** Réceptions de marchandises : les livraisons enregistrées, de la plus récente à la plus ancienne, avec leur valeur au coût d'achat. */
@Component({
  selector: 'app-receipts-page',
  imports: [RouterLink, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.receipts.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.receipts.lead') }}</p>
        </div>
        @if (canReceive()) {
          <a routerLink="/pharmacy/receipts/new" class="inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground">{{ i18n.t('pharmacy.stock.newReceipt') }}</a>
        }
      </header>

      <app-form-builder [fields]="filterFields" formId="pharmacy-receipts-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="pharmacy-receipts-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('pharmacy.receipts.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.receipts.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.receipt.supplier') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.receipts.when') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.receipts.lines') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.receipts.units') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.receipts.value') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.id) {
                <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="r.number">
                  <td class="px-4 py-3 font-mono text-xs">{{ r.number }}@if (r.deliveryNote) { <span class="block font-sans text-muted-foreground">{{ r.deliveryNote }}</span>}</td>
                  <td class="px-4 py-3">{{ r.supplier }}</td>
                  <td class="px-4 py-3 whitespace-nowrap">{{ when(r.receivedAt) }}<span class="block text-xs text-muted-foreground">{{ r.receivedBy?.username ?? '' }}</span></td>
                  <td class="px-4 py-3 text-right font-mono">{{ r.lines }}</td>
                  <td class="px-4 py-3 text-right font-mono">{{ r.units }}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(r.value) }}</td>
                  <td class="px-4 py-3 text-right">
                    <a [routerLink]="['/pharmacy/receipts', r.id]" [class]="link" [attr.aria-label]="i18n.t('pharmacy.receipts.openOf', { number: r.number })">{{ i18n.t('pharmacy.stock.open') }}</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.receipts.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('pharmacy.receipts.pagination')">
            <p class="text-muted-foreground">{{ i18n.t('pharmacy.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
            <div class="flex gap-4">
              <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('pharmacy.previous') }}</button>
              <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('pharmacy.next') }}</button>
            </div>
          </nav>
        }
      }
    </div>
  `,
})
export class ReceiptsPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);
  private readonly user = inject(SessionStore).user;

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = receiptFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<readonly ReceiptSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  private readonly currency = signal('XAF');
  private filter: ReceiptFilter = {};

  protected readonly canReceive = computed(() => hasPermission(this.user()?.permissions ?? [], 'pharmacy.stock:receive'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const supplier = String(value['supplier'] ?? '').trim();
    this.filter = supplier ? { supplier } : {};
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.rows().length === 0);
    try {
      const page = await this.gateway.listReceipts(this.filter, this.offset(), PAGE_SIZE);
      this.rows.set(page.items);
      this.total.set(page.total);
      this.currency.set(page.currency);
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

  protected money(amount: number): string {
    return this.formatter.format(amount, this.currency(), minorDigitsOf(this.currency()));
  }
}

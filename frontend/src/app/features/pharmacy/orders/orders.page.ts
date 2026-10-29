import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { OrderFilter, OrderStatus, OrderSummary } from '../../../core/pharmacy/pharmacy.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { orderTag } from '../pharmacy-status';
import { orderFilterFields } from '../pharmacy.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/** Bons de commande : les commandes aux fournisseurs, celles qui attendent une approbation en tête (les plus anciennes d'abord). */
@Component({
  selector: 'app-orders-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.orders.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.orders.lead') }}</p>
        </div>
        @if (canManage()) {
          <a routerLink="/pharmacy/orders/new" class="inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground">{{ i18n.t('pharmacy.orders.new') }}</a>
        }
      </header>

      <app-form-builder [fields]="filterFields" formId="pharmacy-orders-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="pharmacy-orders-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('pharmacy.orders.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.orders.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.orders.supplier') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.orders.status') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.orders.progress') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.orders.expectedOn') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.receipts.value') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (o of rows(); track o.id) {
                <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="o.number">
                  <td class="px-4 py-3 font-mono text-xs">{{ o.number }}<span class="block font-sans text-muted-foreground">{{ when(o.createdAt) }} · {{ o.createdBy?.username ?? '' }}</span></td>
                  <td class="px-4 py-3">{{ o.supplier.name }}</td>
                  <td class="px-4 py-3"><app-status-tag [text]="tag(o).label" [tone]="tag(o).tone" /></td>
                  <td class="px-4 py-3 text-right font-mono">{{ o.receivedUnits }} / {{ o.units }}</td>
                  <td class="px-4 py-3 font-mono text-xs whitespace-nowrap">{{ o.expectedOn ?? '—' }}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(o.value) }}</td>
                  <td class="px-4 py-3 text-right">
                    <a [routerLink]="['/pharmacy/orders', o.id]" [class]="link" [attr.aria-label]="i18n.t('pharmacy.orders.openOf', { number: o.number })">{{ i18n.t('pharmacy.stock.open') }}</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.orders.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('pharmacy.orders.pagination')">
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
export class OrdersPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);
  private readonly user = inject(SessionStore).user;

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = orderFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<readonly OrderSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  private readonly currency = signal('XAF');
  private filter: OrderFilter = {};

  protected readonly canManage = computed(() => hasPermission(this.user()?.permissions ?? [], 'pharmacy.procurement:manage'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const status = String(value['status'] ?? '');
    this.filter = { ...(status ? { status: status as OrderStatus } : {}), ...(value['mine'] === true ? { mine: true } : {}) };
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
      const page = await this.gateway.listOrders(this.filter, this.offset(), PAGE_SIZE);
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

  protected tag(o: OrderSummary) {
    return orderTag(this.i18n, o.status);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  protected money(amount: number): string {
    return this.formatter.format(amount, this.currency(), minorDigitsOf(this.currency()));
  }
}

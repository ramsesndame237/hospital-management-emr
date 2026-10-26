import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { BillableItem, ItemCategory, ItemFilter } from '../../../core/billing/billing.models';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { catalogFilterFields } from '../billing.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/** Catalogue des tarifs (consultation des prix) : ce que la caisse annonce au patient. Les actes se modifient côté administration. */
@Component({
  selector: 'app-billing-catalog-page',
  imports: [FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.catalog.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.catalog.lead') }}</p>
      </header>

      <app-form-builder [fields]="filterFields" formId="catalog-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="catalog-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('billing.catalog.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.catalog.code') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.catalog.name') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.catalog.category') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.catalog.price') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item.id) {
                <tr class="border-b border-border last:border-b-0">
                  <td class="px-4 py-3 font-mono text-xs">{{ item.code }}</td>
                  <td class="px-4 py-3 font-medium">{{ item.name }}</td>
                  <td class="px-4 py-3">{{ i18n.t('billing.category.' + item.category) }}</td>
                  <td class="px-4 py-3 text-right font-mono">{{ money(item) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('billing.catalog.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('billing.catalog.pagination')">
            <p class="text-muted-foreground">{{ i18n.t('billing.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
            <div class="flex gap-4">
              <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('billing.previous') }}</button>
              <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('billing.next') }}</button>
            </div>
          </nav>
        }
      }
    </div>
  `,
})
export class BillingCatalogPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(BillingGateway);
  private readonly formatter = inject(MoneyFormatter);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = catalogFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<readonly BillableItem[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  private filter: ItemFilter = {};

  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const search = String(value['q'] ?? '');
    const category = String(value['category'] ?? '');
    this.filter = { ...(search ? { search } : {}), ...(category ? { category: category as ItemCategory } : {}) };
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.items().length === 0);
    try {
      const page = await this.gateway.listItems(this.filter, this.offset(), PAGE_SIZE);
      this.items.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected money(item: BillableItem): string {
    return this.formatter.format(item.unitPrice, item.currency, minorDigitsOf(item.currency));
  }
}

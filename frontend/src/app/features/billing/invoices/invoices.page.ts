import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { InvoiceFilter, InvoiceStatus, InvoiceSummary } from '../../../core/billing/billing.models';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { invoiceFilterFields } from '../billing.forms';
import { invoiceTag } from '../invoice-status';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/** Liste des factures : recherche par numéro et statut, solde de chacune, ouverture du détail. */
@Component({
  selector: 'app-invoices-page',
  imports: [RouterLink, HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.invoices.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.invoices.lead') }}</p>
        </div>
        @if (canWrite()) {
          <a hlmBtn routerLink="/billing/invoices/new" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none">{{ i18n.t('billing.invoices.new') }}</a>
        }
      </header>

      <app-form-builder [fields]="filterFields" formId="invoices-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="invoices-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('billing.invoices.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.invoices.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.invoices.patient') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.invoices.status') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.invoices.total') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.invoices.balance') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.invoices.date') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('billing.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (invoice of invoices(); track invoice.id) {
                <tr class="border-b border-border last:border-b-0">
                  <td class="px-4 py-3 font-mono text-xs">{{ invoice.number }}</td>
                  <td class="px-4 py-3">
                    @if (invoice.patient; as p) {
                      <span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span>
                      <span class="block font-mono text-xs text-muted-foreground">{{ p.number }}</span>
                    }
                  </td>
                  <td class="px-4 py-3"><app-status-tag [text]="tag(invoice.status).label" [tone]="tag(invoice.status).tone" /></td>
                  <td class="px-4 py-3 text-right font-mono">{{ money(invoice.total, invoice) }}</td>
                  <td class="px-4 py-3 text-right font-mono" [class.font-semibold]="invoice.balance > 0">{{ money(invoice.balance, invoice) }}</td>
                  <td class="px-4 py-3 whitespace-nowrap">{{ dateOf(invoice) }}</td>
                  <td class="px-4 py-3 text-right">
                    <a [routerLink]="['/billing/invoices', invoice.id]" [class]="link" [attr.aria-label]="i18n.t('billing.invoices.openOf', { number: invoice.number })">{{ i18n.t('billing.invoices.open') }}</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('billing.invoices.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('billing.invoices.pagination')">
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
export class InvoicesPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(BillingGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);
  private readonly user = inject(SessionStore).user;

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = invoiceFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly invoices = signal<readonly InvoiceSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  private filter: InvoiceFilter = {};

  protected readonly canWrite = computed(() => hasPermission(this.user()?.permissions ?? [], 'billing.invoices:write'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const number = String(value['number'] ?? '');
    const status = String(value['status'] ?? '');
    this.filter = { ...(number ? { number } : {}), ...(status ? { status: status as InvoiceStatus } : {}) };
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.invoices().length === 0);
    try {
      const page = await this.gateway.listInvoices(this.filter, this.offset(), PAGE_SIZE);
      this.invoices.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected tag(status: InvoiceStatus) {
    return invoiceTag(this.i18n, status);
  }

  protected money(amount: number, invoice: InvoiceSummary): string {
    return this.formatter.format(amount, invoice.currency, minorDigitsOf(invoice.currency));
  }

  protected dateOf(invoice: InvoiceSummary): string {
    return this.dates.date(Temporal.Instant.from(invoice.createdAt));
  }
}

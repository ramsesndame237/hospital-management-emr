import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { Claim, Payer } from '../../../core/billing/billing.models';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { settleFields } from '../billing.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const SELECT = 'h-11 rounded-[2px] border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

type StateFilter = 'pending' | 'settled' | 'all';

/** Créances d'assureurs : la part des factures émises que les assureurs doivent régler. La comptabilité constate leur règlement, avec la référence du virement ou du bordereau. */
@Component({
  selector: 'app-claims-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.claims.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.claims.lead') }}</p>
      </header>

      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('billing.claims.state') }}</span>
          <select #stateSelect [class]="select" (change)="setState(stateSelect.value)">
            <option value="pending" [selected]="state() === 'pending'">{{ i18n.t('billing.claims.pending') }}</option>
            <option value="settled" [selected]="state() === 'settled'">{{ i18n.t('billing.claims.settled') }}</option>
            <option value="all" [selected]="state() === 'all'">{{ i18n.t('billing.claims.all') }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('billing.claims.payer') }}</span>
          <select #payerSelect [class]="select" (change)="setPayer(payerSelect.value)">
            <option value="">{{ i18n.t('billing.claims.allPayers') }}</option>
            @for (p of payers(); track p.id) {
              <option [value]="p.id" [selected]="p.id === payerId()">{{ p.name }}</option>
            }
          </select>
        </label>
      </div>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="claims-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.claims.sum', { count: total(), amount: money(pageSum()) }) }}</p>
        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-3">
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('billing.claims.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.claims.invoice') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.claims.patient') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.claims.payer') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.claims.amount') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.claims.state') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('billing.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (claim of claims(); track claim.invoiceId) {
                    <tr class="border-b border-border last:border-b-0" [class.bg-muted]="selected()?.invoiceId === claim.invoiceId">
                      <td class="px-4 py-3">
                        <a [routerLink]="['/billing/invoices', claim.invoiceId]" [class]="link" class="font-mono text-xs">{{ claim.invoiceNumber }}</a>
                        <p class="text-xs leading-[18px] text-muted-foreground">{{ when(claim.issuedAt) }}</p>
                      </td>
                      <td class="px-4 py-3">{{ patientName(claim) }}</td>
                      <td class="px-4 py-3">
                        {{ claim.payerName }} <span class="text-muted-foreground">· {{ i18n.t('billing.coverage.percent', { percent: claim.percent }) }}</span>
                        @if (claim.policyNumber) {
                          <p class="font-mono text-xs leading-[18px] text-muted-foreground">{{ claim.policyNumber }}</p>
                        }
                      </td>
                      <td class="px-4 py-3 text-right font-mono">{{ money(claim.amount) }}</td>
                      <td class="px-4 py-3">
                        @if (claim.settledAt) {
                          <app-status-tag [text]="i18n.t('billing.claims.settledOn', { date: when(claim.settledAt) })" tone="success" />
                          <p class="mt-1 font-mono text-xs leading-[18px] text-muted-foreground">{{ claim.settlementReference }}</p>
                        } @else {
                          <app-status-tag [text]="i18n.t('billing.claims.toCollect')" tone="warning" />
                        }
                      </td>
                      <td class="px-4 py-3 text-right">
                        @if (!claim.settledAt) {
                          <button type="button" [class]="link" [attr.aria-label]="i18n.t('billing.claims.settleOf', { number: claim.invoiceNumber })" (click)="open(claim)">{{ i18n.t('billing.claims.settle') }}</button>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('billing.claims.empty') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (total() > pageSize) {
              <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('billing.claims.pagination')">
                <p class="text-muted-foreground">{{ i18n.t('billing.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
                <div class="flex gap-4">
                  <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('billing.previous') }}</button>
                  <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('billing.next') }}</button>
                </div>
              </nav>
            }
          </div>

          @if (selected(); as claim) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="claims-panel-title">
              <h2 id="claims-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('billing.claims.settleOf', { number: claim.invoiceNumber }) }}</h2>
              <p class="text-sm leading-6 text-muted-foreground">{{ claim.payerName }} · {{ money(claim.amount) }}</p>
              <app-form-builder #form [fields]="settleForm()" [busy]="busy()" [formId]="'claims-settle-' + claim.invoiceId" (submitted)="settle($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class ClaimsPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(BillingGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly select = SELECT;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly claims = signal<readonly Claim[]>([]);
  protected readonly payers = signal<readonly Payer[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly state = signal<StateFilter>('pending');
  protected readonly payerId = signal('');
  protected readonly selected = signal<Claim | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);

  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.selected() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));
  protected readonly settleForm = computed(() => settleFields({ notice: this.notice() }));
  /** Total de la page affichée (la devise de l'installation est celle des factures, le franc CFA sans décimales par défaut). */
  protected readonly pageSum = computed(() => this.claims().reduce((sum, c) => sum + c.amount, 0));

  constructor() {
    void this.load(true);
  }

  private async load(initial = false): Promise<void> {
    try {
      if (initial) this.payers.set((await this.gateway.listPayers('', true, 0, 200).catch(() => ({ items: [] as Payer[], total: 0, offset: 0, limit: 0 }))).items);
      const settled = this.state() === 'pending' ? false : this.state() === 'settled' ? true : undefined;
      const page = await this.gateway.listClaims({ ...(this.payerId() ? { payerId: this.payerId() } : {}), ...(settled === undefined ? {} : { settled }) }, this.offset(), PAGE_SIZE);
      this.claims.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected setState(value: string): void {
    this.state.set(value === 'settled' || value === 'all' ? value : 'pending');
    this.offset.set(0);
    this.selected.set(null);
    void this.load();
  }

  protected setPayer(value: string): void {
    this.payerId.set(value);
    this.offset.set(0);
    this.selected.set(null);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    this.selected.set(null);
    void this.load();
  }

  protected money(amount: number): string {
    return this.formatter.format(amount, 'XAF', minorDigitsOf('XAF'));
  }

  protected when(iso: string): string {
    return this.dates.date(Temporal.Instant.from(iso));
  }

  protected patientName(claim: Claim): string {
    return claim.patient ? `${claim.patient.lastName} ${claim.patient.firstName}` : '—';
  }

  protected open(claim: Claim): void {
    this.notice.set(null);
    this.selected.set(claim);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.selected.set(null);
  }

  protected async settle(value: Record<string, unknown>): Promise<void> {
    const claim = this.selected();
    if (!claim) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      await this.gateway.settleClaim(claim.invoiceId, String(value['reference']).trim());
      this.toast.show(this.i18n.t('billing.claims.settledToast', { number: claim.invoiceNumber }));
      this.selected.set(null);
      await this.load();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }
}

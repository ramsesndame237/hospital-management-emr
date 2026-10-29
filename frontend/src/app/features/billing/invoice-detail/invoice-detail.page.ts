import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { CashSessionGateway } from '../../../core/billing/cash-session.gateway';
import { BillableItem, CollectedPayment, Invoice, InvoiceLine, Page, Payment, Receipt, isCancellable, isDraft, isPayable } from '../../../core/billing/billing.models';
import { MoneyFormatter, fromMinorUnits, toMinorUnits } from '../../../core/billing/money';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { collectFields, confirmFields, discountFields, itemSearchFields, reprintFields } from '../billing.forms';
import { invoiceTag } from '../invoice-status';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none';

type Panel =
  | { readonly kind: 'addLine' }
  | { readonly kind: 'discount' }
  | { readonly kind: 'issue' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'collect' }
  | { readonly kind: 'receipt'; readonly collected: CollectedPayment }
  | { readonly kind: 'reprint'; readonly payment: Payment }
  | { readonly kind: 'copy'; readonly receipt: Receipt };

/** Un reçu prêt à afficher : celui qu'on remet à l'encaissement, ou la copie d'une réimpression. */
interface ReceiptView {
  readonly receiptNumber: string;
  readonly invoiceNumber: string;
  readonly patient: string;
  readonly patientNumber: string;
  readonly mode: string;
  readonly amount: string;
  readonly reference: string | null;
  readonly receivedAt: string;
  readonly balance: string;
  readonly change: string | null;
  readonly duplicate: boolean;
}

interface PanelView {
  readonly key: string;
  readonly title: string;
  /** Formulaire du panneau ; `null` pour un reçu (lecture et impression). */
  readonly fields: FieldSchema[] | null;
}

/**
 * Détail d'une facture : lignes, totaux, encaissements, et les actions que son état permet. Un brouillon se prépare (actes, remise)
 * puis s'émet ; une facture émise s'encaisse, en une ou plusieurs fois ; chaque reçu s'imprime, et sa réimpression est une copie
 * tracée avec son motif. L'écran ne calcule jamais de montant : il affiche ceux de l'API (entiers, dans la plus petite unité).
 */
@Component({
  selector: 'app-invoice-detail-page',
  imports: [RouterLink, HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/billing/invoices" [class]="link" class="w-fit text-sm">{{ i18n.t('billing.detail.back') }}</a>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="loadFailure()" formId="invoice-load" />
      } @else if (invoice(); as inv) {
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <h1 class="flex flex-wrap items-center gap-3 text-[28px] leading-9 font-semibold text-foreground">
              <span class="font-mono">{{ inv.number }}</span>
              <app-status-tag [text]="tag().label" [tone]="tag().tone" />
            </h1>
            @if (inv.patient; as p) {
              <p class="text-sm leading-6"><span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span> · <span class="font-mono text-xs text-muted-foreground">{{ p.number }}</span></p>
            }
            @if (inv.issuedAt) {
              <p class="text-xs text-muted-foreground">{{ i18n.t('billing.detail.issuedOn', { date: when(inv.issuedAt) }) }}</p>
            }
          </div>

          <div class="flex flex-wrap gap-3">
            @if (canWrite() && draft()) {
              <button hlmBtn type="button" variant="outline" [class]="primary" (click)="open({ kind: 'addLine' })">{{ i18n.t('billing.detail.addLine') }}</button>
              <button hlmBtn type="button" variant="outline" [class]="primary" (click)="open({ kind: 'discount' })">{{ i18n.t('billing.detail.discount') }}</button>
              <button hlmBtn type="button" [class]="primary" [disabled]="inv.lines.length === 0" (click)="open({ kind: 'issue' })">{{ i18n.t('billing.detail.issue') }}</button>
            }
            @if (canCollect() && payable()) {
              @if (cashOpen() === false) {
                <a hlmBtn routerLink="/billing/session" [class]="primary">{{ i18n.t('billing.detail.openCash') }}</a>
              } @else {
                <button hlmBtn type="button" [class]="primary" (click)="open({ kind: 'collect' })">{{ i18n.t('billing.detail.collect') }}</button>
              }
            }
            @if (canWrite() && cancellable()) {
              <button hlmBtn type="button" variant="outline" [class]="primary" (click)="open({ kind: 'cancel' })">{{ i18n.t('billing.detail.cancel') }}</button>
            }
          </div>
        </header>

        @if (canCollect() && payable() && cashOpen() === false) {
          <p class="border-l-4 border-status-warning bg-card p-3 text-sm leading-6" role="status">{{ i18n.t('billing.detail.noCash') }}</p>
        }

        @if (actionError()) {
          <div class="flex flex-col gap-2">
            <app-form-builder [fields]="actionFailure()" formId="invoice-action-error" />
            @if (conflict()) {
              <button type="button" [class]="link" class="w-fit text-sm" (click)="reload()">{{ i18n.t('billing.detail.reload') }}</button>
            }
          </div>
        }

        @if (inv.status === 'CANCELLED') {
          <app-form-builder [fields]="cancelledNotice()" formId="invoice-cancelled" />
        }

        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-6">
            <section class="border border-border bg-card">
              <h2 class="border-b border-border px-4 py-3 text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('billing.detail.lines') }}</h2>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-sm leading-6">
                  <caption class="sr-only">{{ i18n.t('billing.detail.lines') }}</caption>
                  <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                    <tr>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.detail.item') }}</th>
                      <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.detail.unitPrice') }}</th>
                      <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.detail.quantity') }}</th>
                      <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.detail.lineTotal') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('billing.actions') }}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of inv.lines; track l.id) {
                      <tr class="border-b border-border last:border-b-0">
                        <td class="px-4 py-3"><span class="font-medium">{{ l.itemName }}</span><span class="block font-mono text-xs text-muted-foreground">{{ l.itemCode }}</span></td>
                        <td class="px-4 py-3 text-right font-mono">{{ money(l.unitPrice) }}</td>
                        <td class="px-4 py-3 text-right font-mono">{{ l.quantity }}</td>
                        <td class="px-4 py-3 text-right font-mono">{{ money(l.total) }}</td>
                        <td class="px-4 py-3 text-right">
                          @if (canWrite() && draft()) {
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('billing.detail.removeOf', { name: l.itemName })" (click)="removeLine(l)">{{ i18n.t('billing.detail.remove') }}</button>
                          }
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('billing.detail.noLines') }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <dl class="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm leading-6">
                <div class="flex justify-between gap-4"><dt class="text-muted-foreground">{{ i18n.t('billing.detail.subtotal') }}</dt><dd class="font-mono">{{ money(inv.subtotal) }}</dd></div>
                @if (inv.discount > 0) {
                  <div class="flex justify-between gap-4">
                    <dt class="text-muted-foreground">{{ i18n.t('billing.detail.discountOf', { reason: inv.discountReason ?? '' }) }}</dt>
                    <dd class="font-mono">− {{ money(inv.discount) }}</dd>
                  </div>
                }
                <div class="flex justify-between gap-4 text-base font-semibold"><dt>{{ i18n.t('billing.detail.total') }}</dt><dd class="font-mono">{{ money(inv.total) }}</dd></div>
                <div class="flex justify-between gap-4"><dt class="text-muted-foreground">{{ i18n.t('billing.detail.paid') }}</dt><dd class="font-mono">{{ money(inv.paid) }}</dd></div>
                <div class="flex justify-between gap-4 text-base font-semibold" [class.text-status-warning]="inv.balance > 0 && inv.status !== 'CANCELLED'">
                  <dt>{{ i18n.t('billing.detail.balance') }}</dt><dd class="font-mono">{{ money(inv.status === 'CANCELLED' ? 0 : inv.balance) }}</dd>
                </div>
              </dl>
            </section>

            <section class="border border-border bg-card">
              <h2 class="border-b border-border px-4 py-3 text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('billing.detail.payments') }}</h2>
              @if (inv.payments.length === 0) {
                <p class="px-4 py-6 text-center text-sm text-muted-foreground">{{ i18n.t('billing.detail.noPayments') }}</p>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-sm leading-6">
                    <caption class="sr-only">{{ i18n.t('billing.detail.payments') }}</caption>
                    <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                      <tr>
                        <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.detail.receipt') }}</th>
                        <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.detail.mode') }}</th>
                        <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.detail.amount') }}</th>
                        <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.detail.when') }}</th>
                        <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('billing.actions') }}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of inv.payments; track p.id) {
                        <tr class="border-b border-border last:border-b-0">
                          <td class="px-4 py-3 font-mono text-xs">{{ p.receiptNumber }}</td>
                          <td class="px-4 py-3">{{ i18n.t('billing.mode.' + p.mode) }}@if (p.reference) {<span class="block font-mono text-xs text-muted-foreground">{{ p.reference }}</span>}</td>
                          <td class="px-4 py-3 text-right font-mono">{{ money(p.amount) }}</td>
                          <td class="px-4 py-3 whitespace-nowrap">{{ when(p.receivedAt) }}</td>
                          <td class="px-4 py-3 text-right">
                            @if (canCollect()) {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('billing.detail.reprintOf', { number: p.receiptNumber })" (click)="open({ kind: 'reprint', payment: p })">{{ i18n.t('billing.detail.reprint') }}</button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>
          </div>

          @for (current of panelRows(); track current.key) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="invoice-panel-title">
              <h2 id="invoice-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ current.title }}</h2>

              @if (current.fields) {
                <app-form-builder #form [fields]="current.fields" [busy]="busy()" [formId]="'invoice-' + current.key" (submitted)="submit($event)" (action)="onAction($event)" (valueChange)="onValues($event)" />

                @if (panel()?.kind === 'addLine') {
                  @if (itemsLoading()) {
                    <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
                  } @else if (items(); as found) {
                    <ul class="flex flex-col border border-border">
                      @for (it of found.items; track it.id) {
                        <li class="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0">
                          <span class="min-w-0"><span class="block truncate font-medium">{{ it.name }}</span><span class="block font-mono text-xs text-muted-foreground">{{ it.code }} · {{ money(it.unitPrice) }}</span></span>
                          <button type="button" [class]="link" class="shrink-0" [disabled]="busy()" [attr.aria-label]="i18n.t('billing.lines.addOf', { name: it.name })" (click)="addItem(it)">{{ i18n.t('billing.lines.add') }}</button>
                        </li>
                      } @empty {
                        <li class="px-3 py-4 text-center text-sm text-muted-foreground">{{ i18n.t('billing.lines.none') }}</li>
                      }
                    </ul>
                  }
                }

                @if (panel()?.kind === 'collect' && collectPreview(); as preview) {
                  <p class="text-sm leading-6" [class.text-status-critical]="preview.problem" [class.font-semibold]="!preview.problem" role="status">{{ preview.text }}</p>
                }
              } @else if (receipt(); as r) {
                <article class="print-area flex flex-col gap-3 border border-border p-4 text-sm leading-6">
                  @if (r.duplicate) {
                    <p class="border border-status-warning px-2 py-1 text-center text-xs font-semibold tracking-widest text-status-warning uppercase">{{ i18n.t('billing.receipt.duplicate') }}</p>
                  }
                  <p class="font-mono text-base font-semibold">{{ r.receiptNumber }}</p>
                  <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    <dt class="text-muted-foreground">{{ i18n.t('billing.receipt.invoice') }}</dt><dd class="font-mono">{{ r.invoiceNumber }}</dd>
                    <dt class="text-muted-foreground">{{ i18n.t('billing.receipt.patient') }}</dt><dd>{{ r.patient }} <span class="font-mono text-xs whitespace-nowrap text-muted-foreground">{{ r.patientNumber }}</span></dd>
                    <dt class="text-muted-foreground">{{ i18n.t('billing.receipt.mode') }}</dt><dd>{{ r.mode }}@if (r.reference) { · <span class="font-mono text-xs">{{ r.reference }}</span>}</dd>
                    <dt class="text-muted-foreground">{{ i18n.t('billing.receipt.date') }}</dt><dd>{{ r.receivedAt }}</dd>
                    <dt class="font-semibold">{{ i18n.t('billing.receipt.amount') }}</dt><dd class="font-mono font-semibold">{{ r.amount }}</dd>
                    @if (r.change) {
                      <dt class="text-muted-foreground">{{ i18n.t('billing.receipt.change') }}</dt><dd class="font-mono">{{ r.change }}</dd>
                    }
                    <dt class="text-muted-foreground">{{ i18n.t('billing.receipt.balance') }}</dt><dd class="font-mono">{{ r.balance }}</dd>
                  </dl>
                </article>
                <div class="flex flex-col gap-3">
                  <button hlmBtn type="button" [class]="primary" class="w-full" (click)="print()">{{ i18n.t('billing.receipt.print') }}</button>
                  <button hlmBtn type="button" variant="outline" [class]="primary" class="w-full" (click)="close()">{{ i18n.t('billing.close') }}</button>
                </div>
              }
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class InvoiceDetailPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(BillingGateway);
  private readonly sessions = inject(CashSessionGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  /** Identifiant de la facture, lu dans l'adresse (`/billing/invoices/:id`). */
  readonly id = input.required<string>();

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly conflict = signal(false);
  /** La caisse du caissier est-elle ouverte ? `null` : on ne sait pas (pas le droit d'encaisser, ou lecture en échec). Sans caisse ouverte, on n'encaisse pas. */
  protected readonly cashOpen = signal<boolean | null>(null);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  protected readonly items = signal<Page<BillableItem> | null>(null);
  protected readonly itemsLoading = signal(false);
  private readonly notice = signal<string | null>(null);
  private readonly quantity = signal(1);
  private readonly collectValues = signal<Record<string, unknown>>({});

  protected readonly canWrite = computed(() => hasPermission(this.user()?.permissions ?? [], 'billing.invoices:write'));
  protected readonly canCollect = computed(() => hasPermission(this.user()?.permissions ?? [], 'billing.payments:collect'));
  protected readonly draft = computed(() => !!this.invoice() && isDraft(this.invoice()!));
  protected readonly payable = computed(() => !!this.invoice() && isPayable(this.invoice()!));
  protected readonly cancellable = computed(() => !!this.invoice() && isCancellable(this.invoice()!));
  protected readonly tag = computed(() => invoiceTag(this.i18n, this.invoice()?.status ?? 'DRAFT'));
  protected readonly loadFailure = computed(() => failureNotice(this.loadError()));
  protected readonly actionFailure = computed(() => failureNotice(this.actionError()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));
  protected readonly cancelledNotice = computed<FieldSchema[]>(() => [
    { type: 'message', name: 'cancelled', tone: 'critical', appearance: 'outlined', title: 'billing.detail.cancelledTitle', text: this.invoice()?.cancellationReason ?? '' },
  ]);

  protected readonly panelRows = computed<PanelView[]>(() => {
    const panel = this.panel();
    const inv = this.invoice();
    const notice = this.notice();
    if (!panel || !inv) return [];
    const digits = inv.currencyDigits;
    switch (panel.kind) {
      case 'addLine':
        return [{ key: 'add-line', title: this.i18n.t('billing.lines.title'), fields: itemSearchFields() }];
      case 'discount':
        return [{ key: 'discount', title: this.i18n.t('billing.discount.title'), fields: discountFields({ digits, amount: inv.discount > 0 ? fromMinorUnits(inv.discount, digits) : '', reason: inv.discountReason ?? '', hasDiscount: inv.discount > 0, notice }) }];
      case 'issue':
        return [{ key: 'issue', title: this.i18n.t('billing.issue.title'), fields: confirmFields({ tone: 'warning', title: 'billing.issue.warningTitle', text: 'billing.issue.warningText', submit: 'billing.issue.submit', keep: 'billing.issue.keep', notice }) }];
      case 'cancel':
        return [{ key: 'cancel', title: this.i18n.t('billing.cancelInvoice.title'), fields: confirmFields({ tone: 'critical', title: 'billing.cancelInvoice.warningTitle', text: 'billing.cancelInvoice.warningText', submit: 'billing.cancelInvoice.submit', reasonLabel: 'billing.cancelInvoice.reason', keep: 'billing.cancelInvoice.keep', notice }) }];
      case 'collect':
        return [{ key: 'collect', title: this.i18n.t('billing.collect.title'), fields: collectFields({ digits, balance: fromMinorUnits(inv.balance, digits), notice }) }];
      case 'reprint':
        return [{ key: `reprint-${panel.payment.id}`, title: this.i18n.t('billing.reprint.panelTitle', { number: panel.payment.receiptNumber }), fields: reprintFields({ notice }) }];
      case 'receipt':
      case 'copy':
        return [{ key: panel.kind === 'receipt' ? `receipt-${panel.collected.payment.id}` : `copy-${panel.receipt.receiptNumber}`, title: this.i18n.t(panel.kind === 'receipt' ? 'billing.receipt.title' : 'billing.receipt.copyTitle'), fields: null }];
    }
  });

  protected readonly receipt = computed<ReceiptView | null>(() => {
    const panel = this.panel();
    if (panel?.kind === 'receipt') {
      const inv = panel.collected.invoice;
      return this.receiptView({
        receiptNumber: panel.collected.payment.receiptNumber, invoiceNumber: inv.number, patient: inv.patient, mode: panel.collected.payment.mode, amount: panel.collected.payment.amount,
        currency: inv.currency, digits: inv.currencyDigits, reference: panel.collected.payment.reference, receivedAt: panel.collected.payment.receivedAt, balance: inv.balance, change: panel.collected.change, duplicate: false,
      });
    }
    if (panel?.kind === 'copy') {
      const r = panel.receipt;
      return this.receiptView({
        receiptNumber: r.receiptNumber, invoiceNumber: r.invoiceNumber, patient: r.patient, mode: r.mode, amount: r.amount, currency: r.currency, digits: r.currencyDigits,
        reference: r.reference, receivedAt: r.receivedAt, balance: r.invoiceBalance, change: 0, duplicate: true,
      });
    }
    return null;
  });

  /** Aperçu en direct de l'encaissement : monnaie à rendre, ou raison pour laquelle les montants saisis ne conviennent pas. */
  protected readonly collectPreview = computed<{ text: string; problem: boolean } | null>(() => {
    const inv = this.invoice();
    const values = this.collectValues();
    if (!inv) return null;
    const amount = toMinorUnits(String(values['amount'] ?? ''), inv.currencyDigits);
    if (amount === null || amount === 0) return null;
    if (amount > inv.balance) return { text: this.i18n.t('billing.collect.tooMuch', { balance: this.money(inv.balance) }), problem: true };
    if (values['mode'] !== 'CASH') return { text: this.i18n.t('billing.collect.remaining', { left: this.money(inv.balance - amount) }), problem: false };
    const raw = String(values['tendered'] ?? '').trim();
    if (raw === '') return { text: this.i18n.t('billing.collect.remaining', { left: this.money(inv.balance - amount) }), problem: false };
    const tendered = toMinorUnits(raw, inv.currencyDigits);
    if (tendered === null) return null;
    if (tendered < amount) return { text: this.i18n.t('billing.collect.tenderedLow', { amount: this.money(amount) }), problem: true };
    return { text: this.i18n.t('billing.collect.change', { change: this.money(tendered - amount) }), problem: false };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.panel.set(null);
    try {
      this.invoice.set(await this.gateway.getInvoice(id));
    } catch (error) {
      this.invoice.set(null);
      this.loadError.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
    // La caisse ouverte conditionne l'encaissement : on le sait avant que le caissier n'ouvre le panneau.
    if (this.canCollect()) {
      this.cashOpen.set(await this.sessions.current().then((s) => s !== null, () => null));
    }
  }

  protected reload(): void {
    this.actionError.set(null);
    this.conflict.set(false);
    this.close();
    void this.load(this.id());
  }

  protected money(amount: number): string {
    const inv = this.invoice();
    return inv ? this.formatter.format(amount, inv.currency, inv.currencyDigits) : String(amount);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  private receiptView(r: {
    receiptNumber: string; invoiceNumber: string; patient: Invoice['patient']; mode: string; amount: number; currency: string; digits: number;
    reference: string | null; receivedAt: string; balance: number; change: number; duplicate: boolean;
  }): ReceiptView {
    const fmt = (n: number) => this.formatter.format(n, r.currency, r.digits);
    return {
      receiptNumber: r.receiptNumber, invoiceNumber: r.invoiceNumber, patient: r.patient ? `${r.patient.lastName} ${r.patient.firstName}` : '', patientNumber: r.patient?.number ?? '',
      mode: this.i18n.t(`billing.mode.${r.mode}`), amount: fmt(r.amount), reference: r.reference, receivedAt: this.when(r.receivedAt), balance: fmt(r.balance), change: r.change > 0 ? fmt(r.change) : null, duplicate: r.duplicate,
    };
  }

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.actionError.set(null);
    this.conflict.set(false);
    this.items.set(null);
    this.quantity.set(1);
    this.collectValues.set({});
    this.panel.set(panel);
    if (panel.kind === 'addLine') void this.searchItems('');
  }

  protected close(): void {
    this.panel.set(null);
  }

  protected print(): void {
    this.document.defaultView?.print();
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.close();
    else if (event.action === 'removeDiscount') void this.removeDiscount();
  }

  /** Valeurs du formulaire ouvert : la quantité à ajouter, ou les montants saisis pour l'aperçu de l'encaissement. */
  protected onValues(values: Record<string, unknown>): void {
    const kind = this.panel()?.kind;
    if (kind === 'addLine') {
      const q = Number(values['quantity']);
      this.quantity.set(Number.isInteger(q) && q >= 1 && q <= 9999 ? q : 1);
    } else if (kind === 'collect') {
      this.collectValues.set(values);
    }
  }

  private async searchItems(query: string): Promise<void> {
    this.itemsLoading.set(true);
    try {
      this.items.set(await this.gateway.listItems(query ? { search: query } : {}, 0, 10));
    } catch (error) {
      this.items.set(null);
      this.notice.set(failureMessage(error, this.i18n));
    } finally {
      this.itemsLoading.set(false);
    }
  }

  protected async addItem(item: BillableItem): Promise<void> {
    const inv = this.invoice();
    if (!inv) return;
    await this.act(() => this.gateway.addLine(inv.id, item.id, this.quantity()), (updated) => {
      this.invoice.set(updated);
      this.toast.show(this.i18n.t('billing.lines.added', { name: item.name }));
    }, false);
  }

  protected async removeLine(line: InvoiceLine): Promise<void> {
    const inv = this.invoice();
    if (!inv) return;
    await this.act(() => this.gateway.removeLine(inv.id, line.id), (updated) => this.invoice.set(updated), false);
  }

  private async removeDiscount(): Promise<void> {
    const inv = this.invoice();
    if (!inv) return;
    await this.act(() => this.gateway.setDiscount(inv.id, 0, null), (updated) => {
      this.invoice.set(updated);
      this.toast.show(this.i18n.t('billing.discount.removed'));
    });
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    const inv = this.invoice();
    if (!panel || !inv) return;
    this.notice.set(null);
    const text = (name: string): string => String(value[name] ?? '').trim();
    switch (panel.kind) {
      case 'addLine': {
        this.quantity.set(Number(value['quantity']) || 1);
        await this.searchItems(text('q'));
        return;
      }
      case 'discount': {
        const amount = toMinorUnits(text('amount'), inv.currencyDigits);
        if (amount === null) return this.notice.set(this.i18n.t('billing.amount.invalid'));
        await this.act(() => this.gateway.setDiscount(inv.id, amount, amount === 0 ? null : text('reason')), (updated) => {
          this.invoice.set(updated);
          this.toast.show(this.i18n.t('billing.discount.applied'));
        });
        return;
      }
      case 'issue':
        await this.act(() => this.gateway.issue(inv.id), (updated) => {
          this.invoice.set(updated);
          this.toast.show(this.i18n.t('billing.issue.done', { number: updated.number }));
        });
        return;
      case 'cancel':
        await this.act(() => this.gateway.cancel(inv.id, text('reason')), (updated) => {
          this.invoice.set(updated);
          this.toast.show(this.i18n.t('billing.cancelInvoice.done', { number: updated.number }));
        });
        return;
      case 'collect': {
        const amount = toMinorUnits(text('amount'), inv.currencyDigits);
        if (amount === null || amount <= 0) return this.notice.set(this.i18n.t('billing.amount.invalid'));
        if (amount > inv.balance) return this.notice.set(this.i18n.t('billing.collect.tooMuch', { balance: this.money(inv.balance) }));
        const mode = text('mode') as 'CASH';
        const tenderedRaw = mode === 'CASH' ? text('tendered') : '';
        const tendered = tenderedRaw === '' ? undefined : toMinorUnits(tenderedRaw, inv.currencyDigits);
        if (tendered === null) return this.notice.set(this.i18n.t('billing.amount.invalid'));
        if (tendered !== undefined && tendered < amount) return this.notice.set(this.i18n.t('billing.collect.tenderedLow', { amount: this.money(amount) }));
        const reference = mode === 'CASH' ? '' : text('reference');
        await this.act(() => this.gateway.collect(inv.id, { mode, amount, ...(reference ? { reference } : {}), ...(tendered !== undefined ? { tendered } : {}) }), (collected) => {
          this.invoice.set(collected.invoice);
          this.panel.set({ kind: 'receipt', collected });
        }, true, false);
        return;
      }
      case 'reprint':
        await this.act(() => this.gateway.reprintReceipt(panel.payment.id, text('reason')), (receipt) => this.panel.set({ kind: 'copy', receipt }), true, false);
        return;
      default:
        return;
    }
  }

  /**
   * Exécute une action de l'API : en cas de succès `done` met l'écran à jour (et, par défaut, le panneau se ferme) ; en cas d'échec le
   * message apparaît dans le panneau ouvert (ou en haut de page s'il n'y en a pas). `409 BILLING_INVOICE_CHANGED` propose de recharger.
   */
  private async act<T>(call: () => Promise<T>, done: (result: T) => void, inPanel = true, closePanel = true): Promise<void> {
    this.busy.set(true);
    try {
      done(await call());
      if (closePanel && inPanel) this.close();
    } catch (error) {
      const api: ApiError = toApiError(error);
      this.conflict.set(api.code === 'BILLING_INVOICE_CHANGED');
      if (api.code === 'BILLING_NO_OPEN_SESSION') this.cashOpen.set(false);
      const message = failureMessage(error, this.i18n, inPanel ? this.form() : undefined);
      if (inPanel && this.panel()) this.notice.set(message);
      else this.actionError.set(message);
      if (this.conflict()) this.actionError.set(message);
    } finally {
      this.busy.set(false);
    }
  }
}

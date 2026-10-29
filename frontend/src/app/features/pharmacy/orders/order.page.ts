import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { Order } from '../../../core/pharmacy/pharmacy.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { orderTag } from '../pharmacy-status';
import { orderReasonFields } from '../pharmacy.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const SECONDARY = 'inline-flex min-h-11 items-center rounded-[2px] border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

type Reason = 'reject' | 'cancel' | 'close';

/**
 * Un bon de commande : ses lignes (commandé, reçu, reste à recevoir), son parcours d'approbation et les actions qui conviennent à son statut.
 * Un brouillon se corrige et se soumet ; un bon à approuver est décidé par un AUTRE pharmacien que son auteur (refus motivé : il revient en
 * brouillon) ; un bon approuvé reçoit ses livraisons, se clôt s'il est resté incomplet, ou s'annule tant que rien n'est arrivé.
 */
@Component({
  selector: 'app-order-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/pharmacy/orders" [class]="link" class="w-fit text-sm">← {{ i18n.t('pharmacy.orders.back') }}</a>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="order-error" />
      }

      @if (order(); as o) {
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col">
            <h1 class="font-mono text-[28px] leading-9 font-semibold text-foreground">{{ o.number }}</h1>
            <p class="text-sm leading-6 text-muted-foreground">
              {{ o.supplier?.name ?? '' }} · {{ i18n.t('pharmacy.orders.createdBy', { who: o.createdBy?.username ?? '', when: when(o.createdAt) }) }}
            </p>
            @if (o.expectedOn) {
              <p class="text-sm text-muted-foreground">{{ i18n.t('pharmacy.orders.expectedOnOf', { date: o.expectedOn }) }}</p>
            }
            @if (o.approvedBy) {
              <p class="text-sm text-muted-foreground">{{ i18n.t('pharmacy.orders.approvedBy', { who: o.approvedBy.username, when: when(o.approvedAt ?? o.createdAt) }) }}</p>
            }
            @if (o.notes) {
              <p class="text-sm text-muted-foreground">{{ o.notes }}</p>
            }
          </div>
          <app-status-tag [text]="tag(o).label" [tone]="tag(o).tone" />
        </header>

        @if (o.rejectionReason) {
          <p class="border-l-4 border-status-warning bg-card p-3 text-sm" role="status">{{ i18n.t('pharmacy.orders.rejectedNotice', { reason: o.rejectionReason }) }}</p>
        }
        @if (o.closedReason) {
          <p class="border-l-4 border-border bg-card p-3 text-sm" role="status">{{ i18n.t(o.status === 'CANCELLED' ? 'pharmacy.orders.cancelledNotice' : 'pharmacy.orders.closedNotice', { who: o.closedBy?.username ?? '', reason: o.closedReason }) }}</p>
        }

        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-4">
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('pharmacy.orders.linesTitle') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.drug') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.orders.ordered') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.orders.receivedCol') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.orders.outstanding') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.drug.unitCost') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.receipts.value') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of o.lines; track $index) {
                    <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="l.drug?.code ?? 'unknown'">
                      <td class="px-4 py-3">
                        @if (l.drug; as d) {
                          <a [routerLink]="['/pharmacy/drugs', d.id]" [class]="link">{{ d.name }}</a>
                          <span class="block text-xs text-muted-foreground">{{ d.genericName }}@if (d.strength) { · {{ d.strength }}} · {{ d.unit }}</span>
                        }
                      </td>
                      <td class="px-4 py-3 text-right font-mono">{{ l.quantity }}</td>
                      <td class="px-4 py-3 text-right font-mono">{{ l.received }}</td>
                      <td class="px-4 py-3 text-right font-mono" [class]="l.outstanding > 0 && (o.status === 'APPROVED' || o.status === 'PARTIALLY_RECEIVED') ? 'text-status-warning' : ''">{{ l.outstanding }}</td>
                      <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(l.unitCost, o.currency) }}</td>
                      <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(l.value, o.currency) }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot class="border-t border-border bg-muted text-sm font-semibold">
                  <tr>
                    <th scope="row" class="px-4 py-2 text-left">{{ i18n.t('pharmacy.receipts.total') }}</th>
                    <td class="px-4 py-2 text-right font-mono">{{ o.units }}</td>
                    <td class="px-4 py-2 text-right font-mono">{{ o.receivedUnits }}</td>
                    <td class="px-4 py-2 text-right font-mono">{{ o.units - o.receivedUnits }}</td>
                    <td></td>
                    <td class="px-4 py-2 text-right whitespace-nowrap">{{ money(o.value, o.currency) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              @if (o.status === 'DRAFT' && canManage()) {
                <a [routerLink]="['/pharmacy/orders', o.id, 'edit']" [class]="secondary">{{ i18n.t('pharmacy.orders.edit') }}</a>
                <button type="button" [class]="primary" [disabled]="busy()" (click)="submitForApproval()">{{ i18n.t('pharmacy.orders.submit') }}</button>
              }
              @if (o.status === 'PENDING_APPROVAL' && canApprove()) {
                @if (isAuthor(o)) {
                  <span class="text-sm text-muted-foreground">{{ i18n.t('pharmacy.orders.authorWaiting') }}</span>
                } @else {
                  <button type="button" [class]="primary" [disabled]="busy()" (click)="approve()">{{ i18n.t('pharmacy.orders.approve') }}</button>
                  <button type="button" [class]="secondary" (click)="open('reject')">{{ i18n.t('pharmacy.orders.reject') }}</button>
                }
              }
              @if ((o.status === 'APPROVED' || o.status === 'PARTIALLY_RECEIVED') && canReceive()) {
                <a [routerLink]="['/pharmacy/receipts/new']" [queryParams]="{ order: o.id }" [class]="primary">{{ i18n.t('pharmacy.orders.receive') }}</a>
              }
              @if (o.status === 'PARTIALLY_RECEIVED' && canManage()) {
                <button type="button" [class]="secondary" (click)="open('close')">{{ i18n.t('pharmacy.orders.close') }}</button>
              }
              @if (canCancel(o)) {
                <button type="button" [class]="secondary" (click)="open('cancel')">{{ i18n.t('pharmacy.orders.cancel') }}</button>
              }
            </div>
          </div>

          @if (panel(); as kind) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="order-panel-title">
              <h2 id="order-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('pharmacy.orders.' + kind + 'Title', { number: o.number }) }}</h2>
              <app-form-builder #form [fields]="panelFields()" [busy]="busy()" [formId]="'order-' + kind" (submitted)="submitReason($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      } @else if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
})
export class OrderPage implements OnInit {
  readonly id = input.required<string>();

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly secondary = SECONDARY;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly order = signal<Order | null>(null);
  protected readonly panel = signal<Reason | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);

  private readonly permissions = computed(() => this.user()?.permissions ?? []);
  protected readonly canManage = computed(() => hasPermission(this.permissions(), 'pharmacy.procurement:manage'));
  protected readonly canApprove = computed(() => hasPermission(this.permissions(), 'pharmacy.procurement:approve'));
  protected readonly canReceive = computed(() => hasPermission(this.permissions(), 'pharmacy.stock:receive'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid items-start gap-6'));
  protected readonly panelFields = computed(() => {
    const kind = this.panel();
    return kind ? orderReasonFields({ kind, notice: this.notice() }) : [];
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.order.set(await this.gateway.getOrder(this.id()));
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected isAuthor(o: Order): boolean {
    return !!o.createdBy && o.createdBy.id === this.user()?.id;
  }

  /** On annule tant que rien n'est arrivé : brouillon, à approuver, ou approuvé sans réception. */
  protected canCancel(o: Order): boolean {
    return this.canManage() && (o.status === 'DRAFT' || o.status === 'PENDING_APPROVAL' || o.status === 'APPROVED');
  }

  protected open(kind: Reason): void {
    this.notice.set(null);
    this.panel.set(kind);
  }

  protected close(): void {
    this.panel.set(null);
    this.notice.set(null);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.close();
  }

  private async run(call: () => Promise<Order>, done: (saved: Order) => string, inPanel = false): Promise<void> {
    this.busy.set(true);
    try {
      const saved = await call();
      this.order.set(saved);
      this.error.set(null);
      this.toast.show(done(saved));
      if (inPanel) this.close();
    } catch (error) {
      const message = failureMessage(error, this.i18n, inPanel ? this.form() : undefined);
      if (inPanel) this.notice.set(message);
      else this.error.set(message);
    } finally {
      this.busy.set(false);
    }
  }

  protected submitForApproval(): Promise<void> {
    return this.run(() => this.gateway.submitOrder(this.id()), (o) => this.i18n.t('pharmacy.orders.submitted', { number: o.number }));
  }

  protected approve(): Promise<void> {
    return this.run(() => this.gateway.approveOrder(this.id()), (o) => this.i18n.t('pharmacy.orders.approved', { number: o.number }));
  }

  protected submitReason(value: Record<string, unknown>): Promise<void> {
    const kind = this.panel();
    const reason = String(value['reason'] ?? '').trim();
    if (kind === 'reject') return this.run(() => this.gateway.rejectOrder(this.id(), reason), (o) => this.i18n.t('pharmacy.orders.rejected', { number: o.number }), true);
    if (kind === 'close') return this.run(() => this.gateway.closeOrder(this.id(), reason), (o) => this.i18n.t('pharmacy.orders.closed', { number: o.number }), true);
    return this.run(() => this.gateway.cancelOrder(this.id(), reason), (o) => this.i18n.t('pharmacy.orders.cancelled', { number: o.number }), true);
  }

  protected tag(o: Order) {
    return orderTag(this.i18n, o.status);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  protected money(amount: number, currency: string): string {
    return this.formatter.format(amount, currency, minorDigitsOf(currency));
  }
}

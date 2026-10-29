import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { ApprovalGateway } from '../../../core/billing/approval.gateway';
import { Approval, ApprovalFilter, ApprovalKind, ApprovalStatus, isPending } from '../../../core/billing/approval.models';
import { MoneyFormatter } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { approvalTag } from '../approval-status';
import { approvalFilterFields, decisionFields } from '../billing.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

type Decision = { readonly approve: boolean; readonly approval: Approval };

/**
 * File des approbations. Un responsable (comptabilité, administrateur système) y voit les demandes de tous, celles qui attendent en tête,
 * et les accepte ou les refuse (un refus s'explique) ; il ne décide jamais de sa propre demande. Un caissier y suit les siennes et retire
 * celle qui attend encore. L'écran ne calcule aucun montant : il affiche ceux de l'API.
 */
@Component({
  selector: 'app-approvals-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.approval.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t(canDecide() ? 'billing.approval.lead' : 'billing.approval.leadOwn') }}</p>
      </header>

      <app-form-builder [fields]="filterFields()" formId="approvals-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="approvals-error" />
      }

      <div [class]="layoutClass()">
        <div class="flex min-w-0 flex-col gap-4">
          @if (loading()) {
            <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
          } @else {
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('billing.approval.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.approval.invoice') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.approval.request') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.approval.requestedBy') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.approval.decision') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('billing.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of approvals(); track a.id) {
                    <tr class="border-b border-border align-top last:border-b-0">
                      <td class="px-4 py-3">
                        <a [routerLink]="['/billing/invoices', a.invoice.id]" [class]="link" class="font-mono text-xs" [attr.aria-label]="i18n.t('billing.approval.openOf', { number: a.invoice.number })">{{ a.invoice.number }}</a>
                        @if (a.invoice.patient; as p) {
                          <span class="block">{{ p.lastName }} {{ p.firstName }}</span>
                        }
                      </td>
                      <td class="px-4 py-3">
                        <span class="font-medium">{{ i18n.t('billing.approval.kind.' + a.kind) }}</span>
                        <span class="block">{{ requestText(a) }}</span>
                        <span class="block text-muted-foreground">{{ i18n.t('billing.approval.reasonOf', { reason: a.reason }) }}</span>
                      </td>
                      <td class="px-4 py-3">{{ a.requestedBy?.username }}<span class="block text-xs whitespace-nowrap text-muted-foreground">{{ when(a.requestedAt) }}</span></td>
                      <td class="px-4 py-3">
                        <app-status-tag [text]="tag(a).label" [tone]="tag(a).tone" />
                        @if (a.decidedBy && a.decidedAt; as at) {
                          <span class="mt-1 block text-xs text-muted-foreground">{{ i18n.t('billing.approval.decidedBy', { name: a.decidedBy.username, date: when(at) }) }}</span>
                        }
                        @if (a.decisionComment) {
                          <span class="block">{{ a.decisionComment }}</span>
                        }
                        @if (a.outdated) {
                          <span class="mt-1 block text-xs text-status-warning">{{ i18n.t('billing.approval.outdated') }}</span>
                        }
                      </td>
                      <td class="px-4 py-3 text-right whitespace-nowrap">
                        @if (pending(a)) {
                          @if (canDecide() && !mine(a)) {
                            <button type="button" [class]="link" [disabled]="a.outdated || busy()" [attr.aria-label]="i18n.t('billing.approval.approveOf', { number: a.invoice.number })" (click)="decide(a, true)">{{ i18n.t('billing.approval.approve') }}</button>
                            <button type="button" [class]="link" class="ml-4" [disabled]="busy()" [attr.aria-label]="i18n.t('billing.approval.rejectOf', { number: a.invoice.number })" (click)="decide(a, false)">{{ i18n.t('billing.approval.reject') }}</button>
                          }
                          @if (canRequest() && mine(a)) {
                            <button type="button" [class]="link" [disabled]="busy()" [attr.aria-label]="i18n.t('billing.approval.withdrawOf', { number: a.invoice.number })" (click)="withdraw(a)">{{ i18n.t('billing.approval.withdraw') }}</button>
                          }
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('billing.approval.empty') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (total() > pageSize) {
              <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('billing.approval.pagination')">
                <p class="text-muted-foreground">{{ i18n.t('billing.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
                <div class="flex gap-4">
                  <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('billing.previous') }}</button>
                  <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('billing.next') }}</button>
                </div>
              </nav>
            }
          }
        </div>

        @if (deciding(); as d) {
          <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="decision-title">
            <h2 id="decision-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t(d.approve ? 'billing.approval.approvePanel' : 'billing.approval.rejectPanel') }}</h2>
            <p class="text-sm leading-6">
              <span class="font-mono text-xs">{{ d.approval.invoice.number }}</span> · {{ requestText(d.approval) }}
              <span class="block text-muted-foreground">{{ i18n.t('billing.approval.reasonOf', { reason: d.approval.reason }) }}</span>
            </p>
            <app-form-builder #form [fields]="decisionForm()" [busy]="busy()" formId="approval-decision" (submitted)="submit($event)" (action)="onAction($event)" />
          </aside>
        }
      </div>
    </div>
  `,
})
export class ApprovalsPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ApprovalGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly approvals = signal<readonly Approval[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly busy = signal(false);
  protected readonly deciding = signal<Decision | null>(null);
  private readonly notice = signal<string | null>(null);
  private filter: ApprovalFilter = {};

  protected readonly canDecide = computed(() => hasPermission(this.user()?.permissions ?? [], 'billing.approvals:decide'));
  protected readonly canRequest = computed(() => hasPermission(this.user()?.permissions ?? [], 'billing.approvals:request'));
  /** Un responsable ouvre sur ce qui attend sa décision ; un caissier voit tout ce qu'il a envoyé. */
  protected readonly filterFields = computed(() => approvalFilterFields({ status: this.canDecide() ? 'PENDING' : '' }));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.deciding() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));
  protected readonly decisionForm = computed(() => decisionFields({ approve: this.deciding()?.approve ?? true, notice: this.notice() }));

  constructor() {
    if (this.canDecide()) this.filter = { status: 'PENDING' };
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const status = String(value['status'] ?? '');
    const kind = String(value['kind'] ?? '');
    this.filter = { ...(status ? { status: status as ApprovalStatus } : {}), ...(kind ? { kind: kind as ApprovalKind } : {}) };
    this.offset.set(0);
    this.deciding.set(null);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.approvals().length === 0);
    try {
      const page = await this.gateway.list(this.filter, this.offset(), PAGE_SIZE);
      this.approvals.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected pending(a: Approval): boolean {
    return isPending(a);
  }

  /** La demande est celle de l'utilisateur connecté : il ne la décide pas, il peut la retirer. */
  protected mine(a: Approval): boolean {
    return !!a.requestedBy && a.requestedBy.id === this.user()?.id;
  }

  protected tag(a: Approval) {
    return approvalTag(this.i18n, a.status);
  }

  protected requestText(a: Approval): string {
    const money = (amount: number) => this.formatter.format(amount, a.currency, a.currencyDigits);
    return a.kind === 'DISCOUNT'
      ? this.i18n.t('billing.approval.discountText', { amount: money(a.amount ?? 0), subtotal: money(a.invoice.subtotal) })
      : this.i18n.t('billing.approval.cancelText', { total: money(a.invoice.total) });
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  protected decide(approval: Approval, approve: boolean): void {
    this.notice.set(null);
    this.deciding.set({ approve, approval });
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') {
      this.deciding.set(null);
      this.notice.set(null);
    }
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const d = this.deciding();
    if (!d) return;
    const comment = String(value['comment'] ?? '').trim();
    this.notice.set(null);
    this.busy.set(true);
    try {
      if (d.approve) await this.gateway.approve(d.approval.id, comment === '' ? null : comment);
      else await this.gateway.reject(d.approval.id, comment);
      this.deciding.set(null);
      this.toast.show(this.i18n.t(d.approve ? 'billing.approval.approved' : 'billing.approval.rejected'));
      await this.load();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  protected async withdraw(approval: Approval): Promise<void> {
    this.busy.set(true);
    try {
      await this.gateway.withdraw(approval.id);
      this.toast.show(this.i18n.t('billing.approval.withdrawn'));
      await this.load();
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(false);
    }
  }
}

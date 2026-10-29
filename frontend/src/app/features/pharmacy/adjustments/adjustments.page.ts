import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { Adjustment, AdjustmentFilter, AdjustmentStatus } from '../../../core/pharmacy/pharmacy.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { adjustmentTag } from '../pharmacy-status';
import { adjustmentFilterFields, decisionFields } from '../pharmacy.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

type Panel = { readonly kind: 'approve' | 'reject'; readonly adjustment: Adjustment };

/**
 * Ajustements de stock : les corrections demandées par les pharmaciens (inventaire, casse, perte, péremption). Une demande ne change rien tant
 * qu'un AUTRE pharmacien ne l'a pas approuvée ; son auteur ne peut donc pas la décider. À l'approbation le stock du lot change et le
 * mouvement entre au grand livre ; un refus est motivé.
 */
@Component({
  selector: 'app-adjustments-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.adjustments.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.adjustments.lead') }}</p>
      </header>

      <app-form-builder [fields]="filterFields" formId="pharmacy-adjustments-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="pharmacy-adjustments-error" />
      }

      <div [class]="layoutClass()">
        <div class="flex min-w-0 flex-col gap-4">
          @if (loading()) {
            <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
          } @else {
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('pharmacy.adjustments.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.adjustments.number') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.drug') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.adjustments.change') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.adjustments.reason') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.adjustments.requested') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.adjustments.status') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of rows(); track a.id) {
                    <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="a.number">
                      <td class="px-4 py-3 font-mono text-xs">{{ a.number }}</td>
                      <td class="px-4 py-3">
                        @if (a.drug; as d) {
                          <a [routerLink]="['/pharmacy/drugs', d.id]" [class]="link">{{ d.name }}</a>
                          <span class="block text-xs text-muted-foreground">{{ d.genericName }}@if (a.batch; as b) { · <span class="font-mono">{{ b.batchNumber }}</span>}</span>
                        }
                      </td>
                      <td class="px-4 py-3 text-right font-mono" [class]="a.direction === 'OUT' ? 'text-status-critical' : 'text-status-success'">{{ a.direction === 'OUT' ? '−' : '+' }}{{ a.quantity }}</td>
                      <td class="px-4 py-3">{{ i18n.t('pharmacy.adjustReason.' + a.reason) }}@if (a.note) { <span class="block text-xs text-muted-foreground">{{ a.note }}</span>}</td>
                      <td class="px-4 py-3 whitespace-nowrap">{{ when(a.requestedAt) }}<span class="block text-xs text-muted-foreground">{{ a.requestedBy?.username ?? '' }}</span></td>
                      <td class="px-4 py-3">
                        <app-status-tag [text]="tag(a).label" [tone]="tag(a).tone" />
                        @if (a.decidedBy; as who) {
                          <span class="mt-1 block text-xs text-muted-foreground">{{ i18n.t('pharmacy.adjustments.decidedBy', { who: who.username, when: when(a.decidedAt ?? a.requestedAt) }) }}</span>
                        }
                        @if (a.decisionComment) {
                          <span class="block text-xs text-muted-foreground">{{ a.decisionComment }}</span>
                        }
                      </td>
                      <td class="px-4 py-3 text-right">
                        @if (a.status === 'PENDING' && canDecide()) {
                          @if (isMine(a)) {
                            <span class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.adjustments.mineWaiting') }}</span>
                          } @else {
                            <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.adjustments.approveOf', { number: a.number })" (click)="open({ kind: 'approve', adjustment: a })">{{ i18n.t('pharmacy.adjustments.approve') }}</button>
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.adjustments.rejectOf', { number: a.number })" (click)="open({ kind: 'reject', adjustment: a })">{{ i18n.t('pharmacy.adjustments.reject') }}</button>
                            </div>
                          }
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.adjustments.empty') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (total() > pageSize) {
              <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('pharmacy.adjustments.pagination')">
                <p class="text-muted-foreground">{{ i18n.t('pharmacy.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
                <div class="flex gap-4">
                  <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('pharmacy.previous') }}</button>
                  <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('pharmacy.next') }}</button>
                </div>
              </nav>
            }
          }
        </div>

        @if (panel(); as current) {
          <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="adjustment-panel-title">
            <h2 id="adjustment-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t(current.kind === 'approve' ? 'pharmacy.decision.approveTitle' : 'pharmacy.decision.rejectTitle', { number: current.adjustment.number }) }}</h2>
            <p class="text-sm leading-6 text-muted-foreground">
              {{ i18n.t('pharmacy.decision.summary', { change: (current.adjustment.direction === 'OUT' ? '−' : '+') + current.adjustment.quantity, drug: current.adjustment.drug?.name ?? '', batch: current.adjustment.batch?.batchNumber ?? '', reason: i18n.t('pharmacy.adjustReason.' + current.adjustment.reason) }) }}
            </p>
            <app-form-builder #form [fields]="panelFields()" [busy]="busy()" [formId]="'adjustment-' + current.kind" (submitted)="submit($event)" (action)="onAction($event)" />
          </aside>
        }
      </div>
    </div>
  `,
})
export class AdjustmentsPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = adjustmentFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<readonly Adjustment[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);
  private filter: AdjustmentFilter = { status: 'PENDING' };

  protected readonly canDecide = computed(() => hasPermission(this.user()?.permissions ?? [], 'pharmacy.stock:approve'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid items-start gap-6'));
  protected readonly panelFields = computed(() => {
    const p = this.panel();
    return p ? decisionFields({ reject: p.kind === 'reject', notice: this.notice() }) : [];
  });

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const status = String(value['status'] ?? '');
    this.filter = { ...(status ? { status: status as AdjustmentStatus } : {}), ...(value['mine'] === true ? { mine: true } : {}) };
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
      const page = await this.gateway.listAdjustments(this.filter, this.offset(), PAGE_SIZE);
      this.rows.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.panel.set(panel);
  }

  protected close(): void {
    this.panel.set(null);
    this.notice.set(null);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.close();
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    if (!panel) return;
    const comment = String(value['comment'] ?? '').trim();
    this.notice.set(null);
    this.busy.set(true);
    try {
      if (panel.kind === 'approve') await this.gateway.approveAdjustment(panel.adjustment.id, comment || null);
      else await this.gateway.rejectAdjustment(panel.adjustment.id, comment);
      this.toast.show(this.i18n.t(panel.kind === 'approve' ? 'pharmacy.decision.approved' : 'pharmacy.decision.rejected', { number: panel.adjustment.number }));
      this.close();
      await this.load();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  protected isMine(a: Adjustment): boolean {
    return !!a.requestedBy && a.requestedBy.id === this.user()?.id;
  }

  protected tag(a: Adjustment) {
    return adjustmentTag(this.i18n, a.status);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}

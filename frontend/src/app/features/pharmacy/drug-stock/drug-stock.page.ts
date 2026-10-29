import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { AdjustmentReason, Batch, Direction, DrugStock, Movement } from '../../../core/pharmacy/pharmacy.models';
import { Temporal } from '../../../core/time/temporal';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { batchTag, daysText, levelTag } from '../pharmacy-status';
import { adjustmentFields, quarantineFields } from '../pharmacy.forms';

const MOVEMENTS_PAGE = 10;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

type Panel = { readonly kind: 'quarantine'; readonly batch: Batch } | { readonly kind: 'adjust'; readonly batch: Batch; readonly direction: Direction };

/**
 * Stock d'un médicament : ses totaux, ses lots (ceux qui périment le plus tôt d'abord, avec leur état) et le grand livre de ses mouvements.
 * Le pharmacien met un lot en quarantaine (motif obligatoire), le libère, ou demande un ajustement de stock : celui-ci ne change rien
 * tant qu'un autre pharmacien ne l'a pas approuvé.
 */
@Component({
  selector: 'app-drug-stock-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/pharmacy/stock" [class]="link" class="w-fit text-sm">← {{ i18n.t('pharmacy.drug.back') }}</a>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="drug-stock-error" />
      }

      @if (stock(); as s) {
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col">
            <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ s.drug.name }}</h1>
            <p class="text-sm leading-6 text-muted-foreground">
              {{ s.drug.genericName }}@if (s.drug.strength) { · {{ s.drug.strength }}} · {{ i18n.t('pharmacy.form.' + s.drug.form) }} · <span class="font-mono">{{ s.drug.code }}</span>
            </p>
            <p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <app-status-tag tone="neutral" [text]="i18n.t('pharmacy.schedule.' + s.drug.schedule)" />
              <app-status-tag tone="neutral" [text]="i18n.t('pharmacy.storage.' + s.drug.storage)" />
              @if (!s.drug.active) {
                <app-status-tag tone="warning" [text]="i18n.t('pharmacy.catalog.inactive')" />
              }
            </p>
          </div>
          <app-status-tag [text]="level(s).label" [tone]="level(s).tone" />
        </header>

        <section class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6" [attr.aria-label]="i18n.t('pharmacy.drug.totals')">
          @for (t of totals(s); track t.key) {
            <div class="flex flex-col gap-1 border border-border bg-card p-4" [attr.data-test]="'total-' + t.key">
              <span class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.drug.total.' + t.key) }}</span>
              <span class="text-xl font-semibold" [class]="t.tone">{{ t.text }}</span>
            </div>
          }
        </section>

        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-8">
            <section class="flex flex-col gap-3" aria-labelledby="batches-title">
              <h2 id="batches-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('pharmacy.drug.batches') }}</h2>
              <div class="overflow-x-auto border border-border bg-card">
                <table class="w-full text-left text-sm leading-6">
                  <caption class="sr-only">{{ i18n.t('pharmacy.drug.batches') }}</caption>
                  <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                    <tr>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.batch') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.expiry') }}</th>
                      <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.drug.quantity') }}</th>
                      <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.drug.unitCost') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.state') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (b of s.batches; track b.id) {
                      <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="b.batchNumber">
                        <td class="px-4 py-3 font-mono text-xs">{{ b.batchNumber }}</td>
                        <td class="px-4 py-3 whitespace-nowrap"><span class="font-mono text-xs">{{ b.expiry }}</span><span class="block text-xs text-muted-foreground">{{ days(b) }}</span></td>
                        <td class="px-4 py-3 text-right font-mono">{{ b.quantity }}</td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(b.unitCost, s.currency) }}</td>
                        <td class="px-4 py-3">
                          <app-status-tag [text]="state(b).label" [tone]="state(b).tone" />
                          @if (b.quarantineReason) {
                            <span class="mt-1 block text-xs text-muted-foreground">{{ i18n.t('pharmacy.drug.quarantineReason', { reason: b.quarantineReason, who: b.quarantinedBy?.username ?? '' }) }}</span>
                          }
                        </td>
                        <td class="px-4 py-3 text-right">
                          <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                            @if (canQuarantine()) {
                              @if (b.status === 'QUARANTINED') {
                                <button type="button" [class]="link" [disabled]="busy()" [attr.aria-label]="i18n.t('pharmacy.drug.releaseOf', { batch: b.batchNumber })" (click)="release(b)">{{ i18n.t('pharmacy.drug.release') }}</button>
                              } @else {
                                <button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.drug.quarantineOf', { batch: b.batchNumber })" (click)="open({ kind: 'quarantine', batch: b })">{{ i18n.t('pharmacy.drug.quarantine') }}</button>
                              }
                            }
                            @if (canAdjust()) {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.drug.addOf', { batch: b.batchNumber })" (click)="open({ kind: 'adjust', batch: b, direction: 'IN' })">{{ i18n.t('pharmacy.drug.add') }}</button>
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.drug.removeOf', { batch: b.batchNumber })" (click)="open({ kind: 'adjust', batch: b, direction: 'OUT' })">{{ i18n.t('pharmacy.drug.remove') }}</button>
                            }
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.drug.noBatches') }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>

            <section class="flex flex-col gap-3" aria-labelledby="movements-title">
              <h2 id="movements-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('pharmacy.drug.movements') }}</h2>
              <div class="overflow-x-auto border border-border bg-card">
                <table class="w-full text-left text-sm leading-6">
                  <caption class="sr-only">{{ i18n.t('pharmacy.drug.movements') }}</caption>
                  <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                    <tr>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.when') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.batch') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.type') }}</th>
                      <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.drug.delta') }}</th>
                      <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.drug.balance') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.by') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of movements(); track m.id) {
                      <tr class="border-b border-border align-top last:border-b-0">
                        <td class="px-4 py-3 whitespace-nowrap">{{ when(m.at) }}</td>
                        <td class="px-4 py-3 font-mono text-xs">{{ m.batchNumber }}</td>
                        <td class="px-4 py-3">{{ i18n.t('pharmacy.movement.' + m.type) }}@if (m.reference) { <span class="block font-mono text-xs text-muted-foreground">{{ m.reference }}</span>}@if (m.reason) { <span class="block text-xs text-muted-foreground">{{ m.reason }}</span>}</td>
                        <td class="px-4 py-3 text-right font-mono" [class]="m.delta < 0 ? 'text-status-critical' : 'text-status-success'">{{ m.delta > 0 ? '+' : '' }}{{ m.delta }}</td>
                        <td class="px-4 py-3 text-right font-mono">{{ m.balance }}</td>
                        <td class="px-4 py-3">{{ m.by?.username ?? '—' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.drug.noMovements') }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (movementsTotal() > movementsPage) {
                <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('pharmacy.drug.movementsPagination')">
                  <p class="text-muted-foreground">{{ i18n.t('pharmacy.range', { from: movementsOffset() + 1, to: movementsLast(), total: movementsTotal() }) }}</p>
                  <div class="flex gap-4">
                    <button type="button" [class]="link" [disabled]="movementsOffset() === 0" (click)="moveTo(movementsOffset() - movementsPage)">{{ i18n.t('pharmacy.previous') }}</button>
                    <button type="button" [class]="link" [disabled]="movementsLast() >= movementsTotal()" (click)="moveTo(movementsOffset() + movementsPage)">{{ i18n.t('pharmacy.next') }}</button>
                  </div>
                </nav>
              }
            </section>
          </div>

          @if (panel(); as current) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="drug-panel-title">
              <h2 id="drug-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ panelTitle() }}</h2>
              <p class="text-xs leading-5 text-muted-foreground">{{ i18n.t('pharmacy.drug.panelBatch', { batch: current.batch.batchNumber, expiry: current.batch.expiry, quantity: current.batch.quantity }) }}</p>
              <app-form-builder #form [fields]="panelFields()" [busy]="busy()" [formId]="'drug-panel-' + current.kind" (submitted)="submit($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      } @else if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
})
export class DrugStockPage implements OnInit {
  readonly id = input.required<string>();

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly link = LINK;
  protected readonly movementsPage = MOVEMENTS_PAGE;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stock = signal<DrugStock | null>(null);
  protected readonly movements = signal<readonly Movement[]>([]);
  protected readonly movementsTotal = signal(0);
  protected readonly movementsOffset = signal(0);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);

  private permissions = computed(() => this.user()?.permissions ?? []);
  protected readonly canQuarantine = computed(() => hasPermission(this.permissions(), 'pharmacy.stock:quarantine'));
  protected readonly canAdjust = computed(() => hasPermission(this.permissions(), 'pharmacy.stock:adjust'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly movementsLast = computed(() => Math.min(this.movementsOffset() + MOVEMENTS_PAGE, this.movementsTotal()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid items-start gap-6'));
  protected readonly panelTitle = computed(() => {
    const p = this.panel();
    if (!p) return '';
    return p.kind === 'quarantine' ? this.i18n.t('pharmacy.quarantine.title') : this.i18n.t(p.direction === 'IN' ? 'pharmacy.adjust.titleIn' : 'pharmacy.adjust.titleOut');
  });
  protected readonly panelFields = computed(() => {
    const p = this.panel();
    if (!p) return [];
    return p.kind === 'quarantine' ? quarantineFields({ notice: this.notice() }) : adjustmentFields({ direction: p.direction, max: p.direction === 'OUT' ? p.batch.quantity : null, notice: this.notice() });
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [stock, moves] = await Promise.all([this.gateway.getDrugStock(this.id()), this.gateway.listMovements({ drugId: this.id() }, this.movementsOffset(), MOVEMENTS_PAGE)]);
      this.stock.set(stock);
      this.movements.set(moves.items);
      this.movementsTotal.set(moves.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected moveTo(offset: number): void {
    this.movementsOffset.set(Math.max(0, offset));
    void this.load();
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
    this.notice.set(null);
    this.busy.set(true);
    try {
      if (panel.kind === 'quarantine') {
        await this.gateway.quarantine(panel.batch.id, String(value['reason']).trim());
        this.toast.show(this.i18n.t('pharmacy.quarantine.done', { batch: panel.batch.batchNumber }));
      } else {
        const note = String(value['note'] ?? '').trim();
        const asked = await this.gateway.requestAdjustment({
          batchId: panel.batch.id, direction: panel.direction, quantity: Number(value['quantity']), reason: String(value['reason']) as AdjustmentReason, ...(note ? { note } : {}),
        });
        this.toast.show(this.i18n.t('pharmacy.adjust.done', { number: asked.number }));
      }
      this.close();
      await this.load();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  protected async release(batch: Batch): Promise<void> {
    this.busy.set(true);
    try {
      await this.gateway.release(batch.id);
      this.toast.show(this.i18n.t('pharmacy.drug.released', { batch: batch.batchNumber }));
      await this.load();
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(false);
    }
  }

  protected level(s: DrugStock) {
    return levelTag(this.i18n, s.level);
  }

  protected state(b: Batch) {
    return batchTag(this.i18n, b);
  }

  protected days(b: Batch): string {
    return daysText(this.i18n, b.daysToExpiry);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  protected money(amount: number, currency: string): string {
    return this.formatter.format(amount, currency, minorDigitsOf(currency));
  }

  protected totals(s: DrugStock): { key: string; text: string; tone: string }[] {
    const unit = s.drug.unit;
    const flag = (n: number, tone: string) => (n > 0 ? tone : 'text-foreground');
    return [
      { key: 'dispensable', text: `${s.dispensable} ${unit}`, tone: s.level === 'OUT' ? 'text-status-critical' : 'text-foreground' },
      { key: 'reorder', text: s.drug.reorderLevel ? `${s.drug.reorderLevel} ${unit}` : '—', tone: 'text-foreground' },
      { key: 'expiring', text: `${s.expiringSoon} ${unit}`, tone: flag(s.expiringSoon, 'text-status-warning') },
      { key: 'expired', text: `${s.expired} ${unit}`, tone: flag(s.expired, 'text-status-critical') },
      { key: 'quarantined', text: `${s.quarantined} ${unit}`, tone: flag(s.quarantined, 'text-status-warning') },
      { key: 'value', text: this.money(s.value, s.currency), tone: 'text-foreground' },
    ];
  }
}

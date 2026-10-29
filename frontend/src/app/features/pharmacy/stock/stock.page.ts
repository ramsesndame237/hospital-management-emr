import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { StockFilter, StockLevel, StockRow, StockSummary } from '../../../core/pharmacy/pharmacy.models';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { levelTag } from '../pharmacy-status';
import { stockFilterFields } from '../pharmacy.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const TILE = 'flex flex-col gap-1 border border-border bg-card p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Un compteur du tableau de bord : ce qu'il faut traiter, et ce qu'il ouvre (un filtre de la liste ou un autre écran). */
interface Tile {
  readonly key: 'out' | 'low' | 'expiring' | 'expired' | 'quarantinedBatches' | 'pendingAdjustments';
  readonly count: number;
  readonly tone: 'text-status-critical' | 'text-status-warning' | 'text-foreground';
}

/**
 * Vue d'ensemble du stock : les compteurs à surveiller (ruptures, stocks bas, péremptions proches ou dépassées, lots en quarantaine,
 * ajustements en attente), puis un médicament par ligne avec ce qui est réellement délivrable. Les ruptures et les stocks bas sont en tête.
 */
@Component({
  selector: 'app-pharmacy-stock-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.stock.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.stock.lead') }}</p>
        </div>
        @if (canReceive()) {
          <a routerLink="/pharmacy/receipts/new" class="inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground">{{ i18n.t('pharmacy.stock.newReceipt') }}</a>
        }
      </header>

      @if (summary(); as s) {
        <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" [attr.aria-label]="i18n.t('pharmacy.stock.summaryTitle')">
          @for (tile of tiles(); track tile.key) {
            @if (tile.key === 'quarantinedBatches') {
              <a [class]="tileClass" routerLink="/pharmacy/expiry" [queryParams]="{ quarantined: 1 }" data-test="tile-quarantinedBatches">
                <span class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.stock.tile.' + tile.key) }}</span>
                <span class="text-2xl font-semibold" [class]="tile.tone">{{ tile.count }}</span>
              </a>
            } @else if (tile.key === 'pendingAdjustments') {
              <a [class]="tileClass" routerLink="/pharmacy/adjustments" data-test="tile-pendingAdjustments">
                <span class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.stock.tile.' + tile.key) }}</span>
                <span class="text-2xl font-semibold" [class]="tile.tone">{{ tile.count }}</span>
              </a>
            } @else {
              <button type="button" [class]="tileClass" [attr.data-test]="'tile-' + tile.key" [attr.aria-pressed]="quick() === tile.key" (click)="quickFilter(tile.key)">
                <span class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.stock.tile.' + tile.key, { days: s.expiryAlertDays }) }}</span>
                <span class="text-2xl font-semibold" [class]="tile.tone">{{ tile.count }}</span>
              </button>
            }
          }
          <div class="flex flex-col gap-1 border border-border bg-card p-4" data-test="tile-value">
            <span class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.stock.tile.value') }}</span>
            <span class="text-2xl font-semibold text-foreground">{{ money(s.value, s.currency) }}</span>
          </div>
        </section>
      }

      <app-form-builder [fields]="filterFields" formId="pharmacy-stock-filter" (submitted)="apply($event)" />

      @if (quick()) {
        <p class="text-sm text-muted-foreground">
          {{ i18n.t('pharmacy.stock.quickActive', { filter: i18n.t('pharmacy.stock.quick.' + quick(), { days: summary()?.expiryAlertDays ?? 90 }) }) }}
          <button type="button" [class]="link" (click)="clearQuick()">{{ i18n.t('pharmacy.stock.quickClear') }}</button>
        </p>
      }

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="pharmacy-stock-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('pharmacy.stock.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.drug') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.level') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.stock.dispensable') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.stock.reorder') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.attention') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.nextExpiry') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.stock.value') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.drugId) {
                <tr class="border-b border-border align-top last:border-b-0" [class.opacity-60]="!r.active" [attr.data-test]="r.code">
                  <td class="px-4 py-3">
                    <span class="font-medium">{{ r.name }}</span>
                    <span class="block text-xs text-muted-foreground">{{ r.genericName }}@if (r.strength) { · {{ r.strength }}} · <span class="font-mono">{{ r.code }}</span></span>
                  </td>
                  <td class="px-4 py-3"><app-status-tag [text]="level(r).label" [tone]="level(r).tone" /></td>
                  <td class="px-4 py-3 text-right font-mono">{{ r.dispensable }}<span class="block font-sans text-xs text-muted-foreground">{{ r.unit }}</span></td>
                  <td class="px-4 py-3 text-right font-mono">{{ r.reorderLevel || '—' }}</td>
                  <td class="px-4 py-3 text-xs">
                    @if (r.expired > 0) {
                      <span class="block text-status-critical">{{ i18n.t('pharmacy.stock.expiredQty', { n: r.expired }) }}</span>
                    }
                    @if (r.quarantined > 0) {
                      <span class="block text-status-warning">{{ i18n.t('pharmacy.stock.quarantinedQty', { n: r.quarantined }) }}</span>
                    }
                    @if (r.expiringSoon > 0) {
                      <span class="block text-status-warning">{{ i18n.t('pharmacy.stock.expiringQty', { n: r.expiringSoon }) }}</span>
                    }
                  </td>
                  <td class="px-4 py-3 font-mono text-xs whitespace-nowrap">{{ r.nextExpiry ?? '—' }}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(r.value, currency()) }}</td>
                  <td class="px-4 py-3 text-right">
                    <a [routerLink]="['/pharmacy/drugs', r.drugId]" [class]="link" [attr.aria-label]="i18n.t('pharmacy.stock.openOf', { name: r.name })">{{ i18n.t('pharmacy.stock.open') }}</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.stock.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('pharmacy.stock.pagination')">
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
export class PharmacyStockPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly user = inject(SessionStore).user;

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly tileClass = TILE;
  protected readonly filterFields = stockFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<readonly StockRow[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly currency = signal('XAF');
  protected readonly summary = signal<StockSummary | null>(null);
  /** Le compteur sur lequel on a cliqué (son filtre s'ajoute à ceux du formulaire). */
  protected readonly quick = signal<'out' | 'low' | 'expiring' | 'expired' | null>(null);
  private filter: StockFilter = {};

  protected readonly canReceive = computed(() => hasPermission(this.user()?.permissions ?? [], 'pharmacy.stock:receive'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly tiles = computed<readonly Tile[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const tone = (count: number, level: Tile['tone']): Tile['tone'] => (count > 0 ? level : 'text-foreground');
    return [
      { key: 'out', count: s.out, tone: tone(s.out, 'text-status-critical') },
      { key: 'low', count: s.low, tone: tone(s.low, 'text-status-warning') },
      { key: 'expiring', count: s.expiring, tone: tone(s.expiring, 'text-status-warning') },
      { key: 'expired', count: s.expired, tone: tone(s.expired, 'text-status-critical') },
      { key: 'quarantinedBatches', count: s.quarantinedBatches, tone: tone(s.quarantinedBatches, 'text-status-warning') },
      { key: 'pendingAdjustments', count: s.pendingAdjustments, tone: 'text-foreground' },
    ];
  });

  constructor() {
    void this.loadSummary();
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const q = String(value['q'] ?? '').trim();
    const level = String(value['level'] ?? '');
    this.quick.set(null);
    this.filter = {
      ...(q ? { search: q } : {}), ...(level ? { level: level as StockLevel } : {}), ...(value['expiring'] === true ? { expiring: true } : {}),
      ...(value['hasExpired'] === true ? { hasExpired: true } : {}), ...(value['inactive'] === true ? { includeInactive: true } : {}),
    };
    this.offset.set(0);
    void this.load();
  }

  /** Un compteur de la tête de page : la liste ne montre plus que ce qui le compose. */
  protected quickFilter(key: 'out' | 'low' | 'expiring' | 'expired'): void {
    if (this.quick() === key) return this.clearQuick();
    this.quick.set(key);
    this.filter = key === 'out' ? { level: 'OUT' } : key === 'low' ? { level: 'LOW' } : key === 'expiring' ? { expiring: true } : { hasExpired: true };
    this.offset.set(0);
    void this.load();
  }

  protected clearQuick(): void {
    this.quick.set(null);
    this.filter = {};
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async loadSummary(): Promise<void> {
    try {
      this.summary.set(await this.gateway.getSummary());
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    }
  }

  private async load(): Promise<void> {
    this.loading.set(this.rows().length === 0);
    try {
      const page = await this.gateway.listStock(this.filter, this.offset(), PAGE_SIZE);
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

  protected level(r: StockRow) {
    return levelTag(this.i18n, r.level);
  }

  protected money(amount: number, currency: string): string {
    return this.formatter.format(amount, currency, minorDigitsOf(currency));
  }
}

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { ExpiryFilter, ExpiryRow } from '../../../core/pharmacy/pharmacy.models';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { batchTag, daysText } from '../pharmacy-status';
import { expiryFilterFields } from '../pharmacy.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Péremptions : les lots en stock qui périment dans l'horizon choisi (par défaut la fenêtre d'alerte), les périmés en tête, ou les lots mis
 * en quarantaine. Un lot périmé encore en rayon est un danger : il se retire par un ajustement, depuis la fiche du médicament.
 */
@Component({
  selector: 'app-pharmacy-expiry-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.expiry.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.expiry.lead') }}</p>
      </header>

      <app-form-builder [fields]="filterFields" formId="pharmacy-expiry-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="pharmacy-expiry-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('pharmacy.expiry.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.drug') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.batch') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.expiry') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.drug.quantity') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.drug.state') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (b of rows(); track b.id) {
                <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="b.batchNumber">
                  <td class="px-4 py-3"><span class="font-medium">{{ b.drug.name }}</span><span class="block text-xs text-muted-foreground">{{ b.drug.genericName }}@if (b.drug.strength) { · {{ b.drug.strength }}}</span></td>
                  <td class="px-4 py-3 font-mono text-xs">{{ b.batchNumber }}</td>
                  <td class="px-4 py-3 whitespace-nowrap"><span class="font-mono text-xs">{{ b.expiry }}</span><span class="block text-xs text-muted-foreground">{{ days(b) }}</span></td>
                  <td class="px-4 py-3 text-right font-mono">{{ b.quantity }}<span class="block font-sans text-xs text-muted-foreground">{{ b.drug.unit }}</span></td>
                  <td class="px-4 py-3">
                    <app-status-tag [text]="state(b).label" [tone]="state(b).tone" />
                    @if (b.quarantineReason) {
                      <span class="mt-1 block text-xs text-muted-foreground">{{ b.quarantineReason }}</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <a [routerLink]="['/pharmacy/drugs', b.drugId]" [class]="link" [attr.aria-label]="i18n.t('pharmacy.stock.openOf', { name: b.drug.name })">{{ i18n.t('pharmacy.stock.open') }}</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.expiry.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('pharmacy.expiry.pagination')">
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
export class ExpiryPage implements OnInit {
  /** `?quarantined=1` : on arrive depuis le compteur « lots en quarantaine » du tableau de bord. */
  readonly quarantined = input<string | undefined>(undefined);

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = expiryFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<readonly ExpiryRow[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  private filter: ExpiryFilter = {};

  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  ngOnInit(): void {
    if (this.quarantined() === '1') this.filter = { quarantinedOnly: true };
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const days = Number(value['days']);
    this.filter = { ...(Number.isInteger(days) ? { days } : {}), ...(value['quarantinedOnly'] === true ? { quarantinedOnly: true } : {}) };
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
      const page = await this.gateway.listExpiry(this.filter, this.offset(), PAGE_SIZE);
      this.rows.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected state(b: ExpiryRow) {
    return batchTag(this.i18n, b);
  }

  protected days(b: ExpiryRow): string {
    return daysText(this.i18n, b.daysToExpiry);
  }
}

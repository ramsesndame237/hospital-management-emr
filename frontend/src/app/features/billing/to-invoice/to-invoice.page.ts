import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { Billable, SOURCE_TYPES, SourceType } from '../../../core/billing/billing.models';
import { MoneyFormatter, minorDigitsOf } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { ToastService } from '../../../shared/toast/toast.service';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Facturation reliée : ce qui a été fait (demandes d'analyses, examens d'imagerie réalisés, médicaments délivrés) et n'a pas encore de
 * facture. « Établir la facture » crée le brouillon au prix du catalogue ; un code sans prix est signalé et la facture refusée, jamais
 * établie à zéro. L'écran n'affiche que l'identité du patient, un numéro, une date et des libellés d'actes : aucune donnée clinique.
 */
@Component({
  selector: 'app-to-invoice-page',
  imports: [HlmButtonImports, FormBuilderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.toInvoice.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.toInvoice.lead') }}</p>
      </header>

      <div role="group" [attr.aria-label]="i18n.t('billing.toInvoice.typeLabel')" class="flex flex-wrap gap-2">
        @for (t of types; track t) {
          <button
            type="button"
            class="min-h-11 rounded-[2px] border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            [class]="type() === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'"
            [attr.aria-pressed]="type() === t"
            (click)="choose(t)"
          >
            {{ i18n.t('billing.toInvoice.type.' + t) }}
          </button>
        }
      </div>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="to-invoice-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <ul class="flex flex-col gap-3" [attr.aria-label]="i18n.t('billing.toInvoice.type.' + type())">
          @for (row of rows(); track row.id) {
            <li class="flex flex-col gap-3 border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="flex min-w-0 flex-col gap-1">
                <p class="text-sm leading-6">
                  <span class="font-mono text-xs">{{ row.reference }}</span>
                  <span class="text-muted-foreground"> · {{ when(row) }}</span>
                </p>
                <p class="font-medium">{{ patientName(row) }}</p>
                <ul class="mt-1 flex flex-col gap-0.5 text-sm leading-6 text-muted-foreground">
                  @for (line of row.lines; track line.code) {
                    <li>
                      {{ line.label }}@if (line.quantity > 1) { × {{ line.quantity }} }
                      @if (line.unitPrice !== null) {
                        <span class="font-mono"> · {{ price(line.unitPrice) }}</span>
                      } @else {
                        <span class="text-status-warning"> · {{ i18n.t('billing.toInvoice.noPrice', { code: line.code }) }}</span>
                      }
                    </li>
                  }
                </ul>
                @if (row.unpriced.length > 0) {
                  <p class="text-sm leading-6 text-status-warning" role="note">
                    {{ i18n.t('billing.toInvoice.unpriced', { codes: row.unpriced.join(', ') }) }}
                    @if (canManageCatalog()) {
                      <a routerLink="/billing/catalog" [class]="link">{{ i18n.t('billing.toInvoice.openCatalog') }}</a>
                    }
                  </p>
                }
              </div>
              <div class="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                @if (row.total !== null) {
                  <p class="font-mono text-base font-semibold">{{ price(row.total) }}</p>
                }
                <button
                  hlmBtn
                  type="button"
                  class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none"
                  [disabled]="row.unpriced.length > 0 || billing() !== null"
                  [attr.aria-label]="i18n.t('billing.toInvoice.billOf', { reference: row.reference })"
                  (click)="bill(row)"
                >
                  {{ i18n.t(billing() === row.id ? 'billing.saving' : 'billing.toInvoice.bill') }}
                </button>
              </div>
            </li>
          } @empty {
            <li class="border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">{{ i18n.t('billing.toInvoice.empty') }}</li>
          }
        </ul>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('billing.toInvoice.pagination')">
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
export class ToInvoicePage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(BillingGateway);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly money = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);
  private readonly session = inject(SessionStore).user;

  protected readonly types = SOURCE_TYPES;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly type = signal<SourceType>('LAB_REQUISITION');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<readonly Billable[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly currency = signal('XAF');
  /** Identifiant de la source dont la facture est en cours de création (un seul à la fois, pas de double clic). */
  protected readonly billing = signal<string | null>(null);

  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly canManageCatalog = computed(() => hasPermission(this.session()?.permissions ?? [], 'billing.catalog:manage'));

  constructor() {
    void this.load();
  }

  protected choose(type: SourceType): void {
    if (type === this.type()) return;
    this.type.set(type);
    this.offset.set(0);
    this.rows.set([]);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.rows().length === 0);
    const type = this.type();
    try {
      const page = await this.gateway.listBillable(type, this.offset(), PAGE_SIZE);
      if (type !== this.type()) return; // l'utilisateur a changé d'onglet entre-temps
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

  protected async bill(row: Billable): Promise<void> {
    if (this.billing() !== null) return;
    this.billing.set(row.id);
    this.error.set(null);
    try {
      const invoice = await this.gateway.billFromSource(row.type, row.id);
      this.toast.show(this.i18n.t('billing.toInvoice.billed', { number: invoice.number }));
      await this.router.navigate(['/billing/invoices', invoice.id]);
    } catch (error) {
      // Un autre poste a pu facturer entre-temps : la liste est relue (puis le message posé, car la relecture efface l'ancien).
      const message = failureMessage(error, this.i18n);
      await this.load();
      this.error.set(message);
    } finally {
      this.billing.set(null);
    }
  }

  protected patientName(row: Billable): string {
    return row.patient ? `${row.patient.lastName} ${row.patient.firstName} · ${row.patient.number}` : this.i18n.t('billing.toInvoice.unknownPatient');
  }

  protected when(row: Billable): string {
    return this.dates.dateTime(Temporal.Instant.from(row.occurredAt));
  }

  protected price(amount: number): string {
    return this.money.format(amount, this.currency(), minorDigitsOf(this.currency()));
  }
}

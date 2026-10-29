import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { fromMinorUnits, MoneyFormatter, minorDigitsOf, toMinorUnits } from '../../../core/billing/money';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { Drug, DrugChanges, DrugFilter, DrugForm, Schedule, Storage } from '../../../core/pharmacy/pharmacy.models';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { drugFilterFields, drugFormFields } from '../pharmacy.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

type Panel = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly drug: Drug };

/**
 * Formulaire des médicaments : dénomination commune, forme, dosage, classe de délivrance, conservation, code ATC, unité de dispensation, prix
 * et seuil de réapprovisionnement. Qui le tient (pharmacien, administrateur système) ajoute, modifie, retire et remet des médicaments ; les
 * prescripteurs le consultent. Un changement de prix garde l'ancien et le nouveau au journal d'audit.
 */
@Component({
  selector: 'app-pharmacy-catalog-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.catalog.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.catalog.lead') }}</p>
        </div>
        @if (canManage()) {
          <button type="button" [class]="primary" (click)="open({ kind: 'create' })">{{ i18n.t('pharmacy.catalog.new') }}</button>
        }
      </header>

      <app-form-builder [fields]="filterFields()" formId="pharmacy-catalog-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="pharmacy-catalog-error" />
      }

      <div [class]="layoutClass()">
        <div class="flex min-w-0 flex-col gap-4">
          @if (loading()) {
            <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
          } @else {
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('pharmacy.catalog.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.catalog.drug') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.catalog.formAndClass') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.catalog.price') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.catalog.reorder') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of drugs(); track d.id) {
                    <tr class="border-b border-border align-top last:border-b-0" [class.opacity-60]="!d.active" [attr.data-test]="d.code">
                      <td class="px-4 py-3">
                        <span class="font-medium">{{ d.name }}</span>
                        @if (!d.active) {
                          <app-status-tag class="ml-2" tone="neutral" [text]="i18n.t('pharmacy.catalog.inactive')" />
                        }
                        <span class="block text-xs text-muted-foreground">{{ d.genericName }}@if (d.strength) { · {{ d.strength }}} · <span class="font-mono">{{ d.code }}</span>@if (d.atcCode) { · <span class="font-mono">{{ d.atcCode }}</span>}</span>
                      </td>
                      <td class="px-4 py-3">{{ i18n.t('pharmacy.form.' + d.form) }}<span class="block text-xs text-muted-foreground">{{ i18n.t('pharmacy.schedule.' + d.schedule) }} · {{ i18n.t('pharmacy.storage.' + d.storage) }}</span></td>
                      <td class="px-4 py-3 text-right whitespace-nowrap">{{ money(d.unitPrice) }}<span class="block text-xs text-muted-foreground">{{ i18n.t('pharmacy.catalog.perUnit', { unit: d.unit }) }}</span></td>
                      <td class="px-4 py-3 text-right font-mono">{{ d.reorderLevel || '—' }}</td>
                      <td class="px-4 py-3 text-right">
                        <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                          @if (canSeeStock()) {
                            <a [routerLink]="['/pharmacy/drugs', d.id]" [class]="link" [attr.aria-label]="i18n.t('pharmacy.stock.openOf', { name: d.name })">{{ i18n.t('pharmacy.catalog.stockLink') }}</a>
                          }
                          @if (canManage()) {
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.catalog.editOf', { name: d.name })" (click)="open({ kind: 'edit', drug: d })">{{ i18n.t('pharmacy.catalog.edit') }}</button>
                            <button type="button" [class]="link" [disabled]="busy()" [attr.aria-label]="i18n.t(d.active ? 'pharmacy.catalog.deactivateOf' : 'pharmacy.catalog.activateOf', { name: d.name })" (click)="toggleActive(d)">
                              {{ i18n.t(d.active ? 'pharmacy.catalog.deactivate' : 'pharmacy.catalog.activate') }}
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.catalog.empty') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (total() > pageSize) {
              <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('pharmacy.catalog.pagination')">
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
          <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="drug-panel-title">
            <h2 id="drug-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ panelTitle() }}</h2>
            <app-form-builder #form [fields]="formFields()" [busy]="busy()" [formId]="formId()" (submitted)="submit($event)" (action)="onAction($event)" />
          </aside>
        }
      </div>
    </div>
  `,
})
export class PharmacyCatalogPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly drugs = signal<readonly Drug[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly currency = signal('XAF');
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);
  private filter: DrugFilter = {};

  private readonly permissions = computed(() => this.user()?.permissions ?? []);
  protected readonly canManage = computed(() => hasPermission(this.permissions(), 'pharmacy.catalog:manage'));
  protected readonly canSeeStock = computed(() => hasPermission(this.permissions(), 'pharmacy.stock:read'));
  protected readonly filterFields = computed(() => drugFilterFields(this.canManage()));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]' : 'grid items-start gap-6'));
  protected readonly formFields = computed(() => {
    const p = this.panel();
    const drug = p?.kind === 'edit' ? p.drug : null;
    const digits = minorDigitsOf(this.currency());
    return drugFormFields({ drug, digits, price: drug ? fromMinorUnits(drug.unitPrice, digits) : '', notice: this.notice() });
  });
  protected readonly formId = computed(() => {
    const p = this.panel();
    return p?.kind === 'edit' ? `pharmacy-drug-${p.drug.id}` : 'pharmacy-drug-new';
  });
  protected readonly panelTitle = computed(() => {
    const p = this.panel();
    if (!p) return '';
    return p.kind === 'create' ? this.i18n.t('pharmacy.catalog.createTitle') : this.i18n.t('pharmacy.catalog.editTitle', { name: p.drug.name });
  });

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const q = String(value['q'] ?? '').trim();
    const form = String(value['form'] ?? '');
    const schedule = String(value['schedule'] ?? '');
    this.filter = { ...(q ? { search: q } : {}), ...(form ? { form: form as DrugForm } : {}), ...(schedule ? { schedule: schedule as Schedule } : {}), ...(value['inactive'] === true ? { includeInactive: true } : {}) };
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.drugs().length === 0);
    try {
      const page = await this.gateway.listDrugs(this.filter, this.offset(), PAGE_SIZE);
      this.drugs.set(page.items);
      this.total.set(page.total);
      this.currency.set(page.currency);
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
    this.notice.set(null);
    const text = (name: string): string => String(value[name] ?? '').trim();
    const price = toMinorUnits(text('price'), minorDigitsOf(this.currency()));
    if (price === null) return this.notice.set(this.i18n.t('pharmacy.catalog.priceInvalid'));
    const changes: DrugChanges = {
      name: text('name'), genericName: text('genericName'), strength: text('strength') || null, form: text('form') as DrugForm, schedule: text('schedule') as Schedule, storage: text('storage') as Storage,
      atcCode: text('atcCode') || null, unit: text('unit'), unitPrice: price, reorderLevel: Number(value['reorderLevel']) || 0, notes: text('notes') || null,
    };
    this.busy.set(true);
    try {
      const saved = panel.kind === 'create' ? await this.gateway.createDrug({ ...changes, code: text('code') } as Parameters<PharmacyGateway['createDrug']>[0]) : await this.gateway.updateDrug(panel.drug.id, changes);
      this.toast.show(this.i18n.t(panel.kind === 'create' ? 'pharmacy.catalog.created' : 'pharmacy.catalog.updated', { name: saved.name }));
      this.close();
      await this.load();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggleActive(drug: Drug): Promise<void> {
    this.busy.set(true);
    try {
      const saved = await this.gateway.setDrugActive(drug.id, !drug.active);
      this.toast.show(this.i18n.t(saved.active ? 'pharmacy.catalog.activated' : 'pharmacy.catalog.deactivated', { name: saved.name }));
      await this.load();
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(false);
    }
  }

  protected money(amount: number): string {
    return this.formatter.format(amount, this.currency(), minorDigitsOf(this.currency()));
  }
}

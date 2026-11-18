import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { BillableItem, ItemCategory, ItemFilter, SOURCE_CATEGORIES } from '../../../core/billing/billing.models';
import { MoneyFormatter, fromMinorUnits, minorDigitsOf, toMinorUnits } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { catalogFilterFields, itemFields } from '../billing.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

type Panel = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly item: BillableItem };

/**
 * Catalogue des tarifs : ce que la caisse annonce au patient. Qui gère le catalogue crée, modifie et retire les actes ; un acte de
 * laboratoire, de radiologie ou de pharmacie porte le « code source » de l'analyse, de l'examen ou du médicament qu'il tarifie : c'est
 * ce qui permet d'établir la facture d'une demande réalisée.
 */
@Component({
  selector: 'app-billing-catalog-page',
  imports: [HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.catalog.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t(canManage() ? 'billing.catalog.leadManage' : 'billing.catalog.lead') }}</p>
        </div>
        @if (canManage()) {
          <button hlmBtn type="button" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none" (click)="open({ kind: 'create' })">
            {{ i18n.t('billing.catalog.add') }}
          </button>
        }
      </header>

      <app-form-builder [fields]="filterFields" formId="catalog-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="catalog-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-3">
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('billing.catalog.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.catalog.code') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.catalog.name') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.catalog.category') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.catalog.price') }}</th>
                    @if (canManage()) {
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.catalog.sourceCode') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('billing.actions') }}</span></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (item of items(); track item.id) {
                    <tr class="border-b border-border last:border-b-0" [class.bg-muted]="isSelected(item)">
                      <td class="px-4 py-3 font-mono text-xs">{{ item.code }}</td>
                      <td class="px-4 py-3 font-medium">
                        {{ item.name }}
                        @if (!item.active) {
                          <app-status-tag class="ml-2" [text]="i18n.t('billing.catalog.inactive')" tone="neutral" />
                        }
                      </td>
                      <td class="px-4 py-3">{{ i18n.t('billing.category.' + item.category) }}</td>
                      <td class="px-4 py-3 text-right font-mono">{{ money(item) }}</td>
                      @if (canManage()) {
                        <td class="px-4 py-3 font-mono text-xs">
                          @if (item.sourceCode) {
                            {{ item.sourceCode }}
                          } @else if (needsSource(item)) {
                            <span class="font-sans text-status-warning">{{ i18n.t('billing.catalog.noSource') }}</span>
                          }
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('billing.catalog.editOf', { name: item.name })" (click)="open({ kind: 'edit', item })">{{ i18n.t('billing.catalog.edit') }}</button>
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t(item.active ? 'billing.catalog.deactivateOf' : 'billing.catalog.activateOf', { name: item.name })" (click)="toggle(item)">{{ i18n.t(item.active ? 'billing.catalog.deactivate' : 'billing.catalog.activate') }}</button>
                          </div>
                        </td>
                      }
                    </tr>
                  } @empty {
                    <tr>
                      <td [attr.colspan]="canManage() ? 6 : 4" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('billing.catalog.empty') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (total() > pageSize) {
              <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('billing.catalog.pagination')">
                <p class="text-muted-foreground">{{ i18n.t('billing.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
                <div class="flex gap-4">
                  <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('billing.previous') }}</button>
                  <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('billing.next') }}</button>
                </div>
              </nav>
            }
          </div>

          @for (current of panelRows(); track current.key) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="catalog-panel-title">
              <h2 id="catalog-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ current.title }}</h2>
              <app-form-builder #form [fields]="current.fields" [busy]="busy()" [formId]="'catalog-' + current.key" (submitted)="submit($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class BillingCatalogPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(BillingGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = catalogFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<readonly BillableItem[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);
  private filter: ItemFilter = {};

  protected readonly canManage = computed(() => hasPermission(this.session()?.permissions ?? [], 'billing.catalog:manage'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));

  protected readonly panelRows = computed(() => {
    const panel = this.panel();
    const notice = this.notice();
    if (!panel) return [];
    if (panel.kind === 'create') {
      return [{ key: 'create', title: this.i18n.t('billing.catalog.addTitle'), fields: itemFields({ item: null, digits: this.digits(), price: '', notice }) }];
    }
    const price = fromMinorUnits(panel.item.unitPrice, minorDigitsOf(panel.item.currency));
    return [{ key: `edit-${panel.item.id}`, title: this.i18n.t('billing.catalog.editOf', { name: panel.item.name }), fields: itemFields({ item: panel.item, digits: minorDigitsOf(panel.item.currency), price, notice }) }];
  });

  constructor() {
    void this.load();
  }

  /** Décimales de la devise de l'installation : celles des actes déjà listés, sinon le franc CFA (aucune). */
  private digits(): number {
    const first = this.items()[0];
    return first ? minorDigitsOf(first.currency) : 0;
  }

  protected apply(value: Record<string, unknown>): void {
    const search = String(value['q'] ?? '');
    const category = String(value['category'] ?? '');
    this.filter = { ...(search ? { search } : {}), ...(category ? { category: category as ItemCategory } : {}) };
    this.offset.set(0);
    this.panel.set(null);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    this.panel.set(null);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.items().length === 0);
    try {
      const page = await this.gateway.listItems(this.filter, this.offset(), PAGE_SIZE);
      this.items.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected money(item: BillableItem): string {
    return this.formatter.format(item.unitPrice, item.currency, minorDigitsOf(item.currency));
  }

  /** Un acte de laboratoire, de radiologie ou de pharmacie sans code source ne sert pas à facturer une demande réalisée : on le signale. */
  protected needsSource(item: BillableItem): boolean {
    return item.active && SOURCE_CATEGORIES.includes(item.category);
  }

  protected isSelected(item: BillableItem): boolean {
    const panel = this.panel();
    return !!panel && panel.kind === 'edit' && panel.item.id === item.id;
  }

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.panel.set(panel);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.panel.set(null);
  }

  protected async toggle(item: BillableItem): Promise<void> {
    this.error.set(null);
    try {
      await this.gateway.setItemActive(item.id, !item.active);
      this.toast.show(this.i18n.t(item.active ? 'billing.catalog.deactivated' : 'billing.catalog.activated', { name: item.name }));
      await this.load();
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    }
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    if (!panel) return;
    this.notice.set(null);
    const digits = panel.kind === 'edit' ? minorDigitsOf(panel.item.currency) : this.digits();
    const unitPrice = toMinorUnits(String(value['unitPrice'] ?? ''), digits);
    if (unitPrice === null) {
      this.notice.set(this.i18n.t('billing.amount.invalid'));
      return;
    }
    const category = String(value['category']) as ItemCategory;
    // Le code source n'a de sens que pour ces catégories : changer de catégorie le retire.
    const sourceCode = SOURCE_CATEGORIES.includes(category) ? String(value['sourceCode'] ?? '').trim().toUpperCase() : '';
    this.busy.set(true);
    try {
      if (panel.kind === 'create') {
        const created = await this.gateway.createItem({ code: String(value['code']).trim(), name: String(value['name']).trim(), category, unitPrice, ...(sourceCode ? { sourceCode } : {}) });
        this.toast.show(this.i18n.t('billing.catalog.created', { name: created.name }));
      } else {
        const updated = await this.gateway.updateItem(panel.item.id, { name: String(value['name']).trim(), category, unitPrice, sourceCode: sourceCode || null });
        this.toast.show(this.i18n.t('billing.catalog.updated', { name: updated.name }));
      }
      this.panel.set(null);
      await this.load();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }
}

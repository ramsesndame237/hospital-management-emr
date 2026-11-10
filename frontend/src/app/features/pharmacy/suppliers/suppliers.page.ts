import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { Supplier, SupplierChanges, SupplierFilter } from '../../../core/pharmacy/pharmacy.models';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { supplierFilterFields, supplierFormFields } from '../pharmacy.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

type Panel = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly supplier: Supplier };

/**
 * Fournisseurs de la pharmacie : coordonnées, contact et délai de paiement convenu. Qui les tient (le pharmacien) en ajoute, modifie, écarte et
 * remet en service ; l'administrateur système les consulte. Un fournisseur écarté ne reçoit plus de commande, ses bons existants restent.
 */
@Component({
  selector: 'app-suppliers-page',
  imports: [FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.suppliers.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.suppliers.lead') }}</p>
        </div>
        @if (canManage()) {
          <button type="button" [class]="primary" (click)="open({ kind: 'create' })">{{ i18n.t('pharmacy.suppliers.new') }}</button>
        }
      </header>

      <app-form-builder [fields]="filterFields()" formId="pharmacy-suppliers-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="pharmacy-suppliers-error" />
      }

      <div [class]="layoutClass()">
        <div class="flex min-w-0 flex-col gap-4">
          @if (loading()) {
            <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
          } @else {
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('pharmacy.suppliers.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.suppliers.supplier') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.suppliers.contactCol') }}</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('pharmacy.suppliers.terms') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of suppliers(); track s.id) {
                    <tr class="border-b border-border align-top last:border-b-0" [class.opacity-60]="!s.active" [attr.data-test]="s.code">
                      <td class="px-4 py-3">
                        <span class="font-medium">{{ s.name }}</span>
                        @if (!s.active) {
                          <app-status-tag class="ml-2" tone="neutral" [text]="i18n.t('pharmacy.suppliers.inactive')" />
                        }
                        <span class="block font-mono text-xs text-muted-foreground">{{ s.code }}</span>
                      </td>
                      <td class="px-4 py-3 text-xs">
                        @if (s.contactName) {
                          <span class="block">{{ s.contactName }}</span>
                        }
                        @if (s.phone) {
                          <span class="block font-mono">{{ s.phone }}</span>
                        }
                        @if (s.email) {
                          <span class="block">{{ s.email }}</span>
                        }
                        @if (s.address) {
                          <span class="block text-muted-foreground">{{ s.address }}</span>
                        }
                      </td>
                      <td class="px-4 py-3 text-right whitespace-nowrap">{{ i18n.t(s.paymentTermsDays === 0 ? 'pharmacy.suppliers.cash' : 'pharmacy.suppliers.days', { n: s.paymentTermsDays }) }}</td>
                      <td class="px-4 py-3 text-right">
                        @if (canManage()) {
                          <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.suppliers.editOf', { name: s.name })" (click)="open({ kind: 'edit', supplier: s })">{{ i18n.t('pharmacy.suppliers.edit') }}</button>
                            <button type="button" [class]="link" [disabled]="busy()" [attr.aria-label]="i18n.t(s.active ? 'pharmacy.suppliers.deactivateOf' : 'pharmacy.suppliers.activateOf', { name: s.name })" (click)="toggleActive(s)">
                              {{ i18n.t(s.active ? 'pharmacy.suppliers.deactivate' : 'pharmacy.suppliers.activate') }}
                            </button>
                          </div>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('pharmacy.suppliers.empty') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (total() > pageSize) {
              <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('pharmacy.suppliers.pagination')">
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
          <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="supplier-panel-title">
            <h2 id="supplier-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ panelTitle() }}</h2>
            <app-form-builder #form [fields]="formFields()" [busy]="busy()" [formId]="formId()" (submitted)="submit($event)" (action)="onAction($event)" />
          </aside>
        }
      </div>
    </div>
  `,
})
export class SuppliersPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly suppliers = signal<readonly Supplier[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);
  private filter: SupplierFilter = {};

  protected readonly canManage = computed(() => hasPermission(this.user()?.permissions ?? [], 'pharmacy.procurement:manage'));
  protected readonly filterFields = computed(() => supplierFilterFields(this.canManage()));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]' : 'grid items-start gap-6'));
  protected readonly formFields = computed(() => {
    const p = this.panel();
    return supplierFormFields({ supplier: p?.kind === 'edit' ? p.supplier : null, notice: this.notice() });
  });
  protected readonly formId = computed(() => {
    const p = this.panel();
    return p?.kind === 'edit' ? `pharmacy-supplier-${p.supplier.id}` : 'pharmacy-supplier-new';
  });
  protected readonly panelTitle = computed(() => {
    const p = this.panel();
    if (!p) return '';
    return p.kind === 'create' ? this.i18n.t('pharmacy.suppliers.createTitle') : this.i18n.t('pharmacy.suppliers.editTitle', { name: p.supplier.name });
  });

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const q = String(value['q'] ?? '').trim();
    this.filter = { ...(q ? { search: q } : {}), ...(value['inactive'] === true ? { includeInactive: true } : {}) };
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.suppliers().length === 0);
    try {
      const page = await this.gateway.listSuppliers(this.filter, this.offset(), PAGE_SIZE);
      this.suppliers.set(page.items);
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
    this.notice.set(null);
    const text = (name: string): string => String(value[name] ?? '').trim();
    const changes: SupplierChanges = {
      name: text('name'), contactName: text('contactName') || null, phone: text('phone') || null, email: text('email') || null, address: text('address') || null,
      paymentTermsDays: Number(value['paymentTermsDays']) || 0, notes: text('notes') || null,
    };
    this.busy.set(true);
    try {
      const saved = panel.kind === 'create' ? await this.gateway.createSupplier({ ...changes, code: text('code') } as Parameters<PharmacyGateway['createSupplier']>[0]) : await this.gateway.updateSupplier(panel.supplier.id, changes);
      this.toast.show(this.i18n.t(panel.kind === 'create' ? 'pharmacy.suppliers.created' : 'pharmacy.suppliers.updated', { name: saved.name }));
      this.close();
      await this.load();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggleActive(supplier: Supplier): Promise<void> {
    this.busy.set(true);
    try {
      const saved = await this.gateway.setSupplierActive(supplier.id, !supplier.active);
      this.toast.show(this.i18n.t(saved.active ? 'pharmacy.suppliers.activated' : 'pharmacy.suppliers.deactivated', { name: saved.name }));
      await this.load();
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(false);
    }
  }
}

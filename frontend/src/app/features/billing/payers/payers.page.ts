import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { Payer } from '../../../core/billing/billing.models';
import { Translator } from '../../../core/i18n/translator';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { payerFields } from '../billing.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

type Panel = { readonly kind: 'create' } | { readonly kind: 'rename'; readonly payer: Payer };

/** Assureurs (tiers payant) : la liste de ceux qui prennent en charge une part des soins de leurs assurés. Un assureur retiré reste lisible mais n'accepte plus de couverture. */
@Component({
  selector: 'app-payers-page',
  imports: [HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.payers.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.payers.lead') }}</p>
        </div>
        @if (canManage()) {
          <button hlmBtn type="button" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none" (click)="open({ kind: 'create' })">{{ i18n.t('billing.payers.add') }}</button>
        }
      </header>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="payers-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div [class]="layoutClass()">
          <div class="min-w-0 overflow-x-auto border border-border bg-card">
            <table class="w-full text-left text-sm leading-6">
              <caption class="sr-only">{{ i18n.t('billing.payers.title') }}</caption>
              <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                <tr>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.payers.code') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.payers.name') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.payers.state') }}</th>
                  @if (canManage()) {
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('billing.actions') }}</span></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (payer of payers(); track payer.id) {
                  <tr class="border-b border-border last:border-b-0" [class.bg-muted]="isSelected(payer)">
                    <td class="px-4 py-3 font-mono text-xs">{{ payer.code }}</td>
                    <td class="px-4 py-3 font-medium">{{ payer.name }}</td>
                    <td class="px-4 py-3"><app-status-tag [text]="i18n.t(payer.active ? 'billing.payers.active' : 'billing.payers.inactive')" [tone]="payer.active ? 'success' : 'neutral'" /></td>
                    @if (canManage()) {
                      <td class="px-4 py-3">
                        <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                          <button type="button" [class]="link" [attr.aria-label]="i18n.t('billing.payers.renameOf', { name: payer.name })" (click)="open({ kind: 'rename', payer })">{{ i18n.t('billing.payers.rename') }}</button>
                          <button type="button" [class]="link" [attr.aria-label]="i18n.t(payer.active ? 'billing.payers.deactivateOf' : 'billing.payers.activateOf', { name: payer.name })" (click)="toggle(payer)">{{ i18n.t(payer.active ? 'billing.payers.deactivate' : 'billing.payers.activate') }}</button>
                        </div>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="canManage() ? 4 : 3" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('billing.payers.empty') }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @for (current of panelRows(); track current.key) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="payers-panel-title">
              <h2 id="payers-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ current.title }}</h2>
              <app-form-builder #form [fields]="current.fields" [busy]="busy()" [formId]="'payers-' + current.key" (submitted)="submit($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class PayersPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(BillingGateway);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly link = LINK;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly payers = signal<readonly Payer[]>([]);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);

  protected readonly canManage = computed(() => hasPermission(this.session()?.permissions ?? [], 'billing.payers:manage'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));
  protected readonly panelRows = computed(() => {
    const panel = this.panel();
    const notice = this.notice();
    if (!panel) return [];
    return panel.kind === 'create'
      ? [{ key: 'create', title: this.i18n.t('billing.payers.addTitle'), fields: payerFields({ payer: null, notice }) }]
      : [{ key: `rename-${panel.payer.id}`, title: this.i18n.t('billing.payers.renameOf', { name: panel.payer.name }), fields: payerFields({ payer: panel.payer, notice }) }];
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.payers.set((await this.gateway.listPayers('', true, 0, 200)).items);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected isSelected(payer: Payer): boolean {
    const panel = this.panel();
    return !!panel && panel.kind === 'rename' && panel.payer.id === payer.id;
  }

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.panel.set(panel);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.panel.set(null);
  }

  protected async toggle(payer: Payer): Promise<void> {
    this.error.set(null);
    try {
      await this.gateway.setPayerActive(payer.id, !payer.active);
      this.toast.show(this.i18n.t(payer.active ? 'billing.payers.deactivated' : 'billing.payers.activated', { name: payer.name }));
      await this.load();
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    }
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    if (!panel) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      if (panel.kind === 'create') {
        const created = await this.gateway.createPayer(String(value['code']).trim(), String(value['name']).trim());
        this.toast.show(this.i18n.t('billing.payers.created', { name: created.name }));
      } else {
        const updated = await this.gateway.renamePayer(panel.payer.id, String(value['name']).trim());
        this.toast.show(this.i18n.t('billing.payers.renamed', { name: updated.name }));
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

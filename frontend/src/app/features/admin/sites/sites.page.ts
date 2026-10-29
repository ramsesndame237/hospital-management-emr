import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AdministrationGateway } from '../../../core/administration/administration.gateway';
import { Facility, FacilityStatus } from '../../../core/administration/administration.models';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { failureMessage } from '../admin-failure';
import { facilityFields, facilityStatusFields, failureNotice } from '../admin.forms';

type Panel =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly facility: Facility }
  | { readonly kind: 'status'; readonly facility: Facility };

/** ADM-32 — Sites : liste des établissements de l'organisation, création, modification et changement de statut. */
@Component({
  selector: 'app-sites-page',
  imports: [RouterLink, HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('admin.sites.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('admin.sites.lead') }}</p>
        </div>
        @if (canManage()) {
          <button hlmBtn type="button" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none" (click)="open({ kind: 'create' })">
            {{ i18n.t('admin.sites.add') }}
          </button>
        }
      </header>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="loadFailure()" formId="sites-load" />
      } @else {
        <div [class]="layoutClass()">
          <div class="min-w-0 overflow-x-auto border border-border bg-card">
            <table class="w-full text-left text-sm leading-6">
              <caption class="sr-only">{{ i18n.t('admin.sites.title') }}</caption>
              <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                <tr>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.sites.code') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.sites.name') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.sites.status') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('admin.actions') }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (facility of facilities(); track facility.id) {
                  <tr class="border-b border-border last:border-b-0" [class.bg-muted]="isSelected(facility)">
                    <td class="px-4 py-3 font-mono text-xs">{{ facility.code }}</td>
                    <td class="px-4 py-3 font-medium">{{ facility.name }}</td>
                    <td class="px-4 py-3"><app-status-tag [status]="facility.status" /></td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                        <a [routerLink]="['/admin/structure', facility.id]" class="rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{{ i18n.t('admin.sites.structure') }}</a>
                        @if (canManage()) {
                          <button type="button" class="rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" [attr.aria-label]="i18n.t('admin.sites.editOf', { name: facility.name })" (click)="open({ kind: 'edit', facility })">{{ i18n.t('admin.edit') }}</button>
                          <button type="button" class="rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" [attr.aria-label]="i18n.t('admin.sites.statusOf', { name: facility.name })" (click)="open({ kind: 'status', facility })">{{ i18n.t('admin.sites.status') }}</button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('admin.sites.empty') }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @for (current of panelRows(); track current.key) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" [attr.aria-labelledby]="'sites-panel-title'">
              <h2 id="sites-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t(current.titleKey, { name: current.name }) }}</h2>
              <app-form-builder #form [fields]="current.fields" [busy]="busy()" [formId]="'sites-' + current.key" (submitted)="submit($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class SitesPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(AdministrationGateway);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly facilities = signal<readonly Facility[]>([]);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);

  protected readonly canManage = computed(() => hasPermission(this.user()?.permissions ?? [], 'administration.facilities:manage'));
  protected readonly loadFailure = computed(() => failureNotice(this.loadError()));
  /** Liste seule, ou liste + panneau latéral de 400 px sur grand écran (classes écrites en entier pour Tailwind). */
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));

  /** Le panneau ouvert, avec ses champs ; une liste d'un élément pour que le formulaire soit recréé à chaque ouverture. */
  protected readonly panelRows = computed(() => {
    const panel = this.panel();
    const notice = this.notice();
    if (!panel) return [];
    switch (panel.kind) {
      case 'create':
        return [{ key: 'create', titleKey: 'admin.sites.addTitle', name: '', fields: facilityFields({ facility: null, notice }) }];
      case 'edit':
        return [{ key: `edit-${panel.facility.id}`, titleKey: 'admin.sites.editTitle', name: panel.facility.name, fields: facilityFields({ facility: panel.facility, notice }) }];
      case 'status':
        return [{ key: `status-${panel.facility.id}`, titleKey: 'admin.sites.statusTitle', name: panel.facility.name, fields: facilityStatusFields({ facility: panel.facility, notice }) }];
    }
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.facilities.set(await this.gateway.listFacilities());
    } catch (error) {
      this.loadError.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected isSelected(facility: Facility): boolean {
    const panel = this.panel();
    return !!panel && panel.kind !== 'create' && panel.facility.id === facility.id;
  }

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.panel.set(panel);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.panel.set(null);
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    if (!panel) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      if (panel.kind === 'create') {
        const created = await this.gateway.registerFacility({ name: String(value['name']), code: String(value['code']), status: value['status'] as FacilityStatus });
        this.facilities.update((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
        this.toast.show(this.i18n.t('admin.sites.created', { name: created.name }));
      } else if (panel.kind === 'edit') {
        const updated = await this.gateway.updateFacility(panel.facility.id, { name: String(value['name']), code: String(value['code']) });
        this.replace(updated);
        this.toast.show(this.i18n.t('admin.sites.updated', { name: updated.name }));
      } else {
        const updated = await this.gateway.changeFacilityStatus(panel.facility.id, value['status'] as FacilityStatus);
        this.replace(updated);
        this.toast.show(this.i18n.t('admin.sites.statusChanged', { name: updated.name }));
      }
      this.panel.set(null);
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  private replace(updated: Facility): void {
    this.facilities.update((list) => list.map((f) => (f.id === updated.id ? updated : f)).sort((a, b) => a.name.localeCompare(b.name)));
  }
}

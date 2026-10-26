import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdministrationGateway } from '../../../core/administration/administration.gateway';
import { Facility, Organization } from '../../../core/administration/administration.models';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema } from '../../../shared/form-builder/form-schema';
import { PanelCard } from '../../../shared/panel-card';
import { ToastService } from '../../../shared/toast/toast.service';
import { failureMessage } from '../admin-failure';
import { failureNotice, organizationFields } from '../admin.forms';

/** ADM-31 — Organisation : le nom de l'installation et un résumé de ses sites. Sans organisation, l'écran sert à la créer. */
@Component({
  selector: 'app-organization-page',
  imports: [RouterLink, PanelCard, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('admin.organization.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('admin.organization.lead') }}</p>
      </header>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="loadFailure()" formId="organization-load" />
      } @else {
        @if (!organization()) {
          <app-form-builder [fields]="firstRun" formId="organization-first-run" />
        }

        <div class="grid items-start gap-6 lg:grid-cols-2">
          <app-panel-card [heading]="i18n.t('admin.organization.identity')">
            @if (canManage()) {
              <app-form-builder #form [fields]="fields()" [busy]="saving()" formId="organization" (submitted)="save($event)" />
            } @else {
              <dl class="flex flex-col gap-1 text-sm leading-6">
                <dt class="text-muted-foreground">{{ i18n.t('admin.organization.name') }}</dt>
                <dd class="font-medium">{{ organization()?.name }}</dd>
              </dl>
              <app-form-builder [fields]="readOnly" formId="organization-readonly" />
            }
          </app-panel-card>

          <app-panel-card [heading]="i18n.t('admin.organization.sites')">
            <dl class="flex flex-col gap-3 text-sm leading-6">
              <div class="flex justify-between gap-4"><dt>{{ i18n.t('admin.organization.siteCount') }}</dt><dd class="font-mono">{{ facilities().length }}</dd></div>
              <div class="flex justify-between gap-4"><dt>{{ i18n.t('admin.organization.openCount') }}</dt><dd class="font-mono">{{ openCount() }}</dd></div>
            </dl>
            <a routerLink="/admin/sites" class="w-fit rounded-[2px] text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{{ i18n.t('admin.organization.manageSites') }}</a>
          </app-panel-card>
        </div>
      }
    </div>
  `,
})
export class OrganizationPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(AdministrationGateway);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly organization = signal<Organization | null>(null);
  protected readonly facilities = signal<readonly Facility[]>([]);
  protected readonly saving = signal(false);
  private readonly notice = signal<string | null>(null);

  protected readonly canManage = computed(() => hasPermission(this.user()?.permissions ?? [], 'administration.organization:manage'));
  protected readonly openCount = computed(() => this.facilities().filter((f) => f.operational).length);
  protected readonly firstRun: FieldSchema[] = [{ type: 'message', name: 'firstRun', tone: 'info', appearance: 'outlined', title: 'admin.organization.firstRunTitle', text: 'admin.organization.firstRunText' }];
  protected readonly readOnly: FieldSchema[] = [{ type: 'paragraph', name: 'readonly', text: 'admin.organization.readOnly', tone: 'muted' }];

  protected readonly fields = computed(() => organizationFields({ name: this.organization()?.name ?? '', exists: this.organization() !== null, notice: this.notice() }));
  protected readonly loadFailure = computed(() => failureNotice(this.loadError()));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.organization.set(await this.gateway.getOrganization());
      // Le résumé des sites est un plus : sans le droit de les lister, l'écran reste utilisable.
      this.facilities.set(await this.gateway.listFacilities().catch(() => []));
    } catch (error) {
      this.loadError.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(value: Record<string, unknown>): Promise<void> {
    this.notice.set(null);
    this.saving.set(true);
    try {
      const created = this.organization() === null;
      this.organization.set(await this.gateway.saveOrganization(String(value['name'])));
      this.toast.show(this.i18n.t(created ? 'admin.organization.created' : 'admin.organization.saved'));
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.saving.set(false);
    }
  }
}

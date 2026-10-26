import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { IdentityAdminGateway } from '../../../core/iam/identity-admin.gateway';
import { PermissionGroup, RoleInfo, groupPermissions } from '../../../core/iam/identity-admin.models';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { failureMessage } from '../admin-failure';
import { failureNotice } from '../admin.forms';
import { grantsText } from '../permission-text';
import { roleName } from '../users/users.forms';

const LINK = 'rounded-[2px] font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
const READ_ONLY: FieldSchema[] = [{ type: 'message', name: 'readOnly', tone: 'info', appearance: 'outlined', title: 'admin.roles.readOnlyTitle', text: 'admin.roles.readOnlyText' }];

/**
 * ADM — Rôles : ce que chaque rôle accorde, en lecture seule. Les rôles sont des données de l'installation ; leur création et
 * leur modification ne passent pas encore par l'interface (l'API n'expose que leur lecture).
 */
@Component({
  selector: 'app-roles-page',
  imports: [FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('admin.roles.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('admin.roles.lead') }}</p>
      </header>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="failure()" formId="roles-error" />
      } @else {
        <app-form-builder [fields]="readOnly" formId="roles-readonly" />
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('admin.roles.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.roles.role') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.roles.code') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.roles.type') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.roles.mfa') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.roles.permissions') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('admin.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (role of roles(); track role.code) {
                <tr class="border-b border-border last:border-b-0" [class.bg-muted]="isOpen(role)">
                  <td class="px-4 py-3 font-medium">{{ nameOf(role) }}</td>
                  <td class="px-4 py-3 font-mono text-xs">{{ role.code }}</td>
                  <td class="px-4 py-3"><app-status-tag [text]="i18n.t(role.isSystem ? 'admin.roles.system' : 'admin.roles.custom')" [tone]="role.isSystem ? 'neutral' : 'success'" /></td>
                  <td class="px-4 py-3">{{ i18n.t(role.requiresMfa ? 'admin.roles.mfaRequired' : 'admin.roles.mfaOptional') }}</td>
                  <td class="px-4 py-3 font-mono">{{ role.permissions.length }}</td>
                  <td class="px-4 py-3 text-right">
                    <button
                      type="button"
                      [class]="link"
                      [attr.aria-expanded]="isOpen(role)"
                      [attr.aria-controls]="'role-rights-' + role.code"
                      [attr.aria-label]="i18n.t(isOpen(role) ? 'admin.roles.hideOf' : 'admin.roles.showOf', { name: nameOf(role) })"
                      (click)="toggle(role)"
                    >{{ i18n.t(isOpen(role) ? 'admin.roles.hide' : 'admin.roles.show') }}</button>
                  </td>
                </tr>
                @if (isOpen(role)) {
                  <tr class="border-b border-border bg-muted last:border-b-0">
                    <td colspan="6" class="px-4 py-3" [id]="'role-rights-' + role.code">
                      @if (role.permissions.length === 0) {
                        <p class="text-muted-foreground">{{ i18n.t('admin.roles.none') }}</p>
                      } @else {
                        <ul class="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                          @for (group of groups(role); track group.resource) {
                            <li>
                              <span class="font-mono text-xs">{{ group.resource }}</span>
                              <span class="text-muted-foreground"> : {{ grants(group) }}</span>
                            </li>
                          }
                        </ul>
                      }
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('admin.roles.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class RolesPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(IdentityAdminGateway);

  protected readonly link = LINK;
  protected readonly readOnly = READ_ONLY;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly roles = signal<readonly RoleInfo[]>([]);
  private readonly open = signal<ReadonlySet<string>>(new Set());

  protected readonly failure = computed(() => failureNotice(this.loadError()));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.roles.set(await this.gateway.roles());
    } catch (error) {
      this.loadError.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected nameOf(role: RoleInfo): string {
    return roleName(this.i18n, role);
  }

  protected isOpen(role: RoleInfo): boolean {
    return this.open().has(role.code);
  }

  protected toggle(role: RoleInfo): void {
    this.open.update((set) => {
      const next = new Set(set);
      if (!next.delete(role.code)) next.add(role.code);
      return next;
    });
  }

  protected groups(role: RoleInfo): PermissionGroup[] {
    return groupPermissions(role.permissions);
  }

  protected grants(group: PermissionGroup): string {
    return grantsText(this.i18n, group);
  }
}

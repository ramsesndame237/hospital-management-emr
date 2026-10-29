import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { IdentityAdminGateway } from '../../../core/iam/identity-admin.gateway';
import { ManagedUser, PermissionGroup, RoleInfo, UserAccess, groupPermissions } from '../../../core/iam/identity-admin.models';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag, StatusTone } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { failureMessage } from '../admin-failure';
import { failureNotice } from '../admin.forms';
import { grantsText } from '../permission-text';
import { RoleChoice, confirmFields, createUserFields, createdUserFields, editRolesFields, roleChoices, roleName, selectedRoles } from './users.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

type Panel =
  | { readonly kind: 'create' }
  | { readonly kind: 'created'; readonly user: ManagedUser; readonly password: string }
  | { readonly kind: 'roles'; readonly user: ManagedUser }
  | { readonly kind: 'disable'; readonly user: ManagedUser }
  | { readonly kind: 'resetMfa'; readonly user: ManagedUser }
  | { readonly kind: 'access'; readonly user: ManagedUser };

interface PanelView {
  readonly key: string;
  readonly title: string;
  /** Formulaire du panneau ; `null` pour la lecture seule des droits. */
  readonly fields: FieldSchema[] | null;
}

/**
 * ADM — Utilisateurs : les comptes de l'installation. Création (mot de passe provisoire affiché une fois), remplacement des
 * rôles, désactivation, déverrouillage, réinitialisation de la double authentification et lecture des droits effectifs.
 * Un administrateur ne modifie pas son propre compte : l'API le refuse et l'écran ne le propose pas.
 */
@Component({
  selector: 'app-users-page',
  imports: [HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('admin.users.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('admin.users.lead') }}</p>
        </div>
        @if (canManage() && choices().length > 0) {
          <button hlmBtn type="button" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none" (click)="open({ kind: 'create' })">
            {{ i18n.t('admin.users.add') }}
          </button>
        }
      </header>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        @if (pageError()) {
          <app-form-builder [fields]="pageFailure()" formId="users-error" />
        }

        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-3">
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('admin.users.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.users.user') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.users.roles') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.users.state') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('admin.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of users(); track user.id) {
                    <tr class="border-b border-border last:border-b-0" [class.bg-muted]="isSelected(user)">
                      <td class="px-4 py-3">
                        <p class="font-medium">{{ user.username }}@if (isSelf(user)) {<span class="ml-2 text-xs font-normal text-muted-foreground">({{ i18n.t('admin.users.you') }})</span>}</p>
                        <p class="text-xs leading-[18px] text-muted-foreground">{{ user.email }}</p>
                      </td>
                      <td class="px-4 py-3">{{ rolesOf(user) }}</td>
                      <td class="px-4 py-3">
                        <app-status-tag [text]="stateOf(user).label" [tone]="stateOf(user).tone" />
                        <p class="mt-1 text-xs leading-[18px] text-muted-foreground">{{ i18n.t(user.mfaEnabled ? 'admin.users.mfaOn' : 'admin.users.mfaOff') }}</p>
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                          <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.users.accessOf', { name: user.username })" (click)="open({ kind: 'access', user })">{{ i18n.t('admin.users.access') }}</button>
                          @if (canManage() && !isSelf(user)) {
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.users.rolesOf', { name: user.username })" (click)="open({ kind: 'roles', user })">{{ i18n.t('admin.users.editRoles') }}</button>
                            @if (user.locked) {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.users.unlockOf', { name: user.username })" (click)="unlock(user)">{{ i18n.t('admin.users.unlock') }}</button>
                            }
                            @if (user.mfaEnabled) {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.users.resetMfaOf', { name: user.username })" (click)="open({ kind: 'resetMfa', user })">{{ i18n.t('admin.users.resetMfa') }}</button>
                            }
                            @if (user.active) {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.users.disableOf', { name: user.username })" (click)="open({ kind: 'disable', user })">{{ i18n.t('admin.users.disable') }}</button>
                            } @else {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.users.enableOf', { name: user.username })" (click)="enable(user)">{{ i18n.t('admin.users.enable') }}</button>
                            }
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="4" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('admin.users.empty') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (total() > pageSize) {
              <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('admin.users.pagination')">
                <p class="text-muted-foreground">{{ i18n.t('admin.users.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
                <div class="flex gap-4">
                  <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('admin.users.previous') }}</button>
                  <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('admin.users.next') }}</button>
                </div>
              </nav>
            }
          </div>

          @for (current of panelRows(); track current.key) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="users-panel-title">
              <h2 id="users-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ current.title }}</h2>
              @if (current.fields) {
                <app-form-builder #form [fields]="current.fields" [busy]="busy()" [formId]="'users-' + current.key" (submitted)="submit($event)" (action)="onAction($event)" />
              } @else if (accessLoading()) {
                <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
              } @else if (access(); as a) {
                <dl class="flex flex-col gap-3 text-sm leading-6">
                  <div>
                    <dt class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('admin.users.roles') }}</dt>
                    <dd>{{ accessRoles(a) }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('admin.users.departments') }}</dt>
                    <dd>{{ i18n.t('admin.users.departmentCount', { count: a.departments.length }) }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('admin.users.permissions') }}</dt>
                    <dd>
                      @if (!a.active) {
                        <p class="text-status-warning">{{ i18n.t('admin.users.inactiveNoRights') }}</p>
                      } @else if (a.permissions.length === 0) {
                        <p class="text-muted-foreground">{{ i18n.t('admin.users.noPermissions') }}</p>
                      } @else {
                        <ul class="flex flex-col gap-1">
                          @for (group of permissionGroups(a); track group.resource) {
                            <li>
                              <span class="font-mono text-xs">{{ group.resource }}</span>
                              <span class="text-muted-foreground"> : {{ grants(group) }}</span>
                            </li>
                          }
                        </ul>
                      }
                    </dd>
                  </div>
                </dl>
                <button type="button" hlmBtn variant="outline" class="h-auto min-h-11 w-full rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none" (click)="close()">{{ i18n.t('admin.close') }}</button>
              }
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class UsersPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(IdentityAdminGateway);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly loading = signal(true);
  protected readonly pageError = signal<string | null>(null);
  protected readonly users = signal<readonly ManagedUser[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly roles = signal<readonly RoleInfo[]>([]);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  protected readonly access = signal<UserAccess | null>(null);
  protected readonly accessLoading = signal(false);
  private readonly notice = signal<string | null>(null);

  protected readonly canManage = computed(() => hasPermission(this.session()?.permissions ?? [], 'iam.users:manage'));
  protected readonly choices = computed<RoleChoice[]>(() => roleChoices(this.i18n, this.roles()));
  protected readonly pageFailure = computed(() => failureNotice(this.pageError()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));

  protected readonly panelRows = computed<PanelView[]>(() => {
    const panel = this.panel();
    const notice = this.notice();
    const choices = this.choices();
    if (!panel) return [];
    switch (panel.kind) {
      case 'create':
        return [{ key: 'create', title: this.i18n.t('admin.users.addTitle'), fields: createUserFields({ roles: choices, notice }) }];
      case 'created':
        return [{ key: `created-${panel.user.id}`, title: this.i18n.t('admin.users.createdPanel'), fields: createdUserFields({ username: panel.user.username, password: panel.password }) }];
      case 'roles':
        return [{ key: `roles-${panel.user.id}`, title: this.i18n.t('admin.users.rolesOf', { name: panel.user.username }), fields: editRolesFields({ roles: choices, selected: panel.user.roles, notice }) }];
      case 'disable':
        return [{ key: `disable-${panel.user.id}`, title: this.i18n.t('admin.users.disableOf', { name: panel.user.username }), fields: confirmFields({ title: 'admin.users.disableTitle', text: 'admin.users.disableText', submit: 'admin.users.disable', notice }) }];
      case 'resetMfa':
        return [{ key: `reset-${panel.user.id}`, title: this.i18n.t('admin.users.resetMfaOf', { name: panel.user.username }), fields: confirmFields({ title: 'admin.users.resetMfaTitle', text: 'admin.users.resetMfaText', submit: 'admin.users.resetMfa', notice }) }];
      case 'access':
        return [{ key: `access-${panel.user.id}`, title: this.i18n.t('admin.users.accessOf', { name: panel.user.username }), fields: null }];
    }
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      await this.loadUsers();
      // Les rôles servent à libeller et attribuer : sans le droit de les lire, la liste reste utilisable (noms du catalogue).
      this.roles.set(await this.gateway.roles().catch(() => []));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      const page = await this.gateway.listUsers(this.offset(), PAGE_SIZE);
      this.users.set(page.items);
      this.total.set(page.total);
      this.pageError.set(null);
    } catch (error) {
      this.pageError.set(failureMessage(error, this.i18n));
    }
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    this.close();
    void this.loadUsers();
  }

  protected isSelf(user: ManagedUser): boolean {
    return user.id === this.session()?.id;
  }

  protected isSelected(user: ManagedUser): boolean {
    const panel = this.panel();
    return !!panel && panel.kind !== 'create' && panel.user.id === user.id;
  }

  protected rolesOf(user: ManagedUser): string {
    const known = new Map(this.roles().map((r) => [r.code, r]));
    return user.roles.map((code) => roleName(this.i18n, known.get(code) ?? { code, name: code })).join(' · ');
  }

  protected accessRoles(access: UserAccess): string {
    return access.roles.map((r) => roleName(this.i18n, r)).join(' · ');
  }

  protected permissionGroups(access: UserAccess) {
    return groupPermissions(access.permissions);
  }

  protected grants(group: PermissionGroup): string {
    return grantsText(this.i18n, group);
  }

  /** L'état le plus important d'un compte : désactivé, puis verrouillé, puis en attente d'activation, sinon actif. */
  protected stateOf(user: ManagedUser): { label: string; tone: StatusTone } {
    if (!user.active) return { label: this.i18n.t('admin.users.stateDisabled'), tone: 'critical' };
    if (user.locked) return { label: this.i18n.t('admin.users.stateLocked'), tone: 'warning' };
    if (user.mustChangePassword) return { label: this.i18n.t('admin.users.statePending'), tone: 'neutral' };
    return { label: this.i18n.t('admin.users.stateActive'), tone: 'success' };
  }

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.access.set(null);
    this.panel.set(panel);
    if (panel.kind === 'access') void this.loadAccess(panel.user.id);
  }

  protected close(): void {
    this.panel.set(null);
  }

  private async loadAccess(id: string): Promise<void> {
    this.accessLoading.set(true);
    try {
      const data = await this.gateway.access(id);
      if (this.panel()?.kind === 'access') this.access.set(data);
    } catch (error) {
      this.close();
      this.pageError.set(failureMessage(error, this.i18n));
    } finally {
      this.accessLoading.set(false);
    }
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel' || event.action === 'done') this.close();
  }

  protected async enable(user: ManagedUser): Promise<void> {
    await this.direct(() => this.gateway.setActive(user.id, true), this.i18n.t('admin.users.enabled', { name: user.username }));
  }

  protected async unlock(user: ManagedUser): Promise<void> {
    await this.direct(() => this.gateway.unlock(user.id), this.i18n.t('admin.users.unlocked', { name: user.username }));
  }

  /** Action sans confirmation (réversible et sans danger) : elle s'exécute, puis la liste est relue. */
  private async direct(action: () => Promise<unknown>, done: string): Promise<void> {
    this.pageError.set(null);
    try {
      await action();
      this.toast.show(done);
      await this.loadUsers();
    } catch (error) {
      this.pageError.set(failureMessage(error, this.i18n));
    }
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    if (!panel) return;
    this.notice.set(null);
    const chosen = selectedRoles(value, this.choices());
    if ((panel.kind === 'create' || panel.kind === 'roles') && chosen.length === 0) {
      this.notice.set(this.i18n.t('admin.users.rolesRequired'));
      return;
    }
    this.busy.set(true);
    try {
      switch (panel.kind) {
        case 'create': {
          const created = await this.gateway.createUser({ username: String(value['username']), email: String(value['email']), roles: chosen });
          this.panel.set({ kind: 'created', user: created.user, password: created.temporaryPassword });
          await this.loadUsers();
          return;
        }
        case 'roles':
          await this.gateway.assignRoles(panel.user.id, chosen);
          this.toast.show(this.i18n.t('admin.users.rolesSaved', { name: panel.user.username }));
          break;
        case 'disable':
          await this.gateway.setActive(panel.user.id, false);
          this.toast.show(this.i18n.t('admin.users.disabled', { name: panel.user.username }));
          break;
        case 'resetMfa':
          await this.gateway.resetMfa(panel.user.id);
          this.toast.show(this.i18n.t('admin.users.mfaReset', { name: panel.user.username }));
          break;
        default:
          return;
      }
      this.close();
      await this.loadUsers();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }
}

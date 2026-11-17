import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { IdentityAdminGateway } from '../../../core/iam/identity-admin.gateway';
import { ManagedUser } from '../../../core/iam/identity-admin.models';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { Assignment, ReferenceChoice, StaffMember, StaffStatus } from '../../../core/staff/staff.models';
import { StaffGateway } from '../../../core/staff/staff.gateway';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { failureMessage } from '../../../shared/failure-message';
import { failureNotice } from '../admin.forms';
import { assignFields, assignmentLabel, departFields, linkAccountFields, optional, staffFields, unlinkAccountFields } from './staff.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

type Panel =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly member: StaffMember }
  | { readonly kind: 'account'; readonly member: StaffMember }
  | { readonly kind: 'assignments'; readonly member: StaffMember }
  | { readonly kind: 'depart'; readonly member: StaffMember };

interface PanelView {
  readonly key: string;
  readonly title: string;
  readonly fields: FieldSchema[];
}

/**
 * ADM — Personnel : les fiches des personnes qui travaillent dans l'établissement. Création et modification, lien avec le
 * compte de connexion (sans lui, un médecin ou une infirmière ne voit aucun patient), affectations aux services et départ.
 * Une fiche n'est jamais supprimée : un départ est une date.
 */
@Component({
  selector: 'app-staff-page',
  imports: [HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('admin.staff.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('admin.staff.lead') }}</p>
        </div>
        @if (canManage()) {
          <button hlmBtn type="button" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none" (click)="open({ kind: 'create' })">
            {{ i18n.t('admin.staff.add') }}
          </button>
        }
      </header>

      <form class="flex flex-wrap items-end gap-3" role="search" (submit)="$event.preventDefault(); applySearch(searchInput.value)">
        <label class="flex min-w-60 flex-col gap-1 text-sm">
          <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('admin.staff.search') }}</span>
          <input #searchInput type="search" class="h-11 rounded-[2px] border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" [value]="search()" />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('admin.staff.situation') }}</span>
          <select #statusSelect class="h-11 rounded-[2px] border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" (change)="applyStatus(statusSelect.value)">
            <option value="" [selected]="status() === ''">{{ i18n.t('admin.staff.all') }}</option>
            <option value="ACTIVE" [selected]="status() === 'ACTIVE'">{{ i18n.t('admin.staff.statusACTIVE') }}</option>
            <option value="DEPARTED" [selected]="status() === 'DEPARTED'">{{ i18n.t('admin.staff.statusDEPARTED') }}</option>
          </select>
        </label>
        <button hlmBtn type="submit" variant="outline" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none">{{ i18n.t('admin.staff.searchSubmit') }}</button>
      </form>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        @if (pageError()) {
          <app-form-builder [fields]="pageFailure()" formId="staff-error" />
        }

        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-3">
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('admin.staff.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.staff.person') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.staff.profession') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.staff.account') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.staff.situation') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('admin.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (member of members(); track member.id) {
                    <tr class="border-b border-border last:border-b-0" [class.bg-muted]="isSelected(member)">
                      <td class="px-4 py-3">
                        <p class="font-medium">{{ member.lastName }} {{ member.firstName }}</p>
                        <p class="font-mono text-xs leading-[18px] text-muted-foreground">{{ member.staffNumber }}</p>
                      </td>
                      <td class="px-4 py-3">
                        {{ professionName(member.professionCode) }}
                        @if (member.specialtyCode) {
                          <p class="text-xs leading-[18px] text-muted-foreground">{{ specialtyName(member.specialtyCode) }}</p>
                        }
                      </td>
                      <td class="px-4 py-3">
                        @if (member.userId) {
                          <app-status-tag [text]="i18n.t('admin.staff.linked')" tone="success" />
                        } @else {
                          <app-status-tag [text]="i18n.t('admin.staff.notLinked')" tone="warning" />
                        }
                      </td>
                      <td class="px-4 py-3">
                        <app-status-tag [text]="i18n.t('admin.staff.status' + member.status)" [tone]="member.status === 'ACTIVE' ? 'success' : 'neutral'" />
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                          @if (canManage()) {
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.staff.editOf', { name: fullName(member) })" (click)="open({ kind: 'edit', member })">{{ i18n.t('admin.edit') }}</button>
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.staff.accountOf', { name: fullName(member) })" (click)="open({ kind: 'account', member })">{{ i18n.t('admin.staff.account') }}</button>
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.staff.assignmentsOf', { name: fullName(member) })" (click)="open({ kind: 'assignments', member })">{{ i18n.t('admin.staff.assignments') }}</button>
                            @if (member.status === 'ACTIVE' && !member.departedOn) {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.staff.departOf', { name: fullName(member) })" (click)="open({ kind: 'depart', member })">{{ i18n.t('admin.staff.depart') }}</button>
                            }
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('admin.staff.empty') }}</td>
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
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="staff-panel-title">
              <h2 id="staff-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ current.title }}</h2>
              @if (isAssignments()) {
                <ul class="flex flex-col gap-2 text-sm leading-6" [attr.aria-label]="i18n.t('admin.staff.assignments')">
                  @for (row of assignments(); track row.id) {
                    <li class="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-b-0">
                      <div>
                        <p class="font-medium">{{ serviceName(row) }}@if (row.primary) {<span class="ml-2 text-xs font-normal text-muted-foreground">({{ i18n.t('admin.staff.primary') }})</span>}</p>
                        <p class="text-xs leading-[18px] text-muted-foreground">{{ period(row) }}</p>
                      </div>
                      @if (row.current) {
                        <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.staff.endOf', { name: serviceName(row) })" (click)="endAssignment(row)">{{ i18n.t('admin.staff.end') }}</button>
                      }
                    </li>
                  } @empty {
                    <li class="text-muted-foreground">{{ i18n.t('admin.staff.noAssignments') }}</li>
                  }
                </ul>
              }
              <app-form-builder #form [fields]="current.fields" [busy]="busy()" [formId]="'staff-' + current.key" (submitted)="submit($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class StaffPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(StaffGateway);
  private readonly accounts = inject(IdentityAdminGateway);
  private readonly reception = inject(ReceptionGateway);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly loading = signal(true);
  protected readonly pageError = signal<string | null>(null);
  protected readonly members = signal<readonly StaffMember[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly search = signal('');
  protected readonly status = signal<StaffStatus | ''>('');
  protected readonly professions = signal<readonly ReferenceChoice[]>([]);
  protected readonly specialties = signal<readonly ReferenceChoice[]>([]);
  protected readonly services = signal<readonly { readonly id: string; readonly name: string }[]>([]);
  protected readonly accountChoices = signal<readonly ManagedUser[]>([]);
  protected readonly assignments = signal<readonly Assignment[]>([]);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);

  protected readonly canManage = computed(() => hasPermission(this.session()?.permissions ?? [], 'staff:manage'));
  protected readonly pageFailure = computed(() => failureNotice(this.pageError()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));
  protected readonly isAssignments = computed(() => this.panel()?.kind === 'assignments');

  protected readonly panelRows = computed<PanelView[]>(() => {
    const panel = this.panel();
    const notice = this.notice();
    if (!panel) return [];
    const professions = this.professions();
    const specialties = this.specialties();
    switch (panel.kind) {
      case 'create':
        return [{ key: 'create', title: this.i18n.t('admin.staff.addTitle'), fields: staffFields({ member: null, professions, specialties, notice }) }];
      case 'edit':
        return [{ key: `edit-${panel.member.id}`, title: this.i18n.t('admin.staff.editOf', { name: this.fullName(panel.member) }), fields: staffFields({ member: panel.member, professions, specialties, notice }) }];
      case 'account':
        return [{
          key: `account-${panel.member.id}-${panel.member.userId ?? 'none'}`,
          title: this.i18n.t('admin.staff.accountOf', { name: this.fullName(panel.member) }),
          fields: panel.member.userId ? unlinkAccountFields({ notice }) : linkAccountFields({ users: this.accountChoices(), notice }),
        }];
      case 'assignments':
        return [{ key: `assign-${panel.member.id}`, title: this.i18n.t('admin.staff.assignmentsOf', { name: this.fullName(panel.member) }), fields: assignFields({ services: this.services(), notice }) }];
      case 'depart':
        return [{ key: `depart-${panel.member.id}`, title: this.i18n.t('admin.staff.departOf', { name: this.fullName(panel.member) }), fields: departFields({ notice }) }];
    }
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      await this.loadMembers();
      // Libellés et listes de choix : sans eux la liste reste utilisable (codes affichés tels quels).
      this.professions.set(await this.gateway.professions().catch(() => []));
      this.specialties.set(await this.gateway.specialties().catch(() => []));
      this.services.set(await this.reception.listServices().catch(() => []));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMembers(): Promise<void> {
    try {
      const page = await this.gateway.list({ search: this.search() || undefined, status: this.status() || undefined, offset: this.offset(), limit: PAGE_SIZE });
      this.members.set(page.items);
      this.total.set(page.total);
      this.pageError.set(null);
    } catch (error) {
      this.pageError.set(failureMessage(error, this.i18n));
    }
  }

  protected applySearch(value: string): void {
    this.search.set(value.trim());
    this.offset.set(0);
    this.close();
    void this.loadMembers();
  }

  protected applyStatus(value: string): void {
    this.status.set(value === 'ACTIVE' || value === 'DEPARTED' ? value : '');
    this.offset.set(0);
    this.close();
    void this.loadMembers();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    this.close();
    void this.loadMembers();
  }

  protected fullName(member: StaffMember): string {
    return `${member.firstName} ${member.lastName}`;
  }

  protected professionName(code: string): string {
    return this.professions().find((p) => p.code === code)?.label ?? code;
  }

  protected specialtyName(code: string): string {
    return this.specialties().find((p) => p.code === code)?.label ?? code;
  }

  protected serviceName(row: Assignment): string {
    return assignmentLabel(row, this.services());
  }

  protected period(row: Assignment): string {
    return row.endDate ? this.i18n.t('admin.staff.periodClosed', { from: row.startDate, to: row.endDate }) : this.i18n.t('admin.staff.periodOpen', { from: row.startDate });
  }

  protected isSelected(member: StaffMember): boolean {
    const panel = this.panel();
    return !!panel && panel.kind !== 'create' && panel.member.id === member.id;
  }

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.panel.set(panel);
    if (panel.kind === 'assignments') void this.loadAssignments(panel.member.id);
    if (panel.kind === 'account' && !panel.member.userId) void this.loadAccountChoices();
  }

  protected close(): void {
    this.panel.set(null);
  }

  private async loadAssignments(id: string): Promise<void> {
    this.assignments.set([]);
    try {
      this.assignments.set(await this.gateway.assignments(id));
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n));
    }
  }

  /** Les comptes actifs non encore reliés à une fiche de cette page ; l'API refuse de toute façon un compte déjà pris. */
  private async loadAccountChoices(): Promise<void> {
    try {
      const taken = new Set(this.members().map((m) => m.userId).filter((id): id is string => !!id));
      const page = await this.accounts.listUsers(0, 200);
      this.accountChoices.set(page.items.filter((u) => u.active && !taken.has(u.id)));
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n));
    }
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.close();
  }

  protected async endAssignment(row: Assignment): Promise<void> {
    this.notice.set(null);
    try {
      await this.gateway.endAssignment(row.id);
      this.toast.show(this.i18n.t('admin.staff.ended', { name: this.serviceName(row) }));
      const panel = this.panel();
      if (panel?.kind === 'assignments') await this.loadAssignments(panel.member.id);
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n));
    }
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    if (!panel) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      switch (panel.kind) {
        case 'create': {
          const created = await this.gateway.register({
            staffNumber: String(value['staffNumber']).trim(),
            firstName: String(value['firstName']).trim(),
            lastName: String(value['lastName']).trim(),
            professionCode: String(value['professionCode']),
            specialtyCode: optional(value['specialtyCode']),
            email: optional(value['email']),
            phone: optional(value['phone']),
            hiredOn: optional(value['hiredOn']),
          });
          this.toast.show(this.i18n.t('admin.staff.created', { name: this.fullName(created) }));
          break;
        }
        case 'edit': {
          const updated = await this.gateway.update(panel.member.id, {
            firstName: String(value['firstName']).trim(),
            lastName: String(value['lastName']).trim(),
            professionCode: String(value['professionCode']),
            specialtyCode: optional(value['specialtyCode']) ?? null,
            email: optional(value['email']) ?? null,
            phone: optional(value['phone']) ?? null,
            hiredOn: optional(value['hiredOn']) ?? null,
          });
          this.toast.show(this.i18n.t('admin.staff.updated', { name: this.fullName(updated) }));
          break;
        }
        case 'account':
          if (panel.member.userId) {
            await this.gateway.unlinkAccount(panel.member.id);
            this.toast.show(this.i18n.t('admin.staff.unlinked', { name: this.fullName(panel.member) }));
          } else {
            await this.gateway.linkAccount(panel.member.id, String(value['userId']));
            this.toast.show(this.i18n.t('admin.staff.linkedDone', { name: this.fullName(panel.member) }));
          }
          break;
        case 'depart':
          await this.gateway.depart(panel.member.id, optional(value['departedOn']));
          this.toast.show(this.i18n.t('admin.staff.departed', { name: this.fullName(panel.member) }));
          break;
        case 'assignments':
          await this.gateway.assign(panel.member.id, { nodeId: String(value['nodeId']), startDate: optional(value['startDate']), primary: value['primary'] === true });
          this.toast.show(this.i18n.t('admin.staff.assigned', { name: this.fullName(panel.member) }));
          await this.loadAssignments(panel.member.id);
          return;
      }
      this.close();
      await this.loadMembers();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AdministrationGateway } from '../../../core/administration/administration.gateway';
import { Facility, NodeKind, ReferenceOption, ServiceType, StructureNode, StructureTree, childKindOf } from '../../../core/administration/administration.models';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { ToastService } from '../../../shared/toast/toast.service';
import { failureMessage } from '../../../shared/failure-message';
import { childFields, deactivateFields, failureNotice, serviceFields } from '../admin.forms';

type Panel =
  | { readonly kind: 'service' }
  | { readonly kind: 'child'; readonly parent: StructureNode }
  | { readonly kind: 'edit'; readonly node: StructureNode }
  | { readonly kind: 'deactivate'; readonly node: StructureNode };

interface Row {
  readonly node: StructureNode;
  readonly depth: number;
  readonly open: boolean;
}

const FILTER: FieldSchema[] = [{ type: 'checkbox', name: 'inactive', label: 'admin.structure.showInactive' }];
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Identifiants de tous les éléments qui en contiennent d'autres : l'arbre s'ouvre entièrement à la première lecture. */
function parentsOf(nodes: readonly StructureNode[]): string[] {
  return nodes.flatMap((n) => (n.children.length > 0 ? [n.id, ...parentsOf(n.children)] : []));
}

/**
 * ADM-33 / ADM-34 — Structure d'un site : services, unités, salles et lits. Le niveau d'un élément est imposé par son parent ;
 * le code ne change plus après la création ; rien n'est supprimé, on désactive (avec confirmation) et on peut réactiver.
 */
@Component({
  selector: 'app-structure-page',
  imports: [RouterLink, HlmButtonImports, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('admin.structure.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('admin.structure.lead') }}</p>
        </div>
        @if (canManage() && tree()) {
          <button hlmBtn type="button" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none" (click)="open({ kind: 'service' })">
            {{ i18n.t('admin.structure.addService') }}
          </button>
        }
      </header>

      @if (loadingSites()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (facilities().length === 0 && pageError()) {
        <app-form-builder [fields]="pageFailure()" formId="structure-sites-error" />
      } @else if (facilities().length === 0) {
        <div class="flex flex-col gap-2 border border-border bg-card p-6 text-sm leading-6">
          <p class="text-muted-foreground">{{ i18n.t('admin.structure.noSites') }}</p>
          <a routerLink="/admin/sites" [class]="link">{{ i18n.t('admin.structure.goToSites') }}</a>
        </div>
      } @else {
        <nav [attr.aria-label]="i18n.t('admin.structure.siteTabs')" class="flex flex-wrap gap-x-1 border-b border-border">
          @for (facility of facilities(); track facility.id) {
            <a
              [routerLink]="['/admin/structure', facility.id]"
              class="-mb-px border-b-2 px-4 py-2 text-sm leading-6 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              [class]="facility.id === facilityId() ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
              [attr.aria-current]="facility.id === facilityId() ? 'page' : null"
            >{{ facility.name }}</a>
          }
        </nav>

        @if (pageError()) {
          <app-form-builder [fields]="pageFailure()" formId="structure-error" />
        }

        @if (tree()) {
          <dl class="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
            @for (total of totals(); track total.key) {
              <div class="flex flex-col bg-card p-4">
                <dt class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t(total.label) }}</dt>
                <dd class="font-mono text-2xl leading-8 font-semibold text-foreground">{{ total.value }}</dd>
              </div>
            }
          </dl>

          <div class="flex flex-wrap items-center justify-between gap-4">
            <app-form-builder [fields]="filter" formId="structure-filter" class="min-w-0" (valueChange)="showInactive.set($event['inactive'] === true)" />
            <div class="flex gap-4 text-sm">
              <button type="button" [class]="link" (click)="expandAll()">{{ i18n.t('admin.structure.expandAll') }}</button>
              <button type="button" [class]="link" (click)="collapseAll()">{{ i18n.t('admin.structure.collapseAll') }}</button>
            </div>
          </div>

          <div [class]="layoutClass()">
            <div class="min-w-0 overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('admin.structure.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.structure.name') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.structure.level') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.structure.code') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.structure.details') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('admin.structure.state') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('admin.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.node.id) {
                    <tr class="border-b border-border last:border-b-0" [class.bg-muted]="isSelected(row.node)" [class.text-muted-foreground]="!row.node.active">
                      <td class="px-4 py-2" [style.padding-left.px]="16 + row.depth * 24">
                        <div class="flex items-center gap-2">
                          @if (row.node.children.length > 0) {
                            <button
                              type="button"
                              class="grid size-6 shrink-0 place-items-center rounded-[2px] border border-border font-mono text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                              [attr.aria-expanded]="row.open"
                              [attr.aria-label]="i18n.t(row.open ? 'admin.structure.collapse' : 'admin.structure.expand', { name: row.node.name })"
                              (click)="toggle(row.node.id)"
                            >{{ row.open ? '−' : '+' }}</button>
                          } @else {
                            <span class="size-6 shrink-0" aria-hidden="true"></span>
                          }
                          <span [class.font-medium]="row.depth === 0">{{ row.node.name }}</span>
                        </div>
                      </td>
                      <td class="px-4 py-2">{{ i18n.t('server.structure.' + row.node.kind) }}</td>
                      <td class="px-4 py-2 font-mono text-xs">{{ row.node.code }}</td>
                      <td class="px-4 py-2">{{ details(row.node) }}</td>
                      <td class="px-4 py-2">{{ i18n.t(row.node.active ? 'admin.structure.active' : 'admin.structure.inactive') }}</td>
                      <td class="px-4 py-2">
                        @if (canManage()) {
                          <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                            @if (row.node.active && childKind(row.node); as child) {
                              <button type="button" [class]="link" (click)="open({ kind: 'child', parent: row.node })">{{ i18n.t('admin.structure.add.' + child) }}</button>
                            }
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.structure.editOf', { name: row.node.name })" (click)="open({ kind: 'edit', node: row.node })">{{ i18n.t('admin.edit') }}</button>
                            @if (row.node.active) {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.structure.deactivateOf', { name: row.node.name })" (click)="open({ kind: 'deactivate', node: row.node })">{{ i18n.t('admin.structure.deactivate') }}</button>
                            } @else {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('admin.structure.reactivateOf', { name: row.node.name })" (click)="reactivate(row.node)">{{ i18n.t('admin.structure.reactivate') }}</button>
                            }
                          </div>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('admin.structure.empty') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @for (current of panelRows(); track current.key) {
              <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="structure-panel-title">
                <h2 id="structure-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ current.title }}</h2>
                <app-form-builder #form [fields]="current.fields" [busy]="busy()" [formId]="'structure-' + current.key" (submitted)="submit($event)" (action)="onAction($event)" />
              </aside>
            }
          </div>
        } @else if (loadingTree()) {
          <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
        }
      }
    </div>
  `,
})
export class StructurePage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(AdministrationGateway);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  /** Identifiant du site, lu dans l'adresse (`/admin/structure/:facilityId`). */
  readonly facilityId = input<string>();

  protected readonly link = LINK;
  protected readonly filter = FILTER;
  protected readonly loadingSites = signal(true);
  protected readonly loadingTree = signal(false);
  protected readonly facilities = signal<readonly Facility[]>([]);
  protected readonly tree = signal<StructureTree | null>(null);
  protected readonly showInactive = signal(false);
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  protected readonly pageError = signal<string | null>(null);
  private readonly notice = signal<string | null>(null);
  private readonly specialties = signal<readonly ReferenceOption[]>([]);
  private shownFacility: string | undefined;

  protected readonly canManage = computed(() => hasPermission(this.user()?.permissions ?? [], 'administration.structure:manage'));
  protected readonly pageFailure = computed(() => failureNotice(this.pageError()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));

  protected readonly totals = computed(() => {
    const t = this.tree()?.totals;
    return [
      { key: 'services', label: 'admin.structure.totals.services', value: t?.services ?? 0 },
      { key: 'units', label: 'admin.structure.totals.units', value: t?.units ?? 0 },
      { key: 'rooms', label: 'admin.structure.totals.rooms', value: t?.rooms ?? 0 },
      { key: 'beds', label: 'admin.structure.totals.beds', value: t?.beds ?? 0 },
    ];
  });

  /** L'arbre aplati en lignes (profondeur d'abord) : seuls les éléments dont tous les ancêtres sont ouverts sont listés. */
  protected readonly rows = computed<Row[]>(() => {
    const open = this.expanded();
    const out: Row[] = [];
    const walk = (nodes: readonly StructureNode[], depth: number): void => {
      for (const node of nodes) {
        const isOpen = open.has(node.id);
        out.push({ node, depth, open: isOpen });
        if (isOpen) walk(node.children, depth + 1);
      }
    };
    walk(this.tree()?.services ?? [], 0);
    return out;
  });

  protected readonly panelRows = computed(() => {
    const panel = this.panel();
    const notice = this.notice();
    if (!panel) return [];
    const specialties = this.specialties();
    switch (panel.kind) {
      case 'service':
        return [{ key: 'service', title: this.i18n.t('admin.structure.addServiceTitle'), fields: serviceFields({ node: null, specialties, notice }) }];
      case 'child': {
        const kind = childKindOf(panel.parent.kind) as NodeKind;
        return [{ key: `child-${panel.parent.id}`, title: this.i18n.t(`admin.structure.add.${kind}`) + ' · ' + panel.parent.name, fields: childFields({ kind, node: null, notice }) }];
      }
      case 'edit': {
        const { node } = panel;
        const fields = node.kind === 'SERVICE' ? serviceFields({ node, specialties, notice }) : childFields({ kind: node.kind, node, notice });
        return [{ key: `edit-${node.id}`, title: this.i18n.t('admin.structure.editTitle', { name: node.name }), fields }];
      }
      case 'deactivate': {
        const { node } = panel;
        return [{ key: `deactivate-${node.id}`, title: this.i18n.t('admin.structure.deactivateOf', { name: node.name }), fields: deactivateFields({ node, blocked: node.children.some((c) => c.active), notice }) }];
      }
    }
  });

  constructor() {
    void this.loadSites();
    void this.gateway.specialties().then((list) => this.specialties.set(list)).catch(() => undefined);
    // Le site affiché (adresse) ou le filtre « désactivés » change : on relit l'arbre.
    effect(() => {
      const id = this.facilityId();
      const inactive = this.showInactive();
      untracked(() => {
        // Changer de site repart de zéro (arbre vidé, branches ouvertes) ; changer le filtre relit l'arbre sans le faire disparaître.
        const switching = id !== this.shownFacility;
        this.shownFacility = id;
        if (id) void this.loadTree(id, inactive, switching);
        else this.tree.set(null);
      });
    });
  }

  private async loadSites(): Promise<void> {
    try {
      const list = await this.gateway.listFacilities();
      this.facilities.set(list);
      if (!this.facilityId() && list.length > 0) await this.router.navigate(['/admin/structure', list[0].id], { replaceUrl: true });
    } catch (error) {
      this.pageError.set(failureMessage(error, this.i18n));
    } finally {
      this.loadingSites.set(false);
    }
  }

  /** Lit l'arbre d'un site. `reset` : on arrive sur ce site (arbre vidé pendant la lecture, toutes les branches ouvertes). */
  private async loadTree(facilityId: string, includeInactive: boolean, reset: boolean): Promise<void> {
    if (reset) {
      this.tree.set(null);
      this.loadingTree.set(true);
    }
    try {
      const tree = await this.gateway.structure(facilityId, includeInactive);
      if (facilityId !== this.shownFacility) return; // l'utilisateur a changé de site entre-temps : cette réponse est périmée
      this.tree.set(tree);
      this.pageError.set(null);
      if (reset) this.expanded.set(new Set(parentsOf(tree.services)));
    } catch (error) {
      if (facilityId !== this.shownFacility) return;
      this.tree.set(null);
      this.pageError.set(failureMessage(error, this.i18n));
    } finally {
      if (facilityId === this.shownFacility) this.loadingTree.set(false);
    }
  }

  private reload(): Promise<void> {
    const id = this.facilityId();
    return id ? this.loadTree(id, this.showInactive(), false) : Promise.resolve();
  }

  protected childKind(node: StructureNode): NodeKind | null {
    return childKindOf(node.kind);
  }

  protected details(node: StructureNode): string {
    if (node.kind === 'SERVICE') {
      const type = node.serviceType ? this.i18n.t(`server.structure.${node.serviceType}`) : '';
      const specialty = node.specialtyCode ? (this.specialties().find((s) => s.code === node.specialtyCode)?.label ?? node.specialtyCode) : '';
      return [type, specialty].filter(Boolean).join(' · ');
    }
    return node.floor ? this.i18n.t('admin.structure.floorValue', { floor: node.floor }) : '';
  }

  protected isSelected(node: StructureNode): boolean {
    const panel = this.panel();
    return !!panel && (panel.kind === 'edit' || panel.kind === 'deactivate') && panel.node.id === node.id;
  }

  protected toggle(id: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected expandAll(): void {
    this.expanded.set(new Set(parentsOf(this.tree()?.services ?? [])));
  }

  protected collapseAll(): void {
    this.expanded.set(new Set());
  }

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.panel.set(panel);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.panel.set(null);
  }

  protected async reactivate(node: StructureNode): Promise<void> {
    this.pageError.set(null);
    try {
      await this.gateway.setNodeActive(node.id, true);
      this.toast.show(this.i18n.t('admin.structure.reactivated', { name: node.name }));
      await this.reload();
    } catch (error) {
      this.pageError.set(failureMessage(error, this.i18n));
    }
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    const facilityId = this.facilityId();
    if (!panel || !facilityId) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      const text = (name: string): string => String(value[name] ?? '');
      switch (panel.kind) {
        case 'service': {
          const specialtyCode = text('specialtyCode');
          const created = await this.gateway.createService(facilityId, {
            code: text('code'), name: text('name'), serviceType: text('serviceType') as ServiceType, ...(specialtyCode ? { specialtyCode } : {}),
          });
          this.toast.show(this.i18n.t('admin.structure.created', { name: created.name }));
          break;
        }
        case 'child': {
          const floor = text('floor');
          const created = await this.gateway.createChild(panel.parent.id, { code: text('code'), name: text('name'), ...(floor ? { floor } : {}) });
          this.expanded.update((set) => new Set(set).add(panel.parent.id));
          this.toast.show(this.i18n.t('admin.structure.created', { name: created.name }));
          break;
        }
        case 'edit': {
          const { node } = panel;
          const changes = node.kind === 'SERVICE'
            ? { name: text('name'), serviceType: text('serviceType') as ServiceType, specialtyCode: text('specialtyCode') || null }
            : node.kind === 'ROOM'
              ? { name: text('name'), floor: text('floor') || null }
              : { name: text('name') };
          await this.gateway.updateNode(node.id, changes);
          this.toast.show(this.i18n.t('admin.structure.updated', { name: text('name') }));
          break;
        }
        case 'deactivate': {
          await this.gateway.setNodeActive(panel.node.id, false);
          this.toast.show(this.i18n.t('admin.structure.deactivated', { name: panel.node.name }));
          break;
        }
      }
      this.panel.set(null);
      await this.reload();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }
}

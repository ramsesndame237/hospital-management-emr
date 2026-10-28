import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { LabTest, ReferenceRange, Section, TestChanges, TestFilter, TestInput } from '../../../core/lab/lab.models';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { catalogFilterFields, catalogManageFilterFields, testFormFields } from '../lab.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none';
const CELL = 'h-9 w-full min-w-20 border border-input bg-background px-2 font-mono text-sm rounded-[2px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

type Panel = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly test: LabTest } | { readonly kind: 'ranges'; readonly test: LabTest };

/** Une tranche en cours de saisie : tout est du texte tant qu'elle n'est pas enregistrée. */
interface RangeRow {
  sex: 'ANY' | 'FEMALE' | 'MALE';
  ageMin: string;
  ageMax: string;
  low: string;
  high: string;
  critLow: string;
  critHigh: string;
}

const FIELDS = ['ageMin', 'ageMax', 'low', 'high', 'critLow', 'critHigh'] as const;

/**
 * Catalogue des analyses : section, échantillon, délai de rendu et valeurs de référence par sexe et tranche d'âge, avec leurs seuils critiques.
 * Qui le gère (administrateur système) crée, modifie, retire et remet des analyses, et tient leurs valeurs de référence ; les autres le consultent.
 */
@Component({
  selector: 'app-lab-catalog-page',
  imports: [FormBuilderComponent, HlmButtonImports, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('lab.catalog.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('lab.catalog.lead') }}</p>
        </div>
        @if (canManage()) {
          <button hlmBtn type="button" [class]="primary" (click)="open({ kind: 'create' })">{{ i18n.t('lab.manage.new') }}</button>
        }
      </header>

      <app-form-builder [fields]="filterFields()" formId="lab-catalog-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="lab-catalog-error" />
      }

      <div [class]="layoutClass()">
        <div class="flex min-w-0 flex-col gap-4">
          @if (loading()) {
            <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
          } @else {
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('lab.catalog.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.catalog.code') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.catalog.name') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.catalog.specimen') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.catalog.tat') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('lab.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of tests(); track t.id) {
                    <tr class="border-b border-border align-top" [class.opacity-60]="!t.active">
                      <td class="px-4 py-3 font-mono text-xs">{{ t.code }}</td>
                      <td class="px-4 py-3">
                        <span class="font-medium">{{ t.name }}</span>
                        @if (!t.active) {
                          <app-status-tag class="ml-2" tone="neutral" [text]="i18n.t('lab.manage.inactive')" />
                        }
                        <span class="block text-xs text-muted-foreground">{{ i18n.t('lab.section.' + t.section) }}@if (t.unit) { · {{ t.unit }}}</span>
                      </td>
                      <td class="px-4 py-3">{{ i18n.t('lab.specimenType.' + t.specimenType) }}<span class="block text-xs text-muted-foreground">{{ i18n.t('lab.container.' + t.container) }}</span></td>
                      <td class="px-4 py-3 whitespace-nowrap">{{ i18n.t('lab.catalog.tatMinutes', { minutes: t.tatMinutes }) }}</td>
                      <td class="px-4 py-3 text-right">
                        <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                          <button type="button" [class]="link" [attr.aria-expanded]="isOpen(t)" [attr.aria-label]="i18n.t('lab.catalog.showRanges', { name: t.name })" (click)="toggle(t)">{{ i18n.t(isOpen(t) ? 'lab.catalog.hide' : 'lab.catalog.open') }}</button>
                          @if (canManage()) {
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('lab.manage.editOf', { name: t.name })" (click)="open({ kind: 'edit', test: t })">{{ i18n.t('lab.manage.edit') }}</button>
                            @if (t.resultType === 'NUMERIC') {
                              <button type="button" [class]="link" [attr.aria-label]="i18n.t('lab.manage.rangesOf', { name: t.name })" (click)="openRanges(t)">{{ i18n.t('lab.manage.rangesEdit') }}</button>
                            }
                            <button type="button" [class]="link" [disabled]="busy()" [attr.aria-label]="i18n.t(t.active ? 'lab.manage.deactivateOf' : 'lab.manage.activateOf', { name: t.name })" (click)="toggleActive(t)">
                              {{ i18n.t(t.active ? 'lab.manage.deactivate' : 'lab.manage.activate') }}
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                    @if (isOpen(t)) {
                      <tr class="border-b border-border bg-muted/40">
                        <td></td>
                        <td colspan="4" class="px-4 py-3">
                          <h3 class="text-xs font-semibold text-muted-foreground">{{ i18n.t('lab.catalog.ranges') }}</h3>
                          @if (t.resultType === 'CHOICE') {
                            <p>{{ i18n.t('lab.catalog.choices', { values: t.choices.join(', ') }) }}</p>
                          } @else if (t.resultType === 'TEXT') {
                            <p>{{ i18n.t('lab.catalog.text') }}</p>
                          } @else {
                            <ul class="flex flex-col gap-1">
                              @for (r of t.ranges; track $index) {
                                <li>{{ rangeText(t, r) }}@if (criticalText(t, r); as c) { · <span class="text-status-critical">{{ c }}</span>}</li>
                              } @empty {
                                <li class="text-muted-foreground">{{ i18n.t('lab.catalog.noRanges') }}</li>
                              }
                            </ul>
                          }
                          @if (t.instructions) {
                            <p class="mt-2 text-xs text-muted-foreground">{{ i18n.t('lab.catalog.instructions', { text: t.instructions }) }}</p>
                          }
                        </td>
                      </tr>
                    }
                  } @empty {
                    <tr>
                      <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('lab.catalog.empty') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (total() > pageSize) {
              <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('lab.catalog.pagination')">
                <p class="text-muted-foreground">{{ i18n.t('lab.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
                <div class="flex gap-4">
                  <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('lab.previous') }}</button>
                  <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('lab.next') }}</button>
                </div>
              </nav>
            }
          }
        </div>

        @if (panel(); as current) {
          <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="catalog-panel-title">
            <h2 id="catalog-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ panelTitle() }}</h2>
            @if (current.kind === 'ranges') {
              <p class="text-xs leading-5 text-muted-foreground">{{ i18n.t('lab.manage.rangesHint') }}</p>
              @if (rangeNotice()) {
                <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ rangeNotice() }}</p>
              }
              @if (rows().length === 0) {
                <p class="text-sm text-muted-foreground">{{ i18n.t('lab.manage.noRanges') }}</p>
              }
              <div class="flex flex-col gap-4">
                @for (row of rows(); track $index; let i = $index) {
                  <fieldset class="flex flex-col gap-2 border border-border p-3">
                    <legend class="px-1 text-xs text-muted-foreground">{{ i + 1 }}</legend>
                    <label class="flex flex-col gap-1 text-xs">{{ i18n.t('lab.manage.sex') }}
                      <select [class]="cell" [id]="'range-' + i + '-sex'" [value]="row.sex" (change)="setSex(i, $any($event.target).value)">
                        @for (s of sexes; track s) {
                          <option [value]="s" [selected]="row.sex === s">{{ i18n.t('lab.catalog.sex.' + s) }}</option>
                        }
                      </select>
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                      @for (f of fields; track f) {
                        <label class="flex flex-col gap-1 text-xs">{{ i18n.t('lab.manage.' + f) }}
                          <input [class]="cell" [id]="'range-' + i + '-' + f" type="text" inputmode="decimal" [value]="row[f]" (input)="setField(i, f, $any($event.target).value)" />
                        </label>
                      }
                    </div>
                    <button type="button" [class]="link" class="w-fit text-xs" [attr.aria-label]="i18n.t('lab.manage.removeRange', { n: i + 1 })" (click)="removeRow(i)">{{ i18n.t('lab.new.remove') }}</button>
                  </fieldset>
                }
              </div>
              <div class="flex flex-col gap-3">
                <button type="button" [class]="link" class="w-fit text-sm" (click)="addRow()">{{ i18n.t('lab.manage.addRange') }}</button>
                <button hlmBtn type="button" [class]="primary" [disabled]="busy()" (click)="saveRanges()">{{ i18n.t('lab.manage.saveRanges') }}</button>
                <button hlmBtn type="button" variant="outline" [class]="primary" (click)="close()">{{ i18n.t('lab.cancel') }}</button>
              </div>
            } @else {
              <app-form-builder #form [fields]="formFields()" [busy]="busy()" [formId]="formId()" (submitted)="submit($event)" (action)="onAction($event)" />
            }
          </aside>
        }
      </div>
    </div>
  `,
})
export class LabCatalogPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(LabGateway);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly cell = CELL;
  protected readonly sexes = ['ANY', 'FEMALE', 'MALE'] as const;
  protected readonly fields = FIELDS;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tests = signal<readonly LabTest[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  protected readonly rows = signal<readonly RangeRow[]>([]);
  protected readonly rangeNotice = signal<string | null>(null);
  private readonly opened = signal<ReadonlySet<string>>(new Set());
  private readonly notice = signal<string | null>(null);
  private filter: TestFilter = {};

  protected readonly canManage = computed(() => hasPermission(this.user()?.permissions ?? [], 'lab.catalog:manage'));
  protected readonly filterFields = computed(() => (this.canManage() ? catalogManageFilterFields() : catalogFilterFields()));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]' : 'grid items-start gap-6'));
  protected readonly formFields = computed(() => {
    const p = this.panel();
    return testFormFields({ test: p?.kind === 'edit' ? p.test : null, notice: this.notice() });
  });
  protected readonly formId = computed(() => {
    const p = this.panel();
    return p?.kind === 'edit' ? `lab-test-${p.test.id}` : 'lab-test-new';
  });
  protected readonly panelTitle = computed(() => {
    const p = this.panel();
    if (!p) return '';
    if (p.kind === 'create') return this.i18n.t('lab.manage.createTitle');
    return this.i18n.t(p.kind === 'edit' ? 'lab.manage.editTitle' : 'lab.manage.rangesTitle', { name: p.test.name });
  });

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const q = String(value['q'] ?? '').trim();
    const section = String(value['section'] ?? '');
    this.filter = { ...(q ? { search: q } : {}), ...(section ? { section: section as Section } : {}), ...(value['inactive'] === true ? { includeInactive: true } : {}) };
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.tests().length === 0);
    try {
      const page = await this.gateway.listTests(this.filter, this.offset(), PAGE_SIZE);
      this.tests.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected isOpen(test: LabTest): boolean {
    return this.opened().has(test.id);
  }

  protected toggle(test: LabTest): void {
    this.opened.update((set) => {
      const next = new Set(set);
      if (!next.delete(test.id)) next.add(test.id);
      return next;
    });
  }

  // ---- Gestion ---------------------------------------------------------------------------------------------------------

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.rangeNotice.set(null);
    this.panel.set(panel);
  }

  protected close(): void {
    this.panel.set(null);
    this.notice.set(null);
    this.rangeNotice.set(null);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.close();
  }

  private lines(raw: unknown): string[] {
    return String(raw ?? '').split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, ' ')).filter((l) => l !== '');
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    if (!panel || panel.kind === 'ranges') return;
    this.notice.set(null);
    const text = (name: string): string => String(value[name] ?? '').trim();
    const type = panel.kind === 'edit' ? panel.test.resultType : (text('resultType') as LabTest['resultType']);
    const choices = type === 'CHOICE' ? this.lines(value['choices']) : [];
    if (type === 'CHOICE' && (choices.length < 2 || choices.length > 20 || new Set(choices.map((c) => c.toLowerCase())).size !== choices.length)) {
      return this.notice.set(this.i18n.t('lab.manage.choicesInvalid'));
    }
    const changes: TestChanges = {
      name: text('name'), section: text('section') as Section, specimenType: text('specimenType') as LabTest['specimenType'], container: text('container') as LabTest['container'],
      unit: type === 'NUMERIC' && text('unit') !== '' ? text('unit') : null, decimals: type === 'NUMERIC' ? Number(value['decimals']) || 0 : 0, choices, tatMinutes: Number(value['tatMinutes']) || 240,
      instructions: text('instructions') || null,
    };
    await this.act(
      () => (panel.kind === 'create' ? this.gateway.createTest({ ...changes, code: text('code'), resultType: type } satisfies TestInput) : this.gateway.updateTest(panel.test.id, changes)),
      (saved) => this.toast.show(this.i18n.t(panel.kind === 'create' ? 'lab.manage.created' : 'lab.manage.updated', { name: saved.name })),
      true,
    );
  }

  protected async toggleActive(test: LabTest): Promise<void> {
    await this.act(() => this.gateway.setTestActive(test.id, !test.active), (saved) => this.toast.show(this.i18n.t(saved.active ? 'lab.manage.activated' : 'lab.manage.deactivated', { name: saved.name })), false);
  }

  private async act(call: () => Promise<LabTest>, done: (saved: LabTest) => void, inPanel: boolean): Promise<void> {
    this.busy.set(true);
    try {
      done(await call());
      if (inPanel) this.close();
      await this.load();
    } catch (error) {
      const message = failureMessage(error, this.i18n, inPanel ? this.form() : undefined);
      if (inPanel && this.panel()) this.notice.set(message);
      else this.error.set(message);
    } finally {
      this.busy.set(false);
    }
  }

  // ---- Valeurs de référence --------------------------------------------------------------------------------------------

  protected openRanges(test: LabTest): void {
    const text = (n: number | null) => (n === null ? '' : String(n));
    this.rows.set(test.ranges.map((r): RangeRow => ({ sex: r.sex, ageMin: String(r.ageMinDays), ageMax: text(r.ageMaxDays), low: text(r.low), high: text(r.high), critLow: text(r.criticalLow), critHigh: text(r.criticalHigh) })));
    this.open({ kind: 'ranges', test });
  }

  protected addRow(): void {
    this.rows.update((rows) => [...rows, { sex: 'ANY', ageMin: '0', ageMax: '', low: '', high: '', critLow: '', critHigh: '' }]);
  }

  protected removeRow(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected setSex(index: number, sex: string): void {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, sex: sex as RangeRow['sex'] } : r)));
  }

  protected setField(index: number, field: (typeof FIELDS)[number], value: string): void {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  protected async saveRanges(): Promise<void> {
    const panel = this.panel();
    if (panel?.kind !== 'ranges') return;
    const num = (raw: string): number | null | 'bad' => {
      const t = raw.trim().replace(',', '.');
      if (t === '') return null;
      return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : 'bad';
    };
    const ranges: ReferenceRange[] = [];
    for (const [i, r] of this.rows().entries()) {
      const [ageMin, ageMax, low, high, critLow, critHigh] = [num(r.ageMin), num(r.ageMax), num(r.low), num(r.high), num(r.critLow), num(r.critHigh)];
      const bad = [ageMin, ageMax, low, high, critLow, critHigh].includes('bad') || ageMin === null || !Number.isInteger(ageMin) || (ageMax !== null && !Number.isInteger(ageMax)) || (low === null && high === null);
      if (bad) return this.rangeNotice.set(this.i18n.t('lab.manage.rangeInvalid', { n: i + 1 }));
      ranges.push({ sex: r.sex, ageMinDays: ageMin as number, ageMaxDays: ageMax as number | null, low: low as number | null, high: high as number | null, criticalLow: critLow as number | null, criticalHigh: critHigh as number | null });
    }
    this.rangeNotice.set(null);
    this.busy.set(true);
    try {
      const saved = await this.gateway.setRanges(panel.test.id, ranges);
      this.toast.show(this.i18n.t('lab.manage.rangesSaved', { name: saved.name }));
      this.close();
      await this.load();
    } catch (error) {
      this.rangeNotice.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(false);
    }
  }

  // ---- Affichage -------------------------------------------------------------------------------------------------------

  /** Âge en jours, dit comme on le dit : jours (< 2 mois), mois (< 2 ans), sinon années. */
  private age(days: number): string {
    if (days < 60) return this.i18n.t('lab.age.days', { n: days });
    if (days < 730) return this.i18n.t('lab.age.months', { n: Math.round(days / 30.4375) });
    return this.i18n.t('lab.age.years', { n: Math.round(days / 365.25) });
  }

  private num(test: LabTest, value: number | null): string {
    return value === null ? '…' : value.toFixed(test.decimals);
  }

  protected rangeText(test: LabTest, r: ReferenceRange): string {
    const age = r.ageMaxDays === null ? `≥ ${this.age(r.ageMinDays)}` : `${this.age(r.ageMinDays)} – ${this.age(r.ageMaxDays)}`;
    return this.i18n.t('lab.catalog.rangeText', { sex: this.i18n.t(`lab.catalog.sex.${r.sex}`), age, low: this.num(test, r.low), high: this.num(test, r.high) }) + (test.unit ? ` ${test.unit}` : '');
  }

  protected criticalText(test: LabTest, r: ReferenceRange): string | null {
    return r.criticalLow === null && r.criticalHigh === null ? null : this.i18n.t('lab.catalog.rangeCritical', { low: this.num(test, r.criticalLow), high: this.num(test, r.criticalHigh) });
  }
}

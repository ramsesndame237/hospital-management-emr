import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { LabTest, ReferenceRange, Section, TestFilter } from '../../../core/lab/lab.models';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { catalogFilterFields } from '../lab.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Catalogue des analyses (consultation) : section, échantillon, délai de rendu et valeurs de référence par sexe et tranche d'âge, avec
 * leurs seuils critiques. Les analyses se modifient côté administration.
 */
@Component({
  selector: 'app-lab-catalog-page',
  imports: [FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('lab.catalog.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('lab.catalog.lead') }}</p>
      </header>

      <app-form-builder [fields]="filterFields" formId="lab-catalog-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="lab-catalog-error" />
      }

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
                <tr class="border-b border-border align-top">
                  <td class="px-4 py-3 font-mono text-xs">{{ t.code }}</td>
                  <td class="px-4 py-3"><span class="font-medium">{{ t.name }}</span><span class="block text-xs text-muted-foreground">{{ i18n.t('lab.section.' + t.section) }}@if (t.unit) { · {{ t.unit }}}</span></td>
                  <td class="px-4 py-3">{{ i18n.t('lab.specimenType.' + t.specimenType) }}<span class="block text-xs text-muted-foreground">{{ i18n.t('lab.container.' + t.container) }}</span></td>
                  <td class="px-4 py-3 whitespace-nowrap">{{ i18n.t('lab.catalog.tatMinutes', { minutes: t.tatMinutes }) }}</td>
                  <td class="px-4 py-3 text-right">
                    <button type="button" [class]="link" [attr.aria-expanded]="isOpen(t)" [attr.aria-label]="i18n.t('lab.catalog.showRanges', { name: t.name })" (click)="toggle(t)">{{ i18n.t(isOpen(t) ? 'lab.catalog.hide' : 'lab.catalog.open') }}</button>
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
  `,
})
export class LabCatalogPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(LabGateway);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields = catalogFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tests = signal<readonly LabTest[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  private readonly opened = signal<ReadonlySet<string>>(new Set());
  private filter: TestFilter = {};

  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const q = String(value['q'] ?? '').trim();
    const section = String(value['section'] ?? '');
    this.filter = { ...(q ? { search: q } : {}), ...(section ? { section: section as Section } : {}) };
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

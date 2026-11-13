import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import { ExamType, ExamTypeChanges, ExamTypeFilter, Modality } from '../../../core/imaging/imaging.models';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { catalogFilterFields, catalogManageFilterFields, examFormFields } from '../imaging.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none';

type Panel = { readonly kind: 'create' } | { readonly kind: 'edit'; readonly exam: ExamType };

/**
 * Catalogue des examens d'imagerie : modalité, région, durée du créneau, préparation du patient, produit de contraste. Qui le gère (administrateur système)
 * crée, modifie, retire et remet des examens ; les autres le consultent. Le code et la modalité ne changent jamais.
 */
@Component({
  selector: 'app-imaging-catalog-page',
  imports: [FormBuilderComponent, HlmButtonImports, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('imaging.catalog.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('imaging.catalog.lead') }}</p>
        </div>
        @if (canManage()) {
          <button hlmBtn type="button" [class]="primary" (click)="open({ kind: 'create' })">{{ i18n.t('imaging.manage.new') }}</button>
        }
      </header>

      <app-form-builder [fields]="filterFields()" formId="imaging-catalog-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="imaging-catalog-error" />
      }

      <div [class]="layoutClass()">
        <div class="flex min-w-0 flex-col gap-4">
          @if (loading()) {
            <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
          } @else {
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('imaging.catalog.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.catalog.code') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.catalog.name') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.catalog.modality') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('imaging.catalog.duration') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('imaging.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of exams(); track e.id) {
                    <tr class="border-b border-border align-top last:border-b-0" [class.opacity-60]="!e.active" [attr.data-test]="e.code">
                      <td class="px-4 py-3 font-mono text-xs">{{ e.code }}</td>
                      <td class="px-4 py-3">
                        <span class="font-medium">{{ e.name }}</span>
                        @if (!e.active) { <app-status-tag class="ml-2" tone="neutral" [text]="i18n.t('imaging.manage.inactive')" /> }
                        @if (e.usesContrast) { <app-status-tag class="ml-2" tone="warning" [text]="i18n.t('imaging.catalog.contrast')" /> }
                        @if (e.bodyPart) { <span class="block text-xs text-muted-foreground">{{ e.bodyPart }}</span> }
                        @if (e.preparation) { <span class="block text-xs text-muted-foreground">{{ i18n.t('imaging.catalog.preparation', { text: e.preparation }) }}</span> }
                      </td>
                      <td class="px-4 py-3">{{ i18n.t('imaging.modality.' + e.modality) }}</td>
                      <td class="px-4 py-3 whitespace-nowrap">{{ i18n.t('imaging.catalog.minutes', { minutes: e.durationMinutes }) }}</td>
                      <td class="px-4 py-3 text-right">
                        @if (canManage()) {
                          <div class="flex flex-wrap justify-end gap-x-4 gap-y-1">
                            <button type="button" [class]="link" [attr.aria-label]="i18n.t('imaging.manage.editOf', { name: e.name })" (click)="open({ kind: 'edit', exam: e })">{{ i18n.t('imaging.manage.edit') }}</button>
                            <button type="button" [class]="link" [disabled]="busy()" [attr.aria-label]="i18n.t(e.active ? 'imaging.manage.deactivateOf' : 'imaging.manage.activateOf', { name: e.name })" (click)="toggleActive(e)">
                              {{ i18n.t(e.active ? 'imaging.manage.deactivate' : 'imaging.manage.activate') }}
                            </button>
                          </div>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('imaging.catalog.empty') }}</td></tr>
                  }
                </tbody>
              </table>
            </div>

            @if (total() > pageSize) {
              <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('imaging.catalog.pagination')">
                <p class="text-muted-foreground">{{ i18n.t('imaging.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
                <div class="flex gap-4">
                  <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('imaging.previous') }}</button>
                  <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('imaging.next') }}</button>
                </div>
              </nav>
            }
          }
        </div>

        @if (panel(); as current) {
          <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="imaging-catalog-panel-title">
            <h2 id="imaging-catalog-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ panelTitle() }}</h2>
            <app-form-builder #form [fields]="formFields()" [busy]="busy()" [formId]="formId()" (submitted)="submit($event)" (action)="onAction($event)" />
          </aside>
        }
      </div>
    </div>
  `,
})
export class ImagingCatalogPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ImagingGateway);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly exams = signal<readonly ExamType[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);
  private filter: ExamTypeFilter = {};

  protected readonly canManage = computed(() => hasPermission(this.user()?.permissions ?? [], 'imaging.catalog:manage'));
  protected readonly filterFields = computed(() => (this.canManage() ? catalogManageFilterFields() : catalogFilterFields()));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]' : 'grid items-start gap-6'));
  protected readonly formFields = computed(() => {
    const p = this.panel();
    return examFormFields({ exam: p?.kind === 'edit' ? p.exam : null, notice: this.notice() });
  });
  protected readonly formId = computed(() => {
    const p = this.panel();
    return p?.kind === 'edit' ? `imaging-exam-${p.exam.id}` : 'imaging-exam-new';
  });
  protected readonly panelTitle = computed(() => {
    const p = this.panel();
    if (!p) return '';
    return p.kind === 'create' ? this.i18n.t('imaging.manage.createTitle') : this.i18n.t('imaging.manage.editTitle', { name: p.exam.name });
  });

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const q = String(value['q'] ?? '').trim();
    const modality = String(value['modality'] ?? '');
    this.filter = { ...(q ? { search: q } : {}), ...(modality ? { modality: modality as Modality } : {}), ...(value['inactive'] === true ? { includeInactive: true } : {}) };
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.exams().length === 0);
    try {
      const page = await this.gateway.listExamTypes(this.filter, this.offset(), PAGE_SIZE);
      this.exams.set(page.items);
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
    const changes = {
      name: text('name'), bodyPart: text('bodyPart') || null, usesContrast: value['usesContrast'] === true, durationMinutes: Number(value['durationMinutes']) || 30, preparation: text('preparation') || null,
    } satisfies ExamTypeChanges;
    await this.act(
      () => (panel.kind === 'create' ? this.gateway.createExamType({ ...changes, code: text('code'), modality: text('modality') as Modality }) : this.gateway.updateExamType(panel.exam.id, changes)),
      (saved) => this.toast.show(this.i18n.t(panel.kind === 'create' ? 'imaging.manage.created' : 'imaging.manage.updated', { name: saved.name })),
      true,
    );
  }

  protected async toggleActive(exam: ExamType): Promise<void> {
    await this.act(() => this.gateway.setExamTypeActive(exam.id, !exam.active), (saved) => this.toast.show(this.i18n.t(saved.active ? 'imaging.manage.activated' : 'imaging.manage.deactivated', { name: saved.name })), false);
  }

  private async act(call: () => Promise<ExamType>, done: (saved: ExamType) => void, inPanel: boolean): Promise<void> {
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
}

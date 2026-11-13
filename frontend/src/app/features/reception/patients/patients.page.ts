import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PatientCriteria, PatientSummary } from '../../../core/reception/reception.models';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { personName } from '../reception-status';
import { patientSearchFields } from '../reception.forms';

const PAGE_SIZE = 20;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
const SECONDARY = 'inline-flex min-h-9 items-center rounded-[2px] border border-border bg-background px-3 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Patients : la recherche d'un dossier (numéro, nom, naissance, téléphone ou pièce d'identité — jamais la liste complète) et l'ouverture d'un
 * nouveau dossier. L'accueil cherche TOUJOURS avant de créer : c'est ce qui évite les doublons.
 */
@Component({
  selector: 'app-patients-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('reception.patients.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('reception.patients.lead') }}</p>
        </div>
        @if (canWrite()) {
          <a routerLink="/patients/new" [class]="primary">{{ i18n.t('reception.patients.new') }}</a>
        }
      </header>

      <section class="border border-border bg-card p-4" aria-labelledby="search-title">
        <h2 id="search-title" class="sr-only">{{ i18n.t('reception.search.title') }}</h2>
        <app-form-builder #search [fields]="fields" [busy]="loading()" formId="patient-search" (submitted)="run($event)" />
      </section>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="patients-error" />
      }

      @if (searched()) {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('reception.patients.results') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.patients.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.patients.name') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.patients.birth') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.patients.state') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (p of items(); track p.id) {
                <tr class="border-b border-border last:border-b-0" [attr.data-test]="p.number">
                  <td class="px-4 py-3 font-mono text-xs">{{ p.number }}</td>
                  <td class="px-4 py-3"><a [routerLink]="['/patients', p.id]" [class]="link" [attr.aria-label]="i18n.t('reception.patients.openOf', { name: name(p) })">{{ name(p) }}</a>
                    <span class="block text-xs text-muted-foreground">{{ i18n.t('reception.sex.' + p.sex) }}</span></td>
                  <td class="px-4 py-3 whitespace-nowrap">{{ p.birthDate }}<span class="block text-xs text-muted-foreground">{{ i18n.t('reception.patients.age', { n: p.ageYears }) }}@if (p.birthDateEstimated) { · {{ i18n.t('reception.patients.estimated') }}}</span></td>
                  <td class="px-4 py-3">
                    @if (p.status === 'DECEASED') { <app-status-tag tone="critical" [text]="i18n.t('reception.patients.deceased')" /> }
                    @else if (p.identityStatus === 'PROVISIONAL') { <app-status-tag tone="warning" [text]="i18n.t('reception.patients.provisional')" /> }
                    @else { <app-status-tag tone="success" [text]="i18n.t('reception.patients.active')" /> }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="px-4 py-8 text-center text-muted-foreground">
                    {{ i18n.t('reception.patients.none') }}
                    @if (canWrite()) { <a routerLink="/patients/new" [class]="link" class="ml-1">{{ i18n.t('reception.patients.createInstead') }}</a> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (total() > items().length || offset() > 0) {
          <nav class="flex items-center justify-between gap-3 text-sm" [attr.aria-label]="i18n.t('reception.patients.pagination')">
            <span class="text-muted-foreground">{{ i18n.t('reception.patients.range', { from: offset() + 1, to: offset() + items().length, total: total() }) }}</span>
            <span class="flex gap-2">
              <button type="button" [class]="secondary" [disabled]="offset() === 0 || loading()" (click)="go(-1)">{{ i18n.t('reception.patients.previous') }}</button>
              <button type="button" [class]="secondary" [disabled]="offset() + items().length >= total() || loading()" (click)="go(1)">{{ i18n.t('reception.patients.next') }}</button>
            </span>
          </nav>
        }
      }
    </div>
  `,
})
export class PatientsPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ReceptionGateway);
  private readonly user = inject(SessionStore).user;

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly secondary = SECONDARY;
  protected readonly fields = patientSearchFields();
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<readonly PatientSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  private criteria: PatientCriteria = {};

  protected readonly canWrite = computed(() => hasPermission(this.user()?.permissions ?? [], 'patients:write'));
  protected readonly failure = computed(() => failureNotice(this.error()));

  protected run(values: Record<string, unknown>): Promise<void> {
    this.criteria = {
      q: String(values['q'] ?? ''), birthDate: String(values['birthDate'] ?? ''), phone: String(values['phone'] ?? ''), identityNumber: String(values['identityNumber'] ?? ''),
    };
    return this.load(0);
  }

  protected go(direction: -1 | 1): Promise<void> {
    return this.load(Math.max(0, this.offset() + direction * PAGE_SIZE));
  }

  private async load(offset: number): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.gateway.searchPatients(this.criteria, offset, PAGE_SIZE);
      this.items.set(page.items);
      this.total.set(page.total);
      this.offset.set(page.offset);
      this.searched.set(true);
      this.error.set(null);
    } catch (error) {
      this.searched.set(false);
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected name(p: PatientSummary): string {
    return personName(p);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { LabTest, Priority, Source } from '../../../core/lab/lab.models';
import { PatientSearchGateway, PatientSummary } from '../../../core/patients/patient-search.gateway';
import { failureMessage } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { ToastService } from '../../../shared/toast/toast.service';
import { patientSearchFields } from '../../billing/billing.forms';
import { orderFields, testSearchFields } from '../lab.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Nouvelle demande d'analyses, en deux temps : le patient (numéro de dossier ou nom), puis les analyses du catalogue à réaliser, avec la
 * priorité, la provenance et les renseignements cliniques. L'écran annonce combien d'échantillons seront à prélever (un par type de
 * tube) ; c'est le serveur qui les prévoit et leur attribue un code-barres.
 */
@Component({
  selector: 'app-new-requisition-page',
  imports: [RouterLink, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-w-4xl flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('lab.new.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('lab.new.lead') }}</p>
      </header>

      <section class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="patient-step">
        <h2 id="patient-step" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('lab.new.patientStep') }}</h2>
        @if (patient(); as p) {
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm leading-6"><span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span> · <span class="font-mono text-xs text-muted-foreground">{{ p.number }}</span> · {{ p.birthDate }}</p>
            <button type="button" [class]="link" class="text-sm" (click)="changePatient()">{{ i18n.t('lab.new.changePatient') }}</button>
          </div>
        } @else {
          <app-form-builder #patientForm [fields]="patientFields()" [busy]="searching()" formId="patient-search" (submitted)="searchPatients($event)" />
          @if (patients(); as page) {
            <div class="overflow-x-auto border border-border">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('billing.new.results') }}</caption>
                <tbody>
                  @for (p of page.items; track p.id) {
                    <tr class="border-b border-border last:border-b-0">
                      <td class="px-4 py-3"><span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span><span class="block font-mono text-xs text-muted-foreground">{{ p.number }}</span></td>
                      <td class="px-4 py-3">{{ i18n.t('billing.new.age', { age: p.ageYears }) }} · {{ p.birthDate }}</td>
                      <td class="px-4 py-3 text-right">
                        <button type="button" [class]="link" [attr.aria-label]="i18n.t('billing.new.chooseOf', { name: p.lastName + ' ' + p.firstName })" (click)="choose(p)">{{ i18n.t('billing.new.choose') }}</button>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td class="px-4 py-6 text-center text-muted-foreground">{{ i18n.t('billing.new.none') }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            @if (page.total > page.items.length) {
              <p class="text-xs text-muted-foreground">{{ i18n.t('billing.new.refine', { shown: page.items.length, total: page.total }) }}</p>
            }
          }
        }
      </section>

      @if (patient()) {
        <section class="grid items-start gap-6 lg:grid-cols-2" aria-labelledby="tests-step">
          <div class="flex flex-col gap-4 border border-border bg-card p-6">
            <h2 id="tests-step" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('lab.new.testsStep') }}</h2>
            <app-form-builder [fields]="testFields" [busy]="loadingTests()" formId="test-search" (submitted)="searchTests($event)" />
            @if (testsError()) {
              <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ testsError() }}</p>
            }
            <ul class="flex flex-col border border-border">
              @for (t of found(); track t.id) {
                <li class="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0">
                  <span class="min-w-0">
                    <span class="block truncate font-medium">{{ t.name }}</span>
                    <span class="block text-xs text-muted-foreground"><span class="font-mono">{{ t.code }}</span> · {{ i18n.t('lab.section.' + t.section) }} · {{ i18n.t('lab.container.' + t.container) }}</span>
                  </span>
                  @if (isChosen(t)) {
                    <button type="button" [class]="link" class="shrink-0" [attr.aria-label]="i18n.t('lab.new.removeOf', { name: t.name })" (click)="remove(t)">{{ i18n.t('lab.new.remove') }}</button>
                  } @else {
                    <button type="button" [class]="link" class="shrink-0" [attr.aria-label]="i18n.t('lab.new.addOf', { name: t.name })" (click)="add(t)">{{ i18n.t('lab.new.add') }}</button>
                  }
                </li>
              } @empty {
                <li class="px-3 py-4 text-center text-sm text-muted-foreground">{{ i18n.t('lab.new.noResults') }}</li>
              }
            </ul>
          </div>

          <div class="flex flex-col gap-4 border border-border bg-card p-6">
            <h2 class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('lab.new.selected') }}</h2>
            @if (chosen().length === 0) {
              <p class="text-sm text-muted-foreground">{{ i18n.t('lab.new.noneSelected') }}</p>
            } @else {
              <ul class="flex flex-col border border-border">
                @for (t of chosen(); track t.id) {
                  <li class="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0">
                    <span><span class="font-medium">{{ t.name }}</span> <span class="font-mono text-xs text-muted-foreground">{{ t.code }}</span></span>
                    <button type="button" [class]="link" [attr.aria-label]="i18n.t('lab.new.removeOf', { name: t.name })" (click)="remove(t)">{{ i18n.t('lab.new.remove') }}</button>
                  </li>
                }
              </ul>
              <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('lab.new.specimenCount', { count: specimenCount() }) }}</p>
              <app-form-builder #orderForm [fields]="orderSchema()" [busy]="ordering()" formId="lab-order" (submitted)="submit($event)" />
            }
          </div>
        </section>
      }

      <a routerLink="/lab/worklist" [class]="link" class="w-fit text-sm">{{ i18n.t('lab.new.back') }}</a>
    </div>
  `,
})
export class NewRequisitionPage {
  protected readonly i18n = inject(Translator);
  private readonly patientsGateway = inject(PatientSearchGateway);
  private readonly lab = inject(LabGateway);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly patientForm = viewChild<FormBuilderComponent>('patientForm');
  private readonly orderFormRef = viewChild<FormBuilderComponent>('orderForm');

  protected readonly link = LINK;
  protected readonly testFields = testSearchFields();
  protected readonly searching = signal(false);
  protected readonly patients = signal<{ items: readonly PatientSummary[]; total: number } | null>(null);
  protected readonly patient = signal<PatientSummary | null>(null);
  protected readonly loadingTests = signal(false);
  protected readonly found = signal<readonly LabTest[]>([]);
  protected readonly testsError = signal<string | null>(null);
  protected readonly chosen = signal<readonly LabTest[]>([]);
  protected readonly ordering = signal(false);
  private readonly patientNotice = signal<string | null>(null);
  private readonly orderNotice = signal<string | null>(null);

  protected readonly patientFields = computed(() => patientSearchFields({ notice: this.patientNotice() }));
  /** Un prescripteur ouvre sur « consultation externe » ; le laboratoire, qui saisit surtout des prescriptions extérieures, sur « extérieur ». */
  private readonly defaultSource = computed<Source>(() => (hasPermission(this.user()?.permissions ?? [], 'lab.requisitions:read:all') ? 'EXTERNAL' : 'OPD'));
  protected readonly orderSchema = computed(() => orderFields({ notice: this.orderNotice(), source: this.defaultSource() }));
  /** Un échantillon par couple (type d'échantillon, contenant), comme le serveur. */
  protected readonly specimenCount = computed(() => new Set(this.chosen().map((t) => `${t.specimenType}|${t.container}`)).size);

  protected async searchPatients(value: Record<string, unknown>): Promise<void> {
    this.patientNotice.set(null);
    this.searching.set(true);
    try {
      this.patients.set(await this.patientsGateway.search(String(value['q']), 10));
    } catch (error) {
      this.patients.set(null);
      this.patientNotice.set(failureMessage(error, this.i18n, this.patientForm()));
    } finally {
      this.searching.set(false);
    }
  }

  protected choose(patient: PatientSummary): void {
    this.patient.set(patient);
    this.patients.set(null);
    void this.searchTests({ q: '' });
  }

  protected changePatient(): void {
    this.patient.set(null);
    this.chosen.set([]);
    this.found.set([]);
  }

  protected async searchTests(value: Record<string, unknown>): Promise<void> {
    this.testsError.set(null);
    this.loadingTests.set(true);
    try {
      const q = String(value['q'] ?? '').trim();
      this.found.set((await this.lab.listTests(q ? { search: q } : {}, 0, 10)).items);
    } catch (error) {
      this.testsError.set(failureMessage(error, this.i18n));
    } finally {
      this.loadingTests.set(false);
    }
  }

  protected isChosen(test: LabTest): boolean {
    return this.chosen().some((t) => t.id === test.id);
  }

  protected add(test: LabTest): void {
    if (!this.isChosen(test)) this.chosen.update((list) => [...list, test]);
  }

  protected remove(test: LabTest): void {
    this.chosen.update((list) => list.filter((t) => t.id !== test.id));
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const patient = this.patient();
    if (!patient || this.chosen().length === 0) return;
    this.orderNotice.set(null);
    this.ordering.set(true);
    try {
      const notes = String(value['notes'] ?? '').trim();
      const created = await this.lab.order({
        patientId: patient.id, testIds: this.chosen().map((t) => t.id), priority: String(value['priority']) as Priority, source: String(value['source']) as Source, ...(notes ? { clinicalNotes: notes } : {}),
      });
      this.toast.show(this.i18n.t('lab.new.done', { number: created.number }));
      await this.router.navigate(['/lab/requisitions', created.id]);
    } catch (error) {
      this.orderNotice.set(failureMessage(error, this.i18n, this.orderFormRef()));
    } finally {
      this.ordering.set(false);
    }
  }
}

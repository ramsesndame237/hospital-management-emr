import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import { ExamType, IONIZING, Priority, Source } from '../../../core/imaging/imaging.models';
import { PatientSearchGateway, PatientSummary } from '../../../core/patients/patient-search.gateway';
import { failureMessage } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { ToastService } from '../../../shared/toast/toast.service';
import { patientSearchFields } from '../../billing/billing.forms';
import { examSearchFields, orderFields } from '../imaging.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Nouvelle demande d'examen, en trois temps : le patient (numéro de dossier ou nom), l'examen du catalogue (un seul), puis la priorité, la provenance et la
 * question clinique, obligatoire car elle justifie l'examen. Un examen irradiant est signalé avant l'envoi.
 */
@Component({
  selector: 'app-imaging-new-order-page',
  imports: [RouterLink, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-w-4xl flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('imaging.new.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('imaging.new.lead') }}</p>
      </header>

      @if (encounterId()) {
        <p class="border-l-4 border-primary bg-card p-3 text-sm" role="status" data-test="linked">{{ i18n.t('imaging.new.linked') }}</p>
      }

      <section class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="patient-step">
        <h2 id="patient-step" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('imaging.new.patientStep') }}</h2>
        @if (patient(); as p) {
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm leading-6"><span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span> · <span class="font-mono text-xs text-muted-foreground">{{ p.number }}</span> · {{ p.birthDate }}</p>
            <button type="button" [class]="link" class="text-sm" (click)="changePatient()">{{ i18n.t('imaging.new.changePatient') }}</button>
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
        <section class="grid items-start gap-6 lg:grid-cols-2" aria-labelledby="exam-step">
          <div class="flex flex-col gap-4 border border-border bg-card p-6">
            <h2 id="exam-step" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('imaging.new.examStep') }}</h2>
            <app-form-builder [fields]="examFields" [busy]="loadingExams()" formId="exam-search" (submitted)="searchExams($event)" />
            @if (examsError()) {
              <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ examsError() }}</p>
            }
            <ul class="flex flex-col border border-border">
              @for (e of found(); track e.id) {
                <li class="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0">
                  <span class="min-w-0">
                    <span class="block truncate font-medium">{{ e.name }}</span>
                    <span class="block text-xs text-muted-foreground"><span class="font-mono">{{ e.code }}</span> · {{ i18n.t('imaging.modality.' + e.modality) }}@if (e.bodyPart) { · {{ e.bodyPart }}}</span>
                  </span>
                  @if (chosen()?.id === e.id) {
                    <button type="button" [class]="link" class="shrink-0" [attr.aria-label]="i18n.t('imaging.new.removeOf', { name: e.name })" (click)="unchoose()">{{ i18n.t('imaging.new.remove') }}</button>
                  } @else {
                    <button type="button" [class]="link" class="shrink-0" [attr.aria-label]="i18n.t('imaging.new.pickOf', { name: e.name })" (click)="pick(e)">{{ i18n.t('imaging.new.pick') }}</button>
                  }
                </li>
              } @empty {
                <li class="px-3 py-4 text-center text-sm text-muted-foreground">{{ i18n.t('imaging.new.noResults') }}</li>
              }
            </ul>
          </div>

          <div class="flex flex-col gap-4 border border-border bg-card p-6">
            <h2 class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('imaging.new.selected') }}</h2>
            @if (chosen(); as e) {
              <p class="text-sm"><span class="font-medium">{{ e.name }}</span> <span class="font-mono text-xs text-muted-foreground">{{ e.code }}</span></p>
              @if (ionizing()) {
                <p class="border-l-4 border-status-warning bg-card p-3 text-sm" role="note" data-test="ionizing">{{ i18n.t('imaging.new.ionizing') }}</p>
              }
              @if (e.usesContrast) {
                <p class="border-l-4 border-status-warning bg-card p-3 text-sm" role="note" data-test="contrast">{{ i18n.t('imaging.new.contrast') }}</p>
              }
              @if (e.preparation) {
                <p class="text-xs text-muted-foreground" data-test="preparation">{{ i18n.t('imaging.new.preparation', { text: e.preparation }) }}</p>
              }
              <app-form-builder #orderForm [fields]="orderSchema()" [busy]="ordering()" formId="imaging-order" (submitted)="submit($event)" />
            } @else {
              <p class="text-sm text-muted-foreground">{{ i18n.t('imaging.new.noneSelected') }}</p>
            }
          </div>
        </section>
      }

      <a routerLink="/imaging/worklist" [class]="link" class="w-fit text-sm">{{ i18n.t('imaging.new.back') }}</a>
    </div>
  `,
})
export class ImagingNewOrderPage implements OnInit {
  /** Numéro du patient et consultation d'origine, donnés par l'adresse quand on vient de l'espace de consultation. */
  readonly patientNumber = input<string>();
  readonly encounterId = input<string>();

  protected readonly i18n = inject(Translator);
  private readonly patientsGateway = inject(PatientSearchGateway);
  private readonly imaging = inject(ImagingGateway);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly patientForm = viewChild<FormBuilderComponent>('patientForm');
  private readonly orderFormRef = viewChild<FormBuilderComponent>('orderForm');

  protected readonly link = LINK;
  protected readonly examFields = examSearchFields();
  protected readonly searching = signal(false);
  protected readonly patients = signal<{ items: readonly PatientSummary[]; total: number } | null>(null);
  protected readonly patient = signal<PatientSummary | null>(null);
  protected readonly loadingExams = signal(false);
  protected readonly found = signal<readonly ExamType[]>([]);
  protected readonly examsError = signal<string | null>(null);
  protected readonly chosen = signal<ExamType | null>(null);
  protected readonly ordering = signal(false);
  private readonly patientNotice = signal<string | null>(null);
  private readonly orderNotice = signal<string | null>(null);

  protected readonly patientFields = computed(() => patientSearchFields({ notice: this.patientNotice() }));
  /** Un prescripteur ouvre sur « consultation externe » ; le service d'imagerie, qui saisit surtout des prescriptions extérieures, sur « extérieur ». */
  private readonly defaultSource = computed<Source>(() => (hasPermission(this.user()?.permissions ?? [], 'imaging.orders:read:all') ? 'EXTERNAL' : 'OPD'));
  protected readonly orderSchema = computed(() => orderFields({ notice: this.orderNotice(), source: this.defaultSource() }));
  protected readonly ionizing = computed(() => {
    const exam = this.chosen();
    return exam !== null && IONIZING.includes(exam.modality);
  });

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
    void this.searchExams({ q: '' });
  }

  protected changePatient(): void {
    this.patient.set(null);
    this.chosen.set(null);
    this.found.set([]);
  }

  protected async searchExams(value: Record<string, unknown>): Promise<void> {
    this.examsError.set(null);
    this.loadingExams.set(true);
    try {
      const q = String(value['q'] ?? '').trim();
      this.found.set((await this.imaging.listExamTypes(q ? { search: q } : {}, 0, 10)).items);
    } catch (error) {
      this.examsError.set(failureMessage(error, this.i18n));
    } finally {
      this.loadingExams.set(false);
    }
  }

  protected pick(exam: ExamType): void {
    this.chosen.set(exam);
  }

  protected unchoose(): void {
    this.chosen.set(null);
  }

  /** Venu de la consultation : le patient est déjà choisi (rien ne s'écrit tant qu'on n'a pas envoyé la demande). */
  async ngOnInit(): Promise<void> {
    const number = this.patientNumber()?.trim();
    if (!number) return;
    try {
      const found = (await this.patientsGateway.search(number, 5)).items.find((p) => p.number === number);
      if (found) {
        this.patient.set(found);
        void this.searchExams({ q: '' });
      }
    } catch {
      // Le patient se cherche alors à la main, comme d'habitude.
    }
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const patient = this.patient();
    const exam = this.chosen();
    if (!patient || !exam) return;
    this.orderNotice.set(null);
    this.ordering.set(true);
    try {
      const created = await this.imaging.order({
        patientId: patient.id, examTypeId: exam.id, clinicalQuestion: String(value['question']).trim(), priority: String(value['priority']) as Priority, source: String(value['source']) as Source,
        ...(this.encounterId() ? { encounterId: this.encounterId() } : {}),
      });
      this.toast.show(this.i18n.t('imaging.new.done', { number: created.number }));
      await this.router.navigate(['/imaging/orders', created.id]);
    } catch (error) {
      this.orderNotice.set(failureMessage(error, this.i18n, this.orderFormRef()));
    } finally {
      this.ordering.set(false);
    }
  }
}

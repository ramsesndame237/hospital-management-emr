import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { ClinicalGateway } from '../../../core/clinical/clinical.gateway';
import { Allergy, Certainty, DIAGNOSIS_KINDS, CERTAINTIES, DiagnosisInput, DiagnosisKind, Encounter, NoteInput, Severity, VitalsInput } from '../../../core/clinical/clinical.models';
import { Translator } from '../../../core/i18n/translator';
import { Clock } from '../../../core/time/clock';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { ageText, encounterTag, patientName, severityTag } from '../clinical-status';
import { LabRequestsSection } from './lab-requests.section';
import { PrescriptionsSection } from './prescriptions.section';
import { addendumFields, allergyFields, cancelFields, noteFields, VITAL_FIELDS, vitalsFields, voidAllergyFields } from '../clinical.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const SECONDARY = 'inline-flex min-h-11 items-center rounded-[2px] border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const CELL = 'h-9 w-full min-w-20 border border-input bg-background px-2 text-sm rounded-[2px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

type Panel = { readonly kind: 'allergy' } | { readonly kind: 'void'; readonly allergy: Allergy } | { readonly kind: 'cancel' };

/** Un diagnostic en cours de saisie : tout est du texte tant qu'il n'est pas enregistré. */
interface Row {
  code: string;
  label: string;
  kind: DiagnosisKind;
  certainty: Certainty;
}

/**
 * Espace de consultation : le bandeau du patient (allergies actives en rouge), les constantes, la note SOAP, les diagnostics CIM-10, la
 * signature et les addenda. Le médecin qui conduit la consultation la rédige tant qu'elle est en cours ; le médecin ou l'infirmier du service
 * relèvent les constantes. Une fois signée elle est verrouillée : on la complète par des addenda datés et signés.
 */
@Component({
  selector: 'app-encounter-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag, PrescriptionsSection, LabRequestsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/clinical/queue" [class]="link" class="w-fit text-sm">← {{ i18n.t('clinical.encounter.back') }}</a>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="encounter-error" />
      }

      @if (encounter(); as e) {
        @if (e.patient; as p) {
          <section class="flex flex-col gap-2 border border-border bg-card p-4" aria-labelledby="patient-title" data-test="banner">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 id="patient-title" class="text-[24px] leading-8 font-semibold text-foreground">{{ name(p) }}</h1>
                <p class="text-sm text-muted-foreground"><span class="font-mono">{{ p.number }}</span> · {{ i18n.t('clinical.sex.' + p.sex) }} · {{ age(p.birthDate) }} · {{ i18n.t('clinical.encounter.born', { date: p.birthDate }) }}</p>
              </div>
              <div class="flex flex-col items-end gap-1">
                <app-status-tag [text]="tag(e).label" [tone]="tag(e).tone" />
                <span class="font-mono text-xs text-muted-foreground">{{ e.number }}</span>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-sm" role="group" [attr.aria-label]="i18n.t('clinical.allergy.title')">
              <span class="font-medium">{{ i18n.t('clinical.allergy.title') }} :</span>
              @for (a of e.allergies; track a.id) {
                <span class="inline-flex items-center gap-2 border px-2 py-0.5 text-xs" [class]="a.severity === 'SEVERE' ? 'border-status-critical text-status-critical' : 'border-status-warning text-status-warning'" [attr.data-test]="'allergy-' + a.id">
                  {{ a.substance }} · {{ i18n.t('clinical.severity.' + a.severity) }}@if (a.reaction) { · {{ a.reaction }}}
                  @if (canAllergy()) {
                    <button type="button" [class]="link" [attr.aria-label]="i18n.t('clinical.allergy.voidOf', { substance: a.substance })" (click)="open({ kind: 'void', allergy: a })">{{ i18n.t('clinical.allergy.void') }}</button>
                  }
                </span>
              } @empty {
                <span class="text-muted-foreground">{{ i18n.t('clinical.allergy.none') }}</span>
              }
              @if (canAllergy()) {
                <button type="button" [class]="link" (click)="open({ kind: 'allergy' })">{{ i18n.t('clinical.allergy.add') }}</button>
              }
            </div>
          </section>
        }

        @if (e.cancellationReason) {
          <p class="border-l-4 border-status-critical bg-card p-3 text-sm" role="status">{{ i18n.t('clinical.encounter.cancelledNotice', { who: e.cancelledBy?.username ?? '', reason: e.cancellationReason }) }}</p>
        } @else if (e.status === 'SIGNED') {
          <p class="border-l-4 border-status-success bg-card p-3 text-sm" role="status">{{ i18n.t('clinical.encounter.signedNotice', { who: e.signedBy?.username ?? '', when: when(e.signedAt ?? e.startedAt) }) }}</p>
        } @else if (!isAuthor(e)) {
          <p class="border-l-4 border-border bg-card p-3 text-sm" role="status">{{ i18n.t('clinical.encounter.readOnly', { who: e.doctor?.username ?? '' }) }}</p>
        }

        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-8">
            <section class="flex flex-col gap-3" aria-labelledby="vitals-title">
              <h2 id="vitals-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.vitals.title') }}</h2>
              @if (e.vitals; as v) {
                <dl class="grid gap-3 border border-border bg-card p-4 sm:grid-cols-4" data-test="vitals">
                  @for (f of vitalFields; track f.name) {
                    @if (v[f.name] !== null) {
                      <div><dt class="text-xs text-muted-foreground">{{ i18n.t('clinical.vitals.' + f.name) }}</dt><dd class="font-mono text-base font-semibold">{{ v[f.name] }}</dd></div>
                    }
                  }
                  @if (v.bmi !== null) {
                    <div><dt class="text-xs text-muted-foreground">{{ i18n.t('clinical.vitals.bmi') }}</dt><dd class="font-mono text-base font-semibold">{{ v.bmi }}</dd></div>
                  }
                </dl>
                <p class="text-xs text-muted-foreground">{{ i18n.t('clinical.vitals.recordedBy', { who: v.recordedBy?.username ?? '', when: when(v.recordedAt) }) }}</p>
              } @else {
                <p class="text-sm text-muted-foreground">{{ i18n.t('clinical.vitals.none') }}</p>
              }
              @if (canVitals(e)) {
                <div class="border border-border bg-card p-4">
                  <app-form-builder #vitalsForm [fields]="vitalsForm_()" [busy]="busy() === 'vitals'" formId="encounter-vitals" (submitted)="saveVitals($event)" />
                </div>
              }
            </section>

            <section class="flex flex-col gap-3" aria-labelledby="note-title">
              <h2 id="note-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.note.title') }}</h2>
              @if (canWrite(e)) {
                <div class="border border-border bg-card p-4">
                  <app-form-builder #noteForm [fields]="noteForm_()" [busy]="busy() === 'note'" formId="encounter-note" (submitted)="saveNote($event)" />
                </div>
              } @else {
                <dl class="flex flex-col gap-3 border border-border bg-card p-4" data-test="note">
                  @for (key of noteKeys; track key) {
                    <div><dt class="text-xs text-muted-foreground">{{ i18n.t('clinical.note.' + key) }}</dt><dd class="text-sm whitespace-pre-line">{{ e.note[key] ?? '—' }}</dd></div>
                  }
                </dl>
              }
            </section>

            <section class="flex flex-col gap-3" aria-labelledby="dx-title">
              <h2 id="dx-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.diagnoses.title') }}</h2>
              @if (canWrite(e)) {
                <div class="flex flex-col gap-3 border border-border bg-card p-4">
                  @for (row of rows(); track $index; let i = $index) {
                    <fieldset class="grid items-end gap-2 sm:grid-cols-[110px_1fr_140px_150px_auto]">
                      <legend class="sr-only">{{ i18n.t('clinical.diagnoses.rowOf', { n: i + 1 }) }}</legend>
                      <label class="flex flex-col gap-1 text-xs">{{ i18n.t('clinical.diagnoses.code') }}<input [class]="cell" class="font-mono uppercase" [id]="'dx-' + i + '-code'" type="text" [value]="row.code" (input)="setRow(i, 'code', $any($event.target).value)" /></label>
                      <label class="flex flex-col gap-1 text-xs">{{ i18n.t('clinical.diagnoses.label') }}<input [class]="cell" [id]="'dx-' + i + '-label'" type="text" [value]="row.label" (input)="setRow(i, 'label', $any($event.target).value)" /></label>
                      <label class="flex flex-col gap-1 text-xs">{{ i18n.t('clinical.diagnoses.kind') }}
                        <select [class]="cell" [id]="'dx-' + i + '-kind'" [value]="row.kind" (change)="setRow(i, 'kind', $any($event.target).value)">
                          @for (k of kinds; track k) {
                            <option [value]="k" [selected]="row.kind === k">{{ i18n.t('clinical.diagnoses.kinds.' + k) }}</option>
                          }
                        </select>
                      </label>
                      <label class="flex flex-col gap-1 text-xs">{{ i18n.t('clinical.diagnoses.certainty') }}
                        <select [class]="cell" [id]="'dx-' + i + '-certainty'" [value]="row.certainty" (change)="setRow(i, 'certainty', $any($event.target).value)">
                          @for (c of certainties; track c) {
                            <option [value]="c" [selected]="row.certainty === c">{{ i18n.t('clinical.diagnoses.certainties.' + c) }}</option>
                          }
                        </select>
                      </label>
                      <button type="button" [class]="link" class="pb-2 text-xs" [attr.aria-label]="i18n.t('clinical.diagnoses.removeOf', { n: i + 1 })" (click)="removeRow(i)">{{ i18n.t('clinical.diagnoses.remove') }}</button>
                    </fieldset>
                  } @empty {
                    <p class="text-sm text-muted-foreground">{{ i18n.t('clinical.diagnoses.none') }}</p>
                  }
                  @if (diagnosesNotice()) {
                    <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ diagnosesNotice() }}</p>
                  }
                  <div class="flex flex-wrap gap-3">
                    <button type="button" [class]="secondary" (click)="addRow()">{{ i18n.t('clinical.diagnoses.add') }}</button>
                    <button type="button" [class]="primary" [disabled]="busy() === 'diagnoses'" (click)="saveDiagnoses()">{{ i18n.t('clinical.diagnoses.save') }}</button>
                  </div>
                </div>
              } @else {
                <ul class="flex flex-col divide-y divide-border border border-border bg-card" data-test="diagnoses">
                  @for (d of e.diagnoses; track d.code) {
                    <li class="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                      <span class="font-mono text-xs">{{ d.code }}</span> <span>{{ d.label }}</span>
                      <app-status-tag [tone]="d.kind === 'PRIMARY' ? 'success' : 'neutral'" [text]="i18n.t('clinical.diagnoses.kinds.' + d.kind)" />
                      <span class="text-xs text-muted-foreground">{{ i18n.t('clinical.diagnoses.certainties.' + d.certainty) }}</span>
                    </li>
                  } @empty {
                    <li class="px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('clinical.diagnoses.none') }}</li>
                  }
                </ul>
              }
            </section>

            @if (canReadRx()) {
              <app-prescriptions-section [encounterId]="e.id" [canIssue]="canWrite(e) && canWriteRx()" />
            }

            @if (canReadLabs() && e.patient) {
              <app-lab-requests-section [encounterId]="e.id" [patientNumber]="e.patient.number" [canOrder]="canOrderLabs() && e.status !== 'CANCELLED'" />
            }

            @if (canWrite(e)) {
              <section class="flex flex-col gap-3 border border-border bg-card p-4" aria-labelledby="sign-title">
                <h2 id="sign-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.sign.title') }}</h2>
                <p class="text-sm text-muted-foreground">{{ i18n.t('clinical.sign.lead') }}</p>
                @if (e.missingForSignature.length > 0) {
                  <ul class="list-disc pl-5 text-sm text-status-warning" data-test="missing">
                    @for (m of e.missingForSignature; track m) {
                      <li>{{ i18n.t('clinical.sign.missing.' + m) }}</li>
                    }
                  </ul>
                }
                <div class="flex flex-wrap gap-3">
                  <button type="button" [class]="primary" [disabled]="busy() === 'sign' || e.missingForSignature.length > 0" (click)="sign()">{{ i18n.t('clinical.sign.submit') }}</button>
                  <button type="button" [class]="secondary" (click)="open({ kind: 'cancel' })">{{ i18n.t('clinical.cancel.open') }}</button>
                </div>
              </section>
            }

            @if (e.status === 'SIGNED') {
              <section class="flex flex-col gap-3" aria-labelledby="addenda-title">
                <h2 id="addenda-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.addendum.title') }}</h2>
                <ul class="flex flex-col divide-y divide-border border border-border bg-card" data-test="addenda">
                  @for (a of e.addenda; track a.seq) {
                    <li class="flex flex-col gap-1 px-4 py-3 text-sm">
                      <span class="text-xs text-muted-foreground">{{ i18n.t('clinical.addendum.by', { n: a.seq, who: a.by?.username ?? '', when: when(a.at) }) }}</span>
                      <span class="whitespace-pre-line">{{ a.text }}</span>
                    </li>
                  } @empty {
                    <li class="px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('clinical.addendum.none') }}</li>
                  }
                </ul>
                @if (isAuthor(e)) {
                  <div class="border border-border bg-card p-4">
                    <app-form-builder #addendumForm [fields]="addendumForm_()" [busy]="busy() === 'addendum'" formId="encounter-addendum" (submitted)="saveAddendum($event)" />
                  </div>
                }
              </section>
            }
          </div>

          @if (panel(); as current) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="encounter-panel-title">
              <h2 id="encounter-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ panelTitle() }}</h2>
              <app-form-builder #form [fields]="panelFields()" [busy]="busy() === 'panel'" [formId]="'encounter-' + current.kind" (submitted)="submitPanel($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      } @else if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
})
export class EncounterPage implements OnInit {
  readonly id = input.required<string>();

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ClinicalGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly clock = inject(Clock);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');
  private readonly vitalsFormRef = viewChild<FormBuilderComponent>('vitalsForm');
  private readonly noteFormRef = viewChild<FormBuilderComponent>('noteForm');
  private readonly addendumFormRef = viewChild<FormBuilderComponent>('addendumForm');

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly secondary = SECONDARY;
  protected readonly cell = CELL;
  protected readonly vitalFields = VITAL_FIELDS;
  protected readonly noteKeys = ['chiefComplaint', 'history', 'examination', 'assessment', 'plan'] as const;
  protected readonly kinds = DIAGNOSIS_KINDS;
  protected readonly certainties = CERTAINTIES;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly encounter = signal<Encounter | null>(null);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal<'vitals' | 'note' | 'diagnoses' | 'sign' | 'addendum' | 'panel' | null>(null);
  protected readonly rows = signal<readonly Row[]>([]);
  protected readonly diagnosesNotice = signal<string | null>(null);
  private readonly notices = signal<Record<'vitals' | 'note' | 'addendum' | 'panel', string | null>>({ vitals: null, note: null, addendum: null, panel: null });

  private readonly permissions = computed(() => this.user()?.permissions ?? []);
  protected readonly canReadLabs = computed(() => hasPermission(this.permissions(), 'lab.requisitions:read:own'));
  protected readonly canOrderLabs = computed(() => hasPermission(this.permissions(), 'lab.requisitions:order'));
  protected readonly canReadRx = computed(() => hasPermission(this.permissions(), 'clinical.prescriptions:read:department'));
  protected readonly canWriteRx = computed(() => hasPermission(this.permissions(), 'clinical.prescriptions:write:department'));
  protected readonly canAllergy = computed(() => hasPermission(this.permissions(), 'clinical.allergies:write'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid items-start gap-6'));
  protected readonly vitalsForm_ = computed(() => vitalsFields({ vitals: this.encounter()?.vitals ?? null, notice: this.notices().vitals }));
  protected readonly noteForm_ = computed(() => noteFields({ note: this.encounter()?.note ?? { chiefComplaint: null, history: null, examination: null, assessment: null, plan: null }, notice: this.notices().note }));
  protected readonly addendumForm_ = computed(() => addendumFields({ notice: this.notices().addendum }));
  protected readonly panelTitle = computed(() => {
    const p = this.panel();
    if (!p) return '';
    return p.kind === 'allergy' ? this.i18n.t('clinical.allergy.addTitle') : p.kind === 'void' ? this.i18n.t('clinical.allergy.voidTitle', { substance: p.allergy.substance }) : this.i18n.t('clinical.cancel.title');
  });
  protected readonly panelFields = computed(() => {
    const p = this.panel();
    const notice = this.notices().panel;
    return !p ? [] : p.kind === 'allergy' ? allergyFields({ notice }) : p.kind === 'void' ? voidAllergyFields({ notice }) : cancelFields({ notice });
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const e = await this.gateway.getEncounter(this.id());
      this.encounter.set(e);
      this.rows.set(e.diagnoses.map((d) => ({ code: d.code, label: d.label, kind: d.kind, certainty: d.certainty })));
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected isAuthor(e: Encounter): boolean {
    return !!e.doctor && e.doctor.id === this.user()?.id;
  }

  /** Le médecin de la consultation la rédige tant qu'elle est en cours. */
  protected canWrite(e: Encounter): boolean {
    return e.status === 'IN_PROGRESS' && this.isAuthor(e) && hasPermission(this.permissions(), 'clinical.encounters:write:department');
  }

  protected canVitals(e: Encounter): boolean {
    return e.status === 'IN_PROGRESS' && hasPermission(this.permissions(), 'clinical.vitals:record:department');
  }

  private setNotice(key: 'vitals' | 'note' | 'addendum' | 'panel', value: string | null): void {
    this.notices.update((n) => ({ ...n, [key]: value }));
  }

  /** Applique une écriture : la consultation renvoyée remplace l'affichage ; un refus s'affiche près du formulaire (`key`) ou en haut de page. */
  private async write(busy: NonNullable<ReturnType<typeof this.busy>>, call: () => Promise<Encounter>, done: string, notice?: { key: 'vitals' | 'note' | 'addendum' | 'panel'; form?: FormBuilderComponent }): Promise<boolean> {
    this.busy.set(busy);
    if (notice) this.setNotice(notice.key, null);
    try {
      const saved = await call();
      this.encounter.set(saved);
      this.rows.set(saved.diagnoses.map((d) => ({ code: d.code, label: d.label, kind: d.kind, certainty: d.certainty })));
      this.error.set(null);
      this.toast.show(this.i18n.t(done, { number: saved.number }));
      return true;
    } catch (error) {
      const message = failureMessage(error, this.i18n, notice?.form);
      if (notice) this.setNotice(notice.key, message);
      else this.error.set(message);
      return false;
    } finally {
      this.busy.set(null);
    }
  }

  protected saveVitals(value: Record<string, unknown>): Promise<boolean> {
    const input: Record<string, number> = {};
    for (const f of VITAL_FIELDS) {
      const raw = String(value[f.name] ?? '').trim().replace(',', '.');
      if (raw !== '') input[f.name] = Number(raw);
    }
    return this.write('vitals', () => this.gateway.recordVitals(this.id(), input as VitalsInput), 'clinical.vitals.saved', { key: 'vitals', form: this.vitalsFormRef() });
  }

  protected saveNote(value: Record<string, unknown>): Promise<boolean> {
    const input: Record<string, string> = {};
    for (const key of this.noteKeys) input[key] = String(value[key] ?? '').trim();
    return this.write('note', () => this.gateway.updateNote(this.id(), input as NoteInput), 'clinical.note.saved', { key: 'note', form: this.noteFormRef() });
  }

  protected addRow(): void {
    this.rows.update((rows) => [...rows, { code: '', label: '', kind: rows.some((r) => r.kind === 'PRIMARY') ? 'SECONDARY' : 'PRIMARY', certainty: 'PROVISIONAL' }]);
  }

  protected removeRow(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected setRow(index: number, field: keyof Row, value: string): void {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  protected async saveDiagnoses(): Promise<void> {
    const rows = this.rows();
    for (const [i, r] of rows.entries()) {
      if (!/^[A-Za-z][0-9]{2}(\.[0-9A-Za-z]{1,4})?$/.test(r.code.trim())) return this.diagnosesNotice.set(this.i18n.t('clinical.diagnoses.codeInvalid', { n: i + 1 }));
      if (r.label.trim() === '') return this.diagnosesNotice.set(this.i18n.t('clinical.diagnoses.labelRequired', { n: i + 1 }));
    }
    this.diagnosesNotice.set(null);
    const diagnoses: DiagnosisInput[] = rows.map((r) => ({ code: r.code.trim().toUpperCase(), label: r.label.trim(), kind: r.kind, certainty: r.certainty }));
    const ok = await this.write('diagnoses', () => this.gateway.setDiagnoses(this.id(), diagnoses), 'clinical.diagnoses.saved');
    if (!ok) this.diagnosesNotice.set(this.error());
  }

  protected sign(): Promise<boolean> {
    return this.write('sign', () => this.gateway.signEncounter(this.id()), 'clinical.sign.done');
  }

  protected saveAddendum(value: Record<string, unknown>): Promise<boolean> {
    return this.write('addendum', () => this.gateway.addAddendum(this.id(), String(value['text']).trim()), 'clinical.addendum.done', { key: 'addendum', form: this.addendumFormRef() });
  }

  protected open(panel: Panel): void {
    this.setNotice('panel', null);
    this.panel.set(panel);
  }

  protected close(): void {
    this.panel.set(null);
    this.setNotice('panel', null);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.close();
  }

  protected async submitPanel(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    const e = this.encounter();
    if (!panel || !e) return;
    this.busy.set('panel');
    this.setNotice('panel', null);
    try {
      if (panel.kind === 'cancel') {
        this.encounter.set(await this.gateway.cancelEncounter(this.id(), String(value['reason']).trim()));
        this.toast.show(this.i18n.t('clinical.cancel.done', { number: e.number }));
      } else {
        if (panel.kind === 'allergy') {
          const reaction = String(value['reaction'] ?? '').trim();
          await this.gateway.recordAllergy(e.patient!.id, { substance: String(value['substance']).trim(), severity: String(value['severity']) as Severity, ...(reaction ? { reaction } : {}) });
          this.toast.show(this.i18n.t('clinical.allergy.done'));
        } else {
          await this.gateway.voidAllergy(panel.allergy.id, String(value['reason']).trim());
          this.toast.show(this.i18n.t('clinical.allergy.voided', { substance: panel.allergy.substance }));
        }
        await this.load();
      }
      this.close();
    } catch (error) {
      this.setNotice('panel', failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(null);
    }
  }

  protected tag(e: Encounter) {
    return encounterTag(this.i18n, e.status);
  }

  protected name(p: { lastName: string; firstName: string }): string {
    return patientName(p);
  }

  protected age(birthDate: string): string {
    return ageText(this.i18n, birthDate, this.clock.now().toString().slice(0, 10));
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  protected severity(a: Allergy) {
    return severityTag(this.i18n, a.severity);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { ClinicalGateway } from '../../../core/clinical/clinical.gateway';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { Translator } from '../../../core/i18n/translator';
import { InpatientGateway } from '../../../core/inpatient/inpatient.gateway';
import { AdministrationStatus, Chart, Consciousness, Medication, Observation, RecordedObservation } from '../../../core/inpatient/inpatient.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { PanelCard } from '../../../shared/panel-card';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { noteFields, observationFields, reasonFields, riskTone } from '../inpatient.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const OBSERVATIONS_SHOWN = 10;

type Pending = { readonly medication: Medication; readonly status: Exclude<AdministrationStatus, 'GIVEN'> };

/** Un nombre saisi (virgule ou point décimal) ; `null` si le champ est vide. */
const num = (value: unknown): number | null => {
  const text = String(value ?? '').trim().replace(',', '.');
  return text === '' ? null : Number(text);
};

/**
 * Dossier de soins d'un patient hospitalisé : constantes avec score NEWS2, médicaments à administrer (donné, refusé, suspendu) et notes de soins.
 * Tout est en ajout seul : une erreur se corrige par un nouveau relevé et une note. Après la sortie, le dossier reste lisible mais ne reçoit plus rien.
 */
@Component({
  selector: 'app-inpatient-chart-page',
  imports: [HlmButtonImports, RouterLink, FormBuilderComponent, PanelCard, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/ward" [class]="link" class="w-fit text-sm">← {{ i18n.t('inpatient.chart.back') }}</a>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="loadFailure()" formId="chart-load" />
      } @else if (chart(); as c) {
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex flex-col">
            <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ patientName() }}</h1>
            <p class="text-sm leading-6 text-muted-foreground">
              <span class="font-mono">{{ c.patient?.number }}</span> · {{ i18n.t('inpatient.chart.stay', { bed: c.stay.bed ?? '—', day: c.stay.days }) }}
            </p>
          </div>
          @if (canRound() && c.stay.active) {
            <button hlmBtn type="button" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none" [disabled]="startingRound()" (click)="startRound()">
              {{ i18n.t('inpatient.chart.round') }}
            </button>
          }
        </header>

        @if (!c.stay.active) {
          <p class="border border-border bg-muted p-3 text-sm leading-6" role="note">{{ i18n.t('inpatient.chart.ended') }}</p>
        }

        @if (roundError()) {
          <app-form-builder [fields]="roundFailure()" formId="chart-round-error" />
        }

        @if (escalation(); as e) {
          <p class="border border-status-critical bg-card p-3 text-sm leading-6 font-semibold text-status-critical" role="alert">{{ i18n.t('inpatient.chart.escalate', { score: e.news2 }) }}</p>
        } @else if (latest(); as l) {
          @if (l.risk === 'HIGH') {
            <p class="border border-status-critical bg-card p-3 text-sm leading-6 font-semibold text-status-critical" role="alert">{{ i18n.t('inpatient.chart.highRisk', { score: l.news2, when: when(l.recordedAt) }) }}</p>
          }
        }

        <div class="grid items-start gap-6 xl:grid-cols-2">
          <app-panel-card [heading]="i18n.t('inpatient.obs.title')">
            @if (canRecord() && c.stay.active) {
              <app-form-builder #obsForm [fields]="observationForm()" [busy]="busy()" [formId]="'inpatient-obs-' + formKey()" (submitted)="recordObservation($event)" />
            }
            @if (c.observations.length === 0) {
              <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('inpatient.obs.empty') }}</p>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs leading-[18px]">
                  <caption class="sr-only">{{ i18n.t('inpatient.obs.title') }}</caption>
                  <thead class="border-b border-border text-muted-foreground">
                    <tr>
                      <th scope="col" class="py-2 pr-3 font-medium">{{ i18n.t('inpatient.obs.when') }}</th>
                      <th scope="col" class="py-2 pr-3 font-medium">{{ i18n.t('inpatient.obs.score') }}</th>
                      <th scope="col" class="py-2 pr-3 font-medium">{{ i18n.t('inpatient.obs.values') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (o of shownObservations(); track o.id) {
                      <tr class="border-b border-border align-top last:border-b-0">
                        <td class="py-2 pr-3 whitespace-nowrap">{{ when(o.recordedAt) }}<br /><span class="text-muted-foreground">{{ o.recordedBy }}</span></td>
                        <td class="py-2 pr-3"><app-status-tag [text]="i18n.t('inpatient.score', { score: o.news2, risk: i18n.t('inpatient.risk.' + o.risk) })" [tone]="tone(o.risk)" /></td>
                        <td class="py-2 pr-3 font-mono">{{ values(o) }}@if (o.note) {<br /><span class="font-sans text-muted-foreground">{{ o.note }}</span>}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </app-panel-card>

          <app-panel-card [heading]="i18n.t('inpatient.mar.title')">
            @if (c.medications.length === 0) {
              <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('inpatient.mar.empty') }}</p>
            }
            <ul class="flex flex-col gap-4">
              @for (m of c.medications; track m.prescriptionId + ':' + m.position) {
                <li class="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0">
                  <div>
                    <p class="text-sm leading-6 font-medium">{{ m.drugName }}</p>
                    <p class="text-sm leading-6 text-muted-foreground">{{ m.dose }} · {{ m.frequency }}@if (m.instructions) { · {{ m.instructions }} }</p>
                    <p class="font-mono text-xs leading-[18px] text-muted-foreground">{{ m.prescriptionNumber }}</p>
                  </div>
                  @if (m.allergyWarning) {
                    <p class="text-sm leading-6 font-medium text-status-warning" role="note">{{ i18n.t('inpatient.mar.allergy') }}</p>
                  }
                  <p class="text-xs leading-[18px] text-muted-foreground">
                    @if (m.last; as last) {
                      {{ i18n.t('inpatient.mar.last.' + last.status, { when: when(last.at), by: last.by ?? '—' }) }}@if (last.reason) { · {{ last.reason }} }
                      · {{ i18n.t('inpatient.mar.given', { count: m.givenCount }) }}
                    } @else {
                      {{ i18n.t('inpatient.mar.none') }}
                    }
                  </p>
                  @if (canAdminister() && c.stay.active) {
                    <div class="flex flex-wrap gap-x-4 gap-y-1">
                      <button type="button" [class]="link" [disabled]="busy()" [attr.aria-label]="i18n.t('inpatient.mar.giveOf', { name: m.drugName })" (click)="give(m)">{{ i18n.t('inpatient.mar.give') }}</button>
                      <button type="button" [class]="link" [disabled]="busy()" [attr.aria-label]="i18n.t('inpatient.mar.refuseOf', { name: m.drugName })" (click)="ask(m, 'REFUSED')">{{ i18n.t('inpatient.mar.refuse') }}</button>
                      <button type="button" [class]="link" [disabled]="busy()" [attr.aria-label]="i18n.t('inpatient.mar.holdOf', { name: m.drugName })" (click)="ask(m, 'HELD')">{{ i18n.t('inpatient.mar.hold') }}</button>
                    </div>
                  }
                </li>
              }
            </ul>
            @if (pending(); as p) {
              <div class="flex flex-col gap-3 border-t border-border pt-4">
                <h3 class="text-sm leading-6 font-semibold">{{ i18n.t(p.status === 'HELD' ? 'inpatient.mar.holdOf' : 'inpatient.mar.refuseOf', { name: p.medication.drugName }) }}</h3>
                <app-form-builder #reasonForm [fields]="reasonForm$()" [busy]="busy()" [formId]="'inpatient-reason-' + p.medication.prescriptionId + '-' + p.medication.position" (submitted)="submitReason($event)" (action)="onReasonAction($event)" />
              </div>
            }
            @if (marError()) {
              <app-form-builder [fields]="marFailure()" formId="chart-mar-error" />
            }
          </app-panel-card>
        </div>

        <app-panel-card [heading]="i18n.t('inpatient.notes.title')">
          @if (canNote() && c.stay.active) {
            <app-form-builder #noteForm [fields]="noteForm$()" [busy]="busy()" [formId]="'inpatient-note-' + formKey()" (submitted)="addNote($event)" />
          }
          <ul class="flex flex-col gap-3">
            @for (n of c.notes; track n.id) {
              <li class="text-sm leading-6">
                <p>{{ n.text }}</p>
                <p class="text-xs leading-[18px] text-muted-foreground">{{ when(n.writtenAt) }} · {{ n.author ?? '—' }}</p>
              </li>
            } @empty {
              <li class="text-sm leading-6 text-muted-foreground">{{ i18n.t('inpatient.notes.empty') }}</li>
            }
          </ul>
        </app-panel-card>
      }
    </div>
  `,
})
export class InpatientChartPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(InpatientGateway);
  private readonly clinical = inject(ClinicalGateway);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dates = inject(DateTimeFormatter);
  private readonly user = inject(SessionStore).user;
  private readonly obsForm = viewChild<FormBuilderComponent>('obsForm');
  private readonly reasonForm = viewChild<FormBuilderComponent>('reasonForm');
  private readonly noteForm = viewChild<FormBuilderComponent>('noteForm');

  protected readonly link = LINK;
  protected readonly tone = riskTone;
  private readonly admissionId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly chart = signal<Chart | null>(null);
  protected readonly busy = signal(false);
  protected readonly formKey = signal(0);
  protected readonly escalation = signal<RecordedObservation | null>(null);
  protected readonly pending = signal<Pending | null>(null);
  protected readonly startingRound = signal(false);
  protected readonly roundError = signal<string | null>(null);
  protected readonly marError = signal<string | null>(null);
  private readonly obsNotice = signal<string | null>(null);
  private readonly reasonNotice = signal<string | null>(null);
  private readonly noteNotice = signal<string | null>(null);

  private readonly permissions = computed(() => this.user()?.permissions ?? []);
  protected readonly canRecord = computed(() => hasPermission(this.permissions(), 'inpatient.observations:record:department'));
  protected readonly canAdminister = computed(() => hasPermission(this.permissions(), 'inpatient.administrations:record:department'));
  protected readonly canNote = computed(() => hasPermission(this.permissions(), 'inpatient.notes:write:department'));
  protected readonly canRound = computed(() => hasPermission(this.permissions(), 'clinical.encounters:write:department'));
  protected readonly loadFailure = computed(() => failureNotice(this.loadError()));
  protected readonly roundFailure = computed(() => failureNotice(this.roundError()));
  protected readonly marFailure = computed(() => failureNotice(this.marError()));
  protected readonly latest = computed(() => this.chart()?.observations[0] ?? null);
  protected readonly shownObservations = computed(() => (this.chart()?.observations ?? []).slice(0, OBSERVATIONS_SHOWN));
  protected readonly observationForm = computed(() => observationFields({ notice: this.obsNotice() }));
  protected readonly noteForm$ = computed(() => noteFields({ notice: this.noteNotice() }));
  protected readonly reasonForm$ = computed(() => reasonFields({ held: this.pending()?.status === 'HELD', notice: this.reasonNotice() }));
  protected readonly patientName = computed(() => {
    const p = this.chart()?.patient;
    return p ? `${p.lastName} ${p.firstName}` : this.i18n.t('inpatient.unknownPatient');
  });

  constructor() {
    void this.load(true);
  }

  private async load(initial = false): Promise<void> {
    try {
      this.chart.set(await this.gateway.chart(this.admissionId));
      this.loadError.set(null);
    } catch (error) {
      this.loadError.set(failureMessage(error, this.i18n));
    } finally {
      if (initial) this.loading.set(false);
    }
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  protected values(o: Observation): string {
    const pressure = o.diastolic === null ? `${o.systolic}` : `${o.systolic}/${o.diastolic}`;
    return this.i18n.t('inpatient.obs.line', { temperature: String(o.temperature).replace('.', ','), pulse: o.pulse, pressure, rr: o.respiratoryRate, spo2: o.spo2, level: this.i18n.t(`inpatient.consciousness.${o.consciousness}`) }) + (o.supplementalOxygen ? ` · ${this.i18n.t('inpatient.obs.oxygen')}` : '');
  }

  protected async recordObservation(value: Record<string, unknown>): Promise<void> {
    this.obsNotice.set(null);
    this.busy.set(true);
    try {
      const recorded = await this.gateway.recordObservation(this.admissionId, {
        temperature: num(value['temperature']) as number,
        pulse: num(value['pulse']) as number,
        systolic: num(value['systolic']) as number,
        diastolic: num(value['diastolic']),
        respiratoryRate: num(value['respiratoryRate']) as number,
        spo2: num(value['spo2']) as number,
        supplementalOxygen: value['supplementalOxygen'] === true,
        consciousness: String(value['consciousness']) as Consciousness,
        note: String(value['note'] ?? '').trim() || null,
      });
      this.escalation.set(recorded.escalate ? recorded : null);
      this.toast.show(this.i18n.t('inpatient.obs.saved', { score: recorded.news2 }));
      this.formKey.update((n) => n + 1);
      await this.load();
    } catch (error) {
      this.obsNotice.set(failureMessage(error, this.i18n, this.obsForm()));
    } finally {
      this.busy.set(false);
    }
  }

  protected give(medication: Medication): Promise<void> {
    return this.administer(medication, 'GIVEN');
  }

  protected ask(medication: Medication, status: Exclude<AdministrationStatus, 'GIVEN'>): void {
    this.reasonNotice.set(null);
    this.marError.set(null);
    this.pending.set({ medication, status });
  }

  protected onReasonAction(event: FormAction): void {
    if (event.action === 'cancel') this.pending.set(null);
  }

  protected async submitReason(value: Record<string, unknown>): Promise<void> {
    const p = this.pending();
    if (!p) return;
    await this.administer(p.medication, p.status, String(value['reason'] ?? '').trim());
  }

  private async administer(medication: Medication, status: AdministrationStatus, reason?: string): Promise<void> {
    this.busy.set(true);
    this.marError.set(null);
    this.reasonNotice.set(null);
    try {
      await this.gateway.recordAdministration(this.admissionId, { prescriptionId: medication.prescriptionId, position: medication.position, status, ...(reason ? { reason } : {}) });
      this.toast.show(this.i18n.t(`inpatient.mar.saved.${status}`, { name: medication.drugName }));
      this.pending.set(null);
      await this.load();
    } catch (error) {
      const message = failureMessage(error, this.i18n, this.reasonForm());
      if (this.pending()) this.reasonNotice.set(message);
      else this.marError.set(message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async addNote(value: Record<string, unknown>): Promise<void> {
    this.noteNotice.set(null);
    this.busy.set(true);
    try {
      await this.gateway.addNote(this.admissionId, String(value['text'] ?? '').trim());
      this.toast.show(this.i18n.t('inpatient.notes.saved'));
      this.formKey.update((n) => n + 1);
      await this.load();
    } catch (error) {
      this.noteNotice.set(failureMessage(error, this.i18n, this.noteForm()));
    } finally {
      this.busy.set(false);
    }
  }

  /** La tournée du médecin : une consultation sur l'admission du patient hospitalisé (reprise si elle est déjà ouverte). */
  protected async startRound(): Promise<void> {
    this.startingRound.set(true);
    this.roundError.set(null);
    try {
      const encounter = await this.clinical.startEncounter(this.admissionId);
      await this.router.navigate(['/clinical/encounters', encounter.id]);
    } catch (error) {
      const api: ApiError = toApiError(error);
      const open = (api.body as { params?: { encounterId?: string } } | null)?.params?.encounterId;
      if (api.code === 'CLINICAL_ENCOUNTER_ALREADY_OPEN' && open) await this.router.navigate(['/clinical/encounters', open]);
      else this.roundError.set(failureMessage(error, this.i18n));
    } finally {
      this.startingRound.set(false);
    }
  }
}

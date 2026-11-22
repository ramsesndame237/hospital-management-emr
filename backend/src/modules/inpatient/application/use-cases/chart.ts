import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { ServiceAccess } from '../../../../shared-kernel/service-access';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Instant } from '../../../../shared-kernel/temporal';
import { CONSCIOUSNESS_LEVELS, Consciousness, news2 } from '../../domain/news2';
import {
  ADMINISTRATION_STATUSES, Administration, AdministrationStatus, ChartRepository, MedicationDirectory, NursingNote, Observation, OrderedMedication, PatientCard, PatientDirectory, Stay,
  StayDirectory, UserDirectory,
} from '../../domain/ports';

const NOT_FOUND = new DomainError('INPATIENT_STAY_NOT_FOUND', 'Hospitalisation introuvable.');
const CLOSED = new DomainError('INPATIENT_STAY_CLOSED', 'Cette hospitalisation est terminée : on ne peut plus y ajouter de soins.');
const MEDICATION_NOT_FOUND = new DomainError('INPATIENT_MEDICATION_NOT_FOUND', "Cette ligne d'ordonnance n'existe pas, est annulée, ou n'appartient pas à cette hospitalisation.");
const REASON_REQUIRED = new DomainError('INPATIENT_REASON_REQUIRED', 'Un médicament refusé ou suspendu exige un motif (200 caractères au plus).');
const NOTE_INVALID = new DomainError('INPATIENT_NOTE_INVALID', 'La note doit contenir entre 1 et 1000 caractères.');
const STATUS_INVALID = (raw: string) => new DomainError('INPATIENT_STATUS_INVALID', `Statut d'administration invalide : « ${raw} ».`, { value: raw });
const VITALS_INVALID = (field: string, min: number, max: number) => new DomainError('INPATIENT_VITALS_INVALID', `Valeur hors limites : ${field} (de ${min} à ${max}).`, { field, min, max });
const CONSCIOUSNESS_INVALID = new DomainError('INPATIENT_CONSCIOUSNESS_INVALID', 'Niveau de conscience invalide (ALERT, CONFUSION, VOICE, PAIN ou UNRESPONSIVE).');

export interface InpatientDependencies {
  readonly chart: ChartRepository;
  readonly stays: StayDirectory;
  readonly patients: PatientDirectory;
  readonly users: UserDirectory;
  readonly medications: MedicationDirectory;
  readonly access: ServiceAccess;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

export interface PatientView {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

const patientView = (p: PatientCard | undefined): PatientView | null => (p ? { id: p.id, number: p.number, lastName: p.lastName, firstName: p.firstName, sex: p.sex, birthDate: p.birthDate } : null);

export interface ObservationView {
  readonly id: string;
  readonly recordedAt: string;
  readonly recordedBy: string | null;
  readonly temperature: number;
  readonly pulse: number;
  readonly systolic: number;
  readonly diastolic: number | null;
  readonly respiratoryRate: number;
  readonly spo2: number;
  readonly supplementalOxygen: boolean;
  readonly consciousness: string;
  readonly news2: number;
  readonly risk: string;
  readonly note: string | null;
}

export interface MedicationView {
  readonly prescriptionId: string;
  readonly prescriptionNumber: string;
  readonly position: number;
  readonly drugName: string;
  readonly dose: string;
  readonly frequency: string;
  readonly instructions: string | null;
  readonly issuedAt: string;
  readonly allergyWarning: boolean;
  /** Dernière action sur cette ligne (donné, refusé, suspendu), ou `null` : rien n'a encore été fait. */
  readonly last: { readonly status: string; readonly at: string; readonly by: string | null; readonly reason: string | null } | null;
  /** Nombre de doses données. */
  readonly givenCount: number;
}

export interface AdministrationView {
  readonly id: string;
  readonly prescriptionNumber: string | null;
  readonly drugName: string | null;
  readonly status: string;
  readonly reason: string | null;
  readonly at: string;
  readonly by: string | null;
}

export interface NoteView {
  readonly id: string;
  readonly text: string;
  readonly writtenAt: string;
  readonly author: string | null;
}

export interface StayView {
  readonly admissionId: string;
  readonly number: string;
  readonly bed: string | null;
  readonly serviceId: string;
  readonly admittedAt: string;
  readonly days: number;
  readonly active: boolean;
}

export interface ChartView {
  readonly stay: StayView;
  readonly patient: PatientView | null;
  readonly observations: readonly ObservationView[];
  readonly medications: readonly MedicationView[];
  readonly administrations: readonly AdministrationView[];
  readonly notes: readonly NoteView[];
}

export interface WardRowView {
  readonly stay: StayView;
  readonly patient: PatientView | null;
  readonly latest: { readonly recordedAt: string; readonly news2: number; readonly risk: string } | null;
}

/** Jours d'hospitalisation : le jour d'arrivée compte pour un (la nuit de l'arrivée est le premier jour). */
function daysSince(admittedAt: Instant, now: Instant): number {
  return Math.max(1, Math.floor(now.since(admittedAt).total({ unit: 'hours' }) / 24) + 1);
}

const stayView = (d: InpatientDependencies, s: Stay): StayView => ({
  admissionId: s.id, number: s.number, bed: s.bed?.name ?? null, serviceId: s.serviceId, admittedAt: s.admittedAt.toString(), days: daysSince(s.admittedAt, d.clock.now()), active: s.active,
});

const username = (users: Map<string, { username: string }>, id: string): string | null => users.get(id)?.username ?? null;

/** Charge un séjour que l'utilisateur a le droit de voir : hors de son périmètre, il « n'existe pas » (rien ne fuit sur sa présence). */
async function loadStay(d: InpatientDependencies, actorId: string, permission: string, rawId: string): Promise<Result<Stay>> {
  const stay = await d.stays.find((rawId ?? '').trim().toLowerCase());
  if (!stay || !(await d.access.canAccess(actorId, permission, stay.serviceId))) return err(NOT_FOUND);
  return ok(stay);
}

const record = (d: InpatientDependencies, actorId: string, action: string, stay: Stay, metadata: Record<string, string | number | boolean | null> = {}) =>
  // Le journal garde qui a fait quoi pour quelle hospitalisation, jamais une valeur clinique (constantes, note, dose).
  d.audit.record({ action, outcome: 'SUCCESS', actorId, resourceType: 'inpatient-stay', resourceId: stay.id, metadata: { number: stay.number, patientId: stay.patientId, serviceId: stay.serviceId, ...metadata }, occurredAt: d.clock.now() });

const observationView = (o: Observation, users: Map<string, { username: string }>): ObservationView => ({
  id: o.id, recordedAt: o.recordedAt.toString(), recordedBy: username(users, o.recordedBy), temperature: o.temperature, pulse: o.pulse, systolic: o.systolic, diastolic: o.diastolic,
  respiratoryRate: o.respiratoryRate, spo2: o.spo2, supplementalOxygen: o.supplementalOxygen, consciousness: o.consciousness, news2: o.news2, risk: o.risk, note: o.note,
});

/** Les hospitalisés des services de l'utilisateur, avec leur dernier score NEWS2 : la « tournée » de l'infirmier. */
export class ListWardUseCase {
  constructor(private readonly d: InpatientDependencies) {}

  async execute(actorId: string): Promise<Result<readonly WardRowView[]>> {
    const visible = await this.d.access.visibleServices(actorId, 'inpatient.chart:read');
    if (visible !== 'ALL' && visible.length === 0) return ok([]);
    const stays = await this.d.stays.inpatients(visible === 'ALL' ? null : visible);
    const patients = await this.d.patients.find([...new Set(stays.map((s) => s.patientId))]);
    const latest = await this.d.chart.latestObservations(stays.map((s) => s.id));
    return ok(stays.map((s): WardRowView => {
      const o = latest.get(s.id);
      return { stay: stayView(this.d, s), patient: patientView(patients.get(s.patientId)), latest: o ? { recordedAt: o.recordedAt.toString(), news2: o.news2, risk: o.risk } : null };
    }));
  }
}

const HISTORY = 50;

/** Le dossier de soins d'un patient hospitalisé : relevés, médicaments à administrer avec leur historique, notes. La lecture est tracée. */
export class GetChartUseCase {
  constructor(private readonly d: InpatientDependencies) {}

  async execute(actorId: string, admissionId: string): Promise<Result<ChartView>> {
    const loaded = await loadStay(this.d, actorId, 'inpatient.chart:read', admissionId);
    if (!loaded.ok) return err(loaded.error);
    const stay = loaded.value;
    const [observations, administrations, notes, ordered, patients] = await Promise.all([
      this.d.chart.observations(stay.id, HISTORY), this.d.chart.administrations(stay.id, 200), this.d.chart.notes(stay.id, HISTORY), this.d.medications.forStay(stay.id), this.d.patients.find([stay.patientId]),
    ]);
    const users = await this.d.users.find([...new Set([...observations.map((o) => o.recordedBy), ...administrations.map((a) => a.administeredBy), ...notes.map((n) => n.authorId)])]);
    const byLine = new Map<string, OrderedMedication>(ordered.map((m) => [`${m.prescriptionId}:${m.position}`, m]));
    const medications = ordered.map((m): MedicationView => {
      const history = administrations.filter((a) => a.prescriptionId === m.prescriptionId && a.position === m.position);
      const last = history[0];
      return {
        prescriptionId: m.prescriptionId, prescriptionNumber: m.prescriptionNumber, position: m.position, drugName: m.drugName, dose: m.dose, frequency: m.frequency, instructions: m.instructions,
        issuedAt: m.issuedAt.toString(), allergyWarning: m.allergyWarning,
        last: last ? { status: last.status, at: last.administeredAt.toString(), by: username(users, last.administeredBy), reason: last.reason } : null,
        givenCount: history.filter((a) => a.status === 'GIVEN').length,
      };
    });
    await record(this.d, actorId, 'inpatient.chart.read', stay);
    return ok({
      stay: stayView(this.d, stay), patient: patientView(patients.get(stay.patientId)),
      observations: observations.map((o) => observationView(o, users)),
      medications,
      administrations: administrations.slice(0, HISTORY).map((a): AdministrationView => {
        const m = byLine.get(`${a.prescriptionId}:${a.position}`);
        return { id: a.id, prescriptionNumber: m?.prescriptionNumber ?? null, drugName: m?.drugName ?? null, status: a.status, reason: a.reason, at: a.administeredAt.toString(), by: username(users, a.administeredBy) };
      }),
      notes: notes.map((n): NoteView => ({ id: n.id, text: n.text, writtenAt: n.writtenAt.toString(), author: username(users, n.authorId) })),
    });
  }
}

export interface ObservationInput {
  temperature: number;
  pulse: number;
  systolic: number;
  diastolic?: number | null;
  respiratoryRate: number;
  spo2: number;
  supplementalOxygen: boolean;
  consciousness: string;
  note?: string | null;
}

/** Limites physiologiques acceptées (mêmes bornes que la base) : au-delà, c'est presque sûrement une faute de frappe. */
const LIMITS: readonly (readonly [keyof ObservationInput & string, number, number])[] = [
  ['temperature', 30, 45], ['pulse', 20, 300], ['systolic', 40, 300], ['respiratoryRate', 4, 80], ['spo2', 50, 100],
];

export class RecordObservationUseCase {
  constructor(private readonly d: InpatientDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, admissionId: string, input: ObservationInput): Promise<Result<ObservationView & { escalate: boolean }>> {
    const loaded = await loadStay(this.d, actorId, 'inpatient.observations:record', admissionId);
    if (!loaded.ok) return err(loaded.error);
    const stay = loaded.value;
    if (!stay.active) return err(CLOSED);
    for (const [field, min, max] of LIMITS) {
      const value = Number(input[field]);
      if (!Number.isFinite(value) || value < min || value > max) return err(VITALS_INVALID(field, min, max));
    }
    if (input.diastolic !== undefined && input.diastolic !== null && (!Number.isFinite(Number(input.diastolic)) || input.diastolic < 20 || input.diastolic > 200 || input.diastolic >= input.systolic)) {
      return err(VITALS_INVALID('diastolic', 20, Math.min(200, input.systolic - 1)));
    }
    const consciousness = CONSCIOUSNESS_LEVELS.find((c) => c === String(input.consciousness ?? '').trim().toUpperCase());
    if (!consciousness) return err(CONSCIOUSNESS_INVALID);
    const note = (input.note ?? '').trim();
    if (note.length > 300) return err(new DomainError('INPATIENT_NOTE_INVALID', 'La remarque ne doit pas dépasser 300 caractères.'));
    const supplementalOxygen = input.supplementalOxygen === true;
    const score = news2({ temperature: input.temperature, pulse: input.pulse, systolic: input.systolic, respiratoryRate: input.respiratoryRate, spo2: input.spo2, supplementalOxygen, consciousness: consciousness as Consciousness });
    const observation: Observation = {
      id: this.ids.next(), admissionId: stay.id, patientId: stay.patientId, serviceId: stay.serviceId, recordedBy: actorId, recordedAt: this.d.clock.now(),
      temperature: input.temperature, pulse: input.pulse, systolic: input.systolic, diastolic: input.diastolic ?? null, respiratoryRate: input.respiratoryRate, spo2: input.spo2,
      supplementalOxygen, consciousness, news2: score.score, risk: score.risk, note: note || null,
    };
    await this.d.chart.insertObservation(observation);
    await record(this.d, actorId, 'inpatient.observation.record', stay, { news2: score.score, risk: score.risk });
    const users = await this.d.users.find([actorId]);
    return ok({ ...observationView(observation, users), escalate: score.risk === 'HIGH' });
  }
}

export class RecordAdministrationUseCase {
  constructor(private readonly d: InpatientDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, admissionId: string, input: { prescriptionId: string; position: number; status: string; reason?: string | null }): Promise<Result<AdministrationView>> {
    const loaded = await loadStay(this.d, actorId, 'inpatient.administrations:record', admissionId);
    if (!loaded.ok) return err(loaded.error);
    const stay = loaded.value;
    if (!stay.active) return err(CLOSED);
    const status = ADMINISTRATION_STATUSES.find((s) => s === String(input.status ?? '').trim().toUpperCase()) as AdministrationStatus | undefined;
    if (!status) return err(STATUS_INVALID(String(input.status ?? '')));
    const reason = (input.reason ?? '').trim();
    if (status === 'GIVEN' ? reason !== '' : reason.length < 1 || reason.length > 200) return err(status === 'GIVEN' ? new DomainError('INPATIENT_REASON_NOT_ALLOWED', "Un médicament donné n'a pas de motif.") : REASON_REQUIRED);
    const medication = await this.d.medications.find(stay.id, (input.prescriptionId ?? '').trim().toLowerCase(), input.position);
    if (!medication) return err(MEDICATION_NOT_FOUND);
    const administration: Administration = {
      id: this.ids.next(), admissionId: stay.id, patientId: stay.patientId, serviceId: stay.serviceId, prescriptionId: medication.prescriptionId, position: medication.position, status,
      reason: status === 'GIVEN' ? null : reason, administeredBy: actorId, administeredAt: this.d.clock.now(),
    };
    await this.d.chart.insertAdministration(administration);
    await record(this.d, actorId, 'inpatient.administration.record', stay, { status, prescriptionNumber: medication.prescriptionNumber, position: medication.position });
    const users = await this.d.users.find([actorId]);
    return ok({ id: administration.id, prescriptionNumber: medication.prescriptionNumber, drugName: medication.drugName, status, reason: administration.reason, at: administration.administeredAt.toString(), by: username(users, actorId) });
  }
}

export class AddNoteUseCase {
  constructor(private readonly d: InpatientDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, admissionId: string, text: string): Promise<Result<NoteView>> {
    const loaded = await loadStay(this.d, actorId, 'inpatient.notes:write', admissionId);
    if (!loaded.ok) return err(loaded.error);
    const stay = loaded.value;
    if (!stay.active) return err(CLOSED);
    const clean = (text ?? '').trim();
    if (clean.length < 1 || clean.length > 1000) return err(NOTE_INVALID);
    const note: NursingNote = { id: this.ids.next(), admissionId: stay.id, patientId: stay.patientId, serviceId: stay.serviceId, authorId: actorId, writtenAt: this.d.clock.now(), text: clean };
    await this.d.chart.insertNote(note);
    await record(this.d, actorId, 'inpatient.note.add', stay);
    const users = await this.d.users.find([actorId]);
    return ok({ id: note.id, text: note.text, writtenAt: note.writtenAt.toString(), author: username(users, actorId) });
  }
}


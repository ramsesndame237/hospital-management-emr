import { AuditLog } from '../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../shared-kernel/ports';
import { ServiceAccess } from '../../../shared-kernel/service-access';
import { Allergy } from '../domain/allergy';
import { Encounter } from '../domain/encounter';
import { AllergyRepository, EncounterRepository, PatientDirectory, PatientInfo, UserDirectory, VisitDirectory } from '../domain/ports';
import { bodyMassIndex } from '../domain/vitals';

export interface ClinicalDependencies {
  readonly encounters: EncounterRepository;
  readonly allergies: AllergyRepository;
  readonly patients: PatientDirectory;
  readonly users: UserDirectory;
  readonly visits: VisitDirectory;
  readonly access: ServiceAccess;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export interface UserSummary {
  readonly id: string;
  readonly username: string;
}

/** Les noms viennent de l'IAM ; un compte disparu donne `null` plutôt qu'une erreur (le journal garde l'identifiant). */
export async function userSummaries(d: ClinicalDependencies, ids: readonly (string | null)[]): Promise<(id: string | null) => UserSummary | null> {
  const found = await d.users.find([...new Set(ids.filter((i): i is string => !!i))]);
  return (id) => (id && found.get(id) ? { id, username: found.get(id)!.username } : null);
}

export interface PatientSummary {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

export const toPatientSummary = (p: PatientInfo): PatientSummary => ({ id: p.id, number: p.number, lastName: p.lastName, firstName: p.firstName, sex: p.sex, birthDate: p.birthDate });

export interface AllergyView {
  readonly id: string;
  readonly patientId: string;
  readonly substance: string;
  readonly reaction: string | null;
  readonly severity: string;
  readonly status: string;
  readonly recordedBy: UserSummary | null;
  readonly recordedAt: string;
  readonly voidedBy: UserSummary | null;
  readonly voidedAt: string | null;
  readonly voidReason: string | null;
}

export async function toAllergyViews(d: ClinicalDependencies, allergies: readonly Allergy[]): Promise<AllergyView[]> {
  const who = await userSummaries(d, allergies.flatMap((a) => [a.state.recordedBy, a.state.voidedBy]));
  return allergies.map((a) => {
    const s = a.state;
    return {
      id: s.id.value, patientId: s.patientId.value, substance: s.substance, reaction: s.reaction, severity: s.severity, status: s.status, recordedBy: who(s.recordedBy), recordedAt: s.recordedAt.toString(),
      voidedBy: who(s.voidedBy), voidedAt: s.voidedAt?.toString() ?? null, voidReason: s.voidReason,
    };
  });
}

export interface VitalsView {
  readonly temperature: number | null;
  readonly pulse: number | null;
  readonly systolic: number | null;
  readonly diastolic: number | null;
  readonly respiratoryRate: number | null;
  readonly spo2: number | null;
  readonly weightKg: number | null;
  readonly heightCm: number | null;
  /** Indice de masse corporelle, calculé. */
  readonly bmi: number | null;
  readonly recordedBy: UserSummary | null;
  readonly recordedAt: string;
}

export interface EncounterView {
  readonly id: string;
  readonly number: string;
  readonly status: string;
  readonly patient: PatientSummary | null;
  readonly serviceId: string;
  readonly admissionId: string | null;
  readonly doctor: UserSummary | null;
  readonly startedAt: string;
  readonly vitals: VitalsView | null;
  readonly note: { readonly chiefComplaint: string | null; readonly history: string | null; readonly examination: string | null; readonly assessment: string | null; readonly plan: string | null };
  readonly diagnoses: { readonly code: string; readonly label: string; readonly kind: string; readonly certainty: string }[];
  /** Ce qu'il manque pour signer (vide : on peut signer). */
  readonly missingForSignature: readonly string[];
  readonly signedBy: UserSummary | null;
  readonly signedAt: string | null;
  readonly addenda: { readonly seq: number; readonly text: string; readonly by: UserSummary | null; readonly at: string }[];
  readonly cancelledBy: UserSummary | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  /** Allergies actives du patient, affichées en bandeau de la consultation. */
  readonly allergies: AllergyView[];
}

export async function toEncounterView(d: ClinicalDependencies, encounter: Encounter): Promise<EncounterView> {
  const s = encounter.state;
  const patient = (await d.patients.find([s.patientId.value])).get(s.patientId.value);
  const who = await userSummaries(d, [s.doctorId, s.vitalsBy, s.signedBy, s.cancelledBy, ...s.addenda.map((a) => a.by)]);
  const allergies = await d.allergies.listOf(s.patientId, false);
  const v = s.vitals;
  return {
    id: s.id.value, number: s.number.value, status: s.status, patient: patient ? toPatientSummary(patient) : null, serviceId: s.serviceId, admissionId: s.admissionId, doctor: who(s.doctorId),
    startedAt: s.startedAt.toString(),
    vitals: v && s.vitalsAt ? { ...v, bmi: bodyMassIndex(v), recordedBy: who(s.vitalsBy), recordedAt: s.vitalsAt.toString() } : null,
    note: s.note, diagnoses: s.diagnoses.map((x) => ({ code: x.code.value, label: x.label, kind: x.kind, certainty: x.certainty })), missingForSignature: encounter.missingForSignature(),
    signedBy: who(s.signedBy), signedAt: s.signedAt?.toString() ?? null, addenda: s.addenda.map((a) => ({ seq: a.seq, text: a.text, by: who(a.by), at: a.at.toString() })),
    cancelledBy: who(s.cancelledBy), cancelledAt: s.cancelledAt?.toString() ?? null, cancellationReason: s.cancellationReason, allergies: await toAllergyViews(d, allergies),
  };
}

export const pageOf = (offset: number, limit: number) => ({ offset: Math.max(0, Math.trunc(offset)), limit: Math.min(200, Math.max(1, Math.trunc(limit))) });

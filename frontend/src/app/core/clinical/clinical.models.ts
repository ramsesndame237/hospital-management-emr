/** Les codes sont stables, l'interface les traduit (`clinical.severity.<CODE>`, `clinical.status.<CODE>`…). */
export const ENCOUNTER_STATUSES = ['IN_PROGRESS', 'SIGNED', 'CANCELLED'] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DIAGNOSIS_KINDS = ['PRIMARY', 'SECONDARY'] as const;
export type DiagnosisKind = (typeof DIAGNOSIS_KINDS)[number];

export const CERTAINTIES = ['PROVISIONAL', 'CONFIRMED'] as const;
export type Certainty = (typeof CERTAINTIES)[number];

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface UserRef {
  readonly id: string;
  readonly username: string;
}

export interface PatientSummary {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  /** `AAAA-MM-JJ`. */
  readonly birthDate: string;
}

export interface Allergy {
  readonly id: string;
  readonly patientId: string;
  readonly substance: string;
  readonly reaction: string | null;
  readonly severity: Severity;
  readonly status: 'ACTIVE' | 'ENTERED_IN_ERROR';
  readonly recordedBy: UserRef | null;
  readonly recordedAt: string;
  readonly voidedBy: UserRef | null;
  readonly voidedAt: string | null;
  readonly voidReason: string | null;
}

export interface AllergyInput {
  readonly substance: string;
  readonly reaction?: string | null;
  readonly severity: Severity;
}

export interface AllergyChanges {
  readonly reaction?: string | null;
  readonly severity?: Severity;
}

export interface Vitals {
  readonly temperature: number | null;
  readonly pulse: number | null;
  readonly systolic: number | null;
  readonly diastolic: number | null;
  readonly respiratoryRate: number | null;
  readonly spo2: number | null;
  readonly weightKg: number | null;
  readonly heightCm: number | null;
  /** Calculé par le serveur quand le poids et la taille sont connus. */
  readonly bmi: number | null;
  readonly recordedBy: UserRef | null;
  readonly recordedAt: string;
}

export type VitalsInput = { readonly [K in keyof Omit<Vitals, 'bmi' | 'recordedBy' | 'recordedAt'>]?: number | null };

export interface Note {
  readonly chiefComplaint: string | null;
  readonly history: string | null;
  readonly examination: string | null;
  readonly assessment: string | null;
  readonly plan: string | null;
}

export type NoteInput = { readonly [K in keyof Note]?: string | null };

export interface Diagnosis {
  readonly code: string;
  readonly label: string;
  readonly kind: DiagnosisKind;
  readonly certainty: Certainty;
}

export interface Addendum {
  readonly seq: number;
  readonly text: string;
  readonly by: UserRef | null;
  readonly at: string;
}

export interface Encounter {
  readonly id: string;
  readonly number: string;
  readonly status: EncounterStatus;
  readonly patient: PatientSummary | null;
  readonly serviceId: string;
  readonly admissionId: string | null;
  readonly doctor: UserRef | null;
  readonly startedAt: string;
  readonly vitals: Vitals | null;
  readonly note: Note;
  readonly diagnoses: readonly Diagnosis[];
  /** `PRIMARY_DIAGNOSIS`, `ASSESSMENT` : ce qu'il manque pour signer (vide : on peut signer). */
  readonly missingForSignature: readonly ('PRIMARY_DIAGNOSIS' | 'ASSESSMENT')[];
  readonly signedBy: UserRef | null;
  readonly signedAt: string | null;
  readonly addenda: readonly Addendum[];
  readonly cancelledBy: UserRef | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  /** Allergies actives du patient, en bandeau. */
  readonly allergies: readonly Allergy[];
}

export interface EncounterSummary {
  readonly id: string;
  readonly number: string;
  readonly patient: PatientSummary | null;
  readonly serviceId: string;
  readonly doctor: UserRef | null;
  readonly status: EncounterStatus;
  readonly startedAt: string;
  readonly signedAt: string | null;
  readonly primaryDiagnosis: { readonly code: string; readonly label: string } | null;
}

export interface EncounterFilter {
  readonly status?: EncounterStatus;
  readonly patientId?: string;
  /** Seulement les consultations de l'appelant. */
  readonly mine?: boolean;
}

export interface QueueItem {
  readonly admission: { readonly id: string; readonly number: string; readonly type: 'OUTPATIENT' | 'EMERGENCY'; readonly admittedAt: string; readonly serviceId: string };
  readonly patient: PatientSummary | null;
  /** Consultation en cours pour cette admission ; absente : le patient attend. */
  readonly encounter: { readonly id: string; readonly number: string; readonly doctor: UserRef | null; readonly mine: boolean } | null;
}

export interface DiagnosisInput {
  readonly code: string;
  readonly label: string;
  readonly kind: DiagnosisKind;
  readonly certainty?: Certainty;
}

export type PrescriptionStatus = 'ISSUED' | 'CANCELLED';

/** Une allergie active du patient qui vise un médicament : un motif est exigé pour le prescrire malgré tout. */
export interface AllergyAlert {
  readonly allergyId: string;
  readonly substance: string;
  readonly severity: Severity;
}

export interface DrugSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength: string | null;
  readonly form: string;
  readonly schedule: string;
  readonly unit: string;
  readonly active: boolean;
}

export interface DrugSuggestion extends DrugSummary {
  readonly allergyAlerts: readonly AllergyAlert[];
}

export interface PrescriptionLine {
  readonly position: number;
  readonly drug: DrugSummary | null;
  readonly dose: string;
  readonly frequency: string;
  readonly durationDays: number | null;
  readonly quantity: number;
  readonly instructions: string | null;
  /** Motif de prescription malgré une allergie connue ; absent : aucune alerte à l'émission. */
  readonly allergyOverride: string | null;
}

export interface Prescription {
  readonly id: string;
  readonly number: string;
  readonly encounterId: string;
  readonly patient: PatientSummary | null;
  readonly serviceId: string;
  readonly doctor: UserRef | null;
  readonly status: PrescriptionStatus;
  readonly issuedAt: string;
  readonly notes: string | null;
  readonly lines: readonly PrescriptionLine[];
  /** Ce que la pharmacie a délivré : une ordonnance délivrée, même en partie, ne s'annule plus. */
  readonly dispensing: 'NONE' | 'PARTIAL' | 'COMPLETE';
  readonly cancelledBy: UserRef | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
}

export interface PrescriptionLineInput {
  readonly drugId: string;
  readonly dose: string;
  readonly frequency: string;
  readonly durationDays?: number | null;
  readonly quantity: number;
  readonly instructions?: string | null;
  readonly allergyOverride?: string | null;
}

export interface PrescriptionInput {
  readonly notes?: string | null;
  readonly lines: readonly PrescriptionLineInput[];
}

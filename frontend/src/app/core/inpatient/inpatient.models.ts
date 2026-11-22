export const CONSCIOUSNESS_LEVELS = ['ALERT', 'CONFUSION', 'VOICE', 'PAIN', 'UNRESPONSIVE'] as const;
export type Consciousness = (typeof CONSCIOUSNESS_LEVELS)[number];

export type Risk = 'LOW' | 'MEDIUM' | 'HIGH';

export const ADMINISTRATION_STATUSES = ['GIVEN', 'REFUSED', 'HELD'] as const;
export type AdministrationStatus = (typeof ADMINISTRATION_STATUSES)[number];

export interface PatientCard {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

export interface Stay {
  readonly admissionId: string;
  readonly number: string;
  readonly bed: string | null;
  readonly serviceId: string;
  readonly admittedAt: string;
  /** Jour d'hospitalisation : le jour d'arrivée est le premier. */
  readonly days: number;
  /** Faux après la sortie : plus aucun soin ne peut être ajouté. */
  readonly active: boolean;
}

export interface WardRow {
  readonly stay: Stay;
  readonly patient: PatientCard | null;
  readonly latest: { readonly recordedAt: string; readonly news2: number; readonly risk: Risk } | null;
}

export interface Observation {
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
  readonly consciousness: Consciousness;
  /** Calculé à la saisie d'après sept paramètres (NEWS2) et conservé tel quel. */
  readonly news2: number;
  readonly risk: Risk;
  readonly note: string | null;
}

/** Réponse à l'enregistrement : `escalate` vrai = score élevé, prévenir le médecin sans attendre. */
export interface RecordedObservation extends Observation {
  readonly escalate: boolean;
}

export interface ObservationInput {
  readonly temperature: number;
  readonly pulse: number;
  readonly systolic: number;
  readonly diastolic?: number | null;
  readonly respiratoryRate: number;
  readonly spo2: number;
  readonly supplementalOxygen: boolean;
  readonly consciousness: Consciousness;
  readonly note?: string | null;
}

export interface Medication {
  readonly prescriptionId: string;
  readonly prescriptionNumber: string;
  readonly position: number;
  readonly drugName: string;
  readonly dose: string;
  readonly frequency: string;
  readonly instructions: string | null;
  readonly issuedAt: string;
  /** Le médecin a prescrit malgré une allergie connue : à vérifier avant d'administrer. */
  readonly allergyWarning: boolean;
  readonly last: { readonly status: AdministrationStatus; readonly at: string; readonly by: string | null; readonly reason: string | null } | null;
  readonly givenCount: number;
}

export interface Administration {
  readonly id: string;
  readonly prescriptionNumber: string | null;
  readonly drugName: string | null;
  readonly status: AdministrationStatus;
  readonly reason: string | null;
  readonly at: string;
  readonly by: string | null;
}

export interface AdministrationInput {
  readonly prescriptionId: string;
  readonly position: number;
  readonly status: AdministrationStatus;
  /** Obligatoire quand le médicament est refusé ou suspendu ; interdit quand il est donné. */
  readonly reason?: string;
}

export interface NursingNote {
  readonly id: string;
  readonly text: string;
  readonly writtenAt: string;
  readonly author: string | null;
}

export interface Chart {
  readonly stay: Stay;
  readonly patient: PatientCard | null;
  readonly observations: readonly Observation[];
  readonly medications: readonly Medication[];
  readonly administrations: readonly Administration[];
  readonly notes: readonly NursingNote[];
}

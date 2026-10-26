import { PlainDate } from '../../../shared-kernel/temporal';
import { Admission, Movement } from './admission';
import { AdmissionId, AdmissionNumber, AdmissionStatus, AdmissionType, BedRef, PatientRef, PractitionerRef } from './values';

export interface AdmissionFilter {
  readonly status?: AdmissionStatus;
  readonly type?: AdmissionType;
  readonly patientId?: PatientRef;
  readonly practitionerId?: PractitionerRef;
  /** Période d'arrivée : début inclus, fin exclue (ISO 8601). */
  readonly from?: string;
  readonly to?: string;
  /** `null` : tous les services. Sinon seulement ceux-ci (liste vide : aucun résultat). */
  readonly serviceIds: readonly string[] | null;
}

/** Pourquoi une écriture a été refusée (aucun effet) : le lit ou le patient a été pris entre la vérification et l'écriture. */
export type SaveOutcome = 'OK' | 'BED_OCCUPIED' | 'PATIENT_ALREADY_INPATIENT' | 'APPOINTMENT_ALREADY_USED';

export interface MovementRecord extends Movement {
  readonly seq: number;
}

export interface AdmissionRepository {
  nextNumber(): Promise<AdmissionNumber>;
  findById(id: AdmissionId): Promise<Admission | null>;
  /**
   * Enregistre l'admission ET archive le mouvement (arrivée, transfert, sortie, annulation), dans la même transaction. La base
   * garantit « un lit, un occupant » et « une hospitalisation en cours par patient » : si une écriture concurrente l'emporte,
   * rien n'est écrit et la cause est renvoyée.
   */
  save(admission: Admission, movement: Movement): Promise<SaveOutcome>;
  /** Plus récentes d'abord. */
  list(filter: AdmissionFilter, offset: number, limit: number): Promise<{ items: Admission[]; total: number }>;
  /** Mouvements d'une admission, dans l'ordre. */
  movements(id: AdmissionId): Promise<MovementRecord[]>;
  /** Hospitalisation en cours du patient, s'il en a une. */
  findInpatientOf(patientId: PatientRef): Promise<Admission | null>;
  /** Admissions en cours qui occupent l'un de ces lits, indexées par lit. */
  occupants(beds: readonly BedRef[]): Promise<Map<string, Admission>>;
}

export interface PatientInfo {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  /** Faux pour un patient décédé. */
  readonly alive: boolean;
}

/** Les patients appartiennent au module Patients : la racine de composition branche ce port dessus. */
export interface PatientDirectory {
  find(ids: readonly string[]): Promise<Map<string, PatientInfo>>;
}

export interface PractitionerInfo {
  readonly id: string;
  readonly staffNumber: string;
  readonly lastName: string;
  readonly firstName: string;
}

export type PractitionerAvailability = 'OK' | 'UNKNOWN' | 'NOT_EMPLOYED' | 'NOT_ASSIGNED';

/** Le personnel appartient au module Personnel : la racine de composition branche ce port dessus. */
export interface PractitionerDirectory {
  find(ids: readonly string[]): Promise<Map<string, PractitionerInfo>>;
  availability(practitionerId: string, serviceId: string, date: PlainDate): Promise<PractitionerAvailability>;
}

export interface NodeInfo {
  readonly id: string;
  readonly kind: 'SERVICE' | 'UNIT' | 'ROOM' | 'BED';
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
  /** Le service dont dépend l'élément (lui-même pour un service). */
  readonly serviceId: string;
  /** Où il se trouve dans son service : « Néonatologie › Salle 1 » pour un lit (vide pour un service). Plusieurs lits portent le même code dans des salles différentes. */
  readonly location: string;
}

/** La structure appartient au module Administration : la racine de composition branche ce port dessus. */
export interface StructureDirectory {
  describe(id: string): Promise<NodeInfo | null>;
  describeMany(ids: readonly string[]): Promise<Map<string, NodeInfo>>;
  /** Tous les lits (actifs ou non) des salles et unités d'un service, par code. */
  bedsOf(serviceId: string): Promise<NodeInfo[]>;
}

/** Les rendez-vous appartiennent au module Rendez-vous : la racine de composition branche ce port dessus. */
export interface AppointmentDirectory {
  /** Ce rendez-vous peut-il servir à une admission de ce patient ? Renvoie son service, ou le code de l'erreur. */
  check(appointmentId: string, patientId: string): Promise<{ ok: true; serviceId: string } | { ok: false; code: string; message: string }>;
  /** Le patient s'est présenté : le rendez-vous passe à « honoré ». */
  markArrived(actorId: string, appointmentId: string, patientId: string): Promise<void>;
}

/** Les nomenclatures appartiennent au module Référentiels : la racine de composition branche ce port dessus. */
export interface VisitReasons {
  isActive(code: string): Promise<boolean>;
}

export const ADMISSION_REPOSITORY = Symbol('ADMISSION_REPOSITORY');
export const ADMISSION_PATIENTS = Symbol('ADMISSION_PATIENTS');
export const ADMISSION_PRACTITIONERS = Symbol('ADMISSION_PRACTITIONERS');
export const ADMISSION_STRUCTURE = Symbol('ADMISSION_STRUCTURE');
export const ADMISSION_APPOINTMENTS = Symbol('ADMISSION_APPOINTMENTS');
export const ADMISSION_REASONS = Symbol('ADMISSION_REASONS');

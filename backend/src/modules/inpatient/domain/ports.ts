import { Instant } from '../../../shared-kernel/temporal';
import { Consciousness, Risk } from './news2';

export const ADMINISTRATION_STATUSES = ['GIVEN', 'REFUSED', 'HELD'] as const;
export type AdministrationStatus = (typeof ADMINISTRATION_STATUSES)[number];

/** Le séjour d'un patient hospitalisé, tel que le module Admissions le décrit (le module Hospitalisation ne connaît pas les admissions). */
export interface Stay {
  readonly id: string;
  readonly number: string;
  readonly patientId: string;
  readonly serviceId: string;
  readonly bed: { readonly id: string; readonly name: string } | null;
  readonly admittedAt: Instant;
  /** Hospitalisation en cours : seule une hospitalisation en cours reçoit de nouveaux soins. */
  readonly active: boolean;
}

export interface StayDirectory {
  find(admissionId: string): Promise<Stay | null>;
  /** Hospitalisations en cours de ces services (`null` : tous), par lit. */
  inpatients(serviceIds: readonly string[] | null): Promise<Stay[]>;
}

export interface PatientCard {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

export interface PatientDirectory {
  find(ids: readonly string[]): Promise<Map<string, PatientCard>>;
}

export interface UserDirectory {
  find(ids: readonly string[]): Promise<Map<string, { readonly id: string; readonly username: string }>>;
}

/** Une ligne d'ordonnance en cours pour ce séjour (ordonnances des tournées de cette hospitalisation, non annulées). */
export interface OrderedMedication {
  readonly prescriptionId: string;
  readonly prescriptionNumber: string;
  readonly position: number;
  readonly drugName: string;
  readonly dose: string;
  readonly frequency: string;
  readonly instructions: string | null;
  readonly issuedAt: Instant;
  /** Le médecin a prescrit malgré une allergie connue (motif d'exception enregistré) : l'infirmier doit le voir avant d'administrer. */
  readonly allergyWarning: boolean;
}

export interface MedicationDirectory {
  /** Lignes d'ordonnance non annulées des consultations de ce séjour, les plus récentes d'abord. */
  forStay(admissionId: string): Promise<OrderedMedication[]>;
  /** La ligne existe-t-elle, non annulée, pour ce séjour ? */
  find(admissionId: string, prescriptionId: string, position: number): Promise<OrderedMedication | null>;
}

export interface Observation {
  readonly id: string;
  readonly admissionId: string;
  readonly patientId: string;
  readonly serviceId: string;
  readonly recordedBy: string;
  readonly recordedAt: Instant;
  readonly temperature: number;
  readonly pulse: number;
  readonly systolic: number;
  readonly diastolic: number | null;
  readonly respiratoryRate: number;
  readonly spo2: number;
  readonly supplementalOxygen: boolean;
  readonly consciousness: Consciousness;
  readonly news2: number;
  readonly risk: Risk;
  readonly note: string | null;
}

export interface Administration {
  readonly id: string;
  readonly admissionId: string;
  readonly patientId: string;
  readonly serviceId: string;
  readonly prescriptionId: string;
  readonly position: number;
  readonly status: AdministrationStatus;
  readonly reason: string | null;
  readonly administeredBy: string;
  readonly administeredAt: Instant;
}

export interface NursingNote {
  readonly id: string;
  readonly admissionId: string;
  readonly patientId: string;
  readonly serviceId: string;
  readonly authorId: string;
  readonly writtenAt: Instant;
  readonly text: string;
}

export interface ChartRepository {
  insertObservation(o: Observation): Promise<void>;
  /** Les plus récentes d'abord. */
  observations(admissionId: string, limit: number): Promise<Observation[]>;
  /** Dernier relevé de chacun de ces séjours, indexé par séjour. */
  latestObservations(admissionIds: readonly string[]): Promise<Map<string, Observation>>;
  insertAdministration(a: Administration): Promise<void>;
  administrations(admissionId: string, limit: number): Promise<Administration[]>;
  insertNote(n: NursingNote): Promise<void>;
  notes(admissionId: string, limit: number): Promise<NursingNote[]>;
}

export const CHART_REPOSITORY = Symbol('INPATIENT_CHART_REPOSITORY');
export const INPATIENT_STAYS = Symbol('INPATIENT_STAYS');
export const INPATIENT_PATIENTS = Symbol('INPATIENT_PATIENTS');
export const INPATIENT_USERS = Symbol('INPATIENT_USERS');
export const INPATIENT_MEDICATIONS = Symbol('INPATIENT_MEDICATIONS');

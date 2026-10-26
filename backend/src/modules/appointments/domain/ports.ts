import { PlainDate } from '../../../shared-kernel/temporal';
import { Appointment, AppointmentNumber } from './appointment';
import { AppointmentId, AppointmentStatus, LocationRef, PatientRef, PractitionerRef, TimeSlot } from './values';

export interface AppointmentFilter {
  /** Début de période (inclus) et fin (exclue), sur l'heure de début du rendez-vous. */
  readonly from?: string;
  readonly to?: string;
  readonly practitionerId?: PractitionerRef;
  readonly patientId?: PatientRef;
  readonly status?: AppointmentStatus;
  /** `null` : tous les services. Sinon seulement ceux-ci (liste vide : aucun résultat). */
  readonly serviceIds: readonly string[] | null;
}

export interface Conflicts {
  readonly practitionerBusy: boolean;
  readonly patientBusy: boolean;
}

export interface AppointmentRepository {
  nextNumber(): Promise<AppointmentNumber>;
  findById(id: AppointmentId): Promise<Appointment | null>;
  /**
   * Enregistre le rendez-vous. Si son créneau est pris entre-temps (deux accueils qui réservent en même temps), rien n'est écrit et
   * les conflits sont renvoyés : la vérification et l'écriture se font sous verrou, dans la même transaction.
   */
  save(appointment: Appointment): Promise<Conflicts>;
  /** Plus anciens d'abord (le plus proche dans le temps en tête de l'agenda). */
  list(filter: AppointmentFilter, offset: number, limit: number): Promise<{ items: Appointment[]; total: number }>;
  /** Les rendez-vous actifs du professionnel et du patient qui chevauchent ce créneau (en ignorant `excludeId`). */
  findConflicts(practitionerId: PractitionerRef, patientId: PatientRef, slot: TimeSlot, excludeId?: AppointmentId): Promise<Conflicts>;
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
  /** Le professionnel est-il en poste ce jour-là, et affecté à ce service (ou à l'une de ses unités) ? */
  availability(practitionerId: string, serviceId: string, date: PlainDate): Promise<PractitionerAvailability>;
}

export interface LocationInfo {
  readonly id: string;
  readonly kind: 'SERVICE' | 'UNIT' | 'ROOM' | 'BED';
  readonly active: boolean;
  /** Le service dont dépend l'élément (lui-même pour un service). */
  readonly serviceId: string;
}

/** La structure appartient au module Administration : la racine de composition branche ce port dessus. */
export interface LocationDirectory {
  describe(id: LocationRef): Promise<LocationInfo | null>;
}

/** Les nomenclatures appartiennent au module Référentiels : la racine de composition branche ce port dessus. */
export interface VisitReasons {
  isActive(code: string): Promise<boolean>;
}

export const APPOINTMENT_REPOSITORY = Symbol('APPOINTMENT_REPOSITORY');
export const APPOINTMENT_PATIENTS = Symbol('APPOINTMENT_PATIENTS');
export const APPOINTMENT_PRACTITIONERS = Symbol('APPOINTMENT_PRACTITIONERS');
export const APPOINTMENT_LOCATIONS = Symbol('APPOINTMENT_LOCATIONS');
export const APPOINTMENT_REASONS = Symbol('APPOINTMENT_REASONS');

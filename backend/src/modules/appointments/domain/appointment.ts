import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, Temporal } from '../../../shared-kernel/temporal';
import { ValueObject } from '../../../shared-kernel/value-object';
import { AppointmentId, AppointmentStatus, LocationRef, PatientRef, PractitionerRef, ReasonCode, ServiceRef, TimeSlot } from './values';

/** Numéro de rendez-vous lisible (`RDV-0000123`), attribué par le système. */
export class AppointmentNumber extends ValueObject<string> {
  static create(raw: string): Result<AppointmentNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^RDV-\d{7,12}$/.test(normalized) ? ok(new AppointmentNumber(normalized)) : err(new DomainError('APPOINTMENT_NUMBER_INVALID', 'Numéro de rendez-vous invalide.'));
  }

  static fromSequence(n: number): Result<AppointmentNumber> {
    return AppointmentNumber.create(`RDV-${String(n).padStart(7, '0')}`);
  }
}

export interface AppointmentState {
  readonly id: AppointmentId;
  readonly number: AppointmentNumber;
  readonly patientId: PatientRef;
  readonly practitionerId: PractitionerRef;
  /** Service ou unité où a lieu le rendez-vous. */
  readonly locationId: LocationRef;
  /** Service dont dépend ce lieu : c'est lui qui détermine qui a le droit de voir et de gérer le rendez-vous. */
  readonly serviceId: ServiceRef;
  readonly slot: TimeSlot;
  readonly reasonCode: ReasonCode | null;
  readonly status: AppointmentStatus;
  readonly cancellationReason: string | null;
}

const CLOSED = (status: AppointmentStatus) =>
  new DomainError('APPOINTMENT_NOT_MODIFIABLE', `Ce rendez-vous est ${status === AppointmentStatus.ARRIVED ? 'déjà honoré' : status === AppointmentStatus.CANCELLED ? 'annulé' : 'clos (patient absent)'} : il ne peut plus être modifié.`, { status });

/**
 * Rendez-vous : un patient est attendu par un professionnel, dans un service, sur un créneau. Il reste `SCHEDULED` jusqu'à ce
 * que le patient se présente (`ARRIVED`, ce qui ouvre une admission), qu'il soit annulé (`CANCELLED`, avec un motif) ou que le
 * patient ne vienne pas (`NO_SHOW`). Rien n'est supprimé.
 */
export class Appointment {
  private constructor(private current: AppointmentState) {}

  static restore(state: AppointmentState): Appointment {
    return new Appointment(state);
  }

  static schedule(state: Omit<AppointmentState, 'status' | 'cancellationReason'>): Appointment {
    return new Appointment({ ...state, status: AppointmentStatus.SCHEDULED, cancellationReason: null });
  }

  get state(): AppointmentState { return this.current; }
  get id(): AppointmentId { return this.current.id; }
  get status(): AppointmentStatus { return this.current.status; }

  /** Change l'horaire, le professionnel et/ou le lieu d'un rendez-vous encore à venir. */
  reschedule(changes: { slot?: TimeSlot; practitionerId?: PractitionerRef; locationId?: LocationRef; serviceId?: ServiceRef; reasonCode?: ReasonCode | null }): Result<void> {
    if (this.current.status !== AppointmentStatus.SCHEDULED) return err(CLOSED(this.current.status));
    this.current = { ...this.current, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) };
    return ok(undefined);
  }

  cancel(reason: string): Result<void> {
    if (this.current.status !== AppointmentStatus.SCHEDULED) return err(CLOSED(this.current.status));
    this.current = { ...this.current, status: AppointmentStatus.CANCELLED, cancellationReason: reason };
    return ok(undefined);
  }

  /** Le patient ne s'est pas présenté : possible seulement une fois le créneau commencé. */
  markNoShow(now: Instant): Result<void> {
    if (this.current.status !== AppointmentStatus.SCHEDULED) return err(CLOSED(this.current.status));
    if (Temporal.Instant.compare(now, this.current.slot.start) < 0) {
      return err(new DomainError('APPOINTMENT_NOT_STARTED', "Le créneau n'a pas encore commencé : on ne peut pas constater une absence."));
    }
    this.current = { ...this.current, status: AppointmentStatus.NO_SHOW };
    return ok(undefined);
  }

  /** Le patient s'est présenté (une admission a été ouverte). */
  markArrived(): Result<void> {
    if (this.current.status !== AppointmentStatus.SCHEDULED) return err(CLOSED(this.current.status));
    this.current = { ...this.current, status: AppointmentStatus.ARRIVED };
    return ok(undefined);
  }
}

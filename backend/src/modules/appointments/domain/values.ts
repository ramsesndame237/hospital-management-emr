import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, Temporal } from '../../../shared-kernel/temporal';
import { ValueObject } from '../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Identifiant (UUID) d'une ressource d'un autre module : ce module n'en connaît que l'identifiant. */
function uuid(raw: string, code: string, message: string): Result<string> {
  const normalized = (raw ?? '').trim();
  return UUID.test(normalized) ? ok(normalized.toLowerCase()) : err(new DomainError(code, message));
}

export class AppointmentId extends ValueObject<string> {
  static create(raw: string): Result<AppointmentId> {
    const r = uuid(raw, 'APPOINTMENT_ID_INVALID', "L'identifiant de ce rendez-vous est invalide.");
    return r.ok ? ok(new AppointmentId(r.value)) : err(r.error);
  }
}

export class PatientRef extends ValueObject<string> {
  static create(raw: string): Result<PatientRef> {
    const r = uuid(raw, 'APPOINTMENT_PATIENT_INVALID', "L'identifiant du patient est invalide.");
    return r.ok ? ok(new PatientRef(r.value)) : err(r.error);
  }
}

/** Le professionnel qui reçoit (fiche du personnel). */
export class PractitionerRef extends ValueObject<string> {
  static create(raw: string): Result<PractitionerRef> {
    const r = uuid(raw, 'APPOINTMENT_PRACTITIONER_INVALID', "L'identifiant du professionnel est invalide.");
    return r.ok ? ok(new PractitionerRef(r.value)) : err(r.error);
  }
}

/** Le service ou l'unité où a lieu le rendez-vous (élément de la structure). */
export class LocationRef extends ValueObject<string> {
  static create(raw: string): Result<LocationRef> {
    const r = uuid(raw, 'APPOINTMENT_LOCATION_INVALID', "L'identifiant du service ou de l'unité est invalide.");
    return r.ok ? ok(new LocationRef(r.value)) : err(r.error);
  }
}

export class ServiceRef extends ValueObject<string> {
  static create(raw: string): Result<ServiceRef> {
    const r = uuid(raw, 'APPOINTMENT_LOCATION_INVALID', "L'identifiant du service est invalide.");
    return r.ok ? ok(new ServiceRef(r.value)) : err(r.error);
  }
}

/** Motif (code actif du catalogue VISIT_REASON des référentiels) ; son existence est vérifiée par le cas d'usage. */
export class ReasonCode extends ValueObject<string> {
  static create(raw: string): Result<ReasonCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9_.-]{0,31}$/.test(normalized) ? ok(new ReasonCode(normalized)) : err(new DomainError('APPOINTMENT_REASON_UNKNOWN', "Ce motif n'existe pas ou n'est plus actif.", { value: String(raw) }));
  }
}

export const MIN_DURATION = 5;
export const MAX_DURATION = 240;

/** Créneau : un début précis (instant) et une durée en minutes (5 à 240, par pas de 5). */
export class TimeSlot {
  private constructor(readonly start: Instant, readonly durationMinutes: number) {
    Object.freeze(this);
  }

  static create(startsAt: string, durationMinutes: number): Result<TimeSlot> {
    let start: Instant;
    try {
      // Un décalage horaire explicite est exigé : « 2026-11-02T09:00 » sans fuseau serait interprété à la place de l'appelant.
      if (typeof startsAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(startsAt.trim())) throw new Error('fuseau');
      start = Temporal.Instant.from(startsAt.trim());
    } catch {
      return err(new DomainError('APPOINTMENT_START_INVALID', 'La date et l\'heure doivent être au format ISO 8601 avec fuseau (ex. 2026-11-02T09:00:00+01:00).'));
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < MIN_DURATION || durationMinutes > MAX_DURATION || durationMinutes % 5 !== 0) {
      return err(new DomainError('APPOINTMENT_DURATION_INVALID', `La durée doit être comprise entre ${MIN_DURATION} et ${MAX_DURATION} minutes, par pas de 5.`, { min: MIN_DURATION, max: MAX_DURATION }));
    }
    return ok(new TimeSlot(start, durationMinutes));
  }

  static restore(start: Instant, durationMinutes: number): TimeSlot {
    return new TimeSlot(start, durationMinutes);
  }

  get end(): Instant {
    return this.start.add({ minutes: this.durationMinutes });
  }

  /** Deux créneaux se chevauchent s'ils ont une durée en commun (l'un peut commencer à l'instant où l'autre finit). */
  overlaps(other: TimeSlot): boolean {
    return Temporal.Instant.compare(this.start, other.end) < 0 && Temporal.Instant.compare(other.start, this.end) < 0;
  }

  equals(other: TimeSlot): boolean {
    return this.start.equals(other.start) && this.durationMinutes === other.durationMinutes;
  }
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  ARRIVED = 'ARRIVED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

/** Un rendez-vous « actif » occupe le professionnel et le patient sur son créneau. */
export const isActiveStatus = (s: AppointmentStatus): boolean => s === AppointmentStatus.SCHEDULED || s === AppointmentStatus.ARRIVED;

export function parseStatus(raw: string): Result<AppointmentStatus> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(AppointmentStatus) as string[]).find((v) => v === normalized);
  return found ? ok(found as AppointmentStatus) : err(new DomainError('APPOINTMENT_STATUS_INVALID', `Statut invalide : ${raw}`, { value: String(raw) }));
}

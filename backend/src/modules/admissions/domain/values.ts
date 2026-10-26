import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Temporal } from '../../../shared-kernel/temporal';
import { ValueObject } from '../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Identifiant (UUID) d'une ressource : ce module n'en connaît que l'identifiant pour tout ce qui vient d'un autre module. */
function uuid(raw: string, code: string, message: string): Result<string> {
  const normalized = (raw ?? '').trim();
  return UUID.test(normalized) ? ok(normalized.toLowerCase()) : err(new DomainError(code, message));
}

function ref<T extends ValueObject<string>>(make: (v: string) => T, code: string, message: string) {
  return (raw: string): Result<T> => {
    const r = uuid(raw, code, message);
    return r.ok ? ok(make(r.value)) : err(r.error);
  };
}

export class AdmissionId extends ValueObject<string> {
  static create = ref((v) => new AdmissionId(v), 'ADMISSION_ID_INVALID', "L'identifiant de cette admission est invalide.");
}
export class PatientRef extends ValueObject<string> {
  static create = ref((v) => new PatientRef(v), 'ADMISSION_PATIENT_INVALID', "L'identifiant du patient est invalide.");
}
export class PractitionerRef extends ValueObject<string> {
  static create = ref((v) => new PractitionerRef(v), 'ADMISSION_PRACTITIONER_INVALID', "L'identifiant du professionnel est invalide.");
}
/** Le service responsable de la prise en charge (il borne les droits d'accès). */
export class ServiceRef extends ValueObject<string> {
  static create = ref((v) => new ServiceRef(v), 'ADMISSION_SERVICE_INVALID', "L'identifiant du service est invalide.");
}
/** Un lit de la structure de l'établissement. */
export class BedRef extends ValueObject<string> {
  static create = ref((v) => new BedRef(v), 'ADMISSION_BED_INVALID', "L'identifiant du lit est invalide.");
}
export class AppointmentRef extends ValueObject<string> {
  static create = ref((v) => new AppointmentRef(v), 'ADMISSION_APPOINTMENT_INVALID', "L'identifiant du rendez-vous est invalide.");
}

export class AdmissionNumber extends ValueObject<string> {
  static create(raw: string): Result<AdmissionNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^ADM-\d{7,12}$/.test(normalized) ? ok(new AdmissionNumber(normalized)) : err(new DomainError('ADMISSION_NUMBER_INVALID', "Numéro d'admission invalide."));
  }

  static fromSequence(n: number): Result<AdmissionNumber> {
    return AdmissionNumber.create(`ADM-${String(n).padStart(7, '0')}`);
  }
}

/** Motif (code actif du catalogue VISIT_REASON) ; son existence est vérifiée par le cas d'usage. */
export class ReasonCode extends ValueObject<string> {
  static create(raw: string): Result<ReasonCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9_.-]{0,31}$/.test(normalized) ? ok(new ReasonCode(normalized)) : err(new DomainError('ADMISSION_REASON_UNKNOWN', "Ce motif n'existe pas ou n'est plus actif.", { value: String(raw) }));
  }
}

/** `OUTPATIENT` : consultation ou soin sans nuit à l'hôpital ; `EMERGENCY` : urgence ; `INPATIENT` : hospitalisation dans un lit. */
export enum AdmissionType { OUTPATIENT = 'OUTPATIENT', EMERGENCY = 'EMERGENCY', INPATIENT = 'INPATIENT' }
export enum AdmissionStatus { IN_PROGRESS = 'IN_PROGRESS', DISCHARGED = 'DISCHARGED', CANCELLED = 'CANCELLED' }
export enum DischargeType { HOME = 'HOME', TRANSFERRED_OUT = 'TRANSFERRED_OUT', LEFT_AGAINST_ADVICE = 'LEFT_AGAINST_ADVICE', DECEASED = 'DECEASED', OTHER = 'OTHER' }

export function parseEnum<T extends string>(values: Record<string, T>, raw: string, field: string): Result<T> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(values) as string[]).find((v) => v === normalized);
  return found ? ok(found as T) : err(new DomainError('ADMISSION_ENUM_INVALID', `Valeur invalide pour « ${field} » : ${raw}`, { field, value: String(raw) }));
}

/** Date et heure ISO 8601 AVEC fuseau : sans fuseau, l'heure serait interprétée à la place de l'appelant. */
export function parseInstant(raw: string, field: string) {
  const invalid = () => err(new DomainError('ADMISSION_DATETIME_INVALID', `Le champ « ${field} » doit être une date et heure ISO 8601 avec fuseau (ex. 2026-11-02T09:00:00+01:00).`, { field }));
  if (typeof raw !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(raw.trim())) return invalid();
  try {
    return ok(Temporal.Instant.from(raw.trim()));
  } catch {
    return invalid();
  }
}

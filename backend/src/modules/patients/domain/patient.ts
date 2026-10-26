import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../shared-kernel/temporal';
import {
  Address, ContactEmail, CountryCode, IdentityDocument, IdentityStatus, MaritalStatus, nameKey, NextOfKin, PatientId, PatientNumber, PersonName, PhoneNumber, Sex, ShortText,
} from './values';

export interface PatientState {
  readonly id: PatientId;
  readonly number: PatientNumber;
  readonly identityStatus: IdentityStatus;
  readonly lastName: PersonName;
  readonly firstName: PersonName;
  readonly sex: Sex;
  readonly birthDate: PlainDate;
  /** Vrai si la date de naissance n'est qu'une estimation (âge approximatif, 1er janvier de l'année…). */
  readonly birthDateEstimated: boolean;
  readonly birthPlace: ShortText | null;
  readonly nationality: CountryCode | null;
  readonly maritalStatus: MaritalStatus | null;
  readonly occupation: ShortText | null;
  readonly phone: PhoneNumber | null;
  readonly email: ContactEmail | null;
  readonly address: Address | null;
  readonly identityDocument: IdentityDocument | null;
  readonly nextOfKin: NextOfKin | null;
  readonly dateOfDeath: PlainDate | null;
}

/** Champs modifiables d'un coup : absent = inchangé, `null` = retiré (pour les champs facultatifs). */
export type PatientChanges = Partial<Omit<PatientState, 'id' | 'number' | 'dateOfDeath'>>;

const EARLIEST_BIRTH = Temporal.PlainDate.from('1880-01-01');
const cmp = (a: PlainDate, b: PlainDate) => Temporal.PlainDate.compare(a, b);

/** Version simple d'un état, sans objets de valeur : sert à repérer ce qui a changé et à archiver chaque version. */
export type PatientSnapshot = Readonly<Record<string, unknown>>;

export function snapshotOf(s: PatientState): PatientSnapshot {
  const t = (v: { value: string } | null) => v?.value ?? null;
  return {
    identityStatus: s.identityStatus,
    lastName: s.lastName.value,
    firstName: s.firstName.value,
    sex: s.sex,
    birthDate: s.birthDate.toString(),
    birthDateEstimated: s.birthDateEstimated,
    birthPlace: t(s.birthPlace),
    nationality: t(s.nationality),
    maritalStatus: s.maritalStatus,
    occupation: t(s.occupation),
    phone: t(s.phone),
    email: t(s.email),
    address: s.address && { line: t(s.address.line), quarter: t(s.address.quarter), city: t(s.address.city), region: t(s.address.region), country: t(s.address.country) },
    identityDocument: s.identityDocument && { type: s.identityDocument.type, number: s.identityDocument.number },
    nextOfKin: s.nextOfKin && { name: s.nextOfKin.name.value, relationship: s.nextOfKin.relationship, phone: s.nextOfKin.phone.value },
    dateOfDeath: s.dateOfDeath?.toString() ?? null,
  };
}

/**
 * Patient : l'identité et le dossier administratif — rien de médical. Le numéro de dossier est attribué une fois pour toutes.
 * Rien n'est jamais supprimé ; une correction d'identité est archivée par le dépôt (chaque version est conservée).
 */
export class Patient {
  private constructor(private current: PatientState) {}

  /** Reconstitue un patient lu en base (aucune règle de création n'est rejouée). */
  static restore(state: PatientState): Patient {
    return new Patient(state);
  }

  static register(state: Omit<PatientState, 'dateOfDeath'>, today: PlainDate): Result<Patient> {
    const date = checkBirthDate(state.birthDate, today);
    return date.ok ? ok(new Patient({ ...state, dateOfDeath: null })) : err(date.error);
  }

  get state(): PatientState { return this.current; }
  get id(): PatientId { return this.current.id; }
  get number(): PatientNumber { return this.current.number; }
  get isDeceased(): boolean { return this.current.dateOfDeath !== null; }
  /** Voir {@link nameKey}. */
  get nameKey(): string { return nameKey(this.current.lastName.value, this.current.firstName.value); }

  ageYears(today: PlainDate): number {
    const end = this.current.dateOfDeath && cmp(this.current.dateOfDeath, today) < 0 ? this.current.dateOfDeath : today;
    return this.current.birthDate.until(end, { largestUnit: 'years' }).years;
  }

  /**
   * Applique des corrections et renvoie les noms des champs réellement modifiés (vide : rien n'a changé). Un patient identifié
   * ne redevient jamais « provisoire ». Refusé sans rien changer si le résultat est incohérent.
   */
  apply(changes: PatientChanges, today: PlainDate): Result<string[]> {
    const next = { ...this.current } as { -readonly [K in keyof PatientState]: PatientState[K] };
    for (const [key, value] of Object.entries(changes)) if (value !== undefined) (next as Record<string, unknown>)[key] = value;

    if (this.current.identityStatus === IdentityStatus.CONFIRMED && next.identityStatus === IdentityStatus.PROVISIONAL) {
      return err(new DomainError('PATIENT_IDENTITY_STATUS_INVALID', "Un patient dont l'identité est confirmée ne redevient pas provisoire."));
    }
    const date = checkBirthDate(next.birthDate, today);
    if (!date.ok) return err(date.error);
    if (next.dateOfDeath && cmp(next.birthDate, next.dateOfDeath) > 0) {
      return err(new DomainError('PATIENT_DEATH_DATE_INVALID', 'La date de décès précède la date de naissance.'));
    }

    const before = snapshotOf(this.current);
    const after = snapshotOf(next);
    const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    this.current = next;
    return ok(changed);
  }

  /** Enregistre le décès, une seule fois ; jamais avant la naissance ni dans le futur. */
  recordDeath(date: PlainDate, today: PlainDate): Result<void> {
    if (this.current.dateOfDeath) return err(new DomainError('PATIENT_ALREADY_DECEASED', 'Le décès de ce patient est déjà enregistré.'));
    if (cmp(date, this.current.birthDate) < 0 || cmp(date, today) > 0) {
      return err(new DomainError('PATIENT_DEATH_DATE_INVALID', 'La date de décès doit être comprise entre la naissance et aujourd\'hui.'));
    }
    this.current = { ...this.current, dateOfDeath: date };
    return ok(undefined);
  }
}

function checkBirthDate(birthDate: PlainDate, today: PlainDate): Result<void> {
  if (cmp(birthDate, today) > 0 || cmp(birthDate, EARLIEST_BIRTH) < 0) {
    return err(new DomainError('PATIENT_BIRTH_DATE_INVALID', 'La date de naissance doit être comprise entre 1880 et aujourd\'hui.'));
  }
  return ok(undefined);
}

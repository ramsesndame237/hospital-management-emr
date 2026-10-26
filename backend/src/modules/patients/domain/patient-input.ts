import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { PatientChanges } from './patient';
import {
  Address, ContactEmail, CountryCode, IdentityDocument, IdentityStatus, MaritalStatus, NextOfKin, parseDate, parseEnum, PersonName, PhoneNumber, Sex, ShortText,
} from './values';

/** Saisie brute (texte) d'un patient. Champ absent = inchangé ; `null` ou vide = retiré (champs facultatifs). */
export interface PatientInput {
  identityStatus?: string;
  lastName?: string;
  firstName?: string;
  sex?: string;
  birthDate?: string;
  birthDateEstimated?: boolean;
  birthPlace?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: { line?: string | null; quarter?: string | null; city?: string | null; region?: string | null; country?: string | null } | null;
  identityDocument?: { type: string; number: string } | null;
  nextOfKin?: { name: string; relationship: string; phone: string } | null;
}

/** Champ facultatif : absent → `undefined` (inchangé) ; `null` ou vide → `null` (retiré) ; sinon valeur validée. */
function optional<T>(raw: string | null | undefined, parse: (v: string) => Result<T>): Result<T | null | undefined> {
  if (raw === undefined) return ok(undefined);
  if (raw === null || raw.trim() === '') return ok(null);
  return parse(raw);
}

/**
 * Transforme la saisie en objets de valeur — c'est ici que toute valeur invalide est refusée. Le résultat ne contient que les champs
 * présents dans la saisie (`PatientChanges`), à appliquer à un patient existant ou à compléter pour en créer un.
 */
export function parsePatientInput(input: PatientInput): Result<PatientChanges> {
  const out: Record<string, unknown> = {};
  const set = <T>(key: string, r: Result<T | undefined>): boolean => {
    if (!r.ok) return false;
    if (r.value !== undefined) out[key] = r.value;
    return true;
  };
  const fail = (r: Result<unknown>) => r as { ok: false; error: DomainError };

  const results: [string, Result<unknown>][] = [
    ['identityStatus', input.identityStatus === undefined ? ok(undefined) : parseEnum(IdentityStatus, input.identityStatus, 'identityStatus')],
    ['lastName', input.lastName === undefined ? ok(undefined) : PersonName.create(input.lastName, 'lastName')],
    ['firstName', input.firstName === undefined ? ok(undefined) : PersonName.create(input.firstName, 'firstName')],
    ['sex', input.sex === undefined ? ok(undefined) : parseEnum(Sex, input.sex, 'sex')],
    ['birthDate', input.birthDate === undefined ? ok(undefined) : parseDate(input.birthDate, 'birthDate')],
    ['birthDateEstimated', ok(input.birthDateEstimated)],
    ['birthPlace', optional(input.birthPlace, (v) => ShortText.create(v, 'birthPlace', 100))],
    ['nationality', optional(input.nationality, (v) => CountryCode.create(v, 'nationality'))],
    ['maritalStatus', optional(input.maritalStatus, (v) => parseEnum(MaritalStatus, v, 'maritalStatus'))],
    ['occupation', optional(input.occupation, (v) => ShortText.create(v, 'occupation', 100))],
    ['phone', optional(input.phone, (v) => PhoneNumber.create(v))],
    ['email', optional(input.email, ContactEmail.create)],
    ['address', input.address === undefined ? ok(undefined) : input.address === null ? ok(null) : Address.create(input.address)],
    ['identityDocument', input.identityDocument === undefined ? ok(undefined) : input.identityDocument === null ? ok(null) : IdentityDocument.create(input.identityDocument.type, input.identityDocument.number)],
    ['nextOfKin', input.nextOfKin === undefined ? ok(undefined) : input.nextOfKin === null ? ok(null) : NextOfKin.create(input.nextOfKin)],
  ];
  for (const [key, result] of results) {
    if (!set(key, result as Result<unknown>)) return err(fail(result).error);
  }
  return ok(out as PatientChanges);
}

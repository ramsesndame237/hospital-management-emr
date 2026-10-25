import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../shared-kernel/temporal';
import { ValueObject } from '../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/; // eslint-disable-line no-control-regex

export class PatientId extends ValueObject<string> {
  static create(raw: string): Result<PatientId> {
    const normalized = (raw ?? '').trim();
    return UUID.test(normalized) ? ok(new PatientId(normalized.toLowerCase())) : err(new DomainError('PATIENT_ID_INVALID', "L'identifiant de ce patient est invalide."));
  }
}

/** Numéro de dossier (identifiant permanent du patient dans l'établissement) : `PAT-0000123`. Attribué par le système, jamais réutilisé. */
export class PatientNumber extends ValueObject<string> {
  static create(raw: string): Result<PatientNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^PAT-\d{7,12}$/.test(normalized) ? ok(new PatientNumber(normalized)) : err(new DomainError('PATIENT_NUMBER_INVALID', 'Numéro de dossier invalide.', { value: String(raw) }));
  }

  static fromSequence(n: number): Result<PatientNumber> {
    return PatientNumber.create(`PAT-${String(n).padStart(7, '0')}`);
  }
}

export type NameField = 'lastName' | 'firstName' | 'nextOfKinName';

/** Nom ou prénom : 1 à 100 caractères, sans caractère de contrôle, espaces normalisés. Les accents et la casse saisis sont conservés. */
export class PersonName extends ValueObject<string> {
  static create(raw: string, field: NameField): Result<PersonName> {
    const normalized = (raw ?? '').trim().replace(/\s+/g, ' ');
    if (normalized.length === 0 || normalized.length > 100 || CONTROL.test(normalized)) {
      return err(new DomainError('PATIENT_NAME_INVALID', `Le champ « ${field} » doit comporter de 1 à 100 caractères.`, { field }));
    }
    return ok(new PersonName(normalized));
  }
}

/**
 * Clé de comparaison d'un nom : sans accents ni casse ni ponctuation, mots triés. « Élisabeth  Ngo-Bassa » et « ngo bassa elisabeth »
 * donnent la même clé : l'inversion nom/prénom, fréquente à la saisie, ne cache plus un doublon.
 */
export function nameKey(...parts: string[]): string {
  return parts
    .join(' ')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/** Texte libre court et facultatif (lieu de naissance, profession, éléments d'adresse). */
export class ShortText extends ValueObject<string> {
  static create(raw: string, field: string, max: number): Result<ShortText> {
    const normalized = (raw ?? '').trim().replace(/\s+/g, ' ');
    if (normalized.length === 0 || normalized.length > max || CONTROL.test(normalized)) {
      return err(new DomainError('PATIENT_FIELD_INVALID', `Le champ « ${field} » doit comporter de 1 à ${max} caractères.`, { field, max }));
    }
    return ok(new ShortText(normalized));
  }
}

export class PhoneNumber extends ValueObject<string> {
  static create(raw: string, field = 'phone'): Result<PhoneNumber> {
    const normalized = (raw ?? '').trim();
    if (!/^\+?[0-9][0-9 ().-]{4,19}$/.test(normalized) || normalized.replace(/\D/g, '').length < 6) {
      return err(new DomainError('PATIENT_PHONE_INVALID', 'Numéro de téléphone invalide.', { field }));
    }
    return ok(new PhoneNumber(normalized));
  }

  /** Chiffres seuls, pour comparer deux numéros écrits différemment (« +237 655 00 00 00 » et « 237655000000 »). */
  get digits(): string {
    return this.value.replace(/\D/g, '');
  }

  /**
   * Clé de rapprochement : les 8 derniers chiffres. « 655 00 00 00 » (numéro national) et « +237 655 00 00 00 » (international)
   * désignent le même abonné ; on ne compare donc pas l'indicatif du pays.
   */
  get matchKey(): string {
    return this.digits.slice(-8);
  }
}

export class ContactEmail extends ValueObject<string> {
  static create(raw: string): Result<ContactEmail> {
    const normalized = (raw ?? '').trim().toLowerCase();
    if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return err(new DomainError('PATIENT_EMAIL_INVALID', 'Adresse e-mail invalide.'));
    return ok(new ContactEmail(normalized));
  }
}

/** Pays ou nationalité : code ISO 3166-1 alpha-2 (`CM`, `FR`…). */
export class CountryCode extends ValueObject<string> {
  static create(raw: string, field: string): Result<CountryCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(normalized) ? ok(new CountryCode(normalized)) : err(new DomainError('PATIENT_COUNTRY_INVALID', `Le champ « ${field} » doit être un code pays à 2 lettres (ISO 3166-1).`, { field }));
  }
}

export enum Sex { MALE = 'MALE', FEMALE = 'FEMALE', UNDETERMINED = 'UNDETERMINED' }
export enum MaritalStatus { SINGLE = 'SINGLE', MARRIED = 'MARRIED', DIVORCED = 'DIVORCED', WIDOWED = 'WIDOWED', SEPARATED = 'SEPARATED' }
export enum Relationship { SPOUSE = 'SPOUSE', PARENT = 'PARENT', CHILD = 'CHILD', SIBLING = 'SIBLING', RELATIVE = 'RELATIVE', FRIEND = 'FRIEND', GUARDIAN = 'GUARDIAN', OTHER = 'OTHER' }
export enum DocumentType { NATIONAL_ID = 'NATIONAL_ID', PASSPORT = 'PASSPORT', BIRTH_CERTIFICATE = 'BIRTH_CERTIFICATE', DRIVING_LICENSE = 'DRIVING_LICENSE', OTHER = 'OTHER' }
/** `PROVISIONAL` : patient non identifié (urgence, nouveau-né sans nom…), à confirmer plus tard. */
export enum IdentityStatus { CONFIRMED = 'CONFIRMED', PROVISIONAL = 'PROVISIONAL' }

export function parseEnum<T extends string>(values: Record<string, T>, raw: string, field: string): Result<T> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(values) as string[]).find((v) => v === normalized);
  return found ? ok(found as T) : err(new DomainError('PATIENT_ENUM_INVALID', `Valeur invalide pour « ${field} » : ${raw}`, { field, value: String(raw) }));
}

/** Pièce d'identité : type et numéro (3 à 40 caractères, lettres, chiffres, « - », « / » ; espaces retirés, majuscules). */
export class IdentityDocument {
  private constructor(readonly type: DocumentType, readonly number: string) {
    Object.freeze(this);
  }

  static create(type: string, number: string): Result<IdentityDocument> {
    const t = parseEnum(DocumentType, type, 'identityDocument.type');
    if (!t.ok) return err(t.error);
    const n = (number ?? '').replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9/-]{2,39}$/.test(n)) return err(new DomainError('PATIENT_DOCUMENT_INVALID', "Numéro de pièce d'identité invalide (3 à 40 caractères : lettres, chiffres, « - », « / »)."));
    return ok(new IdentityDocument(t.value, n));
  }

  equals(other: IdentityDocument | null): boolean {
    return !!other && other.type === this.type && other.number === this.number;
  }
}

export class Address {
  private constructor(
    readonly line: ShortText | null,
    readonly quarter: ShortText | null,
    readonly city: ShortText | null,
    readonly region: ShortText | null,
    readonly country: CountryCode | null,
  ) {
    Object.freeze(this);
  }

  /** Renvoie `null` si aucun élément n'est renseigné. */
  static create(raw: { line?: string | null; quarter?: string | null; city?: string | null; region?: string | null; country?: string | null }): Result<Address | null> {
    const text = (v: string | null | undefined, field: string, max: number): Result<ShortText | null> => (v?.trim() ? ShortText.create(v, field, max) : ok(null));
    const line = text(raw.line, 'address.line', 200);
    const quarter = text(raw.quarter, 'address.quarter', 100);
    const city = text(raw.city, 'address.city', 100);
    const region = text(raw.region, 'address.region', 100);
    const country = raw.country?.trim() ? CountryCode.create(raw.country, 'address.country') : ok(null);
    for (const r of [line, quarter, city, region, country]) if (!r.ok) return err(r.error);
    if (!line.ok || !quarter.ok || !city.ok || !region.ok || !country.ok) return ok(null);
    if (!line.value && !quarter.value && !city.value && !region.value && !country.value) return ok(null);
    return ok(new Address(line.value, quarter.value, city.value, region.value, country.value));
  }
}

/** Personne à prévenir : nom, lien avec le patient et téléphone (au moins un moyen de la joindre). */
export class NextOfKin {
  private constructor(readonly name: PersonName, readonly relationship: Relationship, readonly phone: PhoneNumber) {
    Object.freeze(this);
  }

  static create(raw: { name: string; relationship: string; phone: string }): Result<NextOfKin> {
    const name = PersonName.create(raw.name, 'nextOfKinName');
    if (!name.ok) return err(name.error);
    const relationship = parseEnum(Relationship, raw.relationship, 'nextOfKin.relationship');
    if (!relationship.ok) return err(relationship.error);
    const phone = PhoneNumber.create(raw.phone, 'nextOfKin.phone');
    if (!phone.ok) return err(phone.error);
    return ok(new NextOfKin(name.value, relationship.value, phone.value));
  }
}

/** Date `AAAA-MM-JJ` (jour réel : le 30 février est refusé). */
export function parseDate(raw: string, field: string): Result<PlainDate> {
  const invalid = () => err(new DomainError('PATIENT_DATE_INVALID', `Le champ « ${field} » doit être une date au format AAAA-MM-JJ.`, { field }));
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return invalid();
  try {
    return ok(Temporal.PlainDate.from(raw.trim(), { overflow: 'reject' }));
  } catch {
    return invalid();
  }
}

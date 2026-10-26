import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../shared-kernel/temporal';
import { ValueObject } from '../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid(raw: string, code: string, message: string): Result<string> {
  const normalized = (raw ?? '').trim();
  return UUID.test(normalized) ? ok(normalized.toLowerCase()) : err(new DomainError(code, message));
}

export class StaffId extends ValueObject<string> {
  static create(raw: string): Result<StaffId> {
    const id = parseUuid(raw, 'STAFF_ID_INVALID', "L'identifiant de ce membre du personnel est invalide.");
    return id.ok ? ok(new StaffId(id.value)) : err(id.error);
  }
}

export class AssignmentId extends ValueObject<string> {
  static create(raw: string): Result<AssignmentId> {
    const id = parseUuid(raw, 'ASSIGNMENT_ID_INVALID', "L'identifiant de cette affectation est invalide.");
    return id.ok ? ok(new AssignmentId(id.value)) : err(id.error);
  }
}

/** Référence à un élément de la structure (service, unité…) : le module n'en connaît que l'identifiant. */
export class NodeRef extends ValueObject<string> {
  static create(raw: string): Result<NodeRef> {
    const id = parseUuid(raw, 'ASSIGNMENT_NODE_INVALID', "L'identifiant du service ou de l'unité est invalide.");
    return id.ok ? ok(new NodeRef(id.value)) : err(id.error);
  }
}

/** Référence à un établissement. */
export class FacilityRef extends ValueObject<string> {
  static create(raw: string): Result<FacilityRef> {
    const id = parseUuid(raw, 'STAFF_FACILITY_INVALID', "L'identifiant de l'établissement est invalide.");
    return id.ok ? ok(new FacilityRef(id.value)) : err(id.error);
  }
}

/** Référence à un compte utilisateur (IAM) : le module n'en connaît que l'identifiant. */
export class UserRef extends ValueObject<string> {
  static create(raw: string): Result<UserRef> {
    const id = parseUuid(raw, 'STAFF_USER_INVALID', "L'identifiant du compte est invalide.");
    return id.ok ? ok(new UserRef(id.value)) : err(id.error);
  }
}

/** Matricule : unique, jamais réutilisé. Majuscules, chiffres, « _ », « - », « . », « / » ; 1 à 32 caractères. */
export class StaffNumber extends ValueObject<string> {
  static create(raw: string): Result<StaffNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_./-]{0,31}$/.test(normalized)) {
      return err(new DomainError('STAFF_NUMBER_INVALID', 'Matricule invalide (1 à 32 caractères : lettres, chiffres, « _ », « - », « . », « / »).', { value: String(raw) }));
    }
    return ok(new StaffNumber(normalized));
  }
}

/** Nom ou prénom : 1 à 100 caractères, sans caractère de contrôle. `field` désigne le champ fautif dans le message. */
export class PersonName extends ValueObject<string> {
  static create(raw: string, field: 'firstName' | 'lastName'): Result<PersonName> {
    const normalized = (raw ?? '').trim().replace(/\s+/g, ' ');
    // eslint-disable-next-line no-control-regex
    if (normalized.length === 0 || normalized.length > 100 || /[\u0000-\u001f\u007f]/.test(normalized)) {
      return err(new DomainError('STAFF_NAME_INVALID', `Le champ « ${field} » doit comporter de 1 à 100 caractères.`, { field }));
    }
    return ok(new PersonName(normalized));
  }
}

export class ContactEmail extends ValueObject<string> {
  static create(raw: string): Result<ContactEmail> {
    const normalized = (raw ?? '').trim().toLowerCase();
    if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return err(new DomainError('STAFF_EMAIL_INVALID', 'Adresse e-mail invalide.'));
    }
    return ok(new ContactEmail(normalized));
  }
}

/** Numéro de téléphone : chiffres, espaces, « + » initial, « ( ) . - » ; 6 à 20 caractères dont au moins 6 chiffres. */
export class PhoneNumber extends ValueObject<string> {
  static create(raw: string): Result<PhoneNumber> {
    const normalized = (raw ?? '').trim();
    const digits = normalized.replace(/\D/g, '').length;
    if (!/^\+?[0-9][0-9 ().-]{4,19}$/.test(normalized) || digits < 6) {
      return err(new DomainError('STAFF_PHONE_INVALID', 'Numéro de téléphone invalide.'));
    }
    return ok(new PhoneNumber(normalized));
  }
}

/** Code d'une entrée de référentiel (profession, spécialité) ; son existence et son activité sont vérifiées par `ReferenceCodes`. */
export class ReferenceCode extends ValueObject<string> {
  static create(raw: string, code: 'STAFF_PROFESSION_UNKNOWN' | 'STAFF_SPECIALTY_UNKNOWN'): Result<ReferenceCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_.-]{0,31}$/.test(normalized)) {
      return err(new DomainError(code, "Cette valeur n'existe pas ou n'est plus active.", { value: String(raw) }));
    }
    return ok(new ReferenceCode(normalized));
  }
}

/** Date calendaire `AAAA-MM-JJ` (jour réel : le 30 février est refusé). */
export function parseDate(raw: string, field: string): Result<PlainDate> {
  const invalid = () => err(new DomainError('STAFF_DATE_INVALID', `Le champ « ${field} » doit être une date au format AAAA-MM-JJ.`, { field }));
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return invalid();
  try {
    return ok(Temporal.PlainDate.from(raw.trim(), { overflow: 'reject' }));
  } catch {
    return invalid();
  }
}

import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { ValueObject } from '../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(raw: string, code: string, message: string): Result<string> {
  const normalized = (raw ?? '').trim();
  return UUID.test(normalized) ? ok(normalized.toLowerCase()) : err(new DomainError(code, message));
}

export class EncounterId extends ValueObject<string> {
  static create(raw: string): Result<EncounterId> {
    const r = uuid(raw, 'CLINICAL_ENCOUNTER_ID_INVALID', "L'identifiant de cette consultation est invalide.");
    return r.ok ? ok(new EncounterId(r.value)) : err(r.error);
  }
}

export class AllergyId extends ValueObject<string> {
  static create(raw: string): Result<AllergyId> {
    const r = uuid(raw, 'CLINICAL_ALLERGY_ID_INVALID', "L'identifiant de cette allergie est invalide.");
    return r.ok ? ok(new AllergyId(r.value)) : err(r.error);
  }
}

/** Le patient concerné (module Patients) : ce module n'en connaît que l'identifiant. */
export class PatientRef extends ValueObject<string> {
  static create(raw: string): Result<PatientRef> {
    const r = uuid(raw, 'CLINICAL_PATIENT_INVALID', "L'identifiant du patient est invalide.");
    return r.ok ? ok(new PatientRef(r.value)) : err(r.error);
  }
}

/** Numéro de consultation, attribué par le système. */
export class EncounterNumber extends ValueObject<string> {
  static create(raw: string): Result<EncounterNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^CON-\d{7,12}$/.test(normalized) ? ok(new EncounterNumber(normalized)) : err(new DomainError('CLINICAL_ENCOUNTER_NUMBER_INVALID', 'Numéro de consultation invalide.'));
  }

  static fromSequence(n: number): Result<EncounterNumber> {
    return EncounterNumber.create(`CON-${String(n).padStart(7, '0')}`);
  }
}

/** Code CIM-10 : une lettre, deux chiffres, puis facultativement un point et un à quatre caractères (`J18`, `J18.9`, `S72.00`). */
export class IcdCode extends ValueObject<string> {
  static create(raw: string): Result<IcdCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/.test(normalized)
      ? ok(new IcdCode(normalized))
      : err(new DomainError('CLINICAL_ICD_INVALID', `Code CIM-10 invalide : « ${String(raw ?? '')} » (par exemple J18.9).`, { value: String(raw ?? '') }));
  }
}

function parseEnum<E extends string>(values: readonly E[], raw: string, code: string, label: string): Result<E> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = values.find((v) => v === normalized);
  return found ? ok(found) : err(new DomainError(code, `${label} invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

export const DIAGNOSIS_KINDS = ['PRIMARY', 'SECONDARY'] as const;
export type DiagnosisKind = (typeof DIAGNOSIS_KINDS)[number];
export const parseDiagnosisKind = (raw: string) => parseEnum(DIAGNOSIS_KINDS, raw, 'CLINICAL_DIAGNOSIS_KIND_INVALID', 'Rang du diagnostic');

/** `PROVISIONAL` : hypothèse à confirmer ; `CONFIRMED` : retenu. */
export const CERTAINTIES = ['PROVISIONAL', 'CONFIRMED'] as const;
export type Certainty = (typeof CERTAINTIES)[number];
export const parseCertainty = (raw: string) => parseEnum(CERTAINTIES, raw, 'CLINICAL_CERTAINTY_INVALID', 'Degré de certitude');

export const SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const parseSeverity = (raw: string) => parseEnum(SEVERITIES, raw, 'CLINICAL_SEVERITY_INVALID', 'Gravité');

/** Texte clinique facultatif : vide → absent ; au plus `max` caractères. */
export function parseClinicalText(raw: string | null | undefined, max: number, code: string): Result<string | null> {
  if (raw === undefined || raw === null || raw.trim() === '') return ok(null);
  return raw.trim().length <= max ? ok(raw.trim()) : err(new DomainError(code, `Le texte ne doit pas dépasser ${max} caractères.`, { max }));
}

/** Texte obligatoire de 1 à `max` caractères (motif d'annulation, addendum…). */
export function requiredText(raw: string, max: number, code: string, message: string): Result<string> {
  const text = (raw ?? '').trim();
  return text.length >= 1 && text.length <= max ? ok(text) : err(new DomainError(code, message, { max }));
}

export class PrescriptionId extends ValueObject<string> {
  static create(raw: string): Result<PrescriptionId> {
    const r = uuid(raw, 'CLINICAL_PRESCRIPTION_ID_INVALID', "L'identifiant de cette ordonnance est invalide.");
    return r.ok ? ok(new PrescriptionId(r.value)) : err(r.error);
  }
}

/** Le médicament prescrit (module Pharmacie) : ce module n'en connaît que l'identifiant. */
export class DrugRef extends ValueObject<string> {
  static create(raw: string): Result<DrugRef> {
    const r = uuid(raw, 'CLINICAL_DRUG_INVALID', "L'identifiant du médicament est invalide.");
    return r.ok ? ok(new DrugRef(r.value)) : err(r.error);
  }
}

/** Numéro d'ordonnance, attribué par le système. */
export class PrescriptionNumber extends ValueObject<string> {
  static create(raw: string): Result<PrescriptionNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^RX-\d{7,12}$/.test(normalized) ? ok(new PrescriptionNumber(normalized)) : err(new DomainError('CLINICAL_PRESCRIPTION_NUMBER_INVALID', "Numéro d'ordonnance invalide."));
  }

  static fromSequence(n: number): Result<PrescriptionNumber> {
    return PrescriptionNumber.create(`RX-${String(n).padStart(7, '0')}`);
  }
}

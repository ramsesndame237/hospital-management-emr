import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { ValueObject } from '../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(raw: string, code: string, message: string): Result<string> {
  const normalized = (raw ?? '').trim();
  return UUID.test(normalized) ? ok(normalized.toLowerCase()) : err(new DomainError(code, message));
}

export class TestId extends ValueObject<string> {
  static create(raw: string): Result<TestId> {
    const r = uuid(raw, 'LAB_TEST_ID_INVALID', "L'identifiant de cette analyse est invalide.");
    return r.ok ? ok(new TestId(r.value)) : err(r.error);
  }
}

export class RequisitionId extends ValueObject<string> {
  static create(raw: string): Result<RequisitionId> {
    const r = uuid(raw, 'LAB_REQUISITION_ID_INVALID', "L'identifiant de cette demande d'analyses est invalide.");
    return r.ok ? ok(new RequisitionId(r.value)) : err(r.error);
  }
}

export class SpecimenId extends ValueObject<string> {
  static create(raw: string): Result<SpecimenId> {
    const r = uuid(raw, 'LAB_SPECIMEN_ID_INVALID', "L'identifiant de cet échantillon est invalide.");
    return r.ok ? ok(new SpecimenId(r.value)) : err(r.error);
  }
}

/** Le patient concerné (module Patients) : ce module n'en connaît que l'identifiant. */
export class PatientRef extends ValueObject<string> {
  static create(raw: string): Result<PatientRef> {
    const r = uuid(raw, 'LAB_PATIENT_INVALID', "L'identifiant du patient est invalide.");
    return r.ok ? ok(new PatientRef(r.value)) : err(r.error);
  }
}

/** Code d'une analyse : 1 à 20 caractères (lettres, chiffres, « _ », « - », « . »), en majuscules. */
export class TestCode extends ValueObject<string> {
  static create(raw: string): Result<TestCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9_.-]{0,19}$/.test(normalized)
      ? ok(new TestCode(normalized))
      : err(new DomainError('LAB_TEST_CODE_INVALID', `Code d'analyse invalide : « ${String(raw ?? '')} » (1 à 20 caractères : lettres, chiffres, « _ », « - », « . »).`, { value: String(raw ?? '') }));
  }
}

export class TestName extends ValueObject<string> {
  static create(raw: string): Result<TestName> {
    const normalized = (raw ?? '').trim().replace(/\s+/g, ' ');
    return normalized.length >= 1 && normalized.length <= 120 ? ok(new TestName(normalized)) : err(new DomainError('LAB_TEST_NAME_INVALID', "Le libellé de l'analyse doit comporter de 1 à 120 caractères."));
  }
}

/** Numéro de demande d'analyses, attribué par le système. */
export class RequisitionNumber extends ValueObject<string> {
  static create(raw: string): Result<RequisitionNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^LAB-\d{7,12}$/.test(normalized) ? ok(new RequisitionNumber(normalized)) : err(new DomainError('LAB_REQUISITION_NUMBER_INVALID', 'Numéro de demande invalide.'));
  }

  static fromSequence(n: number): Result<RequisitionNumber> {
    return RequisitionNumber.create(`LAB-${String(n).padStart(7, '0')}`);
  }
}

/** Code-barres d'un échantillon : celui qu'on colle sur le tube et qu'on scanne à chaque étape. */
export class SpecimenBarcode extends ValueObject<string> {
  static create(raw: string): Result<SpecimenBarcode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^SPC-\d{7,12}$/.test(normalized) ? ok(new SpecimenBarcode(normalized)) : err(new DomainError('LAB_BARCODE_INVALID', "Code-barres d'échantillon invalide."));
  }

  static fromSequence(n: number): Result<SpecimenBarcode> {
    return SpecimenBarcode.create(`SPC-${String(n).padStart(7, '0')}`);
  }
}

function parseEnum<E extends string>(values: readonly E[], raw: string, code: string, label: string): Result<E> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = values.find((v) => v === normalized);
  return found ? ok(found) : err(new DomainError(code, `${label} invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

export const SECTIONS = ['HAEMATOLOGY', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'MICROBIOLOGY', 'HISTOLOGY', 'OTHER'] as const;
export type Section = (typeof SECTIONS)[number];
export const parseSection = (raw: string) => parseEnum(SECTIONS, raw, 'LAB_SECTION_INVALID', 'Section');

export const SPECIMEN_TYPES = ['BLOOD', 'SERUM', 'PLASMA', 'URINE', 'STOOL', 'SWAB', 'CSF', 'TISSUE', 'OTHER'] as const;
export type SpecimenType = (typeof SPECIMEN_TYPES)[number];
export const parseSpecimenType = (raw: string) => parseEnum(SPECIMEN_TYPES, raw, 'LAB_SPECIMEN_TYPE_INVALID', "Type d'échantillon");

/** Contenant : la couleur du bouchon pour les tubes, sinon le flacon ou l'écouvillon. */
export const CONTAINERS = ['RED', 'YELLOW', 'PURPLE', 'LIGHT_BLUE', 'GREEN', 'GREY', 'STERILE_CUP', 'SWAB', 'OTHER'] as const;
export type Container = (typeof CONTAINERS)[number];
export const parseContainer = (raw: string) => parseEnum(CONTAINERS, raw, 'LAB_CONTAINER_INVALID', 'Contenant');

/** `NUMERIC` : un nombre (avec unité et valeurs de référence) ; `TEXT` : un texte libre ; `CHOICE` : une valeur parmi une liste (positif / négatif…). */
export const RESULT_TYPES = ['NUMERIC', 'TEXT', 'CHOICE'] as const;
export type ResultType = (typeof RESULT_TYPES)[number];
export const parseResultType = (raw: string) => parseEnum(RESULT_TYPES, raw, 'LAB_RESULT_TYPE_INVALID', 'Type de résultat');

export const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const parsePriority = (raw: string) => parseEnum(PRIORITIES, raw, 'LAB_PRIORITY_INVALID', 'Priorité');

/** D'où vient la demande : consultation externe, hospitalisation, urgences, ou prescription extérieure / patient de passage. */
export const SOURCES = ['OPD', 'IPD', 'ER', 'EXTERNAL'] as const;
export type Source = (typeof SOURCES)[number];
export const parseSource = (raw: string) => parseEnum(SOURCES, raw, 'LAB_SOURCE_INVALID', 'Provenance');

export const SEXES = ['ANY', 'FEMALE', 'MALE'] as const;
export type RangeSex = (typeof SEXES)[number];
export const parseRangeSex = (raw: string) => parseEnum(SEXES, raw, 'LAB_RANGE_SEX_INVALID', 'Sexe');

export const REJECTION_REASONS = ['HEMOLYSED', 'INSUFFICIENT_VOLUME', 'WRONG_CONTAINER', 'CLOTTED', 'MISLABELLED', 'UNLABELLED', 'LEAKING', 'CONTAMINATED', 'EXPIRED_CONTAINER', 'OTHER'] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];
export const parseRejectionReason = (raw: string) => parseEnum(REJECTION_REASONS, raw, 'LAB_REJECTION_REASON_INVALID', 'Motif de rejet');

/** Texte libre de 1 à 200 caractères (motif d'annulation, précision d'un rejet). */
export class Reason extends ValueObject<string> {
  static create(raw: string): Result<Reason> {
    const normalized = (raw ?? '').trim();
    return normalized.length >= 1 && normalized.length <= 200 ? ok(new Reason(normalized)) : err(new DomainError('LAB_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).'));
  }
}

/** Renseignements cliniques ou instructions : facultatifs, 500 caractères au plus. */
export function parseNotes(raw: string | null | undefined): Result<string | null> {
  if (raw === undefined || raw === null || raw.trim() === '') return ok(null);
  return raw.trim().length <= 500 ? ok(raw.trim()) : err(new DomainError('LAB_NOTES_INVALID', 'Le texte ne doit pas dépasser 500 caractères.'));
}

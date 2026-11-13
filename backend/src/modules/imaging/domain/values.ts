import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { ValueObject } from '../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(raw: string, code: string, message: string): Result<string> {
  const normalized = (raw ?? '').trim();
  return UUID.test(normalized) ? ok(normalized.toLowerCase()) : err(new DomainError(code, message));
}

export class ExamTypeId extends ValueObject<string> {
  static create(raw: string): Result<ExamTypeId> {
    const r = uuid(raw, 'IMG_EXAM_ID_INVALID', "L'identifiant de cet examen est invalide.");
    return r.ok ? ok(new ExamTypeId(r.value)) : err(r.error);
  }
}

export class OrderId extends ValueObject<string> {
  static create(raw: string): Result<OrderId> {
    const r = uuid(raw, 'IMG_ORDER_ID_INVALID', "L'identifiant de cette demande d'examen est invalide.");
    return r.ok ? ok(new OrderId(r.value)) : err(r.error);
  }
}

/** Le patient concerné (module Patients) : ce module n'en connaît que l'identifiant. */
export class PatientRef extends ValueObject<string> {
  static create(raw: string): Result<PatientRef> {
    const r = uuid(raw, 'IMG_PATIENT_INVALID', "L'identifiant du patient est invalide.");
    return r.ok ? ok(new PatientRef(r.value)) : err(r.error);
  }
}

/** Code d'un examen : 1 à 20 caractères (lettres, chiffres, « _ », « - », « . »), en majuscules. */
export class ExamCode extends ValueObject<string> {
  static create(raw: string): Result<ExamCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9_.-]{0,19}$/.test(normalized)
      ? ok(new ExamCode(normalized))
      : err(new DomainError('IMG_EXAM_CODE_INVALID', `Code d'examen invalide : « ${String(raw ?? '')} » (1 à 20 caractères : lettres, chiffres, « _ », « - », « . »).`, { value: String(raw ?? '') }));
  }
}

export class ExamName extends ValueObject<string> {
  static create(raw: string): Result<ExamName> {
    const normalized = (raw ?? '').trim().replace(/\s+/g, ' ');
    return normalized.length >= 1 && normalized.length <= 120 ? ok(new ExamName(normalized)) : err(new DomainError('IMG_EXAM_NAME_INVALID', "Le libellé de l'examen doit comporter de 1 à 120 caractères."));
  }
}

/** Numéro de demande d'examen, attribué par le système (sert aussi de numéro d'accession). */
export class OrderNumber extends ValueObject<string> {
  static create(raw: string): Result<OrderNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^IMG-\d{7,12}$/.test(normalized) ? ok(new OrderNumber(normalized)) : err(new DomainError('IMG_ORDER_NUMBER_INVALID', 'Numéro de demande invalide.'));
  }

  static fromSequence(n: number): Result<OrderNumber> {
    return OrderNumber.create(`IMG-${String(n).padStart(7, '0')}`);
  }
}

function parseEnum<E extends string>(values: readonly E[], raw: string, code: string, label: string): Result<E> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = values.find((v) => v === normalized);
  return found ? ok(found) : err(new DomainError(code, `${label} invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

export const MODALITIES = ['XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAPHY', 'FLUOROSCOPY', 'OTHER'] as const;
export type Modality = (typeof MODALITIES)[number];
export const parseModality = (raw: string) => parseEnum(MODALITIES, raw, 'IMG_MODALITY_INVALID', 'Modalité');

/** Modalités qui exposent le patient à des rayons ionisants (la grossesse y est une contre-indication à lever explicitement). */
export const isIonizing = (modality: Modality): boolean => modality === 'XRAY' || modality === 'CT' || modality === 'MAMMOGRAPHY' || modality === 'FLUOROSCOPY';

export const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const parsePriority = (raw: string) => parseEnum(PRIORITIES, raw, 'IMG_PRIORITY_INVALID', 'Priorité');

/** D'où vient la demande : consultation externe, hospitalisation, urgences, ou prescription extérieure / patient de passage. */
export const SOURCES = ['OPD', 'IPD', 'ER', 'EXTERNAL'] as const;
export type Source = (typeof SOURCES)[number];
export const parseSource = (raw: string) => parseEnum(SOURCES, raw, 'IMG_SOURCE_INVALID', 'Provenance');

export const METHODS = ['PHONE', 'IN_PERSON', 'SECURE_MESSAGE'] as const;
export type CommunicationMethod = (typeof METHODS)[number];
export const parseMethod = (raw: string) => parseEnum(METHODS, raw, 'IMG_COMMUNICATION_METHOD_INVALID', 'Moyen de communication');

/** Texte libre de 1 à 200 caractères (motif d'annulation, d'addendum ou de dérogation). */
export class Reason extends ValueObject<string> {
  static create(raw: string): Result<Reason> {
    const normalized = (raw ?? '').trim();
    return normalized.length >= 1 && normalized.length <= 200 ? ok(new Reason(normalized)) : err(new DomainError('IMG_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).'));
  }
}

/** Texte facultatif : `null` s'il est vide, sinon rogné et limité à `max` caractères. */
export function parseOptionalText(raw: string | null | undefined, max: number, code: string): Result<string | null> {
  if (raw === undefined || raw === null || raw.trim() === '') return ok(null);
  return raw.trim().length <= max ? ok(raw.trim()) : err(new DomainError(code, `Le texte ne doit pas dépasser ${max} caractères.`, { max }));
}

import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../shared-kernel/temporal';
import { ValueObject } from '../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(raw: string, code: string, message: string): Result<string> {
  const normalized = (raw ?? '').trim();
  return UUID.test(normalized) ? ok(normalized.toLowerCase()) : err(new DomainError(code, message));
}

export class DrugId extends ValueObject<string> {
  static create(raw: string): Result<DrugId> {
    const r = uuid(raw, 'PHARMACY_DRUG_ID_INVALID', "L'identifiant de ce médicament est invalide.");
    return r.ok ? ok(new DrugId(r.value)) : err(r.error);
  }
}

export class BatchId extends ValueObject<string> {
  static create(raw: string): Result<BatchId> {
    const r = uuid(raw, 'PHARMACY_BATCH_ID_INVALID', "L'identifiant de ce lot est invalide.");
    return r.ok ? ok(new BatchId(r.value)) : err(r.error);
  }
}

export class ReceiptId extends ValueObject<string> {
  static create(raw: string): Result<ReceiptId> {
    const r = uuid(raw, 'PHARMACY_RECEIPT_ID_INVALID', "L'identifiant de cette réception est invalide.");
    return r.ok ? ok(new ReceiptId(r.value)) : err(r.error);
  }
}

export class AdjustmentId extends ValueObject<string> {
  static create(raw: string): Result<AdjustmentId> {
    const r = uuid(raw, 'PHARMACY_ADJUSTMENT_ID_INVALID', "L'identifiant de cet ajustement est invalide.");
    return r.ok ? ok(new AdjustmentId(r.value)) : err(r.error);
  }
}

/** Code d'un médicament dans le formulaire : 1 à 30 caractères (lettres, chiffres, « _ », « - », « . »), en majuscules. */
export class DrugCode extends ValueObject<string> {
  static create(raw: string): Result<DrugCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9_.-]{0,29}$/.test(normalized)
      ? ok(new DrugCode(normalized))
      : err(new DomainError('PHARMACY_DRUG_CODE_INVALID', `Code de médicament invalide : « ${String(raw ?? '')} » (1 à 30 caractères : lettres, chiffres, « _ », « - », « . »).`, { value: String(raw ?? '') }));
  }
}

/** Libellé (nom commercial ou nom usuel) ou dénomination commune : 1 à 120 caractères. */
export class DrugName extends ValueObject<string> {
  static create(raw: string): Result<DrugName> {
    const normalized = (raw ?? '').trim().replace(/\s+/g, ' ');
    return normalized.length >= 1 && normalized.length <= 120 ? ok(new DrugName(normalized)) : err(new DomainError('PHARMACY_DRUG_NAME_INVALID', 'Le nom du médicament doit comporter de 1 à 120 caractères.'));
  }
}

export class GenericName extends ValueObject<string> {
  static create(raw: string): Result<GenericName> {
    const normalized = (raw ?? '').trim().replace(/\s+/g, ' ');
    return normalized.length >= 1 && normalized.length <= 120 ? ok(new GenericName(normalized)) : err(new DomainError('PHARMACY_GENERIC_NAME_INVALID', 'La dénomination commune doit comporter de 1 à 120 caractères.'));
  }
}

/** Numéro de lot chez le fabricant : 1 à 40 caractères, normalisé en majuscules. */
export class BatchNumber extends ValueObject<string> {
  static create(raw: string): Result<BatchNumber> {
    const normalized = (raw ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
    return /^[A-Z0-9][A-Z0-9 ._/-]{0,39}$/.test(normalized)
      ? ok(new BatchNumber(normalized))
      : err(new DomainError('PHARMACY_BATCH_NUMBER_INVALID', `Numéro de lot invalide : « ${String(raw ?? '')} » (1 à 40 caractères : lettres, chiffres, espace, « . », « _ », « / », « - »).`, { value: String(raw ?? '') }));
  }
}

/** Numéro de réception de marchandises, attribué par le système. */
export class ReceiptNumber extends ValueObject<string> {
  static create(raw: string): Result<ReceiptNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^GRN-\d{7,12}$/.test(normalized) ? ok(new ReceiptNumber(normalized)) : err(new DomainError('PHARMACY_RECEIPT_NUMBER_INVALID', 'Numéro de réception invalide.'));
  }

  static fromSequence(n: number): Result<ReceiptNumber> {
    return ReceiptNumber.create(`GRN-${String(n).padStart(7, '0')}`);
  }
}

export class AdjustmentNumber extends ValueObject<string> {
  static create(raw: string): Result<AdjustmentNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^ADJ-\d{7,12}$/.test(normalized) ? ok(new AdjustmentNumber(normalized)) : err(new DomainError('PHARMACY_ADJUSTMENT_NUMBER_INVALID', "Numéro d'ajustement invalide."));
  }

  static fromSequence(n: number): Result<AdjustmentNumber> {
    return AdjustmentNumber.create(`ADJ-${String(n).padStart(7, '0')}`);
  }
}

export const MAX_QUANTITY = 1_000_000;

/** Quantité en unités de dispensation (comprimés, flacons…) : un entier de 1 à 1 000 000. */
export class Quantity extends ValueObject<number> {
  static create(raw: number): Result<Quantity> {
    return Number.isSafeInteger(raw) && raw >= 1 && raw <= MAX_QUANTITY
      ? ok(new Quantity(raw))
      : err(new DomainError('PHARMACY_QUANTITY_INVALID', `La quantité doit être un entier compris entre 1 et ${MAX_QUANTITY}.`, { max: MAX_QUANTITY }));
  }
}

export const MAX_MONEY = 1_000_000_000_000;

/** Montant en plus petite unité monétaire de l'installation : un entier, jamais un décimal. */
export class Money extends ValueObject<number> {
  static create(raw: number): Result<Money> {
    return Number.isSafeInteger(raw) && raw >= 0 && raw <= MAX_MONEY
      ? ok(new Money(raw))
      : err(new DomainError('PHARMACY_AMOUNT_INVALID', `Le montant doit être un entier compris entre 0 et ${MAX_MONEY}.`, { max: MAX_MONEY }));
  }

  static restore(value: number): Money {
    return new Money(value);
  }
}

/** Date de péremption (`AAAA-MM-JJ`) : un jour réel du calendrier. */
export function parseExpiry(raw: string): Result<PlainDate> {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return err(new DomainError('PHARMACY_EXPIRY_INVALID', 'La date de péremption doit être au format AAAA-MM-JJ.'));
  try {
    return ok(Temporal.PlainDate.from(raw.trim(), { overflow: 'reject' }));
  } catch {
    return err(new DomainError('PHARMACY_EXPIRY_INVALID', 'La date de péremption doit être au format AAAA-MM-JJ.'));
  }
}

function parseEnum<E extends string>(values: readonly E[], raw: string, code: string, label: string): Result<E> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = values.find((v) => v === normalized);
  return found ? ok(found) : err(new DomainError(code, `${label} invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

export const FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'INFUSION', 'CREAM', 'OINTMENT', 'DROPS', 'INHALER', 'SUPPOSITORY', 'POWDER', 'PATCH', 'OTHER'] as const;
export type DrugForm = (typeof FORMS)[number];
export const parseForm = (raw: string) => parseEnum(FORMS, raw, 'PHARMACY_FORM_INVALID', 'Forme galénique');

/** `OTC` : vente libre ; `PRESCRIPTION` : sur ordonnance ; `CONTROLLED` : substance contrôlée (stupéfiants, psychotropes). */
export const SCHEDULES = ['OTC', 'PRESCRIPTION', 'CONTROLLED'] as const;
export type Schedule = (typeof SCHEDULES)[number];
export const parseSchedule = (raw: string) => parseEnum(SCHEDULES, raw, 'PHARMACY_SCHEDULE_INVALID', 'Classe de délivrance');

export const STORAGES = ['ROOM', 'COOL', 'COLD_CHAIN'] as const;
export type Storage = (typeof STORAGES)[number];
export const parseStorage = (raw: string) => parseEnum(STORAGES, raw, 'PHARMACY_STORAGE_INVALID', 'Condition de conservation');

export const DIRECTIONS = ['IN', 'OUT'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const parseDirection = (raw: string) => parseEnum(DIRECTIONS, raw, 'PHARMACY_DIRECTION_INVALID', "Sens de l'ajustement");

export const ADJUSTMENT_REASONS = ['COUNT_CORRECTION', 'DAMAGED', 'EXPIRED', 'LOST', 'FOUND', 'OTHER'] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];
export const parseAdjustmentReason = (raw: string) => parseEnum(ADJUSTMENT_REASONS, raw, 'PHARMACY_ADJUSTMENT_REASON_INVALID', "Motif d'ajustement");

/** Texte libre de 1 à 200 caractères (motif de quarantaine, de refus…). */
export class Reason extends ValueObject<string> {
  static create(raw: string): Result<Reason> {
    const normalized = (raw ?? '').trim();
    return normalized.length >= 1 && normalized.length <= 200 ? ok(new Reason(normalized)) : err(new DomainError('PHARMACY_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).'));
  }
}

/** Texte facultatif : vide → absent ; au plus `max` caractères. */
export function parseOptionalText(raw: string | null | undefined, max: number, code: string): Result<string | null> {
  if (raw === undefined || raw === null || raw.trim() === '') return ok(null);
  return raw.trim().length <= max ? ok(raw.trim()) : err(new DomainError(code, `Le texte ne doit pas dépasser ${max} caractères.`, { max }));
}

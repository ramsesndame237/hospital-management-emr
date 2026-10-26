import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { ValueObject } from '../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(raw: string, code: string, message: string): Result<string> {
  const normalized = (raw ?? '').trim();
  return UUID.test(normalized) ? ok(normalized.toLowerCase()) : err(new DomainError(code, message));
}

export class ItemId extends ValueObject<string> {
  static create(raw: string): Result<ItemId> {
    const r = uuid(raw, 'BILLING_ITEM_ID_INVALID', "L'identifiant de cet acte est invalide.");
    return r.ok ? ok(new ItemId(r.value)) : err(r.error);
  }
}

export class InvoiceId extends ValueObject<string> {
  static create(raw: string): Result<InvoiceId> {
    const r = uuid(raw, 'BILLING_INVOICE_ID_INVALID', "L'identifiant de cette facture est invalide.");
    return r.ok ? ok(new InvoiceId(r.value)) : err(r.error);
  }
}

export class LineId extends ValueObject<string> {
  static create(raw: string): Result<LineId> {
    const r = uuid(raw, 'BILLING_LINE_ID_INVALID', "L'identifiant de cette ligne est invalide.");
    return r.ok ? ok(new LineId(r.value)) : err(r.error);
  }
}

export class PaymentId extends ValueObject<string> {
  static create(raw: string): Result<PaymentId> {
    const r = uuid(raw, 'BILLING_PAYMENT_ID_INVALID', "L'identifiant de cet encaissement est invalide.");
    return r.ok ? ok(new PaymentId(r.value)) : err(r.error);
  }
}

/** Le patient facturé (module Patients) : ce module n'en connaît que l'identifiant. */
export class PatientRef extends ValueObject<string> {
  static create(raw: string): Result<PatientRef> {
    const r = uuid(raw, 'BILLING_PATIENT_INVALID', "L'identifiant du patient est invalide.");
    return r.ok ? ok(new PatientRef(r.value)) : err(r.error);
  }
}

/** Le service (structure de l'établissement) auquel un acte est rattaché. */
export class ServiceRef extends ValueObject<string> {
  static create(raw: string): Result<ServiceRef> {
    const r = uuid(raw, 'BILLING_SERVICE_INVALID', "L'identifiant du service est invalide.");
    return r.ok ? ok(new ServiceRef(r.value)) : err(r.error);
  }
}

/** Code d'un acte facturable : 1 à 32 caractères (lettres, chiffres, « _ », « - », « . »), en majuscules. */
export class ItemCode extends ValueObject<string> {
  static create(raw: string): Result<ItemCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9_.-]{0,31}$/.test(normalized) ? ok(new ItemCode(normalized)) : err(new DomainError('BILLING_ITEM_CODE_INVALID', `Code d'acte invalide : « ${String(raw ?? '')} » (1 à 32 caractères : lettres, chiffres, « _ », « - », « . »).`, { value: String(raw ?? '') }));
  }
}

export class ItemName extends ValueObject<string> {
  static create(raw: string): Result<ItemName> {
    const normalized = (raw ?? '').trim().replace(/\s+/g, ' ');
    return normalized.length >= 1 && normalized.length <= 200 ? ok(new ItemName(normalized)) : err(new DomainError('BILLING_ITEM_NAME_INVALID', "Le libellé de l'acte doit comporter de 1 à 200 caractères."));
  }
}

export enum ItemCategory {
  CONSULTATION = 'CONSULTATION',
  LABORATORY = 'LABORATORY',
  RADIOLOGY = 'RADIOLOGY',
  PHARMACY = 'PHARMACY',
  PROCEDURE = 'PROCEDURE',
  HOSPITALIZATION = 'HOSPITALIZATION',
  OTHER = 'OTHER',
}

export function parseCategory(raw: string): Result<ItemCategory> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(ItemCategory) as string[]).find((v) => v === normalized);
  return found ? ok(found as ItemCategory) : err(new DomainError('BILLING_ITEM_CATEGORY_INVALID', `Catégorie d'acte invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

/** Nombre de décimales de la plus petite unité de chaque devise (le franc CFA n'en a pas ; l'euro a des centimes). */
const MINOR_DIGITS: Readonly<Record<string, number>> = { XAF: 0, XOF: 0, GNF: 0, RWF: 0, EUR: 2, USD: 2, GBP: 2, MAD: 2, CHF: 2, TND: 3 };

/** Devise de l'installation (code ISO 4217). Les montants sont des entiers dans sa plus petite unité : jamais de nombre décimal. */
export class Currency extends ValueObject<string> {
  static create(raw: string): Result<Currency> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? ok(new Currency(normalized)) : err(new DomainError('BILLING_CURRENCY_INVALID', `Devise invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
  }

  /** Décimales d'affichage (0 pour le franc CFA). Une devise inconnue est traitée comme ayant 2 décimales. */
  get minorDigits(): number {
    return MINOR_DIGITS[this.value] ?? 2;
  }
}

export const MAX_AMOUNT = 1_000_000_000_000; // mille milliards d'unités : bien en deçà de la limite des entiers sûrs

/** Montant, entier non négatif dans la plus petite unité de la devise. */
export class Amount extends ValueObject<number> {
  static readonly ZERO = new Amount(0);

  static create(raw: number): Result<Amount> {
    return Number.isSafeInteger(raw) && raw >= 0 && raw <= MAX_AMOUNT ? ok(new Amount(raw)) : err(new DomainError('BILLING_AMOUNT_INVALID', `Le montant doit être un entier compris entre 0 et ${MAX_AMOUNT}.`, { max: MAX_AMOUNT }));
  }

  /** Montant d'un encaissement : strictement positif. */
  static positive(raw: number): Result<Amount> {
    const amount = Amount.create(raw);
    return amount.ok && amount.value.value > 0 ? amount : err(new DomainError('BILLING_AMOUNT_INVALID', `Le montant doit être un entier compris entre 1 et ${MAX_AMOUNT}.`, { max: MAX_AMOUNT }));
  }

  /** Reconstitution depuis la base (déjà validé). */
  static restore(value: number): Amount {
    return new Amount(value);
  }

  plus(other: Amount): Amount {
    return new Amount(this.value + other.value);
  }

  minus(other: Amount): Amount {
    return new Amount(Math.max(0, this.value - other.value));
  }
}

export const MAX_QUANTITY = 9999;

/** Quantité d'une ligne : entier de 1 à 9999. */
export class Quantity extends ValueObject<number> {
  static create(raw: number): Result<Quantity> {
    return Number.isInteger(raw) && raw >= 1 && raw <= MAX_QUANTITY ? ok(new Quantity(raw)) : err(new DomainError('BILLING_QUANTITY_INVALID', `La quantité doit être un entier compris entre 1 et ${MAX_QUANTITY}.`, { max: MAX_QUANTITY }));
  }

  static restore(value: number): Quantity {
    return new Quantity(value);
  }
}

/** Motif libre (remise, annulation, réimpression) : de 1 à 200 caractères. */
export class Reason extends ValueObject<string> {
  static create(raw: string): Result<Reason> {
    const normalized = (raw ?? '').trim();
    return normalized.length >= 1 && normalized.length <= 200 ? ok(new Reason(normalized)) : err(new DomainError('BILLING_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).'));
  }
}

/** Note libre d'une facture : facultative, 500 caractères au plus. */
export function parseNote(raw: string | null | undefined): Result<string | null> {
  if (raw === undefined || raw === null || raw.trim() === '') return ok(null);
  return raw.trim().length <= 500 ? ok(raw.trim()) : err(new DomainError('BILLING_NOTE_INVALID', 'La note ne doit pas dépasser 500 caractères.'));
}

export class InvoiceNumber extends ValueObject<string> {
  static create(raw: string): Result<InvoiceNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^FAC-\d{7,12}$/.test(normalized) ? ok(new InvoiceNumber(normalized)) : err(new DomainError('BILLING_INVOICE_NUMBER_INVALID', 'Numéro de facture invalide.'));
  }

  static fromSequence(n: number): Result<InvoiceNumber> {
    return InvoiceNumber.create(`FAC-${String(n).padStart(7, '0')}`);
  }
}

export class ReceiptNumber extends ValueObject<string> {
  static create(raw: string): Result<ReceiptNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^REC-\d{7,12}$/.test(normalized) ? ok(new ReceiptNumber(normalized)) : err(new DomainError('BILLING_RECEIPT_NUMBER_INVALID', 'Numéro de reçu invalide.'));
  }

  static fromSequence(n: number): Result<ReceiptNumber> {
    return ReceiptNumber.create(`REC-${String(n).padStart(7, '0')}`);
  }
}

export enum InvoiceStatus {
  /** En préparation : lignes et remise modifiables, rien n'est dû. */
  DRAFT = 'DRAFT',
  /** Émise : verrouillée, en attente de paiement. */
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export function parseInvoiceStatus(raw: string): Result<InvoiceStatus> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(InvoiceStatus) as string[]).find((v) => v === normalized);
  return found ? ok(found as InvoiceStatus) : err(new DomainError('BILLING_STATUS_FILTER_INVALID', `Statut de facture invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

export enum PaymentMode {
  CASH = 'CASH',
  CARD = 'CARD',
  MOBILE_MONEY = 'MOBILE_MONEY',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export function parsePaymentMode(raw: string): Result<PaymentMode> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(PaymentMode) as string[]).find((v) => v === normalized);
  return found ? ok(found as PaymentMode) : err(new DomainError('BILLING_PAYMENT_MODE_INVALID', `Mode de paiement invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

/** Référence d'un paiement (n° de transaction mobile, de chèque, de virement) : facultative, 64 caractères au plus. */
export function parsePaymentReference(raw: string | null | undefined): Result<string | null> {
  if (raw === undefined || raw === null || raw.trim() === '') return ok(null);
  return /^[\w .\/-]{1,64}$/.test(raw.trim()) ? ok(raw.trim()) : err(new DomainError('BILLING_PAYMENT_REFERENCE_INVALID', 'La référence du paiement doit comporter de 1 à 64 caractères (lettres, chiffres, espaces, « . », « / », « - »).'));
}

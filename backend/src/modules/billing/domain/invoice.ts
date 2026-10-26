import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import {
  Amount, Currency, InvoiceId, InvoiceNumber, InvoiceStatus, ItemCode, ItemId, ItemName, LineId, PatientRef, PaymentId, PaymentMode, Quantity, Reason, ReceiptNumber,
} from './values';

/** Ligne de facture : une copie de l'acte au moment de la facturation (code, libellé, prix). Elle ne suit pas les évolutions du catalogue. */
export interface InvoiceLine {
  readonly id: LineId;
  readonly itemId: ItemId;
  readonly itemCode: ItemCode;
  readonly itemName: ItemName;
  readonly unitPrice: Amount;
  readonly quantity: Quantity;
}

export const lineTotal = (line: InvoiceLine): Amount => Amount.restore(line.unitPrice.value * line.quantity.value);

/** Encaissement : écrit une fois, jamais modifié ni supprimé (une erreur se corrige par un avoir, pas par une retouche). */
export interface Payment {
  readonly id: PaymentId;
  readonly receiptNumber: ReceiptNumber;
  readonly mode: PaymentMode;
  readonly amount: Amount;
  readonly reference: string | null;
  readonly receivedBy: string;
  readonly receivedAt: Instant;
  /** Session de caisse pendant laquelle l'argent a été perçu ; absente des encaissements antérieurs aux sessions de caisse. */
  readonly sessionId: string | null;
}

export interface InvoiceState {
  readonly id: InvoiceId;
  readonly number: InvoiceNumber;
  readonly patientId: PatientRef;
  readonly currency: Currency;
  readonly status: InvoiceStatus;
  readonly lines: readonly InvoiceLine[];
  readonly discount: Amount;
  readonly discountReason: Reason | null;
  readonly note: string | null;
  readonly cancellationReason: Reason | null;
  readonly payments: readonly Payment[];
  readonly createdBy: string;
  readonly issuedAt: Instant | null;
  /** Compteur de modifications : deux caissiers qui modifient la même facture ne s'écrasent pas (le second est refusé). */
  readonly version: number;
}

const NOT_DRAFT = (status: InvoiceStatus) => new DomainError('BILLING_INVOICE_NOT_DRAFT', 'Cette facture est émise : ses lignes et sa remise ne peuvent plus être modifiées.', { status });

/** Statut d'une facture émise d'après ce qui a été payé. */
export function statusFor(total: Amount, paid: Amount): InvoiceStatus {
  if (paid.value <= 0) return InvoiceStatus.ISSUED;
  return paid.value >= total.value ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
}

/**
 * Facture d'un patient. Elle se prépare en `DRAFT` (lignes, remise), puis s'émet : dès lors elle est verrouillée et se règle par
 * un ou plusieurs encaissements (`PARTIALLY_PAID` puis `PAID`). Une facture sans encaissement peut être annulée avec un motif ; une
 * facture payée ne s'annule pas (il faudra la rembourser). Rien n'est supprimé.
 */
export class Invoice {
  private constructor(private current: InvoiceState) {}

  static restore(state: InvoiceState): Invoice {
    return new Invoice(state);
  }

  static draft(state: Pick<InvoiceState, 'id' | 'number' | 'patientId' | 'currency' | 'note' | 'createdBy'>): Invoice {
    return new Invoice({
      ...state, status: InvoiceStatus.DRAFT, lines: [], discount: Amount.ZERO, discountReason: null, cancellationReason: null, payments: [], issuedAt: null, version: 0,
    });
  }

  get state(): InvoiceState { return this.current; }
  get id(): InvoiceId { return this.current.id; }
  get status(): InvoiceStatus { return this.current.status; }

  get subtotal(): Amount {
    return this.current.lines.reduce((sum, line) => sum.plus(lineTotal(line)), Amount.ZERO);
  }

  /** À payer : le sous-total moins la remise. */
  get total(): Amount {
    return this.subtotal.minus(this.current.discount);
  }

  get paid(): Amount {
    return this.current.payments.reduce((sum, p) => sum.plus(p.amount), Amount.ZERO);
  }

  get balance(): Amount {
    return this.total.minus(this.paid);
  }

  addLine(line: InvoiceLine): Result<void> {
    if (this.current.status !== InvoiceStatus.DRAFT) return err(NOT_DRAFT(this.current.status));
    this.current = { ...this.current, lines: [...this.current.lines, line] };
    return ok(undefined);
  }

  removeLine(lineId: LineId): Result<void> {
    if (this.current.status !== InvoiceStatus.DRAFT) return err(NOT_DRAFT(this.current.status));
    if (!this.current.lines.some((l) => l.id.equals(lineId))) return err(new DomainError('BILLING_LINE_NOT_FOUND', 'Ligne de facture introuvable.'));
    const lines = this.current.lines.filter((l) => !l.id.equals(lineId));
    const subtotal = lines.reduce((sum, l) => sum.plus(lineTotal(l)), Amount.ZERO);
    // Retirer une ligne ne doit pas laisser une remise supérieure à ce qui reste à facturer : on l'efface alors (le caissier la ressaisit).
    const discountStillValid = this.current.discount.value <= subtotal.value;
    this.current = {
      ...this.current, lines, discount: discountStillValid ? this.current.discount : Amount.ZERO, discountReason: discountStillValid ? this.current.discountReason : null,
    };
    return ok(undefined);
  }

  /** Remise sur toute la facture. Un montant nul retire la remise ; sinon un motif est obligatoire. */
  setDiscount(amount: Amount, reason: Reason | null): Result<void> {
    if (this.current.status !== InvoiceStatus.DRAFT) return err(NOT_DRAFT(this.current.status));
    if (amount.value === 0) {
      this.current = { ...this.current, discount: Amount.ZERO, discountReason: null };
      return ok(undefined);
    }
    if (!reason) return err(new DomainError('BILLING_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).'));
    if (amount.value > this.subtotal.value) {
      return err(new DomainError('BILLING_DISCOUNT_TOO_HIGH', 'La remise ne peut pas dépasser le total de la facture.', { subtotal: this.subtotal.value }));
    }
    this.current = { ...this.current, discount: amount, discountReason: reason };
    return ok(undefined);
  }

  /** Émet la facture : verrouille les lignes. Une facture vide, ou dont le total est nul, n'a rien à régler et ne s'émet pas. */
  issue(now: Instant): Result<void> {
    if (this.current.status !== InvoiceStatus.DRAFT) return err(NOT_DRAFT(this.current.status));
    if (this.current.lines.length === 0) return err(new DomainError('BILLING_INVOICE_EMPTY', 'Une facture sans ligne ne peut pas être émise.'));
    if (this.total.value === 0) return err(new DomainError('BILLING_INVOICE_EMPTY', 'Le total de la facture est nul : il n\'y a rien à régler.'));
    this.current = { ...this.current, status: InvoiceStatus.ISSUED, issuedAt: now };
    return ok(undefined);
  }

  /** Une facture se paie seulement quand elle est émise et qu'il reste un solde. */
  canBePaid(): Result<void> {
    const status = this.current.status;
    if (status === InvoiceStatus.PAID) return err(new DomainError('BILLING_INVOICE_NOT_PAYABLE', 'Cette facture est déjà entièrement payée.', { status }));
    if (status !== InvoiceStatus.ISSUED && status !== InvoiceStatus.PARTIALLY_PAID) {
      return err(new DomainError('BILLING_INVOICE_NOT_PAYABLE', status === InvoiceStatus.DRAFT ? "Cette facture n'est pas encore émise : émettez-la avant d'encaisser." : 'Cette facture est annulée : on ne peut plus l\'encaisser.', { status }));
    }
    return ok(undefined);
  }

  /** Enregistre un encaissement. Le montant ne peut pas dépasser le solde : on ne perçoit jamais plus que ce qui est dû. */
  collect(payment: Payment): Result<void> {
    const payable = this.canBePaid();
    if (!payable.ok) return payable;
    if (payment.amount.value > this.balance.value) {
      return err(new DomainError('BILLING_OVERPAYMENT', 'Le montant dépasse le solde de la facture.', { balance: this.balance.value }));
    }
    const payments = [...this.current.payments, payment];
    const paid = payments.reduce((sum, p) => sum.plus(p.amount), Amount.ZERO);
    this.current = { ...this.current, payments, status: statusFor(this.total, paid) };
    return ok(undefined);
  }

  /** Annule une facture non encaissée, avec un motif. Une facture déjà payée (même en partie) demande d'abord un remboursement. */
  cancel(reason: Reason): Result<void> {
    const status = this.current.status;
    if (status === InvoiceStatus.CANCELLED) return err(new DomainError('BILLING_INVOICE_ALREADY_CANCELLED', 'Cette facture est déjà annulée.'));
    if (this.current.payments.length > 0) return err(new DomainError('BILLING_INVOICE_HAS_PAYMENTS', 'Cette facture a des encaissements : elle ne peut pas être annulée (un remboursement est nécessaire).', { paid: this.paid.value }));
    this.current = { ...this.current, status: InvoiceStatus.CANCELLED, cancellationReason: reason };
    return ok(undefined);
  }
}

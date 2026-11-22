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

/** Prise en charge par un assureur (tiers payant) : sa part, en pourcentage de ce qui reste après remise, est réglée par lui ; le patient ne règle que le reste. */
export interface Coverage {
  readonly payerId: string;
  /** De 1 à 100. */
  readonly percent: number;
  readonly policyNumber: string | null;
}

/** Règlement de la part de l'assureur : qui l'a constaté, quand, avec quelle référence (virement, bordereau). */
export interface Settlement {
  readonly at: Instant;
  readonly by: string;
  readonly reference: string;
}

export interface InvoiceState {
  readonly id: InvoiceId;
  readonly number: InvoiceNumber;
  readonly patientId: PatientRef;
  /** L'admission que cette facture règle, quand il y en a une. */
  readonly admissionId: string | null;
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
  /** Prise en charge par un assureur, quand il y en a une. */
  readonly coverage: Coverage | null;
  /** Règlement de la part de l'assureur, une fois constaté. */
  readonly settlement: Settlement | null;
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

  static restore(state: Omit<InvoiceState, 'coverage' | 'settlement'> & { readonly coverage?: Coverage | null; readonly settlement?: Settlement | null }): Invoice {
    return new Invoice({ ...state, coverage: state.coverage ?? null, settlement: state.settlement ?? null });
  }

  static draft(state: Pick<InvoiceState, 'id' | 'number' | 'patientId' | 'currency' | 'note' | 'createdBy'> & { readonly admissionId?: string | null }): Invoice {
    return new Invoice({
      ...state, admissionId: state.admissionId ?? null, status: InvoiceStatus.DRAFT, lines: [], discount: Amount.ZERO, discountReason: null, cancellationReason: null, payments: [], issuedAt: null, coverage: null, settlement: null, version: 0,
    });
  }

  get state(): InvoiceState { return this.current; }
  get id(): InvoiceId { return this.current.id; }
  get status(): InvoiceStatus { return this.current.status; }

  get subtotal(): Amount {
    return this.current.lines.reduce((sum, line) => sum.plus(lineTotal(line)), Amount.ZERO);
  }

  /** Le sous-total moins la remise : ce que coûtent les soins, avant la part de l'assureur. */
  get grossTotal(): Amount {
    return this.subtotal.minus(this.current.discount);
  }

  /** La part de l'assureur : son pourcentage de ce qui reste après remise (arrondi à l'entier le plus proche). */
  get coverageAmount(): Amount {
    const coverage = this.current.coverage;
    return coverage ? Amount.restore(Math.round((this.grossTotal.value * coverage.percent) / 100)) : Amount.ZERO;
  }

  /** À payer PAR LE PATIENT : ce qui reste après la remise et la part de l'assureur. */
  get total(): Amount {
    return this.grossTotal.minus(this.coverageAmount);
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

  /** Applique une prise en charge à un brouillon (elle remplace la précédente). Sa part se recalcule si les lignes ou la remise changent, jusqu'à l'émission. */
  applyCoverage(coverage: Coverage): Result<void> {
    if (this.current.status !== InvoiceStatus.DRAFT) return err(NOT_DRAFT(this.current.status));
    if (!Number.isInteger(coverage.percent) || coverage.percent < 1 || coverage.percent > 100) return err(new DomainError('BILLING_COVERAGE_PERCENT_INVALID', 'Le pourcentage pris en charge doit être un entier de 1 à 100.'));
    this.current = { ...this.current, coverage };
    return ok(undefined);
  }

  removeCoverage(): Result<void> {
    if (this.current.status !== InvoiceStatus.DRAFT) return err(NOT_DRAFT(this.current.status));
    this.current = { ...this.current, coverage: null };
    return ok(undefined);
  }

  /** Constate que l'assureur a réglé sa part. Une seule fois, sur une facture émise dont l'assureur doit quelque chose. */
  settle(settlement: Settlement): Result<void> {
    const status = this.current.status;
    if (status === InvoiceStatus.DRAFT || status === InvoiceStatus.CANCELLED) return err(new DomainError('BILLING_SETTLEMENT_NOT_ALLOWED', "Seule une facture émise peut avoir sa part d'assureur réglée.", { status }));
    if (!this.current.coverage || this.coverageAmount.value === 0) return err(new DomainError('BILLING_NO_PAYER_SHARE', "Cette facture n'a pas de part d'assureur à régler."));
    if (this.current.settlement) return err(new DomainError('BILLING_ALREADY_SETTLED', "La part de l'assureur est déjà réglée."));
    this.current = { ...this.current, settlement };
    return ok(undefined);
  }

  /** Émet la facture : verrouille les lignes. Une facture vide ne s'émet pas ; une facture entièrement prise en charge s'émet déjà soldée pour le patient. */
  issue(now: Instant): Result<void> {
    if (this.current.status !== InvoiceStatus.DRAFT) return err(NOT_DRAFT(this.current.status));
    if (this.current.lines.length === 0) return err(new DomainError('BILLING_INVOICE_EMPTY', 'Une facture sans ligne ne peut pas être émise.'));
    if (this.grossTotal.value === 0) return err(new DomainError('BILLING_INVOICE_EMPTY', 'Le total de la facture est nul : il n\'y a rien à régler.'));
    // Prise en charge à 100 % : le patient ne doit rien, la facture naît soldée (la créance de l'assureur se suit à part).
    this.current = { ...this.current, status: this.total.value === 0 ? InvoiceStatus.PAID : InvoiceStatus.ISSUED, issuedAt: now };
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
    if (this.current.settlement) return err(new DomainError('BILLING_INVOICE_PAYER_SETTLED', "L'assureur a déjà réglé sa part : cette facture ne peut plus être annulée."));
    if (this.current.payments.length > 0) return err(new DomainError('BILLING_INVOICE_HAS_PAYMENTS', 'Cette facture a des encaissements : elle ne peut pas être annulée (un remboursement est nécessaire).', { paid: this.paid.value }));
    this.current = { ...this.current, status: InvoiceStatus.CANCELLED, cancellationReason: reason };
    return ok(undefined);
  }
}

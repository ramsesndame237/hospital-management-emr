import { Instant } from '../../../shared-kernel/temporal';
import { BillableItem } from './item';
import { Invoice, Payment } from './invoice';
import { InvoiceNumber, InvoiceId, InvoiceStatus, ItemCategory, ItemCode, ItemId, PatientRef, PaymentId, ReceiptNumber, ServiceRef } from './values';

export interface ItemFilter {
  /** Texte cherché dans le code et le libellé (insensible à la casse). */
  readonly search?: string;
  readonly category?: ItemCategory;
  readonly serviceId?: ServiceRef;
  readonly includeInactive: boolean;
}

export interface ItemRepository {
  findById(id: ItemId): Promise<BillableItem | null>;
  findByCode(code: ItemCode): Promise<BillableItem | null>;
  /** Refuse (`false`) un code déjà pris ; la vérification et l'écriture se font ensemble (index unique). */
  insert(item: BillableItem): Promise<boolean>;
  update(item: BillableItem): Promise<void>;
  list(filter: ItemFilter, offset: number, limit: number): Promise<{ items: BillableItem[]; total: number }>;
}

/** Une facture dans une liste : ses totaux, sans ses lignes. */
export interface InvoiceSummary {
  readonly id: string;
  readonly number: string;
  readonly patientId: string;
  readonly status: InvoiceStatus;
  readonly currency: string;
  readonly subtotal: number;
  readonly discount: number;
  readonly total: number;
  readonly paid: number;
  readonly issuedAt: Instant | null;
  readonly createdAt: Instant;
}

export interface InvoiceFilter {
  readonly patientId?: PatientRef;
  readonly status?: InvoiceStatus;
  readonly number?: InvoiceNumber;
  /** Bornes sur la date de création : début inclus, fin exclue. */
  readonly from?: string;
  readonly to?: string;
}

/** Résultat d'une écriture sous verrou : refusée parce que la facture a changé entre-temps, ou parce que le paiement la dépasserait. */
export type SaveOutcome = 'SAVED' | 'CHANGED' | 'OVERPAYMENT';

export interface InvoiceRepository {
  nextInvoiceNumber(): Promise<InvoiceNumber>;
  nextReceiptNumber(): Promise<ReceiptNumber>;
  findById(id: InvoiceId): Promise<Invoice | null>;
  findByPayment(paymentId: PaymentId): Promise<{ invoice: Invoice; payment: Payment } | null>;
  /** Crée la facture (brouillon). */
  insert(invoice: Invoice): Promise<void>;
  /**
   * Enregistre une modification de la facture (lignes, remise, émission, annulation). Refusée (`CHANGED`) si quelqu'un l'a modifiée
   * depuis sa lecture : la comparaison de version et l'écriture se font ensemble.
   */
  save(invoice: Invoice): Promise<SaveOutcome>;
  /**
   * Enregistre un encaissement. Sous verrou, le total déjà encaissé est relu : si le nouveau paiement le dépasserait (deux caisses qui
   * encaissent en même temps), rien n'est écrit (`OVERPAYMENT`). Met le statut de la facture à jour.
   */
  addPayment(invoice: Invoice, payment: Payment): Promise<SaveOutcome>;
  list(filter: InvoiceFilter, offset: number, limit: number): Promise<{ items: InvoiceSummary[]; total: number }>;
}

export interface PatientInfo {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
}

/** Les patients appartiennent au module Patients : la racine de composition branche ce port dessus. */
export interface PatientDirectory {
  find(ids: readonly string[]): Promise<Map<string, PatientInfo>>;
}

export interface ServiceInfo {
  readonly id: string;
  readonly active: boolean;
}

/** La structure appartient au module Administration : la racine de composition branche ce port dessus. Seuls les services nous intéressent. */
export interface ServiceDirectory {
  find(id: ServiceRef): Promise<ServiceInfo | null>;
}

export const ITEM_REPOSITORY = Symbol('BILLING_ITEM_REPOSITORY');
export const INVOICE_REPOSITORY = Symbol('BILLING_INVOICE_REPOSITORY');
export const BILLING_PATIENTS = Symbol('BILLING_PATIENTS');
export const BILLING_SERVICES = Symbol('BILLING_SERVICES');
export const BILLING_CURRENCY = Symbol('BILLING_CURRENCY');

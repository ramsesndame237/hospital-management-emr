import { Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { BillableItem } from './item';
import { CashSession, SessionId, SessionNumber, SessionStatus, Takings } from './cash-session';
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
export type SaveOutcome = 'SAVED' | 'CHANGED' | 'OVERPAYMENT' | 'SESSION_CLOSED';

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

/** Une session avec ce qui y a été encaissé (relu à chaque lecture : jamais mis en cache). */
export interface SessionRecord {
  readonly session: CashSession;
  readonly takings: Takings;
  readonly paymentCount: number;
}

export interface SessionPayment {
  readonly id: string;
  readonly receiptNumber: string;
  readonly invoiceNumber: string;
  readonly mode: string;
  readonly amount: number;
  readonly receivedAt: Instant;
}

export interface SessionFilter {
  readonly cashierId?: string;
  readonly status?: SessionStatus;
}

export type OpenOutcome = 'OPENED' | 'CASHIER_BUSY' | 'COUNTER_BUSY';

export interface CashSessionRepository {
  nextSessionNumber(): Promise<SessionNumber>;
  findById(id: SessionId): Promise<SessionRecord | null>;
  /** La session ouverte d'un caissier (il n'en a qu'une). */
  findOpenByCashier(cashierId: string): Promise<SessionRecord | null>;
  /** Ouvre la session, sauf si le caissier en a déjà une ouverte ou si le poste est déjà tenu : la vérification et l'écriture se font sous verrou. */
  open(session: CashSession): Promise<OpenOutcome>;
  /**
   * Modifie une session sous verrou (clôture, contre-signature) : les encaissements sont relus dans la même transaction et ne peuvent plus
   * arriver pendant la clôture. `mutate` applique la règle du domaine ; rien n'est écrit si elle refuse. `null` : session introuvable.
   */
  mutate(id: SessionId, mutate: (record: SessionRecord) => Result<void>): Promise<Result<SessionRecord> | null>;
  list(filter: SessionFilter, offset: number, limit: number): Promise<{ items: SessionRecord[]; total: number }>;
  payments(sessionId: SessionId): Promise<SessionPayment[]>;
}

/** Les comptes appartiennent à l'IAM : la racine de composition branche ce port dessus (nom du caissier, du responsable). */
export interface UserDirectory {
  find(ids: readonly string[]): Promise<Map<string, { readonly id: string; readonly username: string }>>;
}

export const CASH_SESSION_REPOSITORY = Symbol('BILLING_CASH_SESSION_REPOSITORY');
export const BILLING_USERS = Symbol('BILLING_USERS');
/** Écart de caisse (plus petite unité de la devise) au-delà duquel la clôture attend la contre-signature d'un responsable. */
export const BILLING_VARIANCE_LIMIT = Symbol('BILLING_VARIANCE_LIMIT');
export const ITEM_REPOSITORY = Symbol('BILLING_ITEM_REPOSITORY');
export const INVOICE_REPOSITORY = Symbol('BILLING_INVOICE_REPOSITORY');
export const BILLING_PATIENTS = Symbol('BILLING_PATIENTS');
export const BILLING_SERVICES = Symbol('BILLING_SERVICES');
export const BILLING_CURRENCY = Symbol('BILLING_CURRENCY');

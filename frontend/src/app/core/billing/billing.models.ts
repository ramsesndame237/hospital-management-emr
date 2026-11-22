import type { ApprovalSummary } from './approval.models';

/** Statuts d'une facture : le code est stable, l'interface le traduit (`billing.status.<CODE>`). */
export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_MODES = ['CASH', 'CARD', 'MOBILE_MONEY', 'CHEQUE', 'BANK_TRANSFER'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const ITEM_CATEGORIES = ['CONSULTATION', 'LABORATORY', 'RADIOLOGY', 'PHARMACY', 'PROCEDURE', 'HOSPITALIZATION', 'OTHER'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** Le patient tel qu'une facture le résume : identité seulement, jamais de donnée clinique. */
export interface BilledPatient {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
}

/**
 * Tous les montants sont des ENTIERS dans la plus petite unité de la devise de l'installation (le franc CFA n'a pas de centimes :
 * 5000 = 5 000 FCFA). Jamais de nombre décimal pour de l'argent.
 */
export interface InvoiceLine {
  readonly id: string;
  readonly itemId: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly total: number;
}

export interface Payment {
  readonly id: string;
  readonly receiptNumber: string;
  readonly mode: PaymentMode;
  readonly amount: number;
  readonly reference: string | null;
  readonly receivedAt: string;
}

/** La prise en charge d'un assureur (tiers payant) sur une facture. */
export interface InvoiceCoverage {
  readonly payerId: string;
  readonly payerName: string | null;
  readonly policyNumber: string | null;
  readonly percent: number;
  /** La part de l'assureur, entier dans la plus petite unité de la devise. */
  readonly amount: number;
  readonly settledAt: string | null;
  readonly settlementReference: string | null;
}

export interface Invoice {
  readonly id: string;
  readonly number: string;
  readonly status: InvoiceStatus;
  readonly currency: string;
  /** Décimales de la plus petite unité de la devise (0 pour le franc CFA). */
  readonly currencyDigits: number;
  readonly patient: BilledPatient | null;
  /** L'admission que cette facture règle. */
  readonly admissionId: string | null;
  readonly lines: readonly InvoiceLine[];
  readonly subtotal: number;
  readonly discount: number;
  readonly discountReason: string | null;
  /** Sous-total moins remise : ce que coûtent les soins avant la part de l'assureur. */
  readonly grossTotal: number;
  readonly coverage: InvoiceCoverage | null;
  /** À payer PAR LE PATIENT (après remise et part de l'assureur). */
  readonly total: number;
  readonly paid: number;
  readonly balance: number;
  readonly note: string | null;
  readonly cancellationReason: string | null;
  readonly issuedAt: string | null;
  readonly payments: readonly Payment[];
  /** Demandes d'approbation de la facture (remise, annulation), la plus récente en premier. */
  readonly approvals: readonly ApprovalSummary[];
  /** Remise (en % du sous-total) au-delà de laquelle un responsable doit l'approuver : en deçà, elle s'applique directement. */
  readonly discountApprovalPercent: number;
}

/** Une facture dans une liste : ses totaux, sans ses lignes. */
export interface InvoiceSummary {
  readonly id: string;
  readonly number: string;
  readonly status: InvoiceStatus;
  readonly currency: string;
  readonly patient: BilledPatient | null;
  readonly subtotal: number;
  readonly discount: number;
  /** La part de l'assureur (0 sans prise en charge). */
  readonly payerShare: number;
  readonly total: number;
  readonly paid: number;
  readonly balance: number;
  readonly issuedAt: string | null;
  readonly createdAt: string;
}

export interface InvoiceFilter {
  readonly number?: string;
  readonly status?: InvoiceStatus;
  readonly patientId?: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface CollectInput {
  readonly mode: PaymentMode;
  readonly amount: number;
  readonly reference?: string;
  /** Espèces remises par le patient (seulement pour `CASH`) : sert à calculer la monnaie. */
  readonly tendered?: number;
}

export interface CollectedPayment {
  readonly payment: Payment;
  /** Monnaie à rendre ; 0 hors espèces. */
  readonly change: number;
  readonly invoice: Invoice;
}

/** Données d'un reçu réimprimé : une copie, à marquer « DUPLICATA ». */
export interface Receipt {
  readonly receiptNumber: string;
  readonly invoiceNumber: string;
  readonly patient: BilledPatient | null;
  readonly mode: PaymentMode;
  readonly amount: number;
  readonly currency: string;
  readonly currencyDigits: number;
  readonly reference: string | null;
  readonly receivedAt: string;
  readonly duplicate: true;
  readonly invoiceBalance: number;
}

export interface BillableItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: ItemCategory;
  readonly unitPrice: number;
  readonly currency: string;
  readonly serviceId: string | null;
  /** Code de l'analyse, de l'examen d'imagerie ou du médicament que cet acte tarifie (catégories laboratoire, radiologie, pharmacie). */
  readonly sourceCode: string | null;
  readonly active: boolean;
}

/** Catégories dont un acte peut tarifier une analyse, un examen ou un médicament. */
export const SOURCE_CATEGORIES: readonly ItemCategory[] = ['LABORATORY', 'RADIOLOGY', 'PHARMACY'];

export interface ItemInput {
  readonly code: string;
  readonly name: string;
  readonly category: ItemCategory;
  /** Plus petite unité de la devise (entier). */
  readonly unitPrice: number;
  readonly sourceCode?: string;
}

/** `null` retire le code source ; une clé absente ne change rien. */
export interface ItemChanges {
  readonly name?: string;
  readonly category?: ItemCategory;
  readonly unitPrice?: number;
  readonly sourceCode?: string | null;
}

export const SOURCE_TYPES = ['LAB_REQUISITION', 'IMAGING_ORDER', 'DISPENSATION'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export interface BillableLine {
  readonly code: string;
  readonly label: string;
  readonly quantity: number;
  /** Acte du catalogue qui tarifie la ligne ; `null` : aucun prix configuré. */
  readonly itemName: string | null;
  readonly unitPrice: number | null;
}

/** Ce qui a été fait (demande d'analyses, examen réalisé, délivrance) et n'a pas encore de facture. */
export interface Billable {
  readonly type: SourceType;
  readonly id: string;
  readonly reference: string;
  readonly patient: { readonly id: string; readonly number: string; readonly lastName: string; readonly firstName: string } | null;
  readonly occurredAt: string;
  readonly lines: readonly BillableLine[];
  /** Codes sans acte du catalogue : la facture est refusée tant qu'ils ne sont pas tarifés. */
  readonly unpriced: readonly string[];
  readonly total: number | null;
}

/** Une page de choses à facturer, avec la devise de l'installation (les prix sont des entiers dans sa plus petite unité). */
export interface BillablePage extends Page<Billable> {
  readonly currency: string;
}

export interface ItemFilter {
  readonly search?: string;
  readonly category?: ItemCategory;
}

/** Une facture se modifie (lignes, remise) tant qu'elle est un brouillon. */
export const isDraft = (invoice: Pick<Invoice, 'status'>): boolean => invoice.status === 'DRAFT';

/** Une facture se règle quand elle est émise (ou partiellement payée) et qu'il reste un solde. */
export const isPayable = (invoice: Pick<Invoice, 'status' | 'balance'>): boolean =>
  (invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID') && invoice.balance > 0;

/** Une facture sans encaissement peut être annulée (brouillon ou émise). */
export const isCancellable = (invoice: Pick<Invoice, 'status' | 'payments'>): boolean =>
  (invoice.status === 'DRAFT' || invoice.status === 'ISSUED') && invoice.payments.length === 0;

export interface Payer {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
}

/** Couverture d'un patient : son assureur, son numéro d'assuré, le pourcentage pris en charge et sa validité. */
export interface PatientCoverage {
  readonly id: string;
  readonly patientId: string;
  readonly payer: { readonly id: string; readonly code: string; readonly name: string } | null;
  readonly policyNumber: string;
  readonly percent: number;
  readonly validFrom: string;
  readonly validUntil: string | null;
  /** Peut s'appliquer aujourd'hui : active, commencée, pas expirée. */
  readonly validToday: boolean;
}

export interface CoverageInput {
  readonly payerId: string;
  readonly policyNumber: string;
  readonly percent: number;
  readonly validFrom?: string;
  readonly validUntil?: string;
}

/** Créance d'assureur : la part d'une facture émise qu'il doit régler. */
export interface Claim {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly patient: BilledPatient | null;
  readonly payerId: string;
  readonly payerName: string;
  readonly policyNumber: string | null;
  readonly percent: number;
  readonly amount: number;
  readonly issuedAt: string;
  readonly settledAt: string | null;
  readonly settlementReference: string | null;
}

export interface ClaimFilter {
  readonly payerId?: string;
  /** `false` : à recouvrer ; `true` : réglées ; absent : toutes. */
  readonly settled?: boolean;
}

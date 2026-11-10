/** Les codes sont stables, l'interface les traduit (`pharmacy.form.<CODE>`, `pharmacy.schedule.<CODE>`…). */
export const FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'INFUSION', 'CREAM', 'OINTMENT', 'DROPS', 'INHALER', 'SUPPOSITORY', 'POWDER', 'PATCH', 'OTHER'] as const;
export type DrugForm = (typeof FORMS)[number];

/** `OTC` : vente libre ; `PRESCRIPTION` : sur ordonnance ; `CONTROLLED` : substance contrôlée. */
export const SCHEDULES = ['OTC', 'PRESCRIPTION', 'CONTROLLED'] as const;
export type Schedule = (typeof SCHEDULES)[number];

export const STORAGES = ['ROOM', 'COOL', 'COLD_CHAIN'] as const;
export type Storage = (typeof STORAGES)[number];

export const LEVELS = ['OK', 'LOW', 'OUT'] as const;
export type StockLevel = (typeof LEVELS)[number];

export const DIRECTIONS = ['IN', 'OUT'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const ADJUSTMENT_REASONS = ['COUNT_CORRECTION', 'DAMAGED', 'EXPIRED', 'LOST', 'FOUND', 'OTHER'] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** Motifs admis selon le sens (les mêmes règles que l'API) : on ne « casse » pas du stock en entrée, on n'en « retrouve » pas en sortie. */
export const REASONS_BY_DIRECTION: Readonly<Record<Direction, readonly AdjustmentReason[]>> = {
  IN: ['COUNT_CORRECTION', 'FOUND', 'OTHER'],
  OUT: ['COUNT_CORRECTION', 'DAMAGED', 'EXPIRED', 'LOST', 'OTHER'],
};

export const ADJUSTMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number];

export type MovementType = 'RECEIPT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface UserRef {
  readonly id: string;
  readonly username: string;
}

export interface Drug {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength: string | null;
  readonly form: DrugForm;
  readonly schedule: Schedule;
  readonly storage: Storage;
  readonly atcCode: string | null;
  readonly unit: string;
  /** Prix d'une unité, entier dans la plus petite unité de `currency`. */
  readonly unitPrice: number;
  readonly currency: string;
  readonly reorderLevel: number;
  readonly notes: string | null;
  readonly active: boolean;
}

export interface DrugPage extends Page<Drug> {
  readonly currency: string;
}

export interface DrugFilter {
  readonly search?: string;
  readonly form?: DrugForm;
  readonly schedule?: Schedule;
  readonly includeInactive?: boolean;
}

export interface DrugInput {
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength?: string | null;
  readonly form: DrugForm;
  readonly schedule: Schedule;
  readonly storage?: Storage;
  readonly atcCode?: string | null;
  readonly unit: string;
  readonly unitPrice?: number;
  readonly reorderLevel?: number;
  readonly notes?: string | null;
}

/** Champs modifiables : le code ne change jamais ; `null` efface le dosage, le code ATC ou les remarques. */
export type DrugChanges = Partial<Omit<DrugInput, 'code'>>;

export interface DrugSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength: string | null;
  readonly unit: string;
}

export interface StockRow {
  readonly drugId: string;
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength: string | null;
  readonly form: DrugForm;
  readonly schedule: Schedule;
  readonly unit: string;
  readonly active: boolean;
  readonly reorderLevel: number;
  /** Lots non périmés et hors quarantaine. */
  readonly dispensable: number;
  readonly quarantined: number;
  /** Périmé mais encore en rayon : à retirer. */
  readonly expired: number;
  readonly expiringSoon: number;
  readonly nextExpiry: string | null;
  readonly level: StockLevel;
  readonly value: number;
}

export interface StockPage extends Page<StockRow> {
  readonly expiryAlertDays: number;
  readonly currency: string;
}

export interface StockFilter {
  readonly search?: string;
  readonly level?: StockLevel;
  readonly expiring?: boolean;
  readonly hasExpired?: boolean;
  readonly includeInactive?: boolean;
}

export interface StockSummary {
  readonly drugs: number;
  readonly out: number;
  readonly low: number;
  readonly expiring: number;
  readonly expired: number;
  readonly quarantinedBatches: number;
  readonly pendingAdjustments: number;
  readonly value: number;
  readonly expiryAlertDays: number;
  readonly currency: string;
}

export interface Batch {
  readonly id: string;
  readonly drugId: string;
  readonly batchNumber: string;
  readonly expiry: string;
  /** Négatif : périmé depuis. */
  readonly daysToExpiry: number;
  readonly quantity: number;
  readonly unitCost: number;
  readonly status: 'AVAILABLE' | 'QUARANTINED';
  readonly expired: boolean;
  readonly expiringSoon: boolean;
  readonly dispensable: boolean;
  readonly quarantineReason: string | null;
  readonly quarantinedBy: UserRef | null;
  readonly quarantinedAt: string | null;
  readonly receivedAt: string;
}

export interface DrugStock {
  readonly drug: Drug;
  readonly dispensable: number;
  readonly quarantined: number;
  readonly expired: number;
  readonly expiringSoon: number;
  readonly nextExpiry: string | null;
  readonly level: StockLevel;
  readonly value: number;
  readonly expiryAlertDays: number;
  readonly currency: string;
  readonly batches: readonly Batch[];
}

export interface ExpiryRow extends Batch {
  readonly drug: DrugSummary;
}

export interface ExpiryPage extends Page<ExpiryRow> {
  readonly expiryAlertDays: number;
  readonly currency: string;
}

export interface ExpiryFilter {
  readonly days?: number;
  readonly quarantinedOnly?: boolean;
}

export interface Movement {
  readonly id: string;
  readonly drugId: string;
  readonly batchId: string;
  readonly batchNumber: string;
  readonly type: MovementType;
  /** Signé : positif pour une entrée, négatif pour une sortie. */
  readonly delta: number;
  readonly balance: number;
  readonly reason: string | null;
  readonly reference: string | null;
  readonly by: UserRef | null;
  readonly at: string;
}

export interface MovementFilter {
  readonly drugId?: string;
  readonly batchId?: string;
}

export interface ReceiptLine {
  readonly drug: DrugSummary | null;
  readonly batchId: string;
  readonly batchNumber: string;
  readonly expiry: string;
  readonly quantity: number;
  readonly unitCost: number;
  readonly value: number;
}

export interface Receipt {
  readonly id: string;
  readonly number: string;
  readonly supplier: string;
  readonly deliveryNote: string | null;
  readonly notes: string | null;
  readonly receivedBy: UserRef | null;
  readonly receivedAt: string;
  /** Bon de commande auquel la livraison s'impute. */
  readonly order: { readonly id: string; readonly number: string } | null;
  readonly units: number;
  readonly value: number;
  readonly currency: string;
  readonly lines: readonly ReceiptLine[];
}

export interface ReceiptSummary {
  readonly id: string;
  readonly number: string;
  readonly supplier: string;
  readonly deliveryNote: string | null;
  readonly receivedBy: UserRef | null;
  readonly receivedAt: string;
  readonly orderNumber: string | null;
  readonly lines: number;
  readonly units: number;
  readonly value: number;
}

export interface ReceiptPage extends Page<ReceiptSummary> {
  readonly currency: string;
}

export interface ReceiptFilter {
  readonly supplier?: string;
  readonly drugId?: string;
}

export interface ReceiptLineInput {
  readonly drugId: string;
  readonly batchNumber: string;
  readonly expiry: string;
  readonly quantity: number;
  readonly unitCost?: number;
}

export interface ReceiptInput {
  /** Libre quand la livraison s'impute sur un bon de commande (c'est alors le fournisseur du bon). */
  readonly supplier?: string;
  readonly purchaseOrderId?: string;
  readonly deliveryNote?: string | null;
  readonly notes?: string | null;
  readonly lines: readonly ReceiptLineInput[];
}

export interface Adjustment {
  readonly id: string;
  readonly number: string;
  readonly drug: DrugSummary | null;
  readonly batch: { readonly id: string; readonly batchNumber: string; readonly expiry: string; readonly quantity: number } | null;
  readonly direction: Direction;
  readonly quantity: number;
  readonly reason: AdjustmentReason;
  readonly note: string | null;
  readonly status: AdjustmentStatus;
  readonly requestedBy: UserRef | null;
  readonly requestedAt: string;
  readonly decidedBy: UserRef | null;
  readonly decidedAt: string | null;
  readonly decisionComment: string | null;
}

export interface AdjustmentFilter {
  readonly status?: AdjustmentStatus;
  readonly drugId?: string;
  readonly batchId?: string;
  /** Seulement les demandes de l'appelant. */
  readonly mine?: boolean;
}

export interface AdjustmentInput {
  readonly batchId: string;
  readonly direction: Direction;
  readonly quantity: number;
  readonly reason: AdjustmentReason;
  readonly note?: string | null;
}

export const ORDER_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Supplier {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  /** Délai de paiement convenu, en jours (0 : comptant). */
  readonly paymentTermsDays: number;
  readonly notes: string | null;
  readonly active: boolean;
}

export interface SupplierFilter {
  readonly search?: string;
  readonly includeInactive?: boolean;
}

export interface SupplierInput {
  readonly code: string;
  readonly name: string;
  readonly contactName?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly address?: string | null;
  readonly paymentTermsDays?: number;
  readonly notes?: string | null;
}

/** Champs modifiables : le code ne change jamais ; `null` efface contact, téléphone, e-mail, adresse ou remarques. */
export type SupplierChanges = Partial<Omit<SupplierInput, 'code'>>;

export interface OrderLine {
  readonly drug: DrugSummary | null;
  readonly quantity: number;
  readonly unitCost: number;
  readonly received: number;
  readonly outstanding: number;
  readonly value: number;
}

export interface Order {
  readonly id: string;
  readonly number: string;
  readonly supplier: { readonly id: string; readonly code: string; readonly name: string } | null;
  readonly status: OrderStatus;
  readonly expectedOn: string | null;
  readonly notes: string | null;
  readonly createdBy: UserRef | null;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly approvedBy: UserRef | null;
  readonly approvedAt: string | null;
  /** Dernier refus : le bon est alors revenu en brouillon. */
  readonly rejectionReason: string | null;
  readonly closedBy: UserRef | null;
  readonly closedAt: string | null;
  readonly closedReason: string | null;
  readonly units: number;
  readonly receivedUnits: number;
  readonly value: number;
  readonly currency: string;
  readonly lines: readonly OrderLine[];
}

export interface OrderSummary {
  readonly id: string;
  readonly number: string;
  readonly supplier: { readonly id: string; readonly name: string };
  readonly status: OrderStatus;
  readonly createdBy: UserRef | null;
  readonly createdAt: string;
  readonly expectedOn: string | null;
  readonly lines: number;
  readonly units: number;
  readonly receivedUnits: number;
  readonly value: number;
}

export interface OrderPage extends Page<OrderSummary> {
  readonly currency: string;
}

export interface OrderFilter {
  readonly status?: OrderStatus;
  readonly supplierId?: string;
  readonly drugId?: string;
  /** Seulement les bons de l'appelant. */
  readonly mine?: boolean;
}

export interface OrderLineInput {
  readonly drugId: string;
  readonly quantity: number;
  /** Absent : le coût du dernier lot reçu (0 si jamais reçu). */
  readonly unitCost?: number;
}

export interface OrderInput {
  readonly supplierId: string;
  readonly expectedOn?: string | null;
  readonly notes?: string | null;
  readonly lines: readonly OrderLineInput[];
}

export interface Suggestion {
  readonly drug: DrugSummary;
  readonly level: 'OUT' | 'LOW';
  readonly dispensable: number;
  readonly reorderLevel: number;
  readonly onOrder: number;
  readonly suggested: number;
  readonly lastUnitCost: number | null;
}

export interface SuggestionList {
  readonly items: readonly Suggestion[];
  readonly currency: string;
}

import { Result } from '../../../shared-kernel/result';
import { Instant, PlainDate } from '../../../shared-kernel/temporal';
import { AdjustmentStatus, StockAdjustment } from './adjustment';
import { Batch, MovementDraft, MovementType, StockLevel } from './batch';
import { Drug } from './drug';
import { GoodsReceipt } from './receipt';
import { AdjustmentId, AdjustmentNumber, BatchId, DrugCode, DrugForm, DrugId, ReceiptId, ReceiptNumber, Schedule } from './values';

export interface DrugFilter {
  /** Texte cherché dans le code, le nom et la dénomination commune (insensible à la casse). */
  readonly search?: string;
  readonly form?: DrugForm;
  readonly schedule?: Schedule;
  readonly includeInactive: boolean;
}

export interface DrugRepository {
  findById(id: DrugId): Promise<Drug | null>;
  findByCode(code: DrugCode): Promise<Drug | null>;
  findByIds(ids: readonly DrugId[]): Promise<Drug[]>;
  /** Refuse (`false`) un code déjà pris ; la vérification et l'écriture se font ensemble (index unique). */
  insert(drug: Drug): Promise<boolean>;
  update(drug: Drug): Promise<void>;
  list(filter: DrugFilter, offset: number, limit: number): Promise<{ items: Drug[]; total: number }>;
}

/** Un médicament et son stock agrégé sur tous ses lots, à une date donnée. */
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
  /** Quantité délivrable : lots non périmés et hors quarantaine. */
  readonly dispensable: number;
  readonly quarantined: number;
  /** Quantité périmée (hors quarantaine), à retirer du rayon. */
  readonly expired: number;
  /** Part de la quantité délivrable qui périme dans la fenêtre d'alerte. */
  readonly expiringSoon: number;
  readonly nextExpiry: PlainDate | null;
  readonly level: StockLevel;
  /** Valeur du stock au coût d'achat (tous lots, plus petite unité monétaire). */
  readonly value: number;
}

export interface StockFilter {
  readonly search?: string;
  readonly level?: StockLevel;
  /** Seulement ceux qui ont du stock qui périme dans la fenêtre d'alerte. */
  readonly expiring?: boolean;
  /** Seulement ceux qui ont du stock périmé. */
  readonly hasExpired?: boolean;
  readonly includeInactive: boolean;
}

export interface StockSummary {
  readonly drugs: number;
  readonly out: number;
  readonly low: number;
  /** Médicaments qui ont du stock périmant dans la fenêtre d'alerte. */
  readonly expiring: number;
  /** Médicaments qui ont du stock périmé. */
  readonly expired: number;
  readonly quarantinedBatches: number;
  readonly pendingAdjustments: number;
  readonly value: number;
}

export interface BatchDrug {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength: string | null;
  readonly unit: string;
}

export interface BatchWithDrug {
  readonly batch: Batch;
  readonly drug: BatchDrug;
}

export interface BatchFilter {
  readonly drugId?: DrugId;
  /** Lots qui périment au plus tard à cette date (périmés compris) — page « péremptions ». */
  readonly expiresBy?: PlainDate;
  readonly quarantinedOnly?: boolean;
  /** Par défaut seuls les lots en stock sont listés. */
  readonly includeEmpty?: boolean;
}

export interface MovementRecord {
  readonly id: string;
  readonly drugId: string;
  readonly batchId: string;
  readonly batchNumber: string;
  readonly type: MovementType;
  readonly delta: number;
  readonly balance: number;
  readonly reason: string | null;
  readonly reference: string | null;
  readonly by: string;
  readonly at: Instant;
}

export interface MovementFilter {
  readonly drugId?: DrugId;
  readonly batchId?: BatchId;
}

export interface ReceiptSummary {
  readonly id: string;
  readonly number: string;
  readonly supplier: string;
  readonly deliveryNote: string | null;
  readonly receivedBy: string;
  readonly receivedAt: Instant;
  readonly lines: number;
  readonly units: number;
  /** Valeur de la livraison au coût d'achat. */
  readonly value: number;
}

export interface ReceiptFilter {
  readonly supplier?: string;
  readonly drugId?: DrugId;
}

export interface StockRepository {
  nextReceiptNumber(): Promise<ReceiptNumber>;
  /**
   * Inscrit la réception et met à jour les lots dans une seule transaction : un lot existant s'augmente (même péremption exigée), sinon il
   * est créé. Rien n'est écrit si une ligne est refusée. Renvoie la réception telle qu'elle est enregistrée (avec les lots réels).
   */
  postReceipt(receipt: GoodsReceipt): Promise<Result<GoodsReceipt>>;
  findReceipt(id: ReceiptId): Promise<GoodsReceipt | null>;
  listReceipts(filter: ReceiptFilter, offset: number, limit: number): Promise<{ items: ReceiptSummary[]; total: number }>;
  findBatch(id: BatchId): Promise<Batch | null>;
  /** Lots d'un médicament, ceux qui périment le plus tôt d'abord (ordre « premier périmé, premier sorti »). */
  batchesOf(drugId: DrugId, includeEmpty: boolean): Promise<Batch[]>;
  listBatches(filter: BatchFilter, offset: number, limit: number): Promise<{ items: BatchWithDrug[]; total: number }>;
  /** Modifie un lot sous verrou (quarantaine, libération) ; rien n'est écrit si la règle refuse. `null` : lot introuvable. */
  mutateBatch(id: BatchId, mutate: (batch: Batch) => Result<void>): Promise<Result<Batch> | null>;
  movements(filter: MovementFilter, offset: number, limit: number): Promise<{ items: MovementRecord[]; total: number }>;
  overview(filter: StockFilter, today: PlainDate, soonDays: number, offset: number, limit: number): Promise<{ items: StockRow[]; total: number }>;
  summary(today: PlainDate, soonDays: number): Promise<StockSummary>;
}

export interface AdjustmentFilter {
  readonly status?: AdjustmentStatus;
  readonly drugId?: DrugId;
  readonly batchId?: BatchId;
  readonly requestedBy?: string;
}

export interface AdjustmentRepository {
  nextNumber(): Promise<AdjustmentNumber>;
  insert(adjustment: StockAdjustment): Promise<void>;
  findById(id: AdjustmentId): Promise<StockAdjustment | null>;
  /** Les plus anciennes d'abord quand on liste les demandes en attente, sinon les plus récentes. */
  list(filter: AdjustmentFilter, offset: number, limit: number): Promise<{ items: StockAdjustment[]; total: number }>;
  /** Y a-t-il déjà une demande en attente sur ce lot ? (évite d'empiler deux corrections contradictoires) */
  hasPending(batchId: BatchId): Promise<boolean>;
  /**
   * Décide une demande sous verrou : la demande puis son lot sont verrouillés (dans cet ordre), `decide` applique la règle ; le
   * mouvement qu'elle renvoie est inscrit au grand livre avec l'auteur de la décision. `null` : demande introuvable.
   */
  decide(id: AdjustmentId, by: string, at: Instant, decide: (adjustment: StockAdjustment, batch: Batch) => Result<MovementDraft | null>): Promise<Result<StockAdjustment> | null>;
}

/** Les comptes appartiennent à l'IAM : la racine de composition branche ce port dessus (nom du réceptionnaire, du demandeur). */
export interface UserDirectory {
  find(ids: readonly string[]): Promise<Map<string, { readonly id: string; readonly username: string }>>;
}

export const DRUG_REPOSITORY = Symbol('PHARMACY_DRUG_REPOSITORY');
export const STOCK_REPOSITORY = Symbol('PHARMACY_STOCK_REPOSITORY');
export const ADJUSTMENT_REPOSITORY = Symbol('PHARMACY_ADJUSTMENT_REPOSITORY');
export const PHARMACY_USERS = Symbol('PHARMACY_USERS');
export const PHARMACY_EXPIRY_ALERT_DAYS = Symbol('PHARMACY_EXPIRY_ALERT_DAYS');
export const PHARMACY_CURRENCY = Symbol('PHARMACY_CURRENCY');

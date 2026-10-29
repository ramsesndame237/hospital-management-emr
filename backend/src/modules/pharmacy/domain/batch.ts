import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, PlainDate, Temporal } from '../../../shared-kernel/temporal';
import { BatchId, BatchNumber, Direction, DrugId, Money, Reason } from './values';

export type BatchStatus = 'AVAILABLE' | 'QUARANTINED';

export type MovementType = 'RECEIPT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

/** Ce qu'une opération a changé dans le stock d'un lot ; le dépôt l'inscrit au grand livre avec l'auteur, l'heure et le solde. */
export interface MovementDraft {
  readonly type: MovementType;
  /** Signé : positif pour une entrée, négatif pour une sortie. */
  readonly delta: number;
  readonly reason: string | null;
  /** Numéro du document à l'origine (réception, ajustement). */
  readonly reference: string | null;
}

export interface BatchState {
  readonly id: BatchId;
  readonly drugId: DrugId;
  readonly batchNumber: BatchNumber;
  readonly expiry: PlainDate;
  readonly quantity: number;
  /** Coût d'achat d'une unité (moyenne pondérée des livraisons de ce lot). */
  readonly unitCost: Money;
  readonly status: BatchStatus;
  readonly quarantineReason: string | null;
  readonly quarantinedBy: string | null;
  readonly quarantinedAt: Instant | null;
  readonly receivedAt: Instant;
}

/** Coût moyen pondéré en entiers (BigInt : quantité × coût dépasse les entiers sûrs), arrondi à l'unité la plus proche. */
function weightedCost(quantityA: number, costA: number, quantityB: number, costB: number): number {
  const total = BigInt(quantityA + quantityB);
  const sum = BigInt(quantityA) * BigInt(costA) + BigInt(quantityB) * BigInt(costB);
  return Number((sum * 2n + total) / (total * 2n));
}

/**
 * Lot d'un médicament : un numéro de lot, une péremption, une quantité en stock. La quantité ne varie que par des mouvements (réception,
 * ajustement approuvé) ; elle ne devient jamais négative. Un lot est périmé le lendemain de sa date de péremption (la date est incluse).
 */
export class Batch {
  private constructor(private current: BatchState) {}

  static restore(state: BatchState): Batch {
    return new Batch(state);
  }

  static create(state: Omit<BatchState, 'status' | 'quarantineReason' | 'quarantinedBy' | 'quarantinedAt'>): Batch {
    return new Batch({ ...state, status: 'AVAILABLE', quarantineReason: null, quarantinedBy: null, quarantinedAt: null });
  }

  get state(): BatchState { return this.current; }
  get id(): BatchId { return this.current.id; }

  isExpired(today: PlainDate): boolean {
    return Temporal.PlainDate.compare(this.current.expiry, today) < 0;
  }

  /** Peut être délivré : en stock, non périmé, hors quarantaine. */
  isDispensable(today: PlainDate): boolean {
    return this.current.status === 'AVAILABLE' && this.current.quantity > 0 && !this.isExpired(today);
  }

  /**
   * Seconde livraison du même lot : la péremption doit être la même (un lot a une seule date), le coût devient la moyenne pondérée.
   * Un lot en quarantaine ne reçoit rien tant qu'il n'est pas libéré.
   */
  receive(expiry: PlainDate, quantity: number, unitCost: Money, reference: string): Result<MovementDraft> {
    if (this.current.status === 'QUARANTINED') return err(new DomainError('PHARMACY_BATCH_QUARANTINED', 'Ce lot est en quarantaine : libérez-le avant de lui ajouter du stock.'));
    if (Temporal.PlainDate.compare(expiry, this.current.expiry) !== 0) {
      return err(new DomainError('PHARMACY_BATCH_EXPIRY_MISMATCH', `Le lot ${this.current.batchNumber.value} existe déjà avec une autre date de péremption (${this.current.expiry.toString()}).`, { batch: this.current.batchNumber.value, expiry: this.current.expiry.toString() }));
    }
    const cost = weightedCost(this.current.quantity, this.current.unitCost.value, quantity, unitCost.value);
    this.current = { ...this.current, quantity: this.current.quantity + quantity, unitCost: Money.restore(cost) };
    return ok({ type: 'RECEIPT', delta: quantity, reason: null, reference });
  }

  /** Ajustement approuvé. Une entrée dans un lot périmé est refusée (le périmé ne se « retrouve » pas) ; une sortie ne dépasse pas le stock. */
  adjust(direction: Direction, quantity: number, today: PlainDate, reason: string | null, reference: string): Result<MovementDraft> {
    if (direction === 'IN') {
      if (this.isExpired(today)) return err(new DomainError('PHARMACY_BATCH_EXPIRED', 'Ce lot est périmé : on ne peut plus y ajouter de stock.'));
      this.current = { ...this.current, quantity: this.current.quantity + quantity };
      return ok({ type: 'ADJUSTMENT_IN', delta: quantity, reason, reference });
    }
    if (quantity > this.current.quantity) {
      return err(new DomainError('PHARMACY_STOCK_INSUFFICIENT', `Le lot ${this.current.batchNumber.value} ne contient que ${this.current.quantity} unité(s).`, { available: this.current.quantity, batch: this.current.batchNumber.value }));
    }
    this.current = { ...this.current, quantity: this.current.quantity - quantity };
    return ok({ type: 'ADJUSTMENT_OUT', delta: -quantity, reason, reference });
  }

  /** Met le lot de côté (rappel de lot, doute sur la conservation) : il n'est plus délivrable, son stock reste visible. */
  quarantine(reason: Reason, by: string, at: Instant): Result<void> {
    if (this.current.status === 'QUARANTINED') return err(new DomainError('PHARMACY_BATCH_ALREADY_QUARANTINED', 'Ce lot est déjà en quarantaine.'));
    this.current = { ...this.current, status: 'QUARANTINED', quarantineReason: reason.value, quarantinedBy: by, quarantinedAt: at };
    return ok(undefined);
  }

  release(): Result<void> {
    if (this.current.status !== 'QUARANTINED') return err(new DomainError('PHARMACY_BATCH_NOT_QUARANTINED', "Ce lot n'est pas en quarantaine."));
    this.current = { ...this.current, status: 'AVAILABLE', quarantineReason: null, quarantinedBy: null, quarantinedAt: null };
    return ok(undefined);
  }
}

export interface Allocation {
  readonly batchId: string;
  readonly batchNumber: string;
  readonly expiry: PlainDate;
  readonly quantity: number;
}

/**
 * « Premier périmé, premier sorti » : prélève la quantité demandée sur les lots délivrables, ceux qui périment le plus tôt d'abord (à
 * péremption égale, le plus anciennement reçu, puis le numéro de lot). `shortfall` : ce qui manque, 0 si le stock suffit.
 */
export function allocateFefo(batches: readonly Batch[], quantity: number, today: PlainDate): { allocations: Allocation[]; shortfall: number } {
  const usable = batches
    .filter((b) => b.isDispensable(today))
    .sort((a, b) =>
      Temporal.PlainDate.compare(a.state.expiry, b.state.expiry)
      || Temporal.Instant.compare(a.state.receivedAt, b.state.receivedAt)
      || a.state.batchNumber.value.localeCompare(b.state.batchNumber.value));
  const allocations: Allocation[] = [];
  let remaining = quantity;
  for (const batch of usable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.state.quantity);
    allocations.push({ batchId: batch.id.value, batchNumber: batch.state.batchNumber.value, expiry: batch.state.expiry, quantity: take });
    remaining -= take;
  }
  return { allocations, shortfall: Math.max(0, remaining) };
}

export type StockLevel = 'OK' | 'LOW' | 'OUT';

/** `OUT` : rien de délivrable ; `LOW` : au seuil de réapprovisionnement ou en dessous (si un seuil est fixé) ; sinon `OK`. */
export function stockLevel(dispensable: number, reorderLevel: number): StockLevel {
  if (dispensable <= 0) return 'OUT';
  return reorderLevel > 0 && dispensable <= reorderLevel ? 'LOW' : 'OK';
}

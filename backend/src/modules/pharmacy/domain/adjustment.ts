import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, PlainDate } from '../../../shared-kernel/temporal';
import { Batch, MovementDraft } from './batch';
import { AdjustmentId, AdjustmentNumber, AdjustmentReason, BatchId, Direction, DrugId, Quantity, Reason } from './values';

export type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export const ADJUSTMENT_STATUSES: readonly AdjustmentStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

/** Motifs admis selon le sens : on ne « casse » pas du stock en entrée, on ne « retrouve » pas du stock en sortie. */
const REASONS_IN: readonly AdjustmentReason[] = ['COUNT_CORRECTION', 'FOUND', 'OTHER'];
const REASONS_OUT: readonly AdjustmentReason[] = ['COUNT_CORRECTION', 'DAMAGED', 'EXPIRED', 'LOST', 'OTHER'];

export interface AdjustmentState {
  readonly id: AdjustmentId;
  readonly number: AdjustmentNumber;
  readonly drugId: DrugId;
  readonly batchId: BatchId;
  readonly direction: Direction;
  readonly quantity: number;
  readonly reason: AdjustmentReason;
  readonly note: string | null;
  readonly status: AdjustmentStatus;
  readonly requestedBy: string;
  readonly requestedAt: Instant;
  readonly decidedBy: string | null;
  readonly decidedAt: Instant | null;
  readonly decisionComment: string | null;
}

export interface AdjustmentRequest {
  readonly id: AdjustmentId;
  readonly number: AdjustmentNumber;
  readonly drugId: DrugId;
  readonly batchId: BatchId;
  readonly direction: Direction;
  readonly quantity: Quantity;
  readonly reason: AdjustmentReason;
  readonly note: string | null;
  readonly requestedBy: string;
  readonly requestedAt: Instant;
}

const NOT_PENDING = new DomainError('PHARMACY_ADJUSTMENT_NOT_PENDING', "Cet ajustement a déjà été décidé.");

/**
 * Demande d'ajustement du stock d'un lot (inventaire, casse, perte, péremption…). Elle ne change rien tant qu'elle n'est pas approuvée,
 * et elle ne peut pas l'être par celui qui l'a demandée (deux paires d'yeux). À l'approbation, le stock du lot est modifié et le
 * mouvement inscrit au grand livre dans la même transaction.
 */
export class StockAdjustment {
  private constructor(private current: AdjustmentState) {}

  static restore(state: AdjustmentState): StockAdjustment {
    return new StockAdjustment(state);
  }

  static request(input: AdjustmentRequest): Result<StockAdjustment> {
    const allowed = input.direction === 'IN' ? REASONS_IN : REASONS_OUT;
    if (!allowed.includes(input.reason)) {
      return err(new DomainError('PHARMACY_ADJUSTMENT_REASON_MISMATCH', `Le motif « ${input.reason} » ne convient pas à un ajustement ${input.direction === 'IN' ? "en entrée" : 'en sortie'}.`, { reason: input.reason, direction: input.direction }));
    }
    if (input.reason === 'OTHER' && input.note === null) return err(new DomainError('PHARMACY_ADJUSTMENT_NOTE_REQUIRED', "Précisez le motif de l'ajustement."));
    if (input.note !== null && input.note.length > 200) return err(new DomainError('PHARMACY_NOTES_INVALID', 'Le texte ne doit pas dépasser 200 caractères.', { max: 200 }));
    return ok(new StockAdjustment({
      id: input.id, number: input.number, drugId: input.drugId, batchId: input.batchId, direction: input.direction, quantity: input.quantity.value, reason: input.reason, note: input.note,
      status: 'PENDING', requestedBy: input.requestedBy, requestedAt: input.requestedAt, decidedBy: null, decidedAt: null, decisionComment: null,
    }));
  }

  get state(): AdjustmentState { return this.current; }
  get id(): AdjustmentId { return this.current.id; }

  /** Applique l'ajustement au lot (qui porte ses propres règles) puis le marque approuvé. Rien n'est modifié si le lot refuse. */
  approve(by: string, at: Instant, batch: Batch, today: PlainDate, comment: string | null): Result<MovementDraft> {
    if (this.current.status !== 'PENDING') return err(NOT_PENDING);
    if (by === this.current.requestedBy) return err(new DomainError('PHARMACY_ADJUSTMENT_SELF_APPROVAL', 'Vous ne pouvez pas approuver un ajustement que vous avez demandé.'));
    const movement = batch.adjust(this.current.direction, this.current.quantity, today, this.current.note ?? this.current.reason, this.current.number.value);
    if (!movement.ok) return movement;
    this.current = { ...this.current, status: 'APPROVED', decidedBy: by, decidedAt: at, decisionComment: comment };
    return movement;
  }

  /** Le refus est motivé : le demandeur doit savoir pourquoi le stock n'a pas changé. */
  reject(by: string, at: Instant, comment: Reason): Result<void> {
    if (this.current.status !== 'PENDING') return err(NOT_PENDING);
    if (by === this.current.requestedBy) return err(new DomainError('PHARMACY_ADJUSTMENT_SELF_APPROVAL', 'Vous ne pouvez pas décider un ajustement que vous avez demandé.'));
    this.current = { ...this.current, status: 'REJECTED', decidedBy: by, decidedAt: at, decisionComment: comment.value };
    return ok(undefined);
  }
}

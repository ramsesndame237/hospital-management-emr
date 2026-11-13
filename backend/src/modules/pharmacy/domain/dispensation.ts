import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, PlainDate } from '../../../shared-kernel/temporal';
import { DispensationId, DispensationNumber } from './values';

export const MAX_DISPENSED_LINES = 40;

/** Une quantité prélevée dans un lot pour une ligne de l'ordonnance. */
export interface DispensationLine {
  /** Rang de la ligne de l'ordonnance servie. */
  readonly prescriptionPosition: number;
  readonly drugId: string;
  readonly batchId: string;
  readonly batchNumber: string;
  readonly expiry: PlainDate;
  readonly quantity: number;
  /** Motif du pharmacien qui délivre malgré une allergie connue que le médecin n'avait pas levée. */
  readonly allergyOverride: string | null;
}

export interface DispensationState {
  readonly id: DispensationId;
  readonly number: DispensationNumber;
  readonly prescriptionId: string;
  readonly patientId: string;
  readonly dispensedBy: string;
  readonly dispensedAt: Instant;
  readonly notes: string | null;
  readonly lines: readonly DispensationLine[];
}

/**
 * Dispensation : le pharmacien délivre tout ou partie d'une ordonnance. Elle s'écrit une fois, avec le détail des lots prélevés ; elle ne se
 * modifie ni ne s'annule (une erreur se rattrape par un ajustement de stock approuvé par un autre pharmacien).
 */
export class Dispensation {
  private constructor(private readonly current: DispensationState) {}

  static restore(state: DispensationState): Dispensation {
    return new Dispensation(state);
  }

  static create(state: DispensationState): Result<Dispensation> {
    if (state.lines.length < 1) return err(new DomainError('PHARMACY_DISPENSATION_EMPTY', 'Une dispensation comporte au moins une ligne.'));
    if (state.lines.length > MAX_DISPENSED_LINES) return err(new DomainError('PHARMACY_DISPENSATION_TOO_LONG', `Une dispensation comporte au plus ${MAX_DISPENSED_LINES} prélèvements.`, { max: MAX_DISPENSED_LINES }));
    if (state.lines.some((l) => !Number.isSafeInteger(l.quantity) || l.quantity < 1)) return err(new DomainError('PHARMACY_DISPENSE_QUANTITY_INVALID', 'Chaque quantité délivrée est un entier positif.'));
    if (state.notes !== null && (state.notes.length < 1 || state.notes.length > 200)) return err(new DomainError('PHARMACY_NOTES_INVALID', 'La remarque ne doit pas dépasser 200 caractères.', { max: 200 }));
    return ok(new Dispensation(state));
  }

  get state(): DispensationState { return this.current; }
  get id(): DispensationId { return this.current.id; }
}

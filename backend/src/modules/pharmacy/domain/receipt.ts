import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, PlainDate, Temporal } from '../../../shared-kernel/temporal';
import { BatchId, BatchNumber, DrugId, Money, parseOptionalText, ReceiptId, ReceiptNumber } from './values';

export const MAX_RECEIPT_LINES = 50;

export interface ReceiptLine {
  readonly drugId: DrugId;
  /** Lot concerné : celui qui existait déjà, sinon celui que la réception crée. */
  readonly batchId: BatchId;
  readonly batchNumber: BatchNumber;
  readonly expiry: PlainDate;
  readonly quantity: number;
  /** Coût d'achat d'une unité. */
  readonly unitCost: Money;
}

export interface ReceiptState {
  readonly id: ReceiptId;
  readonly number: ReceiptNumber;
  readonly supplier: string;
  /** Référence du bon de livraison du fournisseur. */
  readonly deliveryNote: string | null;
  readonly notes: string | null;
  readonly receivedBy: string;
  readonly receivedAt: Instant;
  readonly lines: readonly ReceiptLine[];
}

export interface ReceiptDraft {
  readonly id: ReceiptId;
  readonly number: ReceiptNumber;
  readonly supplier: string;
  readonly deliveryNote?: string | null;
  readonly notes?: string | null;
  readonly receivedBy: string;
  readonly receivedAt: Instant;
  readonly lines: readonly ReceiptLine[];
}

/**
 * Réception de marchandises : ce qu'un fournisseur a livré, ligne par ligne (médicament, lot, péremption, quantité, coût). Écrite une
 * fois pour toutes ; le stock des lots est mis à jour dans la même transaction. Un médicament périmé à l'arrivée est refusé.
 */
export class GoodsReceipt {
  private constructor(private readonly current: ReceiptState) {}

  static restore(state: ReceiptState): GoodsReceipt {
    return new GoodsReceipt(state);
  }

  static create(draft: ReceiptDraft, today: PlainDate): Result<GoodsReceipt> {
    const supplier = (draft.supplier ?? '').trim().replace(/\s+/g, ' ');
    if (supplier.length < 1 || supplier.length > 120) return err(new DomainError('PHARMACY_SUPPLIER_INVALID', 'Le fournisseur doit comporter de 1 à 120 caractères.'));
    const deliveryNote = parseOptionalText(draft.deliveryNote, 60, 'PHARMACY_DELIVERY_NOTE_INVALID');
    if (!deliveryNote.ok) return err(deliveryNote.error);
    const notes = parseOptionalText(draft.notes, 200, 'PHARMACY_NOTES_INVALID');
    if (!notes.ok) return err(notes.error);
    if (draft.lines.length < 1 || draft.lines.length > MAX_RECEIPT_LINES) {
      return err(new DomainError('PHARMACY_RECEIPT_LINES_INVALID', `Une réception compte de 1 à ${MAX_RECEIPT_LINES} lignes.`, { max: MAX_RECEIPT_LINES }));
    }
    const seen = new Set<string>();
    for (const line of draft.lines) {
      const key = `${line.drugId.value}|${line.batchNumber.value}`;
      if (seen.has(key)) return err(new DomainError('PHARMACY_RECEIPT_DUPLICATE_LINE', `Le lot ${line.batchNumber.value} figure deux fois pour ce médicament : regroupez les quantités.`, { batch: line.batchNumber.value }));
      seen.add(key);
      if (Temporal.PlainDate.compare(line.expiry, today) < 0) {
        return err(new DomainError('PHARMACY_RECEIPT_EXPIRED', `Le lot ${line.batchNumber.value} est déjà périmé (${line.expiry.toString()}) : il ne peut pas être reçu.`, { batch: line.batchNumber.value, expiry: line.expiry.toString() }));
      }
    }
    return ok(new GoodsReceipt({ ...draft, supplier, deliveryNote: deliveryNote.value, notes: notes.value, lines: [...draft.lines] }));
  }

  get state(): ReceiptState { return this.current; }
  get id(): ReceiptId { return this.current.id; }
}

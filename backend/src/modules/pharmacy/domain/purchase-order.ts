import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, PlainDate } from '../../../shared-kernel/temporal';
import { DrugId, MAX_QUANTITY, Money, parseOptionalText, PurchaseOrderId, PurchaseOrderNumber, Reason, SupplierId } from './values';

export const MAX_ORDER_LINES = 50;

export type OrderStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';
export const ORDER_STATUSES: readonly OrderStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'];

export interface OrderLine {
  readonly drugId: DrugId;
  /** Quantité commandée, en unités de dispensation. */
  readonly quantity: number;
  /** Coût d'achat convenu d'une unité. */
  readonly unitCost: Money;
  /** Quantité déjà reçue contre ce bon. */
  readonly received: number;
}

export interface OrderState {
  readonly id: PurchaseOrderId;
  readonly number: PurchaseOrderNumber;
  readonly supplierId: SupplierId;
  readonly status: OrderStatus;
  readonly lines: readonly OrderLine[];
  readonly expectedOn: PlainDate | null;
  readonly notes: string | null;
  readonly createdBy: string;
  readonly createdAt: Instant;
  readonly submittedAt: Instant | null;
  readonly approvedBy: string | null;
  readonly approvedAt: Instant | null;
  /** Dernier refus (le bon est alors revenu en brouillon) ; effacé à la nouvelle soumission. */
  readonly rejectionReason: string | null;
  /** Annulation ou clôture : qui, quand, pourquoi. */
  readonly closedBy: string | null;
  readonly closedAt: Instant | null;
  readonly closedReason: string | null;
}

export interface OrderLineInput {
  readonly drugId: DrugId;
  readonly quantity: number;
  readonly unitCost: Money;
}

export interface OrderContent {
  readonly supplierId: SupplierId;
  readonly lines: readonly OrderLineInput[];
  readonly expectedOn: PlainDate | null;
  readonly notes?: string | null;
}

const wrongState = (status: OrderStatus, action: string): Result<never> =>
  err(new DomainError('PHARMACY_ORDER_STATE_INVALID', `Un bon de commande « ${status} » ne peut pas faire l'objet de cette action (${action}).`, { status, action }));

/** Contrôle le contenu d'un bon : de 1 à 50 lignes, un médicament au plus une fois, des quantités entières positives. */
function checkLines(lines: readonly OrderLineInput[]): Result<void> {
  if (lines.length < 1 || lines.length > MAX_ORDER_LINES) return err(new DomainError('PHARMACY_ORDER_LINES_INVALID', `Un bon de commande compte de 1 à ${MAX_ORDER_LINES} lignes.`, { max: MAX_ORDER_LINES }));
  const seen = new Set<string>();
  for (const l of lines) {
    if (!Number.isSafeInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_QUANTITY) return err(new DomainError('PHARMACY_QUANTITY_INVALID', `La quantité doit être un entier compris entre 1 et ${MAX_QUANTITY}.`, { max: MAX_QUANTITY }));
    if (seen.has(l.drugId.value)) return err(new DomainError('PHARMACY_ORDER_DUPLICATE_DRUG', 'Un médicament ne figure qu’une fois dans un bon de commande : regroupez les quantités.'));
    seen.add(l.drugId.value);
  }
  return ok(undefined);
}

/**
 * Bon de commande à un fournisseur. Il se prépare en brouillon, part à l'approbation, et ne peut être approuvé que par un AUTRE que son auteur.
 * Une fois approuvé, les réceptions s'y imputent : on ne reçoit jamais plus que commandé. Un refus le renvoie en brouillon, motif à l'appui.
 */
export class PurchaseOrder {
  private constructor(private current: OrderState) {}

  static restore(state: OrderState): PurchaseOrder {
    return new PurchaseOrder(state);
  }

  static create(input: { readonly id: PurchaseOrderId; readonly number: PurchaseOrderNumber; readonly createdBy: string; readonly createdAt: Instant; readonly content: OrderContent }): Result<PurchaseOrder> {
    const lines = checkLines(input.content.lines);
    if (!lines.ok) return err(lines.error);
    const notes = parseOptionalText(input.content.notes, 300, 'PHARMACY_NOTES_INVALID');
    if (!notes.ok) return err(notes.error);
    return ok(new PurchaseOrder({
      id: input.id, number: input.number, supplierId: input.content.supplierId, status: 'DRAFT', lines: input.content.lines.map((l) => ({ ...l, received: 0 })), expectedOn: input.content.expectedOn,
      notes: notes.value, createdBy: input.createdBy, createdAt: input.createdAt, submittedAt: null, approvedBy: null, approvedAt: null, rejectionReason: null, closedBy: null, closedAt: null, closedReason: null,
    }));
  }

  get state(): OrderState { return this.current; }
  get id(): PurchaseOrderId { return this.current.id; }
  get status(): OrderStatus { return this.current.status; }

  /** Valeur du bon au coût convenu. */
  get value(): number {
    return this.current.lines.reduce((n, l) => n + l.quantity * l.unitCost.value, 0);
  }

  /** Reste à recevoir pour un médicament (0 s'il ne figure pas au bon). */
  outstanding(drugId: DrugId): number {
    const line = this.current.lines.find((l) => l.drugId.value === drugId.value);
    return line ? line.quantity - line.received : 0;
  }

  /** Modifie le contenu : seulement en brouillon. */
  edit(content: OrderContent): Result<void> {
    if (this.current.status !== 'DRAFT') return wrongState(this.current.status, 'modifier');
    const lines = checkLines(content.lines);
    if (!lines.ok) return lines;
    const notes = parseOptionalText(content.notes, 300, 'PHARMACY_NOTES_INVALID');
    if (!notes.ok) return err(notes.error);
    this.current = { ...this.current, supplierId: content.supplierId, lines: content.lines.map((l) => ({ ...l, received: 0 })), expectedOn: content.expectedOn, notes: notes.value };
    return ok(undefined);
  }

  /** Envoie le brouillon à l'approbation (efface le dernier refus). */
  submit(at: Instant): Result<void> {
    if (this.current.status !== 'DRAFT') return wrongState(this.current.status, 'soumettre');
    this.current = { ...this.current, status: 'PENDING_APPROVAL', submittedAt: at, rejectionReason: null };
    return ok(undefined);
  }

  approve(by: string, at: Instant): Result<void> {
    if (this.current.status !== 'PENDING_APPROVAL') return wrongState(this.current.status, 'approuver');
    if (by === this.current.createdBy) return err(new DomainError('PHARMACY_ORDER_SELF_APPROVAL', 'Vous ne pouvez pas approuver un bon de commande que vous avez établi.'));
    this.current = { ...this.current, status: 'APPROVED', approvedBy: by, approvedAt: at };
    return ok(undefined);
  }

  /** Le refus renvoie le bon en brouillon : son auteur le corrige et le soumet de nouveau. Le motif est obligatoire. */
  reject(by: string, reason: Reason): Result<void> {
    if (this.current.status !== 'PENDING_APPROVAL') return wrongState(this.current.status, 'refuser');
    if (by === this.current.createdBy) return err(new DomainError('PHARMACY_ORDER_SELF_APPROVAL', 'Vous ne pouvez pas décider un bon de commande que vous avez établi.'));
    this.current = { ...this.current, status: 'DRAFT', rejectionReason: reason.value, submittedAt: null };
    return ok(undefined);
  }

  /** Annule un bon sur lequel rien n'a été reçu (brouillon, à approuver ou approuvé). Après une réception partielle on le clôt. */
  cancel(by: string, at: Instant, reason: Reason): Result<void> {
    if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(this.current.status)) return wrongState(this.current.status, 'annuler');
    this.current = { ...this.current, status: 'CANCELLED', closedBy: by, closedAt: at, closedReason: reason.value };
    return ok(undefined);
  }

  /** Clôt un bon partiellement reçu dont le solde ne viendra pas (livraison incomplète) : ce qui a été reçu reste acquis. */
  close(by: string, at: Instant, reason: Reason): Result<void> {
    if (this.current.status !== 'PARTIALLY_RECEIVED') return wrongState(this.current.status, 'clore');
    this.current = { ...this.current, status: 'CLOSED', closedBy: by, closedAt: at, closedReason: reason.value };
    return ok(undefined);
  }

  /**
   * Impute une livraison (quantité reçue par médicament). Il faut que le bon soit approuvé, que chaque médicament y figure et que la quantité
   * ne dépasse pas ce qui reste à recevoir. Le bon passe à « reçu » quand tout est arrivé, sinon à « partiellement reçu ».
   */
  receive(quantities: ReadonlyMap<string, number>): Result<void> {
    if (this.current.status !== 'APPROVED' && this.current.status !== 'PARTIALLY_RECEIVED') {
      return err(new DomainError('PHARMACY_ORDER_NOT_RECEIVABLE', `Le bon de commande ${this.current.number.value} n'attend pas de livraison (statut « ${this.current.status} »).`, { number: this.current.number.value, status: this.current.status }));
    }
    for (const [drugId, quantity] of quantities) {
      const line = this.current.lines.find((l) => l.drugId.value === drugId);
      if (!line) return err(new DomainError('PHARMACY_ORDER_DRUG_NOT_ORDERED', `Ce médicament ne figure pas sur le bon de commande ${this.current.number.value}.`, { number: this.current.number.value }));
      if (quantity > line.quantity - line.received) {
        return err(new DomainError('PHARMACY_ORDER_OVER_RECEIPT', `Livraison supérieure à la commande : il ne reste que ${line.quantity - line.received} unité(s) à recevoir.`, { outstanding: line.quantity - line.received }));
      }
    }
    const lines = this.current.lines.map((l) => ({ ...l, received: l.received + (quantities.get(l.drugId.value) ?? 0) }));
    this.current = { ...this.current, lines, status: lines.every((l) => l.received === l.quantity) ? 'RECEIVED' : 'PARTIALLY_RECEIVED' };
    return ok(undefined);
  }
}

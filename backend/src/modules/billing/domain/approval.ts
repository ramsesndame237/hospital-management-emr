import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { ValueObject } from '../../../shared-kernel/value-object';
import { Amount, InvoiceId, Reason } from './values';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ApprovalId extends ValueObject<string> {
  static create(raw: string): Result<ApprovalId> {
    const normalized = (raw ?? '').trim();
    return UUID.test(normalized) ? ok(new ApprovalId(normalized.toLowerCase())) : err(new DomainError('BILLING_APPROVAL_ID_INVALID', "L'identifiant de cette demande est invalide."));
  }
}

export enum ApprovalKind {
  /** Remise sur un brouillon, au-delà du seuil de l'installation. */
  DISCOUNT = 'DISCOUNT',
  /** Annulation d'une facture émise (pas encore encaissée). */
  CANCEL = 'CANCEL',
}

export function parseApprovalKind(raw: string): Result<ApprovalKind> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(ApprovalKind) as string[]).find((v) => v === normalized);
  return found ? ok(found as ApprovalKind) : err(new DomainError('BILLING_APPROVAL_KIND_INVALID', `Type de demande invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  /** Retirée par son auteur avant toute décision. */
  WITHDRAWN = 'WITHDRAWN',
}

export function parseApprovalStatus(raw: string): Result<ApprovalStatus> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(ApprovalStatus) as string[]).find((v) => v === normalized);
  return found ? ok(found as ApprovalStatus) : err(new DomainError('BILLING_APPROVAL_STATUS_INVALID', `Statut de demande invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

/** Commentaire d'une décision : facultatif pour une acceptation, obligatoire pour un refus ; 200 caractères au plus. */
function parseComment(raw: string | null | undefined): Result<string | null> {
  const text = (raw ?? '').trim();
  if (text === '') return ok(null);
  return text.length <= 200 ? ok(text) : err(new DomainError('BILLING_APPROVAL_COMMENT_INVALID', 'Le commentaire ne doit pas dépasser 200 caractères.'));
}

/**
 * Une remise demande l'accord d'un responsable quand elle dépasse `percent` % du sous-total. Calcul en entiers : on compare
 * `remise × 100` à `pourcentage × sous-total`, sans jamais passer par un nombre décimal.
 */
export function discountNeedsApproval(discount: Amount, subtotal: Amount, percent: number): boolean {
  return discount.value > 0 && discount.value * 100 > percent * subtotal.value;
}

export interface ApprovalState {
  readonly id: ApprovalId;
  readonly invoiceId: InvoiceId;
  readonly kind: ApprovalKind;
  readonly status: ApprovalStatus;
  /** Montant de la remise demandée ; absent pour une annulation. */
  readonly amount: Amount | null;
  readonly reason: Reason;
  /** Version de la facture lue au moment de la demande : si elle a changé depuis, la demande est périmée. */
  readonly invoiceVersion: number;
  readonly requestedBy: string;
  readonly requestedAt: Instant;
  readonly decidedBy: string | null;
  readonly decidedAt: Instant | null;
  readonly decisionComment: string | null;
}

/**
 * Demande d'approbation : le caissier explique pourquoi (motif obligatoire) et un responsable, jamais lui, accepte ou refuse. Un refus
 * s'explique. Tant qu'elle n'est pas décidée, son auteur peut la retirer ; ensuite plus rien ne la modifie.
 */
export class ApprovalRequest {
  private constructor(private current: ApprovalState) {}

  static restore(state: ApprovalState): ApprovalRequest {
    return new ApprovalRequest(state);
  }

  static request(input: { id: ApprovalId; invoiceId: InvoiceId; kind: ApprovalKind; amount: Amount | null; reason: Reason; invoiceVersion: number; requestedBy: string; requestedAt: Instant }): Result<ApprovalRequest> {
    if (input.kind === ApprovalKind.DISCOUNT && (input.amount === null || input.amount.value === 0)) {
      return err(new DomainError('BILLING_AMOUNT_INVALID', 'Le montant de la remise doit être strictement positif.'));
    }
    return ok(new ApprovalRequest({
      ...input, amount: input.kind === ApprovalKind.DISCOUNT ? input.amount : null, status: ApprovalStatus.PENDING, decidedBy: null, decidedAt: null, decisionComment: null,
    }));
  }

  get state(): ApprovalState { return this.current; }
  get id(): ApprovalId { return this.current.id; }
  get status(): ApprovalStatus { return this.current.status; }

  private ensurePending(): Result<void> {
    return this.current.status === ApprovalStatus.PENDING
      ? ok(undefined)
      : err(new DomainError('BILLING_APPROVAL_NOT_PENDING', 'Cette demande a déjà été traitée.', { status: this.current.status }));
  }

  /** Accepte ou refuse. Le demandeur ne décide jamais de sa propre demande ; un refus s'accompagne d'une explication. */
  decide(by: string, approve: boolean, comment: string | null | undefined, now: Instant): Result<void> {
    const pending = this.ensurePending();
    if (!pending.ok) return pending;
    if (by === this.current.requestedBy) return err(new DomainError('BILLING_APPROVAL_SELF', 'Vous ne pouvez pas décider de votre propre demande.'));
    const text = parseComment(comment);
    if (!text.ok) return err(text.error);
    if (!approve && text.value === null) return err(new DomainError('BILLING_APPROVAL_COMMENT_REQUIRED', 'Expliquez le refus (200 caractères au plus).'));
    this.current = { ...this.current, status: approve ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED, decidedBy: by, decidedAt: now, decisionComment: text.value };
    return ok(undefined);
  }

  /** Seul l'auteur retire sa demande, et seulement tant qu'elle n'est pas décidée. */
  withdraw(by: string, now: Instant): Result<void> {
    // Pour un tiers la demande n'existe pas : on ne révèle rien de son état.
    if (by !== this.current.requestedBy) return err(new DomainError('BILLING_APPROVAL_NOT_FOUND', 'Demande introuvable.'));
    const pending = this.ensurePending();
    if (!pending.ok) return pending;
    this.current = { ...this.current, status: ApprovalStatus.WITHDRAWN, decidedBy: by, decidedAt: now, decisionComment: null };
    return ok(undefined);
  }
}

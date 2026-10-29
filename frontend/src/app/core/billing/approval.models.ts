import { BilledPatient, InvoiceStatus, Page } from './billing.models';

/** Ce qu'un caissier ne peut pas décider seul : une remise au-delà du seuil, l'annulation d'une facture émise. Le code est stable, l'interface le traduit (`billing.approval.kind.<CODE>`). */
export const APPROVAL_KINDS = ['DISCOUNT', 'CANCEL'] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

/** `PENDING` attend un responsable ; `WITHDRAWN` : retirée par son auteur. Libellés : `billing.approval.status.<CODE>`. */
export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ApprovalUser {
  readonly id: string;
  readonly username: string;
}

/** Une demande, telle que la facture la résume. */
export interface ApprovalSummary {
  readonly id: string;
  readonly kind: ApprovalKind;
  readonly status: ApprovalStatus;
  /** Montant de la remise demandée ; `null` pour une annulation. Entier, dans la plus petite unité de la devise. */
  readonly amount: number | null;
  readonly reason: string;
  readonly requestedBy: ApprovalUser | null;
  readonly requestedAt: string;
  readonly decidedBy: ApprovalUser | null;
  readonly decidedAt: string | null;
  readonly decisionComment: string | null;
  /** La facture a changé depuis la demande : elle ne peut plus être acceptée, seulement refusée ou retirée. */
  readonly outdated: boolean;
}

/** Une demande avec la facture concernée, telle qu'elle est maintenant (file des approbations). */
export interface Approval extends ApprovalSummary {
  readonly currency: string;
  readonly currencyDigits: number;
  readonly invoice: {
    readonly id: string;
    readonly number: string;
    readonly status: InvoiceStatus;
    readonly patient: BilledPatient | null;
    readonly subtotal: number;
    readonly discount: number;
    readonly total: number;
  };
  /** Remise (en % du sous-total) au-delà de laquelle un responsable doit l'approuver. */
  readonly discountApprovalPercent: number;
}

export interface ApprovalFilter {
  readonly status?: ApprovalStatus;
  readonly kind?: ApprovalKind;
}

export type ApprovalPage = Page<Approval>;

export interface RequestApprovalInput {
  readonly invoiceId: string;
  readonly kind: ApprovalKind;
  /** Montant de la remise demandée (pour `DISCOUNT`). */
  readonly amount?: number;
  readonly reason: string;
}

/** Une demande attend-elle un responsable ? */
export const isPending = (approval: Pick<ApprovalSummary, 'status'>): boolean => approval.status === 'PENDING';

/**
 * Une remise dépasse-t-elle le seuil ? Même calcul que le serveur, en entiers (`remise × 100` contre `pourcentage × sous-total`) :
 * l'écran guide le caissier, c'est le serveur qui tranche.
 */
export const discountNeedsApproval = (discount: number, subtotal: number, percent: number): boolean => discount > 0 && discount * 100 > percent * subtotal;

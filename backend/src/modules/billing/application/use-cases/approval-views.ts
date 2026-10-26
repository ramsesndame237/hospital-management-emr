import { ApprovalStatus } from '../../domain/approval';
import { ApprovalRecord, UserDirectory } from '../../domain/ports';

export interface ApprovalUser {
  readonly id: string;
  readonly username: string;
}

/** Une demande d'approbation, sans sa facture (elle figure dans le détail de la facture elle-même). */
export interface ApprovalSummaryView {
  readonly id: string;
  /** `DISCOUNT` (remise au-delà du seuil) ou `CANCEL` (annulation d'une facture émise). */
  readonly kind: string;
  /** `PENDING`, `APPROVED`, `REJECTED` ou `WITHDRAWN`. */
  readonly status: string;
  /** Montant de la remise demandée ; `null` pour une annulation. */
  readonly amount: number | null;
  readonly reason: string;
  readonly requestedBy: ApprovalUser | null;
  readonly requestedAt: string;
  readonly decidedBy: ApprovalUser | null;
  readonly decidedAt: string | null;
  readonly decisionComment: string | null;
  /** Vrai si la facture a changé depuis la demande : elle ne peut plus être acceptée, seulement refusée ou retirée. */
  readonly outdated: boolean;
}

/** Les noms des auteurs et des décideurs, cherchés en une fois pour toute une liste. */
export async function summarize(users: UserDirectory, records: readonly ApprovalRecord[]): Promise<ApprovalSummaryView[]> {
  const ids = new Set<string>();
  for (const { request } of records) {
    ids.add(request.state.requestedBy);
    if (request.state.decidedBy) ids.add(request.state.decidedBy);
  }
  const found = ids.size > 0 ? await users.find([...ids]) : new Map<string, ApprovalUser>();
  const who = (id: string | null): ApprovalUser | null => (id && found.get(id) ? { id, username: found.get(id)!.username } : null);
  return records.map(({ request, invoice }): ApprovalSummaryView => {
    const s = request.state;
    return {
      id: s.id.value, kind: s.kind, status: s.status, amount: s.amount?.value ?? null, reason: s.reason.value, requestedBy: who(s.requestedBy), requestedAt: s.requestedAt.toString(),
      decidedBy: who(s.decidedBy), decidedAt: s.decidedAt?.toString() ?? null, decisionComment: s.decisionComment,
      outdated: s.status === ApprovalStatus.PENDING && invoice.version !== s.invoiceVersion,
    };
  });
}

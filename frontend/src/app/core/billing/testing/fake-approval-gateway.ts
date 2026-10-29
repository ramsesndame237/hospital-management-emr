import { ApprovalGateway } from '../approval.gateway';
import { Approval, ApprovalFilter, ApprovalPage, ApprovalSummary, RequestApprovalInput } from '../approval.models';
import { patient } from './fake-billing-gateway';

export const requester = { id: 'u-cashier', username: 'caissier' };
export const supervisor = { id: 'u-sup', username: 'comptable' };

/** Une demande (résumé tel que la facture l'affiche) : une remise de 2 000 en attente, envoyée par le caissier. */
export const summaryOf = (over: Partial<ApprovalSummary> = {}): ApprovalSummary => ({
  id: 'ap-1', kind: 'DISCOUNT', status: 'PENDING', amount: 2000, reason: 'Patient indigent', requestedBy: requester, requestedAt: '2026-10-24T09:20:00Z',
  decidedBy: null, decidedAt: null, decisionComment: null, outdated: false, ...over,
});

/** Une demande avec sa facture (file des approbations). */
export const approval = (over: Partial<Approval> = {}): Approval => ({
  ...summaryOf(), currency: 'XAF', currencyDigits: 0, discountApprovalPercent: 10,
  invoice: { id: 'inv-1', number: 'FAC-0000123', status: 'DRAFT', patient, subtotal: 11500, discount: 0, total: 11500 }, ...over,
});

export const approvalPage = (items: readonly Approval[], over: Partial<ApprovalPage> = {}): ApprovalPage => ({ items, total: items.length, offset: 0, limit: 25, ...over });

/** Double de test du port `ApprovalGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeApprovalGateway extends ApprovalGateway {
  override list = vi.fn<(filter: ApprovalFilter, offset: number, limit: number) => Promise<ApprovalPage>>().mockResolvedValue(
    approvalPage([
      approval(),
      approval({ id: 'ap-2', kind: 'CANCEL', amount: null, reason: 'Mauvais patient', invoice: { id: 'inv-2', number: 'FAC-0000122', status: 'ISSUED', patient, subtotal: 3000, discount: 0, total: 3000 } }),
    ]),
  );
  override request = vi.fn<(input: RequestApprovalInput) => Promise<Approval>>().mockImplementation((input) =>
    Promise.resolve(approval({ kind: input.kind, amount: input.kind === 'DISCOUNT' ? (input.amount ?? null) : null, reason: input.reason })),
  );
  override approve = vi.fn<(id: string, comment: string | null) => Promise<Approval>>().mockImplementation((id, comment) =>
    Promise.resolve(approval({ id, status: 'APPROVED', decidedBy: supervisor, decidedAt: '2026-10-24T09:40:00Z', decisionComment: comment })),
  );
  override reject = vi.fn<(id: string, comment: string) => Promise<Approval>>().mockImplementation((id, comment) =>
    Promise.resolve(approval({ id, status: 'REJECTED', decidedBy: supervisor, decidedAt: '2026-10-24T09:40:00Z', decisionComment: comment })),
  );
  override withdraw = vi.fn<(id: string) => Promise<Approval>>().mockImplementation((id) =>
    Promise.resolve(approval({ id, status: 'WITHDRAWN', decidedBy: requester, decidedAt: '2026-10-24T09:30:00Z' })),
  );
}

import { CashSessionGateway } from '../cash-session.gateway';
import { CashSessionDetail, CloseSessionInput, DenominationsInfo, OpenSessionInput, SessionFilter, SessionPage, countTotal } from '../cash-session.models';

export const DENOMINATIONS: DenominationsInfo = { currency: 'XAF', currencyDigits: 0, denominations: [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1], varianceLimit: 5000 };

/** Une caisse ouverte : fonds de 20 000, 12 000 d'espèces et 30 000 par carte encaissés, donc 32 000 d'espèces attendues. */
export function session(over: Partial<CashSessionDetail> = {}): CashSessionDetail {
  return {
    id: 's-1', number: 'CAI-0000007', status: 'OPEN', currency: 'XAF', currencyDigits: 0, cashier: { id: 'u-1', username: 'caissier.un' }, counter: 'Caisse OPD 1', openedAt: '2026-10-26T07:30:00Z',
    openingFloat: 20000, openingCount: { '5000': 2, '1000': 10 }, takings: { CASH: 12000, CARD: 30000, MOBILE_MONEY: 0, CHEQUE: 0, BANK_TRANSFER: 0 }, paymentCount: 2, totalTaken: 42000, expectedCash: 32000,
    closedAt: null, closingCount: null, countedCash: null, variance: null, varianceReason: null, requiresCosign: false, cosignedBy: null, cosignedAt: null, cosignComment: null, varianceLimit: 5000,
    payments: [
      { id: 'pay-1', receiptNumber: 'REC-0000001', invoiceNumber: 'FAC-0000123', mode: 'CASH', amount: 12000, receivedAt: '2026-10-26T08:10:00Z' },
      { id: 'pay-2', receiptNumber: 'REC-0000002', invoiceNumber: 'FAC-0000124', mode: 'CARD', amount: 30000, receivedAt: '2026-10-26T09:20:00Z' },
    ],
    ...over,
  };
}

/** La même caisse clôturée avec le comptage donné (le total et l'écart sont recalculés comme le fait le serveur). */
export function closed(count: Record<string, number>, reason: string | null = null, over: Partial<CashSessionDetail> = {}): CashSessionDetail {
  const counted = countTotal(count);
  const variance = counted - 32000;
  const review = Math.abs(variance) > 5000;
  return session({
    status: review ? 'AWAITING_REVIEW' : 'CLOSED', closedAt: '2026-10-26T16:00:00Z', closingCount: count, countedCash: counted, variance, varianceReason: variance === 0 ? null : reason, requiresCosign: review, ...over,
  });
}

/** Double de test du port `CashSessionGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeCashSessionGateway extends CashSessionGateway {
  override denominations = vi.fn<() => Promise<DenominationsInfo>>().mockResolvedValue(DENOMINATIONS);
  override current = vi.fn<() => Promise<CashSessionDetail | null>>().mockResolvedValue(session());
  override open = vi.fn<(input: OpenSessionInput) => Promise<CashSessionDetail>>().mockImplementation((input) =>
    Promise.resolve(session({ counter: input.counter, openingCount: input.openingCount, openingFloat: countTotal(input.openingCount), expectedCash: countTotal(input.openingCount), paymentCount: 0, totalTaken: 0, payments: [], takings: { CASH: 0, CARD: 0, MOBILE_MONEY: 0, CHEQUE: 0, BANK_TRANSFER: 0 } })),
  );
  override close = vi.fn<(id: string, input: CloseSessionInput) => Promise<CashSessionDetail>>().mockImplementation((_id, input) => Promise.resolve(closed(input.count as Record<string, number>, input.reason ?? null)));
  override get = vi.fn<(id: string) => Promise<CashSessionDetail>>().mockImplementation(() => Promise.resolve(session()));
  override list = vi.fn<(filter: SessionFilter, offset: number, limit: number) => Promise<SessionPage>>().mockResolvedValue({
    items: [
      session({ id: 's-2', number: 'CAI-0000008', status: 'AWAITING_REVIEW', cashier: { id: 'u-2', username: 'caissier.deux' }, counter: 'Caisse URG', closedAt: '2026-10-26T15:00:00Z', countedCash: 10000, variance: -22000, varianceReason: 'À vérifier', requiresCosign: true }),
      session(),
      session({ id: 's-0', number: 'CAI-0000006', status: 'CLOSED', closedAt: '2026-10-25T16:00:00Z', countedCash: 32000, variance: 0 }),
    ],
    total: 3, offset: 0, limit: 25,
  });
  override cosign = vi.fn<(id: string, comment: string | null) => Promise<CashSessionDetail>>().mockImplementation((_id, comment) =>
    Promise.resolve(closed({ '10000': 1 }, 'À vérifier', { status: 'CLOSED', cosignedBy: { id: 'u-9', username: 'comptable' }, cosignedAt: '2026-10-26T17:00:00Z', cosignComment: comment })),
  );
}

import { CashSession, CounterName, Denominations, denominationsOf, emptyTakings, parseSessionStatus, SessionId, SessionNumber, SessionStatus, Takings } from '../../src/modules/billing/domain/cash-session';
import { Amount, Currency, PaymentMode } from '../../src/modules/billing/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';

const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T16:00:00Z');
const XAF = must(Currency.create('XAF'));
const count = (raw: unknown) => must(Denominations.create(raw, XAF));

function takings(over: Partial<Record<PaymentMode, number>> = {}): Takings {
  const base = { ...emptyTakings() } as Record<PaymentMode, Amount>;
  for (const [mode, value] of Object.entries(over)) base[mode as PaymentMode] = must(Amount.create(value));
  return base;
}

function open(floor: unknown = { 5000: 2, 1000: 10 }): CashSession {
  return CashSession.open({ id: must(SessionId.create(uuid(1))), number: must(SessionNumber.fromSequence(1)), cashierId: uuid(10), counter: must(CounterName.create('Caisse OPD 1')), currency: XAF, openedAt: NOW, openingCount: count(floor) });
}

describe('sessions de caisse : comptage des billets et pièces', () => {
  it('propose les billets et pièces du franc CFA, de la plus grande valeur à la plus petite', () => {
    expect(denominationsOf(XAF)).toEqual([10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1]);
    expect(denominationsOf(must(Currency.create('XOF')))).toEqual(denominationsOf(XAF));
    expect(denominationsOf(must(Currency.create('EUR')))[0]).toBe(50000);
    expect(denominationsOf(must(Currency.create('ZZZ'))).length).toBeGreaterThan(5);
  });

  it('calcule le total à partir des quantités, jamais saisi', () => {
    expect(count({ 10000: 3, 5000: 2, 100: 4 }).total.value).toBe(30000 + 10000 + 400);
    expect(count({}).total.value).toBe(0);
    expect(count(undefined).total.value).toBe(0);
    expect(count(null).total.value).toBe(0);
  });

  it('écarte les valeurs à zéro', () => {
    expect(count({ 10000: 0, 500: 2 }).counts).toEqual({ '500': 2 });
  });

  it.each([
    ['une valeur qui n\'existe pas', { 3000: 1 }],
    ['une valeur décimale', { '50.5': 1 }],
    ['une quantité négative', { 500: -1 }],
    ['une quantité décimale', { 500: 1.5 }],
    ['une quantité trop grande', { 500: 100001 }],
    ['une quantité textuelle', { 500: '2' }],
    ['un tableau', [1, 2]],
    ['un texte', 'beaucoup'],
  ])('refuse %s', (_name, raw) => expect(codeOf(Denominations.create(raw, XAF))).toBe('BILLING_COUNT_INVALID'));

  it('accepte une quantité de 100 000', () => {
    expect(count({ 10000: 100000 }).total.value).toBe(1_000_000_000);
  });

  it('un poste a un nom de 1 à 40 caractères, sans espaces superflus', () => {
    expect(must(CounterName.create('  Caisse   OPD  1 ')).value).toBe('Caisse OPD 1');
    expect(codeOf(CounterName.create('   '))).toBe('BILLING_COUNTER_INVALID');
    expect(codeOf(CounterName.create('x'.repeat(41)))).toBe('BILLING_COUNTER_INVALID');
  });

  it('numérote les sessions et reconnaît leurs statuts', () => {
    expect(must(SessionNumber.fromSequence(7)).value).toBe('CAI-0000007');
    expect(codeOf(SessionNumber.create('FAC-0000007'))).toBe('BILLING_SESSION_NUMBER_INVALID');
    expect(must(parseSessionStatus('awaiting_review'))).toBe(SessionStatus.AWAITING_REVIEW);
    expect(codeOf(parseSessionStatus('x'))).toBe('BILLING_SESSION_STATUS_INVALID');
  });
});

describe('sessions de caisse : ouverture', () => {
  it('s\'ouvre avec le fonds de caisse compté, sans rien de clôturé', () => {
    const s = open();
    expect(s.state).toMatchObject({ status: 'OPEN', openingFloat: { value: 20000 }, closedAt: null, closingCount: null, countedCash: null, expectedCash: null, variance: null, requiresCosign: false });
  });

  it('peut s\'ouvrir sans fonds de caisse', () => {
    expect(open({}).state.openingFloat.value).toBe(0);
  });

  it('attend en caisse le fonds plus les seules espèces encaissées (pas la carte, pas le mobile money)', () => {
    const s = open();
    expect(s.expectedCashWith(takings({ CASH: 12000, CARD: 50000, MOBILE_MONEY: 7000 })).value).toBe(32000);
    expect(s.expectedCashWith(takings()).value).toBe(20000);
  });
});

describe('sessions de caisse : clôture', () => {
  const close = (s: CashSession, countRaw: unknown, over: { reason?: string | null; limit?: number; t?: Takings } = {}) =>
    s.close({ count: count(countRaw), reason: over.reason ?? null, now: LATER, takings: over.t ?? takings({ CASH: 12000 }), varianceLimit: over.limit ?? 5000 });

  it('clôt une caisse juste sans explication', () => {
    const s = open();
    must(close(s, { 10000: 3, 2000: 1 })); // 32 000 = 20 000 + 12 000
    expect(s.state).toMatchObject({ status: 'CLOSED', countedCash: { value: 32000 }, expectedCash: { value: 32000 }, variance: 0, varianceReason: null, requiresCosign: false });
    expect(s.state.closedAt?.toString()).toBe(LATER.toString());
    expect(s.state.closingCount?.counts).toEqual({ '10000': 3, '2000': 1 });
  });

  it('exige une explication dès que la caisse n\'est pas juste (manque ou excédent)', () => {
    const missing = open();
    expect(codeOf(close(missing, { 10000: 3 }))).toBe('BILLING_VARIANCE_REASON_REQUIRED');
    expect(missing.status).toBe(SessionStatus.OPEN); // rien n'a changé
    const extra = open();
    expect(codeOf(close(extra, { 10000: 4 }, { reason: '   ' }))).toBe('BILLING_VARIANCE_REASON_REQUIRED');
  });

  it('inscrit l\'écart signé : négatif quand il manque de l\'argent, positif en cas d\'excédent', () => {
    const excess = open();
    must(close(excess, { 10000: 3, 500: 6 }, { reason: 'Monnaie mal rendue' })); // 32 000 attendus, 33 000 comptés
    expect(excess.state.variance).toBe(1000);
    const missing = open();
    must(close(missing, { 10000: 3 }, { reason: 'Billet manquant' }));
    expect(missing.state).toMatchObject({ variance: -2000, varianceReason: 'Billet manquant', status: 'CLOSED' });
  });

  it('une explication d\'écart ne dépasse pas 200 caractères', () => {
    expect(codeOf(close(open(), { 10000: 3 }, { reason: 'x'.repeat(201) }))).toBe('BILLING_VARIANCE_REASON_REQUIRED');
  });

  it('au-delà de la limite d\'écart, attend la contre-signature d\'un responsable au lieu d\'être close', () => {
    const s = open();
    must(close(s, { 10000: 2 }, { reason: 'Écart important', limit: 5000 })); // attendu 32 000, compté 20 000 : -12 000
    expect(s.state).toMatchObject({ status: 'AWAITING_REVIEW', variance: -12000, requiresCosign: true, cosignedBy: null });
  });

  it('un écart égal à la limite reste dans la limite', () => {
    const s = open();
    must(close(s, { 10000: 2, 5000: 1, 2000: 3 }, { reason: 'Petit écart', limit: 5000 })); // 31 000 compté : -1 000 attendu 32 000
    expect(s.status).toBe(SessionStatus.CLOSED);
    const edge = open();
    must(close(edge, { 10000: 2, 5000: 1, 2000: 3, 500: 4 }, { reason: 'x', limit: 1000 })); // 33 000 : +1 000 = limite
    expect(edge.status).toBe(SessionStatus.CLOSED);
    const over = open();
    must(close(over, { 10000: 2, 5000: 1, 2000: 3, 500: 6 }, { reason: 'x', limit: 1000 })); // 34 000 : +2 000 > limite
    expect(over.status).toBe(SessionStatus.AWAITING_REVIEW);
  });

  it('avec une limite à zéro, tout écart attend une contre-signature', () => {
    const s = open();
    must(close(s, { 10000: 3, 100: 1 }, { reason: 'x', limit: 0 }));
    expect(s.status).toBe(SessionStatus.AWAITING_REVIEW);
  });

  it('ne se clôture qu\'une fois', () => {
    const s = open();
    must(close(s, { 10000: 3, 2000: 1 }));
    expect(codeOf(close(s, { 10000: 3, 2000: 1 }))).toBe('BILLING_SESSION_NOT_OPEN');
  });
});

describe('sessions de caisse : contre-signature', () => {
  function awaiting(): CashSession {
    const s = open();
    must(s.close({ count: count({ 10000: 2 }), reason: 'Écart important', now: LATER, takings: takings({ CASH: 12000 }), varianceLimit: 5000 }));
    return s;
  }

  it('un responsable valide la clôture, avec un commentaire facultatif', () => {
    const s = awaiting();
    must(s.cosign(uuid(20), '  Vérifié avec le caissier ', LATER));
    expect(s.state).toMatchObject({ status: 'CLOSED', cosignedBy: uuid(20), cosignComment: 'Vérifié avec le caissier', requiresCosign: true });
    expect(s.state.cosignedAt?.toString()).toBe(LATER.toString());
  });

  it('accepte une contre-signature sans commentaire', () => {
    const s = awaiting();
    must(s.cosign(uuid(20), null, LATER));
    expect(s.state.cosignComment).toBeNull();
  });

  it('refuse que le caissier contre-signe sa propre caisse', () => {
    const s = awaiting();
    expect(codeOf(s.cosign(uuid(10), null, LATER))).toBe('BILLING_COSIGN_SELF');
    expect(s.status).toBe(SessionStatus.AWAITING_REVIEW);
  });

  it('refuse un commentaire trop long, une session ouverte, ou déjà validée', () => {
    expect(codeOf(awaiting().cosign(uuid(20), 'x'.repeat(201), LATER))).toBe('BILLING_COSIGN_COMMENT_INVALID');
    expect(codeOf(open().cosign(uuid(20), null, LATER))).toBe('BILLING_SESSION_NOT_AWAITING_REVIEW');
    const done = awaiting();
    must(done.cosign(uuid(20), null, LATER));
    expect(codeOf(done.cosign(uuid(21), null, LATER))).toBe('BILLING_SESSION_NOT_AWAITING_REVIEW');
  });

  it('une clôture dans la limite n\'attend aucune contre-signature', () => {
    const s = open();
    must(s.close({ count: count({ 10000: 3, 2000: 1 }), reason: null, now: LATER, takings: takings({ CASH: 12000 }), varianceLimit: 5000 }));
    expect(codeOf(s.cosign(uuid(20), null, LATER))).toBe('BILLING_SESSION_NOT_AWAITING_REVIEW');
  });
});

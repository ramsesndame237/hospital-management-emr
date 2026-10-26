import { PGlite } from '@electric-sql/pglite';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { CashSession, CounterName, Denominations, SessionId, SessionStatus } from '../../src/modules/billing/domain/cash-session';
import { BillableItem } from '../../src/modules/billing/domain/item';
import { Invoice, Payment } from '../../src/modules/billing/domain/invoice';
import { Amount, Currency, InvoiceId, ItemCategory, ItemCode, ItemId, ItemName, LineId, PatientRef, PaymentId, PaymentMode, Quantity } from '../../src/modules/billing/domain/values';
import { PgCashSessionRepository } from '../../src/modules/billing/infrastructure/persistence/pg-cash-session.repository';
import { PgInvoiceRepository } from '../../src/modules/billing/infrastructure/persistence/pg-invoice.repository';
import { PgItemRepository } from '../../src/modules/billing/infrastructure/persistence/pg-item.repository';
import { err, ok } from '../../src/shared-kernel/result';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, MIGRATIONS, seedFixture, uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T16:00:00Z');
const XAF = must(Currency.create('XAF'));
const A = uuid(11); // premier caissier
const B = uuid(12); // second caissier

describe('schéma des sessions de caisse sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let sessions: PgCashSessionRepository;
  let invoices: PgInvoiceRepository;
  let items: PgItemRepository;
  let seq = 0;

  const newSession = async (cashier = A, counter = 'Caisse 1', floor: Record<string, number> = { 5000: 2 }): Promise<CashSession> => {
    seq += 1;
    return CashSession.open({
      id: must(SessionId.create(uuid(5000 + seq))), number: await sessions.nextSessionNumber(), cashierId: cashier, counter: must(CounterName.create(counter)), currency: XAF, openedAt: NOW,
      openingCount: must(Denominations.create(floor, XAF)),
    });
  };

  /** Une facture émise de `price`, prête à être encaissée. */
  const issuedInvoice = async (price: number): Promise<Invoice> => {
    seq += 1;
    const item = BillableItem.create({ id: must(ItemId.create(uuid(6000 + seq))), code: must(ItemCode.create(`ACT${seq}`)), name: must(ItemName.create('Acte')), category: ItemCategory.CONSULTATION, unitPrice: must(Amount.create(price)), serviceId: null });
    await items.insert(item);
    const inv = Invoice.draft({ id: must(InvoiceId.create(uuid(7000 + seq))), number: await invoices.nextInvoiceNumber(), patientId: must(PatientRef.create(f.patient1)), currency: XAF, note: null, createdBy: A });
    must(inv.addLine({ id: must(LineId.create(uuid(8000 + seq))), itemId: item.id, itemCode: item.state.code, itemName: item.state.name, unitPrice: item.state.unitPrice, quantity: must(Quantity.create(1)) }));
    await invoices.insert(inv); // brouillon d'abord : l'insertion ne porte ni statut ni date d'émission
    must(inv.issue(NOW));
    await invoices.save(inv);
    return (await invoices.findById(inv.id))!;
  };

  const payment = async (session: CashSession | null, amount: number, mode = PaymentMode.CASH, receivedBy = A): Promise<Payment> => {
    seq += 1;
    return { id: must(PaymentId.create(uuid(9000 + seq))), receiptNumber: await invoices.nextReceiptNumber(), mode, amount: must(Amount.positive(amount)), reference: null, receivedBy, receivedAt: NOW, sessionId: session?.id.value ?? null };
  };

  const close = (id: SessionId, counts: Record<string, number>, reason: string | null = null, limit = 5000) =>
    sessions.mutate(id, (r) => r.session.close({ count: must(Denominations.create(counts, XAF)), reason, now: LATER, takings: r.takings, varianceLimit: limit }));

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    sessions = new PgCashSessionRepository(sql);
    invoices = new PgInvoiceRepository(sql);
    items = new PgItemRepository(sql);
    seq = 0;
  });
  afterEach(() => db.close());

  describe('droits', () => {
    it('est idempotent et répartit les droits : la caisse tient, la comptabilité contre-signe, l\'administrateur système lit', async () => {
      await sessions.open(await newSession());
      for (const ddl of MIGRATIONS) await db.exec(ddl);
      expect((await sessions.list({}, 0, 10)).total).toBe(1);
      const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, new Set(r.permissions.map((p) => p.value))]));
      const holders = (p: string) => [...roles].filter(([, s]) => s.has(p)).map(([c]) => c).sort();
      expect(holders('billing.sessions:operate:all')).toEqual(['CASHIER']);
      expect(holders('billing.sessions:read:own')).toEqual(['CASHIER']);
      expect(holders('billing.sessions:read:all')).toEqual(['ACCOUNTANT', 'SYSTEM_ADMIN']);
      expect(holders('billing.sessions:cosign:all')).toEqual(['ACCOUNTANT']);
    });
  });

  describe('ouverture', () => {
    it('enregistre la session et la relit : fonds, comptage et heure', async () => {
      const s = await newSession(A, 'Caisse OPD 1', { 5000: 2, 1000: 10 });
      expect(await sessions.open(s)).toBe('OPENED');
      const record = (await sessions.findById(s.id))!;
      expect(record.session.state).toMatchObject({ number: { value: 'CAI-0000001' }, cashierId: A, counter: { value: 'Caisse OPD 1' }, status: 'OPEN', openingFloat: { value: 20000 }, closedAt: null });
      expect(record.session.state.openingCount.counts).toEqual({ '5000': 2, '1000': 10 });
      expect(record.session.state.openedAt.toString()).toBe(NOW.toString());
      expect(record.paymentCount).toBe(0);
      expect(Object.values(record.takings).every((t) => t.value === 0)).toBe(true);
    });

    it('retrouve la caisse ouverte d\'un caissier', async () => {
      const s = await newSession(A);
      await sessions.open(s);
      expect((await sessions.findOpenByCashier(A))?.session.id.value).toBe(s.id.value);
      expect(await sessions.findOpenByCashier(B)).toBeNull();
    });

    it('refuse une seconde caisse ouverte pour le même caissier, ou un poste déjà tenu (sans tenir compte de la casse)', async () => {
      expect(await sessions.open(await newSession(A, 'Caisse 1'))).toBe('OPENED');
      expect(await sessions.open(await newSession(A, 'Caisse 2'))).toBe('CASHIER_BUSY');
      expect(await sessions.open(await newSession(B, 'CAISSE 1'))).toBe('COUNTER_BUSY');
      expect((await sessions.list({}, 0, 10)).total).toBe(1);
      expect(await sessions.open(await newSession(B, 'Caisse 2'))).toBe('OPENED');
    });

    it('deux ouvertures simultanées ne passent pas toutes les deux', async () => {
      const outcomes = await Promise.all([sessions.open(await newSession(A, 'Caisse 1')), sessions.open(await newSession(A, 'Caisse 9'))]);
      expect(outcomes.sort()).toEqual(['CASHIER_BUSY', 'OPENED']);
      const counters = await Promise.all([sessions.open(await newSession(B, 'Poste X')), sessions.open(await newSession(uuid(13), 'poste x'))]);
      expect(counters.sort()).toEqual(['COUNTER_BUSY', 'OPENED']);
    });

    it('libère le caissier et le poste une fois la session clôturée', async () => {
      const s = await newSession(A, 'Caisse 1');
      await sessions.open(s);
      must((await close(s.id, { 5000: 2 }))!);
      expect(await sessions.open(await newSession(A, 'Caisse 1'))).toBe('OPENED');
      expect((await sessions.list({}, 0, 10)).total).toBe(2);
    });
  });

  describe('encaissements de la session', () => {
    it('totalise ce qui a été encaissé par mode, sans mélanger les sessions', async () => {
      const first = await newSession(A, 'Caisse 1');
      const second = await newSession(B, 'Caisse 2');
      await sessions.open(first);
      await sessions.open(second);
      const inv = await issuedInvoice(100000);
      expect(await invoices.addPayment((await invoices.findById(inv.id))!, await payment(first, 12000))).toBe('SAVED');
      expect(await invoices.addPayment((await invoices.findById(inv.id))!, await payment(first, 5000, PaymentMode.CARD))).toBe('SAVED');
      expect(await invoices.addPayment((await invoices.findById(inv.id))!, await payment(first, 3000))).toBe('SAVED');
      expect(await invoices.addPayment((await invoices.findById(inv.id))!, await payment(second, 7000, PaymentMode.MOBILE_MONEY, B))).toBe('SAVED');
      const a = (await sessions.findById(first.id))!;
      expect(a.paymentCount).toBe(3);
      expect([a.takings.CASH.value, a.takings.CARD.value, a.takings.MOBILE_MONEY.value]).toEqual([15000, 5000, 0]);
      const b = (await sessions.findById(second.id))!;
      expect([b.paymentCount, b.takings.MOBILE_MONEY.value, b.takings.CASH.value]).toEqual([1, 7000, 0]);
    });

    it('liste les encaissements d\'une session avec leur reçu et leur facture, du plus ancien au plus récent', async () => {
      const s = await newSession();
      await sessions.open(s);
      const inv = await issuedInvoice(50000);
      await invoices.addPayment((await invoices.findById(inv.id))!, await payment(s, 1000));
      await invoices.addPayment((await invoices.findById(inv.id))!, await payment(s, 2000, PaymentMode.CHEQUE));
      const list = await sessions.payments(s.id);
      expect(list.map((p) => [p.receiptNumber, p.invoiceNumber, p.mode, p.amount])).toEqual([['REC-0000001', inv.state.number.value, 'CASH', 1000], ['REC-0000002', inv.state.number.value, 'CHEQUE', 2000]]);
    });

    it('refuse un encaissement dans une session clôturée ou inconnue', async () => {
      const s = await newSession();
      await sessions.open(s);
      must((await close(s.id, { 5000: 2 }))!);
      const inv = await issuedInvoice(10000);
      expect(await invoices.addPayment(inv, await payment(s, 1000))).toBe('SESSION_CLOSED');
      const ghost = await newSession(B, 'Fantôme'); // jamais ouverte en base
      expect(await invoices.addPayment(inv, await payment(ghost, 1000))).toBe('SESSION_CLOSED');
      expect((await invoices.findById(inv.id))!.paid.value).toBe(0);
    });

    it('conserve les encaissements antérieurs aux sessions (sans session)', async () => {
      const inv = await issuedInvoice(10000);
      expect(await invoices.addPayment(inv, await payment(null, 1000))).toBe('SAVED');
      expect((await invoices.findById(inv.id))!.state.payments[0].sessionId).toBeNull();
    });
  });

  describe('clôture', () => {
    it('relit les encaissements et fige l\'attendu : fonds + espèces seulement', async () => {
      const s = await newSession(A, 'Caisse 1', { 5000: 2 }); // fonds 10 000
      await sessions.open(s);
      const inv = await issuedInvoice(100000);
      await invoices.addPayment(inv, await payment(s, 12000));
      await invoices.addPayment((await invoices.findById(inv.id))!, await payment(s, 40000, PaymentMode.CARD));
      const done = must((await close(s.id, { 10000: 2, 2000: 1 }))!); // 22 000 comptés, 22 000 attendus
      expect(done.session.state).toMatchObject({ status: 'CLOSED', expectedCash: { value: 22000 }, countedCash: { value: 22000 }, variance: 0, varianceReason: null });
      const reread = (await sessions.findById(s.id))!;
      expect(reread.session.state).toMatchObject({ status: 'CLOSED', closedAt: expect.anything(), requiresCosign: false });
      expect(reread.session.state.closingCount?.counts).toEqual({ '10000': 2, '2000': 1 });
      expect(reread.session.state.closedAt?.toString()).toBe(LATER.toString());
    });

    it('n\'écrit rien quand la règle du domaine refuse (écart sans explication)', async () => {
      const s = await newSession();
      await sessions.open(s);
      const result = await close(s.id, { 10000: 5 });
      expect(result && !result.ok && result.error.code).toBe('BILLING_VARIANCE_REASON_REQUIRED');
      expect((await sessions.findById(s.id))!.session.status).toBe(SessionStatus.OPEN);
    });

    it('met la session en attente de contre-signature quand l\'écart dépasse la limite', async () => {
      const s = await newSession();
      await sessions.open(s);
      const done = must((await close(s.id, { 10000: 5 }, 'Gros écart', 1000))!);
      expect(done.session.state).toMatchObject({ status: 'AWAITING_REVIEW', requiresCosign: true, variance: 40000, varianceReason: 'Gros écart' });
      expect((await sessions.findOpenByCashier(A))).toBeNull();
    });

    it('enregistre la contre-signature', async () => {
      const s = await newSession();
      await sessions.open(s);
      must((await close(s.id, { 10000: 5 }, 'Gros écart', 1000))!);
      const cosigned = await sessions.mutate(s.id, (r) => r.session.cosign(B, 'Vérifié', LATER));
      expect(cosigned && cosigned.ok).toBe(true);
      expect((await sessions.findById(s.id))!.session.state).toMatchObject({ status: 'CLOSED', cosignedBy: B, cosignComment: 'Vérifié' });
    });

    it('renvoie null pour une session inconnue', async () => {
      expect(await sessions.mutate(must(SessionId.create(uuid(1))), () => ok(undefined))).toBeNull();
      expect(await sessions.findById(must(SessionId.create(uuid(1))))).toBeNull();
    });

    it('une règle du domaine qui échoue ne modifie rien (rollback)', async () => {
      const s = await newSession();
      await sessions.open(s);
      const refused = await sessions.mutate(s.id, () => err({ code: 'X', message: 'non', details: {} } as never));
      expect(refused && refused.ok).toBe(false);
      expect((await sessions.findById(s.id))!.session.status).toBe(SessionStatus.OPEN);
    });

    it('un encaissement simultané à la clôture est soit compté dans l\'attendu, soit refusé : jamais perdu', async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        const s = await newSession(uuid(100 + attempt), `Poste ${attempt}`, {});
        await sessions.open(s);
        const inv = await issuedInvoice(50000);
        const pay = await payment(s, 7000, PaymentMode.CASH, uuid(100 + attempt));
        const [paid, closed] = await Promise.all([invoices.addPayment(inv, pay), close(s.id, { 10000: 1 }, 'Écart', 100000)]);
        const final = (await sessions.findById(s.id))!;
        expect(closed && closed.ok).toBe(true);
        expect(final.session.status).toBe(SessionStatus.CLOSED);
        expect(['SAVED', 'SESSION_CLOSED']).toContain(paid);
        // ce que la base contient correspond exactement à ce que la clôture a vu
        expect(final.session.state.expectedCash?.value).toBe(final.takings.CASH.value);
        expect(paid === 'SAVED' ? 7000 : 0).toBe(final.takings.CASH.value);
        // et plus aucun encaissement n'est possible ensuite
        expect(await invoices.addPayment((await invoices.findById(inv.id))!, await payment(s, 1000))).toBe('SESSION_CLOSED');
      }
    });
  });

  describe('liste', () => {
    it('filtre par caissier et par statut, les plus récentes en premier, et pagine', async () => {
      const first = await newSession(A, 'Caisse 1');
      await sessions.open(first);
      must((await close(first.id, { 5000: 2 }))!);
      const second = await newSession(A, 'Caisse 1');
      await sessions.open(second);
      const third = await newSession(B, 'Caisse 2');
      await sessions.open(third);

      const all = await sessions.list({}, 0, 10);
      expect(all.total).toBe(3);
      expect((await sessions.list({ cashierId: A }, 0, 10)).items.map((r) => r.session.state.number.value)).toHaveLength(2);
      expect((await sessions.list({ status: SessionStatus.OPEN }, 0, 10)).total).toBe(2);
      expect((await sessions.list({ status: SessionStatus.CLOSED, cashierId: B }, 0, 10)).total).toBe(0);
      const page = await sessions.list({}, 1, 1);
      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(3);
    });
  });

  describe('contraintes de la base', () => {
    const insert = (over: Record<string, unknown>) => {
      const row = { id: uuid(1), session_number: 'CAI-0000099', cashier_id: A, counter: 'X', currency: 'XAF', status: 'OPEN', opened_at: '2026-11-02T08:00:00Z', opening_float: 0, ...over };
      const keys = Object.keys(row);
      return sql.query(`INSERT INTO billing_cash_sessions (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
    };

    it('refuse une session ouverte déjà clôturée, ou une session close sans comptage', async () => {
      await expect(insert({ closed_at: '2026-11-02T16:00:00Z' })).rejects.toThrow();
      await expect(insert({ status: 'CLOSED', closed_at: '2026-11-02T16:00:00Z' })).rejects.toThrow();
    });

    it('refuse un écart sans explication et une contre-signature requise mais absente', async () => {
      const closed = { status: 'CLOSED', closed_at: '2026-11-02T16:00:00Z', closing_count: '{}', counted_cash: 0, expected_cash: 100 };
      await expect(insert({ ...closed, variance: -100 })).rejects.toThrow();
      await insert({ ...closed, variance: -100, variance_reason: 'Erreur' }).then(() => undefined);
      await expect(insert({ ...closed, id: uuid(2), session_number: 'CAI-0000098', counter: 'Y', cashier_id: B, variance: 0, requires_cosign: true })).rejects.toThrow();
    });

    it('refuse un numéro mal formé, un fonds négatif, un nom de poste vide ou trop long', async () => {
      await expect(insert({ session_number: 'FAC-0000001' })).rejects.toThrow();
      await expect(insert({ opening_float: -1 })).rejects.toThrow();
      await expect(insert({ counter: '' })).rejects.toThrow();
      await expect(insert({ counter: 'x'.repeat(41) })).rejects.toThrow();
      await expect(insert({ status: 'FERMEE' })).rejects.toThrow();
    });

    it('refuse en SQL direct deux sessions ouvertes pour le même caissier ou le même poste', async () => {
      await insert({});
      await expect(insert({ id: uuid(2), session_number: 'CAI-0000098', counter: 'Autre' })).rejects.toThrow();
      await expect(insert({ id: uuid(3), session_number: 'CAI-0000097', cashier_id: B, counter: 'x' })).rejects.toThrow();
    });
  });
});

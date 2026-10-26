import { PGlite } from '@electric-sql/pglite';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { BillableItem } from '../../src/modules/billing/domain/item';
import { Invoice, Payment } from '../../src/modules/billing/domain/invoice';
import {
  Amount, Currency, InvoiceId, InvoiceNumber, InvoiceStatus, ItemCategory, ItemCode, ItemId, ItemName, LineId, PatientRef, PaymentId, PaymentMode, Quantity, Reason, ServiceRef,
} from '../../src/modules/billing/domain/values';
import { CashSession, CounterName, Denominations, SessionId } from '../../src/modules/billing/domain/cash-session';
import { PgCashSessionRepository } from '../../src/modules/billing/infrastructure/persistence/pg-cash-session.repository';
import { PgInvoiceRepository } from '../../src/modules/billing/infrastructure/persistence/pg-invoice.repository';
import { PgItemRepository } from '../../src/modules/billing/infrastructure/persistence/pg-item.repository';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, MIGRATIONS, seedFixture, uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T09:00:00Z');

describe('schéma de la facturation sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let items: PgItemRepository;
  let invoices: PgInvoiceRepository;
  let sessions: PgCashSessionRepository;
  /** La caisse ouverte pendant laquelle les encaissements de ces tests sont perçus. */
  let openSession: string;
  let seq = 0;

  const newItem = (code: string, price = 5000, over: { name?: string; category?: ItemCategory; serviceId?: string } = {}): BillableItem => {
    seq += 1;
    return BillableItem.create({
      id: must(ItemId.create(uuid(500 + seq))), code: must(ItemCode.create(code)), name: must(ItemName.create(over.name ?? `Acte ${code}`)), category: over.category ?? ItemCategory.CONSULTATION,
      unitPrice: must(Amount.create(price)), serviceId: over.serviceId ? must(ServiceRef.create(over.serviceId)) : null,
    });
  };

  /** Une facture brouillon avec une ligne par acte donné ; l'acte est d'abord écrit au catalogue (clé étrangère). */
  const newInvoice = async (specs: { code: string; price: number; quantity?: number }[], patient = f.patient1): Promise<Invoice> => {
    seq += 1;
    const inv = Invoice.draft({
      id: must(InvoiceId.create(uuid(700 + seq))), number: await invoices.nextInvoiceNumber(), patientId: must(PatientRef.create(patient)), currency: must(Currency.create('XAF')), note: null, createdBy: uuid(1),
    });
    for (const spec of specs) {
      const item = newItem(spec.code, spec.price);
      expect(await items.insert(item)).toBe(true);
      must(inv.addLine({ id: must(LineId.create(uuid(800 + seq * 10 + inv.state.lines.length))), itemId: item.id, itemCode: item.state.code, itemName: item.state.name, unitPrice: item.state.unitPrice, quantity: must(Quantity.create(spec.quantity ?? 1)) }));
    }
    await invoices.insert(inv);
    return inv;
  };

  const pay = async (value: number, mode = PaymentMode.CASH): Promise<Payment> => {
    seq += 1;
    return { id: must(PaymentId.create(uuid(900 + seq))), receiptNumber: await invoices.nextReceiptNumber(), mode, amount: must(Amount.positive(value)), reference: null, receivedBy: uuid(1), receivedAt: NOW, sessionId: openSession };
  };

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    items = new PgItemRepository(sql);
    invoices = new PgInvoiceRepository(sql);
    sessions = new PgCashSessionRepository(sql);
    seq = 0;
    const session = CashSession.open({
      id: must(SessionId.create(uuid(4000))), number: await sessions.nextSessionNumber(), cashierId: uuid(1), counter: must(CounterName.create('Caisse 1')), currency: must(Currency.create('XAF')),
      openedAt: NOW, openingCount: Denominations.EMPTY,
    });
    expect(await sessions.open(session)).toBe('OPENED');
    openSession = session.id.value;
  });
  afterEach(() => db.close());

  describe('droits et déploiement', () => {
    it('est idempotent et répartit les droits : caisse, comptabilité, accueil, administrateur système', async () => {
      await items.insert(newItem('CONS'));
      for (const ddl of MIGRATIONS) await db.exec(ddl);
      expect((await items.list({ includeInactive: true }, 0, 10)).total).toBe(1);
      const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, new Set(r.permissions.map((p) => p.value))]));
      const holders = (p: string) => [...roles].filter(([, s]) => s.has(p)).map(([c]) => c).sort();
      expect(holders('billing.catalog:read:all')).toEqual(['ACCOUNTANT', 'CASHIER', 'RECEPTIONIST', 'SYSTEM_ADMIN']);
      expect(holders('billing.catalog:manage:all')).toEqual(['SYSTEM_ADMIN']);
      expect(holders('billing.invoices:read:all')).toEqual(['ACCOUNTANT', 'CASHIER', 'SYSTEM_ADMIN']);
      expect(holders('billing.invoices:write:all')).toEqual(['CASHIER']);
      expect(holders('billing.payments:collect:all')).toEqual(['CASHIER']);
      for (const clinical of ['DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'PATIENT']) {
        expect([...roles.get(clinical)!].some((p) => p.startsWith('billing.'))).toBe(false);
      }
    });
  });

  describe('catalogue des actes', () => {
    it('enregistre un acte et le relit tel quel', async () => {
      const item = newItem('CONS-GEN', 5000, { name: 'Consultation générale', serviceId: f.serviceA });
      expect(await items.insert(item)).toBe(true);
      const loaded = (await items.findById(item.id))!;
      expect(loaded.state).toMatchObject({ code: { value: 'CONS-GEN' }, name: { value: 'Consultation générale' }, category: 'CONSULTATION', unitPrice: { value: 5000 }, active: true });
      expect(loaded.state.serviceId?.value).toBe(f.serviceA);
      expect((await items.findByCode(must(ItemCode.create('cons-gen'))))?.id.value).toBe(item.id.value);
    });

    it('refuse un code déjà pris sans écrire ni lever d\'erreur', async () => {
      expect(await items.insert(newItem('DOUBLON'))).toBe(true);
      expect(await items.insert(newItem('DOUBLON', 9999))).toBe(false);
      expect((await items.list({ includeInactive: true }, 0, 10)).total).toBe(1);
    });

    it('conserve des prix qui dépassent la limite des entiers 32 bits', async () => {
      const item = newItem('GROS', 4_000_000_000);
      await items.insert(item);
      expect((await items.findById(item.id))!.state.unitPrice.value).toBe(4_000_000_000);
    });

    it('met à jour le libellé, la catégorie, le prix et le service, mais jamais le code', async () => {
      const item = newItem('STABLE');
      await items.insert(item);
      item.update({ name: must(ItemName.create('Nouveau libellé')), category: ItemCategory.LABORATORY, unitPrice: must(Amount.create(7500)), serviceId: must(ServiceRef.create(f.serviceB)) });
      await items.update(item);
      const loaded = (await items.findById(item.id))!;
      expect(loaded.state).toMatchObject({ code: { value: 'STABLE' }, category: 'LABORATORY', unitPrice: { value: 7500 } });
      expect(loaded.state.serviceId?.value).toBe(f.serviceB);
      item.update({ serviceId: null });
      await items.update(item);
      expect((await items.findById(item.id))!.state.serviceId).toBeNull();
    });

    it('liste par code, filtre par catégorie, service et recherche, masque les actes retirés, pagine', async () => {
      await items.insert(newItem('B-ECHO', 10000, { name: 'Échographie', category: ItemCategory.RADIOLOGY }));
      await items.insert(newItem('A-CONS', 5000, { name: 'Consultation', category: ItemCategory.CONSULTATION, serviceId: f.serviceA }));
      const gone = newItem('C-OLD', 100, { name: 'Ancien acte' });
      gone.setActive(false);
      await items.insert(gone);

      const all = await items.list({ includeInactive: false }, 0, 10);
      expect(all.items.map((i) => i.state.code.value)).toEqual(['A-CONS', 'B-ECHO']);
      expect(all.total).toBe(2);
      expect((await items.list({ includeInactive: true }, 0, 10)).total).toBe(3);
      expect((await items.list({ includeInactive: false, category: ItemCategory.RADIOLOGY }, 0, 10)).items.map((i) => i.state.code.value)).toEqual(['B-ECHO']);
      expect((await items.list({ includeInactive: false, serviceId: must(ServiceRef.create(f.serviceA)) }, 0, 10)).items.map((i) => i.state.code.value)).toEqual(['A-CONS']);
      expect((await items.list({ includeInactive: false, search: 'écho' }, 0, 10)).items.map((i) => i.state.code.value)).toEqual(['B-ECHO']);
      expect((await items.list({ includeInactive: false, search: 'b-e' }, 0, 10)).total).toBe(1);
      const page = await items.list({ includeInactive: false }, 1, 1);
      expect(page.items.map((i) => i.state.code.value)).toEqual(['B-ECHO']);
      expect(page.total).toBe(2);
    });

    it('traite les caractères génériques de la recherche comme du texte', async () => {
      await items.insert(newItem('PCT', 100, { name: 'Remise 100% garantie' }));
      await items.insert(newItem('AUTRE', 100, { name: 'Autre chose' }));
      expect((await items.list({ includeInactive: false, search: '%' }, 0, 10)).items.map((i) => i.state.code.value)).toEqual(['PCT']);
      expect((await items.list({ includeInactive: false, search: '_' }, 0, 10)).total).toBe(0);
    });

    it('refuse un prix négatif, un code mal formé ou une catégorie inconnue au niveau de la base', async () => {
      const insert = (code: string, category: string, price: number) =>
        sql.query("INSERT INTO billing_items (id, code, name, category, unit_price) VALUES ($1, $2, 'x', $3, $4)", [uuid(1), code, category, price]);
      await expect(insert('OK', 'CONSULTATION', -1)).rejects.toThrow();
      await expect(insert('bad code', 'CONSULTATION', 1)).rejects.toThrow();
      await expect(insert('OK2', 'MAGIE', 1)).rejects.toThrow();
    });
  });

  describe('factures', () => {
    it('numérote en séquence, FAC puis REC', async () => {
      expect((await invoices.nextInvoiceNumber()).value).toBe('FAC-0000001');
      expect((await invoices.nextInvoiceNumber()).value).toBe('FAC-0000002');
      expect((await invoices.nextReceiptNumber()).value).toBe('REC-0000001');
    });

    it('conserve la facture, ses lignes dans l\'ordre et leur copie du prix', async () => {
      const inv = await newInvoice([{ code: 'A', price: 5000, quantity: 2 }, { code: 'B', price: 1500 }]);
      const loaded = (await invoices.findById(inv.id))!;
      expect(loaded.state).toMatchObject({ status: 'DRAFT', currency: { value: 'XAF' }, version: 0, issuedAt: null });
      expect(loaded.state.lines.map((l) => [l.itemCode.value, l.unitPrice.value, l.quantity.value])).toEqual([['A', 5000, 2], ['B', 1500, 1]]);
      expect(loaded.subtotal.value).toBe(11500);
    });

    it("la ligne garde le prix d'origine quand l'acte change ensuite de prix", async () => {
      const inv = await newInvoice([{ code: 'A', price: 5000 }]);
      const item = (await items.findByCode(must(ItemCode.create('A'))))!;
      item.update({ unitPrice: must(Amount.create(9000)) });
      await items.update(item);
      expect((await invoices.findById(inv.id))!.state.lines[0].unitPrice.value).toBe(5000);
    });

    it('enregistre une modification (remise, émission) et incrémente la version', async () => {
      const inv = await newInvoice([{ code: 'A', price: 5000 }]);
      must(inv.setDiscount(must(Amount.create(500)), must(Reason.create('Personnel'))));
      expect(await invoices.save(inv)).toBe('SAVED');
      const reread = (await invoices.findById(inv.id))!;
      expect(reread.state).toMatchObject({ version: 1, discount: { value: 500 } });
      expect(reread.state.discountReason?.value).toBe('Personnel');
      must(reread.issue(NOW));
      expect(await invoices.save(reread)).toBe('SAVED');
      const issued = (await invoices.findById(inv.id))!;
      expect(issued.state).toMatchObject({ status: 'ISSUED', version: 2 });
      expect(issued.state.issuedAt?.toString()).toBe(NOW.toString());
    });

    it("refuse l'écriture d'une facture lue avant une autre modification (deux caissiers en même temps)", async () => {
      const inv = await newInvoice([{ code: 'A', price: 5000 }]);
      const first = (await invoices.findById(inv.id))!;
      const second = (await invoices.findById(inv.id))!;
      must(first.setDiscount(must(Amount.create(100)), must(Reason.create('Premier'))));
      expect(await invoices.save(first)).toBe('SAVED');
      must(second.setDiscount(must(Amount.create(900)), must(Reason.create('Second'))));
      expect(await invoices.save(second)).toBe('CHANGED');
      expect((await invoices.findById(inv.id))!.state.discount.value).toBe(100); // la seconde écriture n'a rien touché
    });

    it('remplace les lignes à chaque enregistrement, sans en laisser de résiduelles', async () => {
      const inv = await newInvoice([{ code: 'A', price: 1000 }, { code: 'B', price: 2000 }, { code: 'C', price: 3000 }]);
      must(inv.removeLine(inv.state.lines[1].id));
      expect(await invoices.save(inv)).toBe('SAVED');
      expect((await invoices.findById(inv.id))!.state.lines.map((l) => l.itemCode.value)).toEqual(['A', 'C']);
    });

    it('trouve une facture par un de ses encaissements', async () => {
      const inv = await newInvoice([{ code: 'A', price: 5000 }]);
      must(inv.issue(NOW));
      await invoices.save(inv);
      const payment = await pay(2000);
      expect(await invoices.addPayment((await invoices.findById(inv.id))!, payment)).toBe('SAVED');
      const found = (await invoices.findByPayment(payment.id))!;
      expect(found.invoice.id.value).toBe(inv.id.value);
      expect(found.payment.receiptNumber.value).toBe(payment.receiptNumber.value);
      expect(await invoices.findByPayment(must(PaymentId.create(uuid(1))))).toBeNull();
    });

    it('refuse en base une remise sans motif, une annulation sans motif, une facture émise sans date', async () => {
      const inv = await newInvoice([{ code: 'A', price: 5000 }]);
      const id = inv.id.value;
      await expect(sql.query('UPDATE billing_invoices SET discount_amount = 100 WHERE id = $1', [id])).rejects.toThrow();
      await expect(sql.query("UPDATE billing_invoices SET status = 'CANCELLED' WHERE id = $1", [id])).rejects.toThrow();
      await expect(sql.query("UPDATE billing_invoices SET status = 'ISSUED' WHERE id = $1", [id])).rejects.toThrow();
      await expect(sql.query("UPDATE billing_invoices SET status = 'ARCHIVEE' WHERE id = $1", [id])).rejects.toThrow();
    });

    it('refuse une facture pour un patient inconnu', async () => {
      await expect(
        sql.query("INSERT INTO billing_invoices (id, invoice_number, patient_id, status, currency, created_by) VALUES ($1, 'FAC-0000099', $2, 'DRAFT', 'XAF', $3)", [uuid(1), uuid(9999), uuid(1)]),
      ).rejects.toThrow();
    });
  });

  describe('encaissements', () => {
    const issuedInvoice = async (price = 10000): Promise<Invoice> => {
      const inv = await newInvoice([{ code: `ACT${seq + 1}`, price }]);
      must(inv.issue(NOW));
      await invoices.save(inv);
      return (await invoices.findById(inv.id))!;
    };

    it('met la facture à jour : PARTIALLY_PAID puis PAID, avec le solde', async () => {
      const inv = await issuedInvoice(10000);
      expect(await invoices.addPayment(inv, await pay(4000))).toBe('SAVED');
      let loaded = (await invoices.findById(inv.id))!;
      expect([loaded.status, loaded.paid.value, loaded.balance.value]).toEqual(['PARTIALLY_PAID', 4000, 6000]);
      expect(await invoices.addPayment(loaded, await pay(6000, PaymentMode.MOBILE_MONEY))).toBe('SAVED');
      loaded = (await invoices.findById(inv.id))!;
      expect([loaded.status, loaded.balance.value]).toEqual(['PAID', 0]);
      expect(loaded.state.payments.map((p) => [p.receiptNumber.value, p.mode, p.amount.value])).toEqual([['REC-0000001', 'CASH', 4000], ['REC-0000002', 'MOBILE_MONEY', 6000]]);
    });

    it('refuse un paiement qui dépasserait le solde, sans rien écrire', async () => {
      const inv = await issuedInvoice(10000);
      expect(await invoices.addPayment(inv, await pay(10001))).toBe('OVERPAYMENT');
      const loaded = (await invoices.findById(inv.id))!;
      expect([loaded.status, loaded.state.payments.length]).toEqual(['ISSUED', 0]);
    });

    it("deux caisses qui encaissent en même temps ne dépassent jamais le total : la seconde relit ce que la première a perçu", async () => {
      const inv = await issuedInvoice(10000);
      const a = await pay(7000);
      const b = await pay(7000);
      // les deux caisses ont lu la même facture (rien d'encaissé) : seule la base voit la course
      const outcomes = await Promise.all([invoices.addPayment(inv, a), invoices.addPayment(inv, b)]);
      expect(outcomes.sort()).toEqual(['OVERPAYMENT', 'SAVED']);
      const loaded = (await invoices.findById(inv.id))!;
      expect(loaded.paid.value).toBe(7000);
      expect(loaded.status).toBe('PARTIALLY_PAID');
    });

    it('refuse d\'encaisser une facture annulée ou encore brouillon', async () => {
      const draftInvoice = await newInvoice([{ code: 'D', price: 1000 }]);
      expect(await invoices.addPayment(draftInvoice, await pay(100))).toBe('CHANGED');
      const inv = await issuedInvoice(1000);
      must(inv.cancel(must(Reason.create('Erreur'))));
      await invoices.save(inv);
      expect(await invoices.addPayment(inv, await pay(100))).toBe('CHANGED');
    });

    it('un encaissement ne se modifie ni ne se supprime, même en SQL direct', async () => {
      const inv = await issuedInvoice(10000);
      const payment = await pay(1000);
      await invoices.addPayment(inv, payment);
      await expect(sql.query('UPDATE billing_payments SET amount = 1 WHERE id = $1', [payment.id.value])).rejects.toThrow(/avoir/);
      await expect(sql.query('DELETE FROM billing_payments WHERE id = $1', [payment.id.value])).rejects.toThrow(/avoir/);
      await expect(sql.query('TRUNCATE billing_payments')).rejects.toThrow(/avoir/);
      expect((await invoices.findById(inv.id))!.paid.value).toBe(1000);
    });

    it('refuse en base un montant nul ou un mode inconnu', async () => {
      const inv = await issuedInvoice(10000);
      const insert = (amount: number, mode: string, n: number) =>
        sql.query("INSERT INTO billing_payments (id, invoice_id, receipt_number, mode, amount, received_by) VALUES ($1, $2, $3, $4, $5, $6)", [uuid(950 + n), inv.id.value, `REC-00001${n}0`, mode, amount, uuid(1)]);
      await expect(insert(0, 'CASH', 1)).rejects.toThrow();
      await expect(insert(5, 'TROC', 2)).rejects.toThrow();
    });

    it('un numéro de reçu est unique', async () => {
      const inv = await issuedInvoice(10000);
      const payment = await pay(1000);
      await invoices.addPayment(inv, payment);
      const clone: Payment = { ...payment, id: must(PaymentId.create(uuid(960))) };
      await expect(invoices.addPayment((await invoices.findById(inv.id))!, clone)).rejects.toThrow();
    });
  });

  describe('liste des factures', () => {
    it('résume totaux, remise et encaissé, les plus récentes en premier', async () => {
      const a = await newInvoice([{ code: 'A', price: 5000, quantity: 2 }]);
      must(a.setDiscount(must(Amount.create(1000)), must(Reason.create('Fidélité'))));
      must(a.issue(NOW));
      await invoices.save(a);
      await invoices.addPayment((await invoices.findById(a.id))!, await pay(3000));
      const b = await newInvoice([{ code: 'B', price: 800 }], f.patient2);

      const page = await invoices.list({}, 0, 10);
      expect(page.total).toBe(2);
      expect(page.items.map((i) => i.number)).toEqual([b.state.number.value, a.state.number.value]);
      expect(page.items[1]).toMatchObject({ subtotal: 10000, discount: 1000, total: 9000, paid: 3000, status: 'PARTIALLY_PAID', currency: 'XAF' });
      expect(page.items[0]).toMatchObject({ subtotal: 800, total: 800, paid: 0, status: 'DRAFT', issuedAt: null });
    });

    it('filtre par patient, statut, numéro et période, et pagine', async () => {
      const a = await newInvoice([{ code: 'A', price: 1000 }]);
      const b = await newInvoice([{ code: 'B', price: 1000 }], f.patient2);
      must(b.issue(NOW));
      await invoices.save(b);
      expect((await invoices.list({ patientId: must(PatientRef.create(f.patient2)) }, 0, 10)).items.map((i) => i.id)).toEqual([b.id.value]);
      expect((await invoices.list({ status: InvoiceStatus.DRAFT }, 0, 10)).items.map((i) => i.id)).toEqual([a.id.value]);
      expect((await invoices.list({ number: a.state.number }, 0, 10)).total).toBe(1);
      expect((await invoices.list({ from: '2100-01-01T00:00:00Z' }, 0, 10)).total).toBe(0);
      expect((await invoices.list({ to: '2100-01-01T00:00:00Z' }, 0, 10)).total).toBe(2);
      const second = await invoices.list({}, 1, 1);
      expect(second.items).toHaveLength(1);
      expect(second.total).toBe(2);
    });
  });
});

import { PGlite } from '@electric-sql/pglite';
import { Drug } from '../../src/modules/pharmacy/domain/drug';
import { OrderContent, PurchaseOrder } from '../../src/modules/pharmacy/domain/purchase-order';
import { GoodsReceipt, ReceiptLine } from '../../src/modules/pharmacy/domain/receipt';
import { Supplier } from '../../src/modules/pharmacy/domain/supplier';
import {
  BatchId, BatchNumber, DrugCode, DrugId, DrugName, GenericName, Money, parseExpiry, PurchaseOrderId, Reason, ReceiptId, SupplierCode, SupplierId,
} from '../../src/modules/pharmacy/domain/values';
import { PgDrugRepository } from '../../src/modules/pharmacy/infrastructure/persistence/pg-drug.repository';
import { PgPurchaseOrderRepository } from '../../src/modules/pharmacy/infrastructure/persistence/pg-purchase-order.repository';
import { PgStockRepository } from '../../src/modules/pharmacy/infrastructure/persistence/pg-stock.repository';
import { PgSupplierRepository } from '../../src/modules/pharmacy/infrastructure/persistence/pg-supplier.repository';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { freshDatabase, uuid } from '../support/seed-sql';

const TODAY = Temporal.PlainDate.from('2026-11-02');
const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const AUTHOR = uuid(31);
const APPROVER = uuid(32);
const money = (n: number) => must(Money.create(n));

describe('schéma de l\'approvisionnement sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let drugs: PgDrugRepository;
  let suppliers: PgSupplierRepository;
  let orders: PgPurchaseOrderRepository;
  let stock: PgStockRepository;
  let seq = 0;

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    drugs = new PgDrugRepository(sql);
    suppliers = new PgSupplierRepository(sql);
    orders = new PgPurchaseOrderRepository(sql);
    stock = new PgStockRepository(sql);
  });
  afterEach(async () => db.close());

  const newDrug = async (code: string): Promise<Drug> => {
    seq += 1;
    const d = must(Drug.create({
      id: must(DrugId.create(uuid(1000 + seq))), code: must(DrugCode.create(code)), name: must(DrugName.create(`Médicament ${code}`)), genericName: must(GenericName.create(`DCI ${code}`)), strength: null, form: 'TABLET',
      schedule: 'OTC', storage: 'ROOM', atcCode: null, unit: 'comprimé', unitPrice: money(25), reorderLevel: 100, notes: null,
    }));
    expect(await drugs.insert(d)).toBe(true);
    return d;
  };

  const newSupplier = async (code: string, over: Partial<Parameters<typeof Supplier.create>[0]> = {}): Promise<Supplier> => {
    seq += 1;
    const s = must(Supplier.create({
      id: must(SupplierId.create(uuid(2000 + seq))), code: must(SupplierCode.create(code)), name: `Fournisseur ${code}`, contactName: null, phone: null, email: null, address: null, paymentTermsDays: 30, notes: null, ...over,
    }));
    expect(await suppliers.insert(s)).toBe(true);
    return s;
  };

  const content = (s: Supplier, lines: [Drug, number, number][]): OrderContent => ({
    supplierId: s.id, expectedOn: Temporal.PlainDate.from('2026-11-20'), notes: null, lines: lines.map(([d, quantity, cost]) => ({ drugId: d.id, quantity, unitCost: money(cost) })),
  });

  const newOrder = async (s: Supplier, lines: [Drug, number, number][], by = AUTHOR): Promise<PurchaseOrder> => {
    seq += 1;
    const o = must(PurchaseOrder.create({ id: must(PurchaseOrderId.create(uuid(3000 + seq))), number: await orders.nextNumber(), createdBy: by, createdAt: NOW, content: content(s, lines) }));
    await orders.insert(o);
    return o;
  };

  const approve = async (o: PurchaseOrder) => {
    must((await orders.mutate(o.id, (x) => x.submit(NOW)))!);
    return must((await orders.mutate(o.id, (x) => x.approve(APPROVER, LATER)))!);
  };

  const receiptFor = async (order: PurchaseOrder, lines: [Drug, string, number][]): Promise<GoodsReceipt> => {
    seq += 1;
    const rl: ReceiptLine[] = lines.map(([d, batch, quantity]) => ({ drugId: d.id, batchId: must(BatchId.create(uuid(4000 + ++seq))), batchNumber: must(BatchNumber.create(batch)), expiry: must(parseExpiry('2027-06-30')), quantity, unitCost: money(10) }));
    return must(GoodsReceipt.create({ id: must(ReceiptId.create(uuid(5000 + seq))), number: await stock.nextReceiptNumber(), supplier: 'x', receivedBy: AUTHOR, receivedAt: LATER, purchaseOrderId: order.id, lines: rl }, TODAY));
  };

  describe('fournisseurs', () => {
    it('enregistre, relit, met à jour et efface les champs facultatifs', async () => {
      const s = await newSupplier('PHARMADIS', { contactName: 'Mme Ngo', phone: '+237 699 00 00 00', email: 'a@b.cm', address: 'Douala', paymentTermsDays: 45, notes: 'Livre le lundi' });
      const found = (await suppliers.findById(s.id))!;
      expect(found.state).toMatchObject({ code: { value: 'PHARMADIS' }, contactName: 'Mme Ngo', email: 'a@b.cm', paymentTermsDays: 45, notes: 'Livre le lundi', active: true });
      expect((await suppliers.findByCode(must(SupplierCode.create('pharmadis'))))!.id.value).toBe(s.id.value);
      must(found.update({ phone: null, paymentTermsDays: 0 }));
      found.setActive(false);
      await suppliers.update(found);
      expect((await suppliers.findById(s.id))!.state).toMatchObject({ phone: null, paymentTermsDays: 0, active: false });
      expect(await suppliers.findByIds([s.id])).toHaveLength(1);
    });

    it('refuse un code déjà pris, filtre et pagine', async () => {
      await newSupplier('AAA');
      await newSupplier('BBB');
      const dup = must(Supplier.create({ ...(await newSupplier('CCC')).state, id: must(SupplierId.create(uuid(9))), code: must(SupplierCode.create('AAA')) }));
      expect(await suppliers.insert(dup)).toBe(false);
      const c = (await suppliers.findByCode(must(SupplierCode.create('CCC'))))!;
      c.setActive(false);
      await suppliers.update(c);
      expect((await suppliers.list({ includeInactive: false }, 0, 10)).total).toBe(2);
      expect((await suppliers.list({ includeInactive: true }, 0, 10)).total).toBe(3);
      expect((await suppliers.list({ includeInactive: true, search: 'fournisseur b' }, 0, 10)).items.map((x) => x.state.code.value)).toEqual(['BBB']);
      expect((await suppliers.list({ includeInactive: true, search: '%' }, 0, 10)).total).toBe(0);
      expect((await suppliers.list({ includeInactive: true }, 1, 1)).items).toHaveLength(1);
    });

    it('refuse en base un code, un e-mail ou un délai invalides', async () => {
      await expect(db.query("INSERT INTO pharmacy_suppliers (id, code, name) VALUES ($1, 'bad code', 'x')", [uuid(7)])).rejects.toThrow();
      await expect(db.query("INSERT INTO pharmacy_suppliers (id, code, name, email) VALUES ($1, 'X', 'x', 'pas-un-mail')", [uuid(7)])).rejects.toThrow();
      await expect(db.query("INSERT INTO pharmacy_suppliers (id, code, name, payment_terms_days) VALUES ($1, 'X', 'x', 400)", [uuid(7)])).rejects.toThrow();
    });
  });

  describe('bons de commande', () => {
    it('enregistre un brouillon avec ses lignes, son numéro et sa date attendue', async () => {
      const s = await newSupplier('S1');
      const d1 = await newDrug('D1');
      const d2 = await newDrug('D2');
      const o = await newOrder(s, [[d1, 100, 10], [d2, 50, 200]]);
      expect(o.state.number.value).toBe('PO-0000001');
      const found = (await orders.findById(o.id))!;
      expect(found.state).toMatchObject({ status: 'DRAFT', createdBy: AUTHOR, notes: null });
      expect(found.state.expectedOn!.toString()).toBe('2026-11-20');
      expect(found.state.lines.map((l) => [l.quantity, l.unitCost.value, l.received])).toEqual([[100, 10, 0], [50, 200, 0]]);
      expect(found.value).toBe(11_000);
    });

    it('applique les transitions sous verrou et ne change rien quand la règle refuse', async () => {
      const s = await newSupplier('S1');
      const d = await newDrug('D1');
      const o = await newOrder(s, [[d, 10, 5]]);
      expect(await orders.mutate(o.id, (x) => x.approve(APPROVER, LATER))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_STATE_INVALID' } });
      must((await orders.mutate(o.id, (x) => x.submit(NOW)))!);
      expect(await orders.mutate(o.id, (x) => x.approve(AUTHOR, LATER))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_SELF_APPROVAL' } });
      expect((await orders.findById(o.id))!.status).toBe('PENDING_APPROVAL');
      const done = must((await orders.mutate(o.id, (x) => x.approve(APPROVER, LATER)))!);
      expect(done.state).toMatchObject({ status: 'APPROVED', approvedBy: APPROVER });
      expect(await orders.mutate(must(PurchaseOrderId.create(uuid(404))), () => ({ ok: true, value: undefined }))).toBeNull();
    });

    it('modifie un brouillon : les lignes sont remplacées', async () => {
      const s = await newSupplier('S1');
      const d1 = await newDrug('D1');
      const d2 = await newDrug('D2');
      const o = await newOrder(s, [[d1, 10, 5]]);
      must((await orders.mutate(o.id, (x) => x.edit(content(s, [[d2, 7, 9]]))))!);
      const found = (await orders.findById(o.id))!;
      expect(found.state.lines.map((l) => [l.drugId.value, l.quantity])).toEqual([[d2.id.value, 7]]);
    });

    it('liste avec le fournisseur, les totaux et les filtres ; les bons à approuver d\'abord par ancienneté', async () => {
      const s1 = await newSupplier('S1');
      const s2 = await newSupplier('S2');
      const d1 = await newDrug('D1');
      const d2 = await newDrug('D2');
      const a = await newOrder(s1, [[d1, 10, 5], [d2, 5, 100]]);
      const b = await newOrder(s2, [[d2, 1, 1]], APPROVER);
      await approve(a);
      must((await orders.mutate(b.id, (x) => x.submit(NOW)))!);
      const all = await orders.list({}, 0, 10);
      expect(all.items.map((i) => i.number)).toEqual(['PO-0000002', 'PO-0000001']);
      expect(all.items[1]).toMatchObject({ supplierName: 'Fournisseur S1', status: 'APPROVED', lines: 2, units: 15, received: 0, value: 550 });
      expect((await orders.list({ status: 'APPROVED' }, 0, 10)).items.map((i) => i.number)).toEqual(['PO-0000001']);
      expect((await orders.list({ supplierId: s2.id }, 0, 10)).total).toBe(1);
      expect((await orders.list({ drugId: d1.id }, 0, 10)).total).toBe(1);
      expect((await orders.list({ drugId: d2.id }, 0, 10)).total).toBe(2);
      expect((await orders.list({ createdBy: APPROVER }, 0, 10)).items.map((i) => i.number)).toEqual(['PO-0000002']);
    });

    it('compte ce qui reste à recevoir sur les bons approuvés ou partiellement reçus seulement', async () => {
      const s = await newSupplier('S1');
      const d = await newDrug('D1');
      const e = await newDrug('D2');
      await newOrder(s, [[e, 999, 1]]);
      const o = await approve(await newOrder(s, [[d, 100, 10]]));
      expect((await orders.onOrder()).get(d.id.value)).toBe(100);
      expect((await orders.onOrder()).has(e.id.value)).toBe(false);
      const posted = await stock.postReceipt(await receiptFor(o, [[d, 'L1', 30]]), { apply: (x) => x.receive(new Map([[d.id.value, 30]])) });
      must(posted);
      expect((await orders.onOrder()).get(d.id.value)).toBe(70);
    });

    it('la base impose les deux paires d\'yeux, la cohérence des dates et celle des quantités reçues', async () => {
      const s = await newSupplier('S1');
      const d = await newDrug('D1');
      const o = await newOrder(s, [[d, 10, 5]]);
      await expect(db.query("UPDATE pharmacy_purchase_orders SET status = 'APPROVED', submitted_at = now(), approved_by = created_by, approved_at = now() WHERE id = $1", [o.id.value])).rejects.toThrow();
      await expect(db.query("UPDATE pharmacy_purchase_orders SET status = 'APPROVED' WHERE id = $1", [o.id.value])).rejects.toThrow();
      await expect(db.query("UPDATE pharmacy_purchase_orders SET status = 'CANCELLED' WHERE id = $1", [o.id.value])).rejects.toThrow();
      await expect(db.query('UPDATE pharmacy_purchase_order_lines SET received = quantity + 1 WHERE order_id = $1', [o.id.value])).rejects.toThrow();
      await expect(db.query('INSERT INTO pharmacy_purchase_order_lines (order_id, position, drug_id, quantity, unit_cost) VALUES ($1, 5, $2, 1, 1)', [o.id.value, d.id.value])).rejects.toThrow();
    });
  });

  describe('réception contre un bon de commande', () => {
    it('reporte les quantités reçues sur le bon, dans la même transaction que les lots', async () => {
      const s = await newSupplier('S1');
      const d1 = await newDrug('D1');
      const d2 = await newDrug('D2');
      const o = await approve(await newOrder(s, [[d1, 100, 10], [d2, 50, 20]]));
      const receipt = await receiptFor(o, [[d1, 'L1', 60]]);
      const posted = must(await stock.postReceipt(receipt, { apply: (x) => x.receive(new Map([[d1.id.value, 60]])) }));
      expect(posted.state.purchaseOrderId!.value).toBe(o.id.value);
      const after = (await orders.findById(o.id))!;
      expect(after.status).toBe('PARTIALLY_RECEIVED');
      expect(after.state.lines.map((l) => l.received)).toEqual([60, 0]);
      expect((await stock.batchesOf(d1.id, false))[0].state.quantity).toBe(60);
      const second = await receiptFor(o, [[d1, 'L2', 40], [d2, 'M1', 50]]);
      must(await stock.postReceipt(second, { apply: (x) => x.receive(new Map([[d1.id.value, 40], [d2.id.value, 50]])) }));
      expect((await orders.findById(o.id))!.status).toBe('RECEIVED');
      const listed = await stock.listReceipts({}, 0, 10);
      expect(listed.items.map((r) => r.orderNumber)).toEqual(['PO-0000001', 'PO-0000001']);
    });

    it('refuse tout (lots, réception, bon) quand le bon refuse la livraison', async () => {
      const s = await newSupplier('S1');
      const d = await newDrug('D1');
      const o = await approve(await newOrder(s, [[d, 10, 5]]));
      const receipt = await receiptFor(o, [[d, 'L1', 11]]);
      const refused = await stock.postReceipt(receipt, { apply: (x) => x.receive(new Map([[d.id.value, 11]])) });
      expect(refused).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_OVER_RECEIPT' } });
      expect(await stock.batchesOf(d.id, true)).toHaveLength(0);
      expect((await stock.listReceipts({}, 0, 10)).total).toBe(0);
      expect((await orders.findById(o.id))!.state.lines[0].received).toBe(0);
    });

    it('refuse une livraison imputée sur un bon qui n\'existe pas', async () => {
      const s = await newSupplier('S1');
      const d = await newDrug('D1');
      const o = await approve(await newOrder(s, [[d, 10, 5]]));
      const receipt = await receiptFor(o, [[d, 'L1', 1]]);
      await db.query('DELETE FROM pharmacy_purchase_order_lines');
      await db.query('DELETE FROM pharmacy_purchase_orders');
      expect(await stock.postReceipt(receipt, { apply: () => ({ ok: true, value: undefined }) })).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_NOT_FOUND' } });
    });

    it('donne le coût d\'achat du lot le plus récemment reçu de chaque médicament', async () => {
      const s = await newSupplier('S1');
      const d = await newDrug('D1');
      const never = await newDrug('D2');
      const o = await approve(await newOrder(s, [[d, 100, 10]]));
      must(await stock.postReceipt(await receiptFor(o, [[d, 'OLD', 10]]), { apply: (x) => x.receive(new Map([[d.id.value, 10]])) }));
      await sql.query("UPDATE pharmacy_batches SET unit_cost = 11, received_at = '2026-01-01T00:00:00Z' WHERE batch_number = 'OLD'");
      must(await stock.postReceipt(await receiptFor(o, [[d, 'NEW', 10]]), { apply: (x) => x.receive(new Map([[d.id.value, 10]])) }));
      await sql.query("UPDATE pharmacy_batches SET unit_cost = 13 WHERE batch_number = 'NEW'");
      const costs = await stock.lastUnitCosts([d.id, never.id]);
      expect(costs.get(d.id.value)).toBe(13);
      expect(costs.has(never.id.value)).toBe(false);
      expect((await stock.lastUnitCosts([])).size).toBe(0);
    });
  });
});

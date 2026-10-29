import { PGlite } from '@electric-sql/pglite';
import { StockAdjustment } from '../../src/modules/pharmacy/domain/adjustment';
import { Batch } from '../../src/modules/pharmacy/domain/batch';
import { Drug } from '../../src/modules/pharmacy/domain/drug';
import { GoodsReceipt, ReceiptLine } from '../../src/modules/pharmacy/domain/receipt';
import {
  AdjustmentId, BatchId, BatchNumber, DrugCode, DrugId, DrugName, GenericName, Money, parseExpiry, Quantity, Reason, ReceiptId,
} from '../../src/modules/pharmacy/domain/values';
import { PgAdjustmentRepository } from '../../src/modules/pharmacy/infrastructure/persistence/pg-adjustment.repository';
import { PgDrugRepository } from '../../src/modules/pharmacy/infrastructure/persistence/pg-drug.repository';
import { PgStockRepository } from '../../src/modules/pharmacy/infrastructure/persistence/pg-stock.repository';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { freshDatabase, uuid } from '../support/seed-sql';

const TODAY = Temporal.PlainDate.from('2026-11-02');
const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const PHARM1 = uuid(21);
const PHARM2 = uuid(22);
const money = (n: number) => must(Money.create(n));

describe('schéma de la pharmacie sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let drugs: PgDrugRepository;
  let stock: PgStockRepository;
  let adjustments: PgAdjustmentRepository;
  let seq = 0;

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    drugs = new PgDrugRepository(sql);
    stock = new PgStockRepository(sql);
    adjustments = new PgAdjustmentRepository(sql);
  });
  afterEach(async () => db.close());

  const newDrug = async (code: string, over: Partial<Parameters<typeof Drug.create>[0]> = {}): Promise<Drug> => {
    seq += 1;
    const drug = must(Drug.create({
      id: must(DrugId.create(uuid(1000 + seq))), code: must(DrugCode.create(code)), name: must(DrugName.create(`Médicament ${code}`)), genericName: must(GenericName.create(`DCI ${code}`)), strength: '500 mg', form: 'TABLET',
      schedule: 'PRESCRIPTION', storage: 'ROOM', atcCode: 'N02BE01', unit: 'comprimé', unitPrice: money(25), reorderLevel: 100, notes: null, ...over,
    }));
    expect(await drugs.insert(drug)).toBe(true);
    return drug;
  };

  const line = (drug: Drug, batchNumber: string, expiry: string, quantity: number, cost = 10): ReceiptLine => {
    seq += 1;
    return { drugId: drug.id, batchId: must(BatchId.create(uuid(3000 + seq))), batchNumber: must(BatchNumber.create(batchNumber)), expiry: must(parseExpiry(expiry)), quantity, unitCost: money(cost) };
  };

  const receive = async (lines: ReceiptLine[], by = PHARM1, at = NOW, supplier = 'Pharma Distrib') => {
    seq += 1;
    const receipt = must(GoodsReceipt.create({ id: must(ReceiptId.create(uuid(4000 + seq))), number: await stock.nextReceiptNumber(), supplier, receivedBy: by, receivedAt: at, lines }, TODAY));
    return stock.postReceipt(receipt);
  };

  const requestAdjustment = async (batch: Batch, direction: 'IN' | 'OUT', quantity: number, reason: 'DAMAGED' | 'COUNT_CORRECTION' | 'FOUND' = 'DAMAGED', by = PHARM1) => {
    seq += 1;
    const a = must(StockAdjustment.request({
      id: must(AdjustmentId.create(uuid(5000 + seq))), number: await adjustments.nextNumber(), drugId: batch.state.drugId, batchId: batch.id, direction, quantity: must(Quantity.create(quantity)), reason, note: null, requestedBy: by, requestedAt: NOW,
    }));
    await adjustments.insert(a);
    return a;
  };

  describe('catalogue', () => {
    it('enregistre et relit un médicament avec tous ses champs', async () => {
      const d = await newDrug('PARA500', { notes: 'À conserver au sec', unitPrice: money(1_250) });
      const found = (await drugs.findById(d.id))!;
      expect(found.state).toMatchObject({ code: { value: 'PARA500' }, strength: '500 mg', form: 'TABLET', schedule: 'PRESCRIPTION', storage: 'ROOM', atcCode: 'N02BE01', unit: 'comprimé', reorderLevel: 100, notes: 'À conserver au sec', active: true });
      expect(found.state.unitPrice.value).toBe(1_250);
      expect((await drugs.findByCode(must(DrugCode.create('para500'))))!.id.value).toBe(d.id.value);
      expect(await drugs.findByIds([d.id])).toHaveLength(1);
    });

    it('refuse un code déjà pris sans erreur technique', async () => {
      await newDrug('DUP');
      const again = must(Drug.create({ ...(await newDrug('OTHER')).state, id: must(DrugId.create(uuid(9))), code: must(DrugCode.create('DUP')) }));
      expect(await drugs.insert(again)).toBe(false);
    });

    it('met à jour, désactive, filtre et pagine', async () => {
      const a = await newDrug('AAA', { form: 'SYRUP', schedule: 'OTC' });
      await newDrug('BBB');
      await newDrug('CCC');
      expect(a.update({ unitPrice: money(99), strength: null }).ok).toBe(true);
      a.setActive(false);
      await drugs.update(a);
      expect((await drugs.findById(a.id))!.state).toMatchObject({ strength: null, active: false });
      expect((await drugs.list({ includeInactive: false }, 0, 10)).total).toBe(2);
      expect((await drugs.list({ includeInactive: true }, 0, 10)).total).toBe(3);
      expect((await drugs.list({ includeInactive: true, form: 'SYRUP' }, 0, 10)).items.map((d) => d.state.code.value)).toEqual(['AAA']);
      expect((await drugs.list({ includeInactive: true, schedule: 'OTC' }, 0, 10)).total).toBe(1);
      expect((await drugs.list({ includeInactive: true, search: 'dci b' }, 0, 10)).items.map((d) => d.state.code.value)).toEqual(['BBB']);
      expect((await drugs.list({ includeInactive: true, search: '%' }, 0, 10)).total).toBe(0);
      expect((await drugs.list({ includeInactive: true }, 1, 1)).items).toHaveLength(1);
    });

    it('refuse en base un code, un prix ou un code ATC invalides', async () => {
      await expect(db.query("INSERT INTO pharmacy_drugs (id, code, name, generic_name, form, schedule, unit) VALUES ($1, 'bad code', 'x', 'x', 'TABLET', 'OTC', 'cp')", [uuid(7)])).rejects.toThrow();
      await expect(db.query("INSERT INTO pharmacy_drugs (id, code, name, generic_name, form, schedule, unit, unit_price) VALUES ($1, 'X', 'x', 'x', 'TABLET', 'OTC', 'cp', -1)", [uuid(7)])).rejects.toThrow();
      await expect(db.query("INSERT INTO pharmacy_drugs (id, code, name, generic_name, form, schedule, unit, atc_code) VALUES ($1, 'X', 'x', 'x', 'TABLET', 'OTC', 'cp', 'N02')", [uuid(7)])).rejects.toThrow();
    });
  });

  describe('réceptions', () => {
    it('crée les lots, le grand livre et la réception dans une seule opération', async () => {
      const d1 = await newDrug('D1');
      const d2 = await newDrug('D2');
      const posted = must(await receive([line(d1, 'L1', '2027-01-01', 100, 10), line(d2, 'M1', '2027-03-01', 40, 50)]));
      expect(posted.state.number.value).toBe('GRN-0000001');
      expect(posted.state.lines.map((l) => [l.batchNumber.value, l.quantity])).toEqual([['L1', 100], ['M1', 40]]);
      const batches = await stock.batchesOf(d1.id, false);
      expect(batches).toHaveLength(1);
      expect(batches[0].state).toMatchObject({ quantity: 100, status: 'AVAILABLE' });
      expect(batches[0].state.expiry.toString()).toBe('2027-01-01');
      const moves = await stock.movements({ drugId: d1.id }, 0, 10);
      expect(moves.items).toMatchObject([{ type: 'RECEIPT', delta: 100, balance: 100, reference: 'GRN-0000001', by: PHARM1, batchNumber: 'L1' }]);
      const found = (await stock.findReceipt(posted.id))!;
      expect(found.state.lines).toHaveLength(2);
    });

    it('une seconde livraison du même lot s\'ajoute au lot existant et garde l\'identifiant du lot', async () => {
      const d = await newDrug('D1');
      const first = must(await receive([line(d, 'L1', '2027-01-01', 10, 10)]));
      const second = must(await receive([line(d, 'l1', '2027-01-01', 30, 20)]));
      const batches = await stock.batchesOf(d.id, false);
      expect(batches).toHaveLength(1);
      expect(batches[0].state.quantity).toBe(40);
      expect(batches[0].state.unitCost.value).toBe(18);
      expect(second.state.lines[0].batchId.value).toBe(first.state.lines[0].batchId.value);
      expect((await stock.movements({ batchId: batches[0].id }, 0, 10)).items.map((m) => [m.delta, m.balance])).toEqual([[30, 40], [10, 10]]);
    });

    it('refuse toute la réception si une ligne contredit un lot existant : rien n\'est écrit', async () => {
      const d = await newDrug('D1');
      const e = await newDrug('D2');
      must(await receive([line(d, 'L1', '2027-01-01', 10)]));
      const bad = await receive([line(e, 'NEW', '2027-05-01', 7), line(d, 'L1', '2027-02-01', 5)]);
      expect(bad).toMatchObject({ ok: false, error: { code: 'PHARMACY_BATCH_EXPIRY_MISMATCH' } });
      expect(await stock.batchesOf(e.id, true)).toHaveLength(0);
      expect((await stock.batchesOf(d.id, true))[0].state.quantity).toBe(10);
      expect((await stock.listReceipts({}, 0, 10)).total).toBe(1);
      expect((await stock.movements({}, 0, 10)).total).toBe(1);
    });

    it('liste les réceptions avec leur valeur, filtrées par fournisseur et médicament', async () => {
      const d1 = await newDrug('D1');
      const d2 = await newDrug('D2');
      must(await receive([line(d1, 'L1', '2027-01-01', 10, 10), line(d2, 'M1', '2027-01-01', 5, 100)], PHARM1, NOW, 'Alpha Pharma'));
      must(await receive([line(d2, 'M2', '2027-01-01', 1, 7)], PHARM2, LATER, 'Beta Labo'));
      const all = await stock.listReceipts({}, 0, 10);
      expect(all.items.map((r) => [r.number, r.lines, r.units, r.value])).toEqual([['GRN-0000002', 1, 1, 7], ['GRN-0000001', 2, 15, 600]]);
      expect((await stock.listReceipts({ supplier: 'alpha' }, 0, 10)).items.map((r) => r.number)).toEqual(['GRN-0000001']);
      expect((await stock.listReceipts({ drugId: d1.id }, 0, 10)).total).toBe(1);
      expect((await stock.listReceipts({ drugId: d2.id }, 0, 10)).total).toBe(2);
    });

    it('le grand livre et les réceptions sont en ajout seul', async () => {
      const d = await newDrug('D1');
      must(await receive([line(d, 'L1', '2027-01-01', 10)]));
      await expect(db.query('UPDATE pharmacy_stock_movements SET delta = 99')).rejects.toThrow(/ajout seul/);
      await expect(db.query('DELETE FROM pharmacy_stock_movements')).rejects.toThrow(/ajout seul/);
      await expect(db.query('TRUNCATE pharmacy_stock_movements')).rejects.toThrow(/ajout seul/);
      await expect(db.query("UPDATE pharmacy_receipts SET supplier = 'x'")).rejects.toThrow(/ajout seul/);
      await expect(db.query('DELETE FROM pharmacy_receipt_lines')).rejects.toThrow(/ajout seul/);
    });

    it('la quantité d\'un lot ne devient jamais négative', async () => {
      const d = await newDrug('D1');
      const r = must(await receive([line(d, 'L1', '2027-01-01', 10)]));
      await expect(db.query('UPDATE pharmacy_batches SET quantity = -1 WHERE id = $1', [r.state.lines[0].batchId.value])).rejects.toThrow();
    });
  });

  describe('stock et péremptions', () => {
    it('agrège par médicament : délivrable, quarantaine, périmé, bientôt périmé, niveau et valeur', async () => {
      const d = await newDrug('D1', { reorderLevel: 100 });
      const quiet = await newDrug('D2', { reorderLevel: 0 });
      const empty = await newDrug('D3');
      must(await receive([line(d, 'OK', '2027-06-01', 60, 10), line(d, 'SOON', '2026-12-01', 30, 10), line(d, 'HELD', '2027-06-01', 20, 10), line(d, 'OLD', '2027-01-01', 5, 100)]));
      await sql.query("UPDATE pharmacy_batches SET expiry_date = '2026-10-01' WHERE batch_number = 'OLD'");
      const held = (await stock.batchesOf(d.id, false)).find((b) => b.state.batchNumber.value === 'HELD')!;
      must((await stock.mutateBatch(held.id, (b) => b.quarantine(must(Reason.create('Rappel')), PHARM1, NOW)))!);
      must(await receive([line(quiet, 'Q1', '2027-06-01', 1, 5)]));

      const all = await stock.overview({ includeInactive: false }, TODAY, 90, 0, 10);
      const row = all.items.find((r) => r.code === 'D1')!;
      expect(row).toMatchObject({ dispensable: 90, quarantined: 20, expired: 5, expiringSoon: 30, level: 'LOW', value: 60 * 10 + 30 * 10 + 20 * 10 + 5 * 100 });
      expect(row.nextExpiry!.toString()).toBe('2026-12-01');
      expect(all.items.find((r) => r.code === 'D2')).toMatchObject({ dispensable: 1, level: 'OK', nextExpiry: expect.anything() });
      expect(all.items.find((r) => r.code === 'D3')).toMatchObject({ dispensable: 0, level: 'OUT', nextExpiry: null, value: 0 });
      // ruptures d'abord, puis stocks bas, puis le reste
      expect(all.items.map((r) => r.level)).toEqual(['OUT', 'LOW', 'OK']);

      expect((await stock.overview({ includeInactive: false, level: 'OUT' }, TODAY, 90, 0, 10)).items.map((r) => r.code)).toEqual([empty.state.code.value]);
      expect((await stock.overview({ includeInactive: false, expiring: true }, TODAY, 90, 0, 10)).items.map((r) => r.code)).toEqual(['D1']);
      expect((await stock.overview({ includeInactive: false, expiring: true }, TODAY, 10, 0, 10)).total).toBe(0);
      expect((await stock.overview({ includeInactive: false, hasExpired: true }, TODAY, 90, 0, 10)).items.map((r) => r.code)).toEqual(['D1']);
      expect((await stock.overview({ includeInactive: false, search: 'dci d2' }, TODAY, 90, 0, 10)).total).toBe(1);
    });

    it('le résumé compte ruptures, stocks bas, péremptions, quarantaines et ajustements en attente', async () => {
      const d = await newDrug('D1', { reorderLevel: 100 });
      await newDrug('D2');
      must(await receive([line(d, 'OK', '2027-06-01', 50, 10), line(d, 'SOON', '2026-12-01', 10, 10)]));
      const batch = (await stock.batchesOf(d.id, false)).find((b) => b.state.batchNumber.value === 'OK')!;
      must((await stock.mutateBatch(batch.id, (b) => b.quarantine(must(Reason.create('Rappel')), PHARM1, NOW)))!);
      await requestAdjustment(batch, 'OUT', 1);
      expect(await stock.summary(TODAY, 90)).toEqual({ drugs: 2, out: 1, low: 1, expiring: 1, expired: 0, quarantinedBatches: 1, pendingAdjustments: 1, value: 600 });
    });

    it('liste les lots qui périment au plus tard à une date, périmés compris, les plus proches d\'abord', async () => {
      const d = await newDrug('D1');
      const e = await newDrug('D2');
      must(await receive([line(d, 'A', '2027-01-01', 5), line(d, 'B', '2026-12-15', 5), line(e, 'C', '2026-11-20', 5), line(e, 'D', '2028-01-01', 5)]));
      await sql.query("UPDATE pharmacy_batches SET expiry_date = '2026-09-01' WHERE batch_number = 'B'");
      const page = await stock.listBatches({ expiresBy: Temporal.PlainDate.from('2027-01-01') }, 0, 10);
      expect(page.items.map((i) => [i.batch.state.batchNumber.value, i.drug.code])).toEqual([['B', 'D1'], ['C', 'D2'], ['A', 'D1']]);
      expect(page.total).toBe(3);
      expect((await stock.listBatches({ drugId: e.id }, 0, 10)).total).toBe(2);
    });

    it('n\'affiche les lots vides que si on le demande, et filtre les quarantaines', async () => {
      const d = await newDrug('D1');
      must(await receive([line(d, 'A', '2027-01-01', 5), line(d, 'B', '2027-02-01', 5)]));
      const [a, b] = await stock.batchesOf(d.id, false);
      await sql.query('UPDATE pharmacy_batches SET quantity = 0 WHERE id = $1', [a.id.value]);
      expect(await stock.batchesOf(d.id, false)).toHaveLength(1);
      expect(await stock.batchesOf(d.id, true)).toHaveLength(2);
      expect((await stock.listBatches({ includeEmpty: true }, 0, 10)).total).toBe(2);
      must((await stock.mutateBatch(b.id, (x) => x.quarantine(must(Reason.create('Rappel')), PHARM1, NOW)))!);
      expect((await stock.listBatches({ quarantinedOnly: true }, 0, 10)).items.map((i) => i.batch.state.batchNumber.value)).toEqual(['B']);
    });

    it('mutateBatch ne change rien quand la règle refuse, et signale un lot introuvable', async () => {
      const d = await newDrug('D1');
      const r = must(await receive([line(d, 'A', '2027-01-01', 5)]));
      const id = r.state.lines[0].batchId;
      expect(await stock.mutateBatch(id, (b) => b.release())).toMatchObject({ ok: false, error: { code: 'PHARMACY_BATCH_NOT_QUARANTINED' } });
      expect(await stock.mutateBatch(must(BatchId.create(uuid(404))), () => ({ ok: true, value: undefined }))).toBeNull();
      const held = must((await stock.mutateBatch(id, (b) => b.quarantine(must(Reason.create('Rappel')), PHARM1, NOW)))!);
      expect(held.state).toMatchObject({ status: 'QUARANTINED', quarantineReason: 'Rappel', quarantinedBy: PHARM1 });
      expect(held.state.quarantinedAt!.toString()).toBe('2026-11-02T08:00:00Z');
      must((await stock.mutateBatch(id, (b) => b.release()))!);
      expect((await stock.findBatch(id))!.state.status).toBe('AVAILABLE');
    });
  });

  describe('ajustements', () => {
    it('enregistre la demande, la liste, et refuse une seconde demande en attente détectable', async () => {
      const d = await newDrug('D1');
      const r = must(await receive([line(d, 'A', '2027-01-01', 10)]));
      const batch = (await stock.findBatch(r.state.lines[0].batchId))!;
      expect(await adjustments.hasPending(batch.id)).toBe(false);
      const a = await requestAdjustment(batch, 'OUT', 3);
      expect(a.state.number.value).toBe('ADJ-0000001');
      expect(await adjustments.hasPending(batch.id)).toBe(true);
      const found = (await adjustments.findById(a.id))!;
      expect(found.state).toMatchObject({ status: 'PENDING', direction: 'OUT', quantity: 3, reason: 'DAMAGED', requestedBy: PHARM1, decidedBy: null });
      expect((await adjustments.list({ status: 'PENDING' }, 0, 10)).total).toBe(1);
      expect((await adjustments.list({ requestedBy: PHARM2 }, 0, 10)).total).toBe(0);
    });

    it('l\'approbation par un autre modifie le lot et inscrit le mouvement, ensemble', async () => {
      const d = await newDrug('D1');
      const r = must(await receive([line(d, 'A', '2027-01-01', 10)]));
      const batch = (await stock.findBatch(r.state.lines[0].batchId))!;
      const a = await requestAdjustment(batch, 'OUT', 3);
      const done = must((await adjustments.decide(a.id, PHARM2, LATER, (adj, b) => {
        const movement = adj.approve(PHARM2, LATER, b, TODAY, 'ok');
        return movement.ok ? movement : movement;
      }))!);
      expect(done.state).toMatchObject({ status: 'APPROVED', decidedBy: PHARM2, decisionComment: 'ok' });
      expect((await stock.findBatch(batch.id))!.state.quantity).toBe(7);
      expect((await stock.movements({ batchId: batch.id }, 0, 10)).items[0]).toMatchObject({ type: 'ADJUSTMENT_OUT', delta: -3, balance: 7, reference: 'ADJ-0000001', by: PHARM2 });
      expect(await adjustments.hasPending(batch.id)).toBe(false);
    });

    it('un lot qui ne peut plus honorer la sortie laisse la demande en attente et le stock intact', async () => {
      const d = await newDrug('D1');
      const r = must(await receive([line(d, 'A', '2027-01-01', 10)]));
      const batch = (await stock.findBatch(r.state.lines[0].batchId))!;
      const a = await requestAdjustment(batch, 'OUT', 8);
      await sql.query('UPDATE pharmacy_batches SET quantity = 5 WHERE id = $1', [batch.id.value]);
      const refused = await adjustments.decide(a.id, PHARM2, LATER, (adj, b) => adj.approve(PHARM2, LATER, b, TODAY, null));
      expect(refused).toMatchObject({ ok: false, error: { code: 'PHARMACY_STOCK_INSUFFICIENT' } });
      expect((await adjustments.findById(a.id))!.state.status).toBe('PENDING');
      expect((await stock.findBatch(batch.id))!.state.quantity).toBe(5);
      expect((await stock.movements({ batchId: batch.id }, 0, 10)).total).toBe(1);
    });

    it('un refus ne touche pas au stock ; une demande introuvable renvoie null', async () => {
      const d = await newDrug('D1');
      const r = must(await receive([line(d, 'A', '2027-01-01', 10)]));
      const batch = (await stock.findBatch(r.state.lines[0].batchId))!;
      const a = await requestAdjustment(batch, 'IN', 2, 'FOUND');
      const rejected = must((await adjustments.decide(a.id, PHARM2, LATER, (adj) => {
        const done = adj.reject(PHARM2, LATER, must(Reason.create('Recomptez')));
        return done.ok ? { ok: true as const, value: null } : done;
      }))!);
      expect(rejected.state).toMatchObject({ status: 'REJECTED', decisionComment: 'Recomptez' });
      expect((await stock.findBatch(batch.id))!.state.quantity).toBe(10);
      expect(await adjustments.decide(must(AdjustmentId.create(uuid(404))), PHARM2, LATER, () => ({ ok: true, value: null }))).toBeNull();
    });

    it('la base impose les deux paires d\'yeux et le motif de refus', async () => {
      const d = await newDrug('D1');
      const r = must(await receive([line(d, 'A', '2027-01-01', 10)]));
      const batch = (await stock.findBatch(r.state.lines[0].batchId))!;
      const a = await requestAdjustment(batch, 'OUT', 1);
      await expect(db.query("UPDATE pharmacy_adjustments SET status = 'APPROVED', decided_by = requested_by, decided_at = now() WHERE id = $1", [a.id.value])).rejects.toThrow();
      await expect(db.query("UPDATE pharmacy_adjustments SET status = 'REJECTED', decided_by = $2, decided_at = now() WHERE id = $1", [a.id.value, PHARM2])).rejects.toThrow();
      await expect(db.query("UPDATE pharmacy_adjustments SET status = 'APPROVED' WHERE id = $1", [a.id.value])).rejects.toThrow();
    });
  });
});

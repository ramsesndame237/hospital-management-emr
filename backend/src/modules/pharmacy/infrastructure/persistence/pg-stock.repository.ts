import { SqlExecutor } from '../../../../database/sql-executor';
import { requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../../shared-kernel/temporal';
import { Batch, MovementDraft, MovementType, StockLevel } from '../../domain/batch';
import {
  BatchFilter, BatchWithDrug, MovementFilter, MovementRecord, ReceiptFilter, ReceiptSummary, StockFilter, StockRepository, StockRow, StockSummary,
} from '../../domain/ports';
import { GoodsReceipt, ReceiptLine } from '../../domain/receipt';
import { BatchId, BatchNumber, DrugId, Money, parseForm, parseSchedule, ReceiptId, ReceiptNumber } from '../../domain/values';
import { BatchRow, batchColumns, loadBatch, need, saveBatch, toBatch, writeMovement } from './pg-batch';

const num = (v: string | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
const day = (v: string): PlainDate => Temporal.PlainDate.from(v.slice(0, 10));
const likePattern = (raw: string): string => `%${raw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

interface ReceiptRow {
  id: string;
  receipt_number: string;
  supplier: string;
  delivery_note: string | null;
  notes: string | null;
  received_by: string;
  received_at: Date | string;
}

interface LineRow {
  drug_id: string;
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit_cost: string | number;
}

/**
 * Stock par médicament : chaque lot non vide est rangé selon son statut et sa péremption par rapport à `$1` (aujourd'hui), la fenêtre
 * d'alerte allant jusqu'à `$2`. Le niveau se déduit de la quantité délivrable et du seuil de réapprovisionnement.
 */
const STOCK = `
  WITH stock AS (
    SELECT d.id AS drug_id, d.code, d.name, d.generic_name, d.strength, d.form, d.schedule, d.unit, d.active, d.reorder_level,
           COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'AVAILABLE' AND b.expiry_date >= $1::date), 0)::int AS dispensable,
           COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'QUARANTINED'), 0)::int AS quarantined,
           COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'AVAILABLE' AND b.expiry_date < $1::date), 0)::int AS expired,
           COALESCE(SUM(b.quantity) FILTER (WHERE b.status = 'AVAILABLE' AND b.expiry_date >= $1::date AND b.expiry_date <= $2::date), 0)::int AS expiring_soon,
           MIN(b.expiry_date) FILTER (WHERE b.status = 'AVAILABLE' AND b.expiry_date >= $1::date)::text AS next_expiry,
           COALESCE(SUM(b.quantity::numeric * b.unit_cost), 0)::text AS value
      FROM pharmacy_drugs d
      LEFT JOIN pharmacy_batches b ON b.drug_id = d.id AND b.quantity > 0
     GROUP BY d.id
  ), leveled AS (
    SELECT stock.*, CASE WHEN dispensable <= 0 THEN 'OUT' WHEN reorder_level > 0 AND dispensable <= reorder_level THEN 'LOW' ELSE 'OK' END AS level FROM stock
  )`;

export class PgStockRepository implements StockRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextReceiptNumber(): Promise<ReceiptNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('pharmacy_receipt_number_seq')::text AS n");
    return need(ReceiptNumber.fromSequence(Number(rows[0].n)), 'Numéro de réception');
  }

  async postReceipt(receipt: GoodsReceipt): Promise<Result<GoodsReceipt>> {
    const s = receipt.state;
    return this.sql.transaction(async (tx) => {
      // Les lots sont verrouillés dans un ordre fixe : deux réceptions simultanées se mettent en file au lieu de s'interbloquer.
      const order = s.lines.map((line, index) => ({ line, index })).sort((a, b) => a.line.drugId.value.localeCompare(b.line.drugId.value) || a.line.batchNumber.value.localeCompare(b.line.batchNumber.value));
      const staged: { index: number; line: ReceiptLine; batch: Batch; created: boolean; movement: MovementDraft }[] = [];
      for (const { line, index } of order) {
        const found = await tx.query<BatchRow>(`SELECT ${batchColumns()} FROM pharmacy_batches WHERE drug_id = $1 AND batch_number = $2 FOR UPDATE`, [line.drugId.value, line.batchNumber.value]);
        if (found[0]) {
          const batch = toBatch(found[0]);
          const movement = batch.receive(line.expiry, line.quantity, line.unitCost, s.number.value);
          if (!movement.ok) return err(movement.error);
          staged.push({ index, line: { ...line, batchId: batch.id }, batch, created: false, movement: movement.value });
        } else {
          const batch = Batch.create({ id: line.batchId, drugId: line.drugId, batchNumber: line.batchNumber, expiry: line.expiry, quantity: line.quantity, unitCost: line.unitCost, receivedAt: s.receivedAt });
          staged.push({ index, line, batch, created: true, movement: { type: 'RECEIPT', delta: line.quantity, reason: null, reference: s.number.value } });
        }
      }
      await tx.query(
        'INSERT INTO pharmacy_receipts (id, receipt_number, supplier, delivery_note, notes, received_by, received_at) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)',
        [s.id.value, s.number.value, s.supplier, s.deliveryNote, s.notes, s.receivedBy, s.receivedAt.toString()],
      );
      for (const item of staged) {
        await saveBatch(tx, item.batch, item.created);
        await writeMovement(tx, item.batch, item.movement, s.receivedBy, s.receivedAt.toString());
        await tx.query(
          'INSERT INTO pharmacy_receipt_lines (receipt_id, position, drug_id, batch_id, batch_number, expiry_date, quantity, unit_cost) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8)',
          [s.id.value, item.index, item.line.drugId.value, item.line.batchId.value, item.line.batchNumber.value, item.line.expiry.toString(), item.line.quantity, item.line.unitCost.value],
        );
      }
      return ok((await this.loadReceipt(tx, s.id.value))!);
    });
  }

  private async loadReceipt(db: SqlExecutor, id: string): Promise<GoodsReceipt | null> {
    const rows = await db.query<ReceiptRow>('SELECT id, receipt_number, supplier, delivery_note, notes, received_by, received_at FROM pharmacy_receipts WHERE id = $1', [id]);
    const r = rows[0];
    if (!r) return null;
    const lines = await db.query<LineRow>('SELECT drug_id, batch_id, batch_number, expiry_date::text AS expiry_date, quantity, unit_cost FROM pharmacy_receipt_lines WHERE receipt_id = $1 ORDER BY position', [id]);
    const what = `Réception ${id}`;
    return GoodsReceipt.restore({
      id: need(ReceiptId.create(r.id), what),
      number: need(ReceiptNumber.create(r.receipt_number), what),
      supplier: r.supplier,
      deliveryNote: r.delivery_note,
      notes: r.notes,
      receivedBy: r.received_by,
      receivedAt: requiredInstantFromDb(r.received_at),
      lines: lines.map((l): ReceiptLine => ({
        drugId: need(DrugId.create(l.drug_id), what), batchId: need(BatchId.create(l.batch_id), what), batchNumber: need(BatchNumber.create(l.batch_number), what),
        expiry: day(l.expiry_date), quantity: l.quantity, unitCost: Money.restore(num(l.unit_cost)),
      })),
    });
  }

  findReceipt(id: ReceiptId): Promise<GoodsReceipt | null> {
    return this.loadReceipt(this.sql, id.value);
  }

  async listReceipts(filter: ReceiptFilter, offset: number, limit: number): Promise<{ items: ReceiptSummary[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.supplier) where.push(`r.supplier ILIKE ${arg(likePattern(filter.supplier))}`);
    if (filter.drugId) where.push(`EXISTS (SELECT 1 FROM pharmacy_receipt_lines x WHERE x.receipt_id = r.id AND x.drug_id = ${arg(filter.drugId.value)})`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM pharmacy_receipts r ${condition}`, args);
    const rows = await this.sql.query<ReceiptRow & { lines: number; units: number; value: string }>(
      `SELECT r.id, r.receipt_number, r.supplier, r.delivery_note, r.notes, r.received_by, r.received_at,
              (SELECT count(*)::int FROM pharmacy_receipt_lines l WHERE l.receipt_id = r.id) AS lines,
              (SELECT COALESCE(SUM(l.quantity), 0)::int FROM pharmacy_receipt_lines l WHERE l.receipt_id = r.id) AS units,
              (SELECT COALESCE(SUM(l.quantity::numeric * l.unit_cost), 0)::text FROM pharmacy_receipt_lines l WHERE l.receipt_id = r.id) AS value
         FROM pharmacy_receipts r ${condition} ORDER BY r.received_at DESC, r.receipt_number DESC OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    return {
      total: total[0]?.n ?? 0,
      items: rows.map((r): ReceiptSummary => ({
        id: r.id, number: r.receipt_number, supplier: r.supplier, deliveryNote: r.delivery_note, receivedBy: r.received_by, receivedAt: requiredInstantFromDb(r.received_at),
        lines: r.lines, units: r.units, value: num(r.value),
      })),
    };
  }

  findBatch(id: BatchId): Promise<Batch | null> {
    return loadBatch(this.sql, id.value);
  }

  async batchesOf(drugId: DrugId, includeEmpty: boolean): Promise<Batch[]> {
    const rows = await this.sql.query<BatchRow>(
      `SELECT ${batchColumns()} FROM pharmacy_batches WHERE drug_id = $1${includeEmpty ? '' : ' AND quantity > 0'} ORDER BY pharmacy_batches.expiry_date, received_at, batch_number`,
      [drugId.value],
    );
    return rows.map(toBatch);
  }

  async listBatches(filter: BatchFilter, offset: number, limit: number): Promise<{ items: BatchWithDrug[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (!filter.includeEmpty) where.push('b.quantity > 0');
    if (filter.drugId) where.push(`b.drug_id = ${arg(filter.drugId.value)}`);
    if (filter.expiresBy) where.push(`b.expiry_date <= ${arg(filter.expiresBy.toString())}::date`);
    if (filter.quarantinedOnly) where.push("b.status = 'QUARANTINED'");
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM pharmacy_batches b ${condition}`, args);
    const rows = await this.sql.query<BatchRow & { d_code: string; d_name: string; d_generic: string; d_strength: string | null; d_unit: string }>(
      `SELECT ${batchColumns('b')}, d.code AS d_code, d.name AS d_name, d.generic_name AS d_generic, d.strength AS d_strength, d.unit AS d_unit
         FROM pharmacy_batches b JOIN pharmacy_drugs d ON d.id = b.drug_id ${condition}
        ORDER BY b.expiry_date, d.generic_name, d.code, b.batch_number OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    return {
      total: total[0]?.n ?? 0,
      items: rows.map((r): BatchWithDrug => ({ batch: toBatch(r), drug: { id: r.drug_id, code: r.d_code, name: r.d_name, genericName: r.d_generic, strength: r.d_strength, unit: r.d_unit } })),
    };
  }

  async mutateBatch(id: BatchId, mutate: (batch: Batch) => Result<void>): Promise<Result<Batch> | null> {
    return this.sql.transaction(async (tx) => {
      const batch = await loadBatch(tx, id.value, true);
      if (!batch) return null;
      const done = mutate(batch);
      if (!done.ok) return err(done.error);
      await saveBatch(tx, batch);
      return ok((await loadBatch(tx, id.value))!);
    });
  }

  async movements(filter: MovementFilter, offset: number, limit: number): Promise<{ items: MovementRecord[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.drugId) where.push(`m.drug_id = ${arg(filter.drugId.value)}`);
    if (filter.batchId) where.push(`m.batch_id = ${arg(filter.batchId.value)}`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM pharmacy_stock_movements m ${condition}`, args);
    const rows = await this.sql.query<{ id: string; drug_id: string; batch_id: string; batch_number: string; type: string; delta: number; balance: number; reason: string | null; reference: string | null; by: string; at: Date | string }>(
      `SELECT m.id, m.drug_id, m.batch_id, b.batch_number, m.type, m.delta, m.balance, m.reason, m.reference, m.by, m.at
         FROM pharmacy_stock_movements m JOIN pharmacy_batches b ON b.id = m.batch_id ${condition} ORDER BY m.seq DESC OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    return {
      total: total[0]?.n ?? 0,
      items: rows.map((r): MovementRecord => ({
        id: r.id, drugId: r.drug_id, batchId: r.batch_id, batchNumber: r.batch_number, type: r.type as MovementType, delta: r.delta, balance: r.balance, reason: r.reason, reference: r.reference, by: r.by, at: requiredInstantFromDb(r.at),
      })),
    };
  }

  async overview(filter: StockFilter, today: PlainDate, soonDays: number, offset: number, limit: number): Promise<{ items: StockRow[]; total: number }> {
    const args: unknown[] = [today.toString(), today.add({ days: soonDays }).toString()];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    const where: string[] = [];
    if (!filter.includeInactive) where.push('active');
    if (filter.level) where.push(`level = ${arg(filter.level)}`);
    if (filter.expiring) where.push('expiring_soon > 0');
    if (filter.hasExpired) where.push('expired > 0');
    if (filter.search) {
      const p = arg(likePattern(filter.search));
      where.push(`(code ILIKE ${p} OR name ILIKE ${p} OR generic_name ILIKE ${p})`);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.sql.query<{ n: number }>(`${STOCK} SELECT count(*)::int AS n FROM leveled ${condition}`, args);
    const rows = await this.sql.query<{
      drug_id: string; code: string; name: string; generic_name: string; strength: string | null; form: string; schedule: string; unit: string; active: boolean; reorder_level: number;
      dispensable: number; quarantined: number; expired: number; expiring_soon: number; next_expiry: string | null; level: string; value: string;
    }>(
      // Les ruptures et les stocks bas d'abord (ce qu'il faut traiter), puis l'ordre alphabétique de la dénomination commune.
      `${STOCK} SELECT * FROM leveled ${condition}
        ORDER BY CASE level WHEN 'OUT' THEN 0 WHEN 'LOW' THEN 1 ELSE 2 END, generic_name, name, code OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    return {
      total: total[0]?.n ?? 0,
      items: rows.map((r): StockRow => ({
        drugId: r.drug_id, code: r.code, name: r.name, genericName: r.generic_name, strength: r.strength, form: need(parseForm(r.form), 'Forme'), schedule: need(parseSchedule(r.schedule), 'Classe'),
        unit: r.unit, active: r.active, reorderLevel: r.reorder_level, dispensable: r.dispensable, quarantined: r.quarantined, expired: r.expired, expiringSoon: r.expiring_soon,
        nextExpiry: r.next_expiry ? day(r.next_expiry) : null, level: r.level as StockLevel, value: num(r.value),
      })),
    };
  }

  async summary(today: PlainDate, soonDays: number): Promise<StockSummary> {
    const args = [today.toString(), today.add({ days: soonDays }).toString()];
    const [row] = await this.sql.query<{ drugs: number; out: number; low: number; expiring: number; expired: number; value: string }>(
      `${STOCK} SELECT count(*) FILTER (WHERE active)::int AS drugs,
                       count(*) FILTER (WHERE active AND level = 'OUT')::int AS out,
                       count(*) FILTER (WHERE active AND level = 'LOW')::int AS low,
                       count(*) FILTER (WHERE expiring_soon > 0)::int AS expiring,
                       count(*) FILTER (WHERE expired > 0)::int AS expired,
                       COALESCE(SUM(value::numeric), 0)::text AS value
                  FROM leveled`,
      args,
    );
    const [quarantined] = await this.sql.query<{ n: number }>("SELECT count(*)::int AS n FROM pharmacy_batches WHERE status = 'QUARANTINED' AND quantity > 0");
    const [pending] = await this.sql.query<{ n: number }>("SELECT count(*)::int AS n FROM pharmacy_adjustments WHERE status = 'PENDING'");
    return { drugs: row.drugs, out: row.out, low: row.low, expiring: row.expiring, expired: row.expired, quarantinedBatches: quarantined.n, pendingAdjustments: pending.n, value: num(row.value) };
  }
}

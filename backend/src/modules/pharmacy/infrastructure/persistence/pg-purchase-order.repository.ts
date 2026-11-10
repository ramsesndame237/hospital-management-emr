import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { Temporal } from '../../../../shared-kernel/temporal';
import { OrderLine, OrderState, OrderStatus, PurchaseOrder } from '../../domain/purchase-order';
import { OrderFilter, OrderSummary, PurchaseOrderRepository } from '../../domain/ports';
import { DrugId, Money, PurchaseOrderId, PurchaseOrderNumber, SupplierId } from '../../domain/values';
import { need } from './pg-batch';

interface OrderRow {
  id: string;
  order_number: string;
  supplier_id: string;
  status: string;
  expected_on: string | null;
  notes: string | null;
  created_by: string;
  created_at: Date | string;
  submitted_at: Date | string | null;
  approved_by: string | null;
  approved_at: Date | string | null;
  rejection_reason: string | null;
  closed_by: string | null;
  closed_at: Date | string | null;
  closed_reason: string | null;
}

interface LineRow {
  drug_id: string;
  quantity: number;
  unit_cost: string | number;
  received: number;
}

const COLUMNS = `id, order_number, supplier_id, status, expected_on::text AS expected_on, notes, created_by, created_at, submitted_at, approved_by, approved_at, rejection_reason, closed_by, closed_at, closed_reason`;

function toOrder(row: OrderRow, lines: LineRow[]): PurchaseOrder {
  const what = `Bon de commande ${row.id}`;
  const state: OrderState = {
    id: need(PurchaseOrderId.create(row.id), what),
    number: need(PurchaseOrderNumber.create(row.order_number), what),
    supplierId: need(SupplierId.create(row.supplier_id), what),
    status: row.status as OrderStatus,
    lines: lines.map((l): OrderLine => ({ drugId: need(DrugId.create(l.drug_id), what), quantity: l.quantity, unitCost: Money.restore(Number(l.unit_cost)), received: l.received })),
    expectedOn: row.expected_on ? Temporal.PlainDate.from(row.expected_on.slice(0, 10)) : null,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: requiredInstantFromDb(row.created_at),
    submittedAt: instantFromDb(row.submitted_at),
    approvedBy: row.approved_by,
    approvedAt: instantFromDb(row.approved_at),
    rejectionReason: row.rejection_reason,
    closedBy: row.closed_by,
    closedAt: instantFromDb(row.closed_at),
    closedReason: row.closed_reason,
  };
  return PurchaseOrder.restore(state);
}

/** Charge un bon et ses lignes ; `lock` le verrouille jusqu'à la fin de la transaction (une réception et une approbation se mettent en file). */
export async function loadOrder(db: SqlExecutor, id: string, lock = false): Promise<PurchaseOrder | null> {
  const rows = await db.query<OrderRow>(`SELECT ${COLUMNS} FROM pharmacy_purchase_orders WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!rows[0]) return null;
  const lines = await db.query<LineRow>('SELECT drug_id, quantity, unit_cost, received FROM pharmacy_purchase_order_lines WHERE order_id = $1 ORDER BY position', [id]);
  return toOrder(rows[0], lines);
}

async function writeLines(db: SqlExecutor, order: PurchaseOrder): Promise<void> {
  const s = order.state;
  await db.query('DELETE FROM pharmacy_purchase_order_lines WHERE order_id = $1', [s.id.value]);
  let position = 0;
  for (const l of s.lines) {
    await db.query('INSERT INTO pharmacy_purchase_order_lines (order_id, position, drug_id, quantity, unit_cost, received) VALUES ($1, $2, $3, $4, $5, $6)', [s.id.value, position++, l.drugId.value, l.quantity, l.unitCost.value, l.received]);
  }
}

/** Écrit l'état d'un bon existant (en-tête et lignes). */
export async function saveOrder(db: SqlExecutor, order: PurchaseOrder): Promise<void> {
  const s = order.state;
  await db.query(
    `UPDATE pharmacy_purchase_orders SET supplier_id = $2, status = $3, expected_on = $4::date, notes = $5, submitted_at = $6::timestamptz, approved_by = $7, approved_at = $8::timestamptz,
            rejection_reason = $9, closed_by = $10, closed_at = $11::timestamptz, closed_reason = $12, version = version + 1, updated_at = now() WHERE id = $1`,
    [s.id.value, s.supplierId.value, s.status, s.expectedOn?.toString() ?? null, s.notes, s.submittedAt?.toString() ?? null, s.approvedBy, s.approvedAt?.toString() ?? null, s.rejectionReason, s.closedBy, s.closedAt?.toString() ?? null, s.closedReason],
  );
  await writeLines(db, order);
}

export class PgPurchaseOrderRepository implements PurchaseOrderRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<PurchaseOrderNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('pharmacy_order_number_seq')::text AS n");
    return need(PurchaseOrderNumber.fromSequence(Number(rows[0].n)), 'Numéro de bon de commande');
  }

  async insert(order: PurchaseOrder): Promise<void> {
    const s = order.state;
    await this.sql.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO pharmacy_purchase_orders (id, order_number, supplier_id, status, expected_on, notes, created_by, created_at) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8::timestamptz)`,
        [s.id.value, s.number.value, s.supplierId.value, s.status, s.expectedOn?.toString() ?? null, s.notes, s.createdBy, s.createdAt.toString()],
      );
      await writeLines(tx, order);
    });
  }

  findById(id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    return loadOrder(this.sql, id.value);
  }

  async list(filter: OrderFilter, offset: number, limit: number): Promise<{ items: OrderSummary[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.status) where.push(`o.status = ${arg(filter.status)}`);
    if (filter.supplierId) where.push(`o.supplier_id = ${arg(filter.supplierId.value)}`);
    if (filter.createdBy) where.push(`o.created_by = ${arg(filter.createdBy)}`);
    if (filter.drugId) where.push(`EXISTS (SELECT 1 FROM pharmacy_purchase_order_lines x WHERE x.order_id = o.id AND x.drug_id = ${arg(filter.drugId.value)})`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM pharmacy_purchase_orders o ${condition}`, args);
    // À décider : les plus anciens d'abord (ils attendent depuis le plus longtemps) ; sinon les plus récents.
    const order = filter.status === 'PENDING_APPROVAL' ? 'o.created_at, o.order_number' : 'o.created_at DESC, o.order_number DESC';
    const rows = await this.sql.query<{
      id: string; order_number: string; supplier_id: string; supplier_name: string; status: string; created_by: string; created_at: Date | string; expected_on: string | null;
      lines: number; units: number; received: number; value: string;
    }>(
      `SELECT o.id, o.order_number, o.supplier_id, s.name AS supplier_name, o.status, o.created_by, o.created_at, o.expected_on::text AS expected_on,
              (SELECT count(*)::int FROM pharmacy_purchase_order_lines l WHERE l.order_id = o.id) AS lines,
              (SELECT COALESCE(SUM(l.quantity), 0)::int FROM pharmacy_purchase_order_lines l WHERE l.order_id = o.id) AS units,
              (SELECT COALESCE(SUM(l.received), 0)::int FROM pharmacy_purchase_order_lines l WHERE l.order_id = o.id) AS received,
              (SELECT COALESCE(SUM(l.quantity::numeric * l.unit_cost), 0)::text FROM pharmacy_purchase_order_lines l WHERE l.order_id = o.id) AS value
         FROM pharmacy_purchase_orders o JOIN pharmacy_suppliers s ON s.id = o.supplier_id ${condition} ORDER BY ${order} OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    return {
      total: total[0]?.n ?? 0,
      items: rows.map((r): OrderSummary => ({
        id: r.id, number: r.order_number, supplierId: r.supplier_id, supplierName: r.supplier_name, status: r.status as OrderStatus, createdBy: r.created_by, createdAt: requiredInstantFromDb(r.created_at),
        expectedOn: r.expected_on ? Temporal.PlainDate.from(r.expected_on.slice(0, 10)) : null, lines: r.lines, units: r.units, received: r.received, value: Number(r.value),
      })),
    };
  }

  async mutate(id: PurchaseOrderId, mutate: (order: PurchaseOrder) => Result<void>): Promise<Result<PurchaseOrder> | null> {
    return this.sql.transaction(async (tx) => {
      const order = await loadOrder(tx, id.value, true);
      if (!order) return null;
      const done = mutate(order);
      if (!done.ok) return err(done.error);
      await saveOrder(tx, order);
      return ok((await loadOrder(tx, id.value))!);
    });
  }

  async onOrder(): Promise<Map<string, number>> {
    const rows = await this.sql.query<{ drug_id: string; n: number }>(
      `SELECT l.drug_id, SUM(l.quantity - l.received)::int AS n FROM pharmacy_purchase_order_lines l JOIN pharmacy_purchase_orders o ON o.id = l.order_id
        WHERE o.status IN ('APPROVED', 'PARTIALLY_RECEIVED') GROUP BY l.drug_id`,
    );
    return new Map(rows.map((r) => [r.drug_id, r.n]));
  }
}

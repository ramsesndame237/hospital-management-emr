import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { Instant } from '../../../../shared-kernel/temporal';
import { AdjustmentState, AdjustmentStatus, StockAdjustment } from '../../domain/adjustment';
import { Batch, MovementDraft } from '../../domain/batch';
import { AdjustmentFilter, AdjustmentRepository } from '../../domain/ports';
import { AdjustmentId, AdjustmentNumber, BatchId, DrugId, parseAdjustmentReason, parseDirection } from '../../domain/values';
import { loadBatch, need, saveBatch, writeMovement } from './pg-batch';

interface AdjustmentRow {
  id: string;
  adjustment_number: string;
  drug_id: string;
  batch_id: string;
  direction: string;
  quantity: number;
  reason: string;
  note: string | null;
  status: string;
  requested_by: string;
  requested_at: Date | string;
  decided_by: string | null;
  decided_at: Date | string | null;
  decision_comment: string | null;
}

const COLUMNS = 'id, adjustment_number, drug_id, batch_id, direction, quantity, reason, note, status, requested_by, requested_at, decided_by, decided_at, decision_comment';

function toAdjustment(row: AdjustmentRow): StockAdjustment {
  const what = `Ajustement ${row.id}`;
  const state: AdjustmentState = {
    id: need(AdjustmentId.create(row.id), what),
    number: need(AdjustmentNumber.create(row.adjustment_number), what),
    drugId: need(DrugId.create(row.drug_id), what),
    batchId: need(BatchId.create(row.batch_id), what),
    direction: need(parseDirection(row.direction), what),
    quantity: row.quantity,
    reason: need(parseAdjustmentReason(row.reason), what),
    note: row.note,
    status: row.status as AdjustmentStatus,
    requestedBy: row.requested_by,
    requestedAt: requiredInstantFromDb(row.requested_at),
    decidedBy: row.decided_by,
    decidedAt: instantFromDb(row.decided_at),
    decisionComment: row.decision_comment,
  };
  return StockAdjustment.restore(state);
}

export class PgAdjustmentRepository implements AdjustmentRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<AdjustmentNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('pharmacy_adjustment_number_seq')::text AS n");
    return need(AdjustmentNumber.fromSequence(Number(rows[0].n)), "Numéro d'ajustement");
  }

  async insert(adjustment: StockAdjustment): Promise<void> {
    const s = adjustment.state;
    await this.sql.query(
      `INSERT INTO pharmacy_adjustments (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12, $13::timestamptz, $14)`,
      [s.id.value, s.number.value, s.drugId.value, s.batchId.value, s.direction, s.quantity, s.reason, s.note, s.status, s.requestedBy, s.requestedAt.toString(), s.decidedBy, s.decidedAt?.toString() ?? null, s.decisionComment],
    );
  }

  async findById(id: AdjustmentId): Promise<StockAdjustment | null> {
    const rows = await this.sql.query<AdjustmentRow>(`SELECT ${COLUMNS} FROM pharmacy_adjustments WHERE id = $1`, [id.value]);
    return rows[0] ? toAdjustment(rows[0]) : null;
  }

  async list(filter: AdjustmentFilter, offset: number, limit: number): Promise<{ items: StockAdjustment[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.status) where.push(`status = ${arg(filter.status)}`);
    if (filter.drugId) where.push(`drug_id = ${arg(filter.drugId.value)}`);
    if (filter.batchId) where.push(`batch_id = ${arg(filter.batchId.value)}`);
    if (filter.requestedBy) where.push(`requested_by = ${arg(filter.requestedBy)}`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM pharmacy_adjustments ${condition}`, args);
    // À décider : les plus anciennes d'abord (elles attendent depuis le plus longtemps) ; sinon l'historique, du plus récent au plus ancien.
    const order = filter.status === 'PENDING' ? 'requested_at, adjustment_number' : 'requested_at DESC, adjustment_number DESC';
    const rows = await this.sql.query<AdjustmentRow>(`SELECT ${COLUMNS} FROM pharmacy_adjustments ${condition} ORDER BY ${order} OFFSET ${arg(offset)} LIMIT ${arg(limit)}`, args);
    return { items: rows.map(toAdjustment), total: total[0]?.n ?? 0 };
  }

  async hasPending(batchId: BatchId): Promise<boolean> {
    const rows = await this.sql.query<{ n: number }>("SELECT count(*)::int AS n FROM pharmacy_adjustments WHERE batch_id = $1 AND status = 'PENDING'", [batchId.value]);
    return (rows[0]?.n ?? 0) > 0;
  }

  async decide(
    id: AdjustmentId,
    by: string,
    at: Instant,
    decide: (adjustment: StockAdjustment, batch: Batch) => Result<MovementDraft | null>,
  ): Promise<Result<StockAdjustment> | null> {
    return this.sql.transaction(async (tx) => {
      // Ordre des verrous : la demande, puis son lot. Une réception ne verrouille que des lots, donc aucune attente circulaire possible.
      const rows = await tx.query<AdjustmentRow>(`SELECT ${COLUMNS} FROM pharmacy_adjustments WHERE id = $1 FOR UPDATE`, [id.value]);
      if (!rows[0]) return null;
      const adjustment = toAdjustment(rows[0]);
      const batch = await loadBatch(tx, adjustment.state.batchId.value, true);
      if (!batch) throw new Error(`Lot ${adjustment.state.batchId.value} de l'ajustement ${id.value} introuvable`);
      const done = decide(adjustment, batch);
      if (!done.ok) return err(done.error);
      const s = adjustment.state;
      await tx.query(
        'UPDATE pharmacy_adjustments SET status = $2, decided_by = $3, decided_at = $4::timestamptz, decision_comment = $5, version = version + 1, updated_at = now() WHERE id = $1',
        [s.id.value, s.status, s.decidedBy, s.decidedAt?.toString() ?? null, s.decisionComment],
      );
      if (done.value) {
        await saveBatch(tx, batch);
        await writeMovement(tx, batch, done.value, by, at.toString());
      }
      const reloaded = await tx.query<AdjustmentRow>(`SELECT ${COLUMNS} FROM pharmacy_adjustments WHERE id = $1`, [id.value]);
      return ok(toAdjustment(reloaded[0]));
    });
  }
}

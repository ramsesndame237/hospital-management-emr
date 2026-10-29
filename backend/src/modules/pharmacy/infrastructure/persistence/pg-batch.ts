import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { Temporal } from '../../../../shared-kernel/temporal';
import { Batch, BatchStatus, MovementDraft } from '../../domain/batch';
import { BatchId, BatchNumber, DrugId, Money } from '../../domain/values';

export interface BatchRow {
  id: string;
  drug_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit_cost: string | number;
  status: string;
  quarantine_reason: string | null;
  quarantined_by: string | null;
  quarantined_at: Date | string | null;
  received_at: Date | string;
}

/** Colonnes d'un lot, préfixées par l'alias de table (`b` dans les jointures). */
export const batchColumns = (alias = ''): string => {
  const p = alias ? `${alias}.` : '';
  // La date est lue en texte (« 2027-01-01 ») : aucun fuseau ne doit pouvoir la décaler d'un jour.
  return ['id', 'drug_id', 'batch_number', 'expiry_date::text AS expiry_date', 'quantity', 'unit_cost', 'status', 'quarantine_reason', 'quarantined_by', 'quarantined_at', 'received_at'].map((c) => `${p}${c}`).join(', ');
};

export function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

export function toBatch(row: BatchRow): Batch {
  const what = `Lot ${row.id}`;
  return Batch.restore({
    id: need(BatchId.create(row.id), what),
    drugId: need(DrugId.create(row.drug_id), what),
    batchNumber: need(BatchNumber.create(row.batch_number), what),
    expiry: Temporal.PlainDate.from(String(row.expiry_date).slice(0, 10)),
    quantity: row.quantity,
    unitCost: Money.restore(Number(row.unit_cost)),
    status: row.status as BatchStatus,
    quarantineReason: row.quarantine_reason,
    quarantinedBy: row.quarantined_by,
    quarantinedAt: instantFromDb(row.quarantined_at),
    receivedAt: requiredInstantFromDb(row.received_at),
  });
}

export async function loadBatch(db: SqlExecutor, id: string, lock = false): Promise<Batch | null> {
  const rows = await db.query<BatchRow>(`SELECT ${batchColumns()} FROM pharmacy_batches WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  return rows[0] ? toBatch(rows[0]) : null;
}

/** Crée le lot s'il n'existe pas, sinon écrit son état (quantité, coût, quarantaine). */
export async function saveBatch(db: SqlExecutor, batch: Batch, create = false): Promise<void> {
  const s = batch.state;
  if (create) {
    await db.query(
      `INSERT INTO pharmacy_batches (id, drug_id, batch_number, expiry_date, quantity, unit_cost, status, quarantine_reason, quarantined_by, quarantined_at, received_at)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz)`,
      [s.id.value, s.drugId.value, s.batchNumber.value, s.expiry.toString(), s.quantity, s.unitCost.value, s.status, s.quarantineReason, s.quarantinedBy, s.quarantinedAt?.toString() ?? null, s.receivedAt.toString()],
    );
    return;
  }
  await db.query(
    `UPDATE pharmacy_batches SET quantity = $2, unit_cost = $3, status = $4, quarantine_reason = $5, quarantined_by = $6, quarantined_at = $7::timestamptz, version = version + 1, updated_at = now() WHERE id = $1`,
    [s.id.value, s.quantity, s.unitCost.value, s.status, s.quarantineReason, s.quarantinedBy, s.quarantinedAt?.toString() ?? null],
  );
}

/** Inscrit un mouvement au grand livre ; le solde est celui du lot après le mouvement. */
export async function writeMovement(db: SqlExecutor, batch: Batch, draft: MovementDraft, by: string, at: string): Promise<void> {
  const s = batch.state;
  await db.query(
    'INSERT INTO pharmacy_stock_movements (drug_id, batch_id, type, delta, balance, reason, reference, by, at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)',
    [s.drugId.value, s.id.value, draft.type, draft.delta, s.quantity, draft.reason, draft.reference, by, at],
  );
}

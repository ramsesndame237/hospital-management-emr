import { SqlExecutor } from '../../../../database/sql-executor';
import { requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { Temporal } from '../../../../shared-kernel/temporal';
import { Dispensation, DispensationLine } from '../../domain/dispensation';
import { DispensationRepository, DispensingContext, DispensingPlan } from '../../domain/ports';
import { DispensationId, DispensationNumber } from '../../domain/values';
import { batchColumns, BatchRow, need, saveBatch, toBatch, writeMovement } from './pg-batch';

interface DispensationRow {
  id: string;
  dispensation_number: string;
  prescription_id: string;
  patient_id: string;
  dispensed_by: string;
  dispensed_at: Date | string;
  notes: string | null;
}

interface LineRow {
  dispensation_id: string;
  prescription_position: number;
  drug_id: string;
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  allergy_override: string | null;
}

const COLUMNS = 'id, dispensation_number, prescription_id, patient_id, dispensed_by, dispensed_at, notes';

function toDispensation(row: DispensationRow, lines: LineRow[]): Dispensation {
  const what = `Dispensation ${row.id}`;
  return Dispensation.restore({
    id: need(DispensationId.create(row.id), what),
    number: need(DispensationNumber.create(row.dispensation_number), what),
    prescriptionId: row.prescription_id,
    patientId: row.patient_id,
    dispensedBy: row.dispensed_by,
    dispensedAt: requiredInstantFromDb(row.dispensed_at),
    notes: row.notes,
    lines: lines.map((l): DispensationLine => ({
      prescriptionPosition: l.prescription_position, drugId: l.drug_id, batchId: l.batch_id, batchNumber: l.batch_number, expiry: Temporal.PlainDate.from(String(l.expiry_date).slice(0, 10)),
      quantity: l.quantity, allergyOverride: l.allergy_override,
    })),
  });
}

export class PgDispensationRepository implements DispensationRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<DispensationNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('pharmacy_dispensation_number_seq')::text AS n");
    return need(DispensationNumber.fromSequence(Number(rows[0].n)), 'Numéro de dispensation');
  }

  async dispensedQuantities(prescriptionIds: readonly string[]): Promise<Map<string, Map<number, number>>> {
    const result = new Map<string, Map<number, number>>();
    if (prescriptionIds.length === 0) return result;
    const rows = await this.sql.query<{ prescription_id: string; prescription_position: number; total: number }>(
      `SELECT d.prescription_id, l.prescription_position, SUM(l.quantity)::int AS total FROM pharmacy_dispensation_lines l JOIN pharmacy_dispensations d ON d.id = l.dispensation_id
        WHERE d.prescription_id = ANY($1::uuid[]) GROUP BY d.prescription_id, l.prescription_position`,
      [prescriptionIds],
    );
    for (const r of rows) {
      const byLine = result.get(r.prescription_id) ?? new Map<number, number>();
      byLine.set(r.prescription_position, r.total);
      result.set(r.prescription_id, byLine);
    }
    return result;
  }

  async listOf(prescriptionId: string): Promise<Dispensation[]> {
    const rows = await this.sql.query<DispensationRow>(`SELECT ${COLUMNS} FROM pharmacy_dispensations WHERE prescription_id = $1 ORDER BY dispensed_at, dispensation_number`, [prescriptionId]);
    if (rows.length === 0) return [];
    const lines = await this.sql.query<LineRow>(
      `SELECT dispensation_id, prescription_position, drug_id, batch_id, batch_number, expiry_date::text AS expiry_date, quantity, allergy_override
         FROM pharmacy_dispensation_lines WHERE dispensation_id = ANY($1::uuid[]) ORDER BY dispensation_id, position`,
      [rows.map((r) => r.id)],
    );
    return rows.map((r) => toDispensation(r, lines.filter((l) => l.dispensation_id === r.id)));
  }

  async dispense(prescriptionId: string, decide: (context: DispensingContext) => Promise<Result<DispensingPlan>>): Promise<Result<Dispensation>> {
    return this.sql.transaction(async (tx) => {
      // Un verrou propre à l'ordonnance (sans toucher aux tables de la Clinique) : deux délivrances de la même ordonnance font la queue.
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pharmacy-dispense:${prescriptionId}`]);
      const done = await tx.query<{ prescription_position: number; total: number }>(
        `SELECT l.prescription_position, SUM(l.quantity)::int AS total FROM pharmacy_dispensation_lines l JOIN pharmacy_dispensations d ON d.id = l.dispensation_id
          WHERE d.prescription_id = $1 GROUP BY l.prescription_position`,
        [prescriptionId],
      );
      const context: DispensingContext = {
        dispensed: new Map(done.map((r) => [r.prescription_position, r.total])),
        batchesOf: async (drugId) => {
          const rows = await tx.query<BatchRow>(`SELECT ${batchColumns()} FROM pharmacy_batches WHERE drug_id = $1 ORDER BY expiry_date, received_at, batch_number FOR UPDATE`, [drugId]);
          return rows.map(toBatch);
        },
      };
      const plan = await decide(context);
      if (!plan.ok) return err(plan.error);
      const s = plan.value.dispensation.state;
      await tx.query(
        `INSERT INTO pharmacy_dispensations (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7)`,
        [s.id.value, s.number.value, s.prescriptionId, s.patientId, s.dispensedBy, s.dispensedAt.toString(), s.notes],
      );
      let position = 0;
      for (const l of s.lines) {
        await tx.query(
          `INSERT INTO pharmacy_dispensation_lines (dispensation_id, position, prescription_position, drug_id, batch_id, batch_number, expiry_date, quantity, allergy_override)
           VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)`,
          [s.id.value, position++, l.prescriptionPosition, l.drugId, l.batchId, l.batchNumber, l.expiry.toString(), l.quantity, l.allergyOverride],
        );
      }
      for (const m of plan.value.movements) {
        await saveBatch(tx, m.batch);
        await writeMovement(tx, m.batch, m.draft, s.dispensedBy, s.dispensedAt.toString());
      }
      return ok(plan.value.dispensation);
    });
  }
}

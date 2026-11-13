import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { Prescription, PrescriptionLine, PrescriptionStatus } from '../../domain/prescription';
import { PrescriptionRepository } from '../../domain/ports';
import { DrugRef, EncounterId, PatientRef, PrescriptionId, PrescriptionNumber } from '../../domain/values';

interface PrescriptionRow {
  id: string;
  prescription_number: string;
  encounter_id: string;
  patient_id: string;
  service_id: string;
  doctor_id: string;
  status: string;
  issued_at: Date | string;
  notes: string | null;
  cancelled_by: string | null;
  cancelled_at: Date | string | null;
  cancellation_reason: string | null;
}

interface LineRow {
  prescription_id: string;
  drug_id: string;
  dose: string;
  frequency: string;
  duration_days: number | null;
  quantity: number;
  instructions: string | null;
  allergy_override: string | null;
}

const COLUMNS = 'id, prescription_number, encounter_id, patient_id, service_id, doctor_id, status, issued_at, notes, cancelled_by, cancelled_at, cancellation_reason';

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

function toPrescription(row: PrescriptionRow, lines: LineRow[]): Prescription {
  const what = `Ordonnance ${row.id}`;
  return Prescription.restore({
    id: need(PrescriptionId.create(row.id), what),
    number: need(PrescriptionNumber.create(row.prescription_number), what),
    encounterId: need(EncounterId.create(row.encounter_id), what),
    patientId: need(PatientRef.create(row.patient_id), what),
    serviceId: row.service_id,
    doctorId: row.doctor_id,
    status: row.status as PrescriptionStatus,
    issuedAt: requiredInstantFromDb(row.issued_at),
    notes: row.notes,
    lines: lines.map((l): PrescriptionLine => ({
      drugId: need(DrugRef.create(l.drug_id), what), dose: l.dose, frequency: l.frequency, durationDays: l.duration_days, quantity: l.quantity, instructions: l.instructions, allergyOverride: l.allergy_override,
    })),
    cancelledBy: row.cancelled_by,
    cancelledAt: instantFromDb(row.cancelled_at),
    cancellationReason: row.cancellation_reason,
  });
}

async function linesOf(db: SqlExecutor, ids: readonly string[]): Promise<Map<string, LineRow[]>> {
  const grouped = new Map<string, LineRow[]>();
  if (ids.length === 0) return grouped;
  const rows = await db.query<LineRow>(
    'SELECT prescription_id, drug_id, dose, frequency, duration_days, quantity, instructions, allergy_override FROM clinical_prescription_lines WHERE prescription_id = ANY($1::uuid[]) ORDER BY prescription_id, position',
    [ids],
  );
  for (const r of rows) grouped.set(r.prescription_id, [...(grouped.get(r.prescription_id) ?? []), r]);
  return grouped;
}

async function load(db: SqlExecutor, id: string, lock = false): Promise<Prescription | null> {
  const rows = await db.query<PrescriptionRow>(`SELECT ${COLUMNS} FROM clinical_prescriptions WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!rows[0]) return null;
  return toPrescription(rows[0], (await linesOf(db, [id])).get(id) ?? []);
}

export class PgPrescriptionRepository implements PrescriptionRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<PrescriptionNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('clinical_prescription_number_seq')::text AS n");
    return need(PrescriptionNumber.fromSequence(Number(rows[0].n)), "Numéro d'ordonnance");
  }

  async insert(prescription: Prescription): Promise<void> {
    const s = prescription.state;
    await this.sql.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO clinical_prescriptions (id, prescription_number, encounter_id, patient_id, service_id, doctor_id, status, issued_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9)`,
        [s.id.value, s.number.value, s.encounterId.value, s.patientId.value, s.serviceId, s.doctorId, s.status, s.issuedAt.toString(), s.notes],
      );
      let position = 0;
      for (const l of s.lines) {
        await tx.query(
          'INSERT INTO clinical_prescription_lines (prescription_id, position, drug_id, dose, frequency, duration_days, quantity, instructions, allergy_override) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [s.id.value, position++, l.drugId.value, l.dose, l.frequency, l.durationDays, l.quantity, l.instructions, l.allergyOverride],
        );
      }
    });
  }

  findById(id: PrescriptionId): Promise<Prescription | null> {
    return load(this.sql, id.value);
  }

  async mutate(id: PrescriptionId, mutate: (prescription: Prescription) => Result<void>): Promise<Result<Prescription> | null> {
    return this.sql.transaction(async (tx) => {
      const prescription = await load(tx, id.value, true);
      if (!prescription) return null;
      const done = mutate(prescription);
      if (!done.ok) return err(done.error);
      const s = prescription.state;
      await tx.query(
        'UPDATE clinical_prescriptions SET status = $2, cancelled_by = $3, cancelled_at = $4::timestamptz, cancellation_reason = $5, version = version + 1, updated_at = now() WHERE id = $1',
        [s.id.value, s.status, s.cancelledBy, s.cancelledAt?.toString() ?? null, s.cancellationReason],
      );
      return ok((await load(tx, id.value))!);
    });
  }

  async listOfEncounter(encounterId: EncounterId): Promise<Prescription[]> {
    const rows = await this.sql.query<PrescriptionRow>(`SELECT ${COLUMNS} FROM clinical_prescriptions WHERE encounter_id = $1 ORDER BY issued_at, prescription_number`, [encounterId.value]);
    const lines = await linesOf(this.sql, rows.map((r) => r.id));
    return rows.map((r) => toPrescription(r, lines.get(r.id) ?? []));
  }

  async listIssued(offset: number, limit: number): Promise<{ items: Prescription[]; total: number }> {
    const total = await this.sql.query<{ n: number }>("SELECT count(*)::int AS n FROM clinical_prescriptions WHERE status = 'ISSUED'");
    const rows = await this.sql.query<PrescriptionRow>(
      `SELECT ${COLUMNS} FROM clinical_prescriptions WHERE status = 'ISSUED' ORDER BY issued_at, prescription_number OFFSET $1 LIMIT $2`,
      [offset, limit],
    );
    const lines = await linesOf(this.sql, rows.map((r) => r.id));
    return { total: total[0]?.n ?? 0, items: rows.map((r) => toPrescription(r, lines.get(r.id) ?? [])) };
  }

  async countIssued(encounterId: EncounterId): Promise<number> {
    const rows = await this.sql.query<{ n: number }>("SELECT count(*)::int AS n FROM clinical_prescriptions WHERE encounter_id = $1 AND status = 'ISSUED'", [encounterId.value]);
    return rows[0]?.n ?? 0;
  }
}

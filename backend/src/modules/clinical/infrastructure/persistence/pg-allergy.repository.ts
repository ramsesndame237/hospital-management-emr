import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { Allergy, AllergyStatus } from '../../domain/allergy';
import { AllergyRepository } from '../../domain/ports';
import { AllergyId, parseSeverity, PatientRef } from '../../domain/values';

interface AllergyRow {
  id: string;
  patient_id: string;
  substance: string;
  reaction: string | null;
  severity: string;
  status: string;
  recorded_by: string;
  recorded_at: Date | string;
  voided_by: string | null;
  voided_at: Date | string | null;
  void_reason: string | null;
}

const COLUMNS = 'id, patient_id, substance, reaction, severity, status, recorded_by, recorded_at, voided_by, voided_at, void_reason';

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

function toAllergy(row: AllergyRow): Allergy {
  const what = `Allergie ${row.id}`;
  return Allergy.restore({
    id: need(AllergyId.create(row.id), what), patientId: need(PatientRef.create(row.patient_id), what), substance: row.substance, reaction: row.reaction, severity: need(parseSeverity(row.severity), what),
    status: row.status as AllergyStatus, recordedBy: row.recorded_by, recordedAt: requiredInstantFromDb(row.recorded_at), voidedBy: row.voided_by, voidedAt: instantFromDb(row.voided_at), voidReason: row.void_reason,
  });
}

export class PgAllergyRepository implements AllergyRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async insert(allergy: Allergy): Promise<void> {
    const s = allergy.state;
    await this.sql.query(
      `INSERT INTO clinical_allergies (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10::timestamptz, $11)`,
      [s.id.value, s.patientId.value, s.substance, s.reaction, s.severity, s.status, s.recordedBy, s.recordedAt.toString(), s.voidedBy, s.voidedAt?.toString() ?? null, s.voidReason],
    );
  }

  async findById(id: AllergyId): Promise<Allergy | null> {
    const rows = await this.sql.query<AllergyRow>(`SELECT ${COLUMNS} FROM clinical_allergies WHERE id = $1`, [id.value]);
    return rows[0] ? toAllergy(rows[0]) : null;
  }

  async mutate(id: AllergyId, mutate: (allergy: Allergy) => Result<void>): Promise<Result<Allergy> | null> {
    return this.sql.transaction(async (tx) => {
      const rows = await tx.query<AllergyRow>(`SELECT ${COLUMNS} FROM clinical_allergies WHERE id = $1 FOR UPDATE`, [id.value]);
      if (!rows[0]) return null;
      const allergy = toAllergy(rows[0]);
      const done = mutate(allergy);
      if (!done.ok) return err(done.error);
      const s = allergy.state;
      await tx.query(
        'UPDATE clinical_allergies SET reaction = $2, severity = $3, status = $4, voided_by = $5, voided_at = $6::timestamptz, void_reason = $7, version = version + 1, updated_at = now() WHERE id = $1',
        [s.id.value, s.reaction, s.severity, s.status, s.voidedBy, s.voidedAt?.toString() ?? null, s.voidReason],
      );
      const reloaded = await tx.query<AllergyRow>(`SELECT ${COLUMNS} FROM clinical_allergies WHERE id = $1`, [id.value]);
      return ok(toAllergy(reloaded[0]));
    });
  }

  async listOf(patientId: PatientRef, includeVoided: boolean): Promise<Allergy[]> {
    const rows = await this.sql.query<AllergyRow>(
      `SELECT ${COLUMNS} FROM clinical_allergies WHERE patient_id = $1${includeVoided ? '' : " AND status = 'ACTIVE'"} ORDER BY recorded_at DESC, id`,
      [patientId.value],
    );
    return rows.map(toAllergy);
  }
}

import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { Addendum, Diagnosis, Encounter, EncounterStatus } from '../../domain/encounter';
import { AdmissionEncounter, EncounterFilter, EncounterRepository, EncounterSummary } from '../../domain/ports';
import { Vitals } from '../../domain/vitals';
import { EncounterId, EncounterNumber, IcdCode, parseCertainty, parseDiagnosisKind, PatientRef } from '../../domain/values';

interface EncounterRow {
  id: string;
  encounter_number: string;
  patient_id: string;
  service_id: string;
  admission_id: string | null;
  doctor_id: string;
  status: string;
  started_at: Date | string;
  temperature: string | number | null;
  pulse: number | null;
  systolic: number | null;
  diastolic: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  weight_kg: string | number | null;
  height_cm: string | number | null;
  vitals_by: string | null;
  vitals_at: Date | string | null;
  chief_complaint: string | null;
  history: string | null;
  examination: string | null;
  assessment: string | null;
  plan: string | null;
  signed_by: string | null;
  signed_at: Date | string | null;
  cancelled_by: string | null;
  cancelled_at: Date | string | null;
  cancellation_reason: string | null;
}

interface DiagnosisRow {
  code: string;
  label: string;
  kind: string;
  certainty: string;
}

interface AddendumRow {
  seq: number;
  text: string;
  by: string;
  at: Date | string;
}

const COLUMNS = `id, encounter_number, patient_id, service_id, admission_id, doctor_id, status, started_at, temperature, pulse, systolic, diastolic, respiratory_rate, spo2, weight_kg, height_cm,
  vitals_by, vitals_at, chief_complaint, history, examination, assessment, plan, signed_by, signed_at, cancelled_by, cancelled_at, cancellation_reason`;

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

function toEncounter(row: EncounterRow, diagnoses: DiagnosisRow[], addenda: AddendumRow[]): Encounter {
  const what = `Consultation ${row.id}`;
  const vitals: Vitals | null = row.vitals_at === null
    ? null
    : { temperature: num(row.temperature), pulse: row.pulse, systolic: row.systolic, diastolic: row.diastolic, respiratoryRate: row.respiratory_rate, spo2: row.spo2, weightKg: num(row.weight_kg), heightCm: num(row.height_cm) };
  return Encounter.restore({
    id: need(EncounterId.create(row.id), what),
    number: need(EncounterNumber.create(row.encounter_number), what),
    patientId: need(PatientRef.create(row.patient_id), what),
    serviceId: row.service_id,
    admissionId: row.admission_id,
    doctorId: row.doctor_id,
    status: row.status as EncounterStatus,
    startedAt: requiredInstantFromDb(row.started_at),
    vitals,
    vitalsBy: row.vitals_by,
    vitalsAt: instantFromDb(row.vitals_at),
    note: { chiefComplaint: row.chief_complaint, history: row.history, examination: row.examination, assessment: row.assessment, plan: row.plan },
    diagnoses: diagnoses.map((d): Diagnosis => ({ code: need(IcdCode.create(d.code), what), label: d.label, kind: need(parseDiagnosisKind(d.kind), what), certainty: need(parseCertainty(d.certainty), what) })),
    signedBy: row.signed_by,
    signedAt: instantFromDb(row.signed_at),
    addenda: addenda.map((a): Addendum => ({ seq: a.seq, text: a.text, by: a.by, at: requiredInstantFromDb(a.at) })),
    cancelledBy: row.cancelled_by,
    cancelledAt: instantFromDb(row.cancelled_at),
    cancellationReason: row.cancellation_reason,
  });
}

async function load(db: SqlExecutor, id: string, lock = false): Promise<Encounter | null> {
  const rows = await db.query<EncounterRow>(`SELECT ${COLUMNS} FROM clinical_encounters WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!rows[0]) return null;
  const diagnoses = await db.query<DiagnosisRow>('SELECT code, label, kind, certainty FROM clinical_encounter_diagnoses WHERE encounter_id = $1 ORDER BY position', [id]);
  const addenda = await db.query<AddendumRow>('SELECT seq, text, by, at FROM clinical_encounter_addenda WHERE encounter_id = $1 ORDER BY seq', [id]);
  return toEncounter(rows[0], diagnoses, addenda);
}

const diagnosesKey = (e: Encounter): string => JSON.stringify(e.state.diagnoses.map((d) => [d.code.value, d.label, d.kind, d.certainty]));

export class PgEncounterRepository implements EncounterRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<EncounterNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('clinical_encounter_number_seq')::text AS n");
    return need(EncounterNumber.fromSequence(Number(rows[0].n)), 'Numéro de consultation');
  }

  async insert(encounter: Encounter): Promise<boolean> {
    const s = encounter.state;
    const rows = await this.sql.query<{ id: string }>(
      `INSERT INTO clinical_encounters (id, encounter_number, patient_id, service_id, admission_id, doctor_id, status, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz) ON CONFLICT DO NOTHING RETURNING id`,
      [s.id.value, s.number.value, s.patientId.value, s.serviceId, s.admissionId, s.doctorId, s.status, s.startedAt.toString()],
    );
    return rows.length === 1;
  }

  findById(id: EncounterId): Promise<Encounter | null> {
    return load(this.sql, id.value);
  }

  async mutate(id: EncounterId, mutate: (encounter: Encounter) => Result<void>): Promise<Result<Encounter> | null> {
    return this.sql.transaction(async (tx) => {
      const encounter = await load(tx, id.value, true);
      if (!encounter) return null;
      const before = diagnosesKey(encounter);
      const done = mutate(encounter);
      if (!done.ok) return err(done.error);
      const s = encounter.state;
      // Les diagnostics s'écrivent AVANT le changement de statut : le déclencheur n'admet leur écriture que tant que la consultation est en cours.
      if (diagnosesKey(encounter) !== before) {
        await tx.query('DELETE FROM clinical_encounter_diagnoses WHERE encounter_id = $1', [s.id.value]);
        let position = 0;
        for (const d of s.diagnoses) {
          await tx.query('INSERT INTO clinical_encounter_diagnoses (encounter_id, position, code, label, kind, certainty) VALUES ($1, $2, $3, $4, $5, $6)', [s.id.value, position++, d.code.value, d.label, d.kind, d.certainty]);
        }
      }
      const v = s.vitals;
      await tx.query(
        `UPDATE clinical_encounters SET status = $2, temperature = $3, pulse = $4, systolic = $5, diastolic = $6, respiratory_rate = $7, spo2 = $8, weight_kg = $9, height_cm = $10,
                vitals_by = $11, vitals_at = $12::timestamptz, chief_complaint = $13, history = $14, examination = $15, assessment = $16, plan = $17, signed_by = $18, signed_at = $19::timestamptz,
                cancelled_by = $20, cancelled_at = $21::timestamptz, cancellation_reason = $22, version = version + 1, updated_at = now() WHERE id = $1`,
        [
          s.id.value, s.status, v?.temperature ?? null, v?.pulse ?? null, v?.systolic ?? null, v?.diastolic ?? null, v?.respiratoryRate ?? null, v?.spo2 ?? null, v?.weightKg ?? null, v?.heightCm ?? null,
          s.vitalsBy, s.vitalsAt?.toString() ?? null, s.note.chiefComplaint, s.note.history, s.note.examination, s.note.assessment, s.note.plan, s.signedBy, s.signedAt?.toString() ?? null,
          s.cancelledBy, s.cancelledAt?.toString() ?? null, s.cancellationReason,
        ],
      );
      return ok((await load(tx, id.value))!);
    });
  }

  async addAddendum(id: EncounterId, add: (encounter: Encounter) => Result<Addendum>): Promise<Result<Encounter> | null> {
    return this.sql.transaction(async (tx) => {
      // Le verrou sérialise deux addenda simultanés (leur numéro d'ordre) ; la consultation elle-même n'est pas réécrite.
      const encounter = await load(tx, id.value, true);
      if (!encounter) return null;
      const added = add(encounter);
      if (!added.ok) return err(added.error);
      await tx.query('INSERT INTO clinical_encounter_addenda (encounter_id, seq, text, by, at) VALUES ($1, $2, $3, $4, $5::timestamptz)', [id.value, added.value.seq, added.value.text, added.value.by, added.value.at.toString()]);
      return ok((await load(tx, id.value))!);
    });
  }

  async list(filter: EncounterFilter, offset: number, limit: number): Promise<{ items: EncounterSummary[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.serviceIds !== null) where.push(`e.service_id = ANY(${arg(filter.serviceIds)}::uuid[])`);
    if (filter.patientId) where.push(`e.patient_id = ${arg(filter.patientId.value)}`);
    if (filter.status) where.push(`e.status = ${arg(filter.status)}`);
    if (filter.doctorId) where.push(`e.doctor_id = ${arg(filter.doctorId)}`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM clinical_encounters e ${condition}`, args);
    const rows = await this.sql.query<{ id: string; encounter_number: string; patient_id: string; service_id: string; doctor_id: string; status: string; started_at: Date | string; signed_at: Date | string | null; code: string | null; label: string | null }>(
      `SELECT e.id, e.encounter_number, e.patient_id, e.service_id, e.doctor_id, e.status, e.started_at, e.signed_at, p.code, p.label
         FROM clinical_encounters e LEFT JOIN clinical_encounter_diagnoses p ON p.encounter_id = e.id AND p.kind = 'PRIMARY'
         ${condition} ORDER BY e.started_at DESC, e.encounter_number DESC OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    return {
      total: total[0]?.n ?? 0,
      items: rows.map((r): EncounterSummary => ({
        id: r.id, number: r.encounter_number, patientId: r.patient_id, serviceId: r.service_id, doctorId: r.doctor_id, status: r.status as EncounterStatus, startedAt: requiredInstantFromDb(r.started_at),
        signedAt: instantFromDb(r.signed_at), primaryDiagnosis: r.code && r.label ? { code: r.code, label: r.label } : null,
      })),
    };
  }

  async byAdmissions(admissionIds: readonly string[]): Promise<Map<string, AdmissionEncounter>> {
    if (admissionIds.length === 0) return new Map();
    const rows = await this.sql.query<{ admission_id: string; id: string; encounter_number: string; doctor_id: string; status: string }>(
      `SELECT DISTINCT ON (admission_id) admission_id, id, encounter_number, doctor_id, status FROM clinical_encounters
        WHERE status <> 'CANCELLED' AND admission_id = ANY($1::uuid[]) ORDER BY admission_id, (status = 'IN_PROGRESS') DESC, started_at DESC`,
      [admissionIds],
    );
    return new Map(rows.map((r) => [r.admission_id, { id: r.id, number: r.encounter_number, doctorId: r.doctor_id, status: r.status as EncounterStatus }]));
  }
}

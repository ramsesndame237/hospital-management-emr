import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { Admission, Movement, MovementKind } from '../../domain/admission';
import { AdmissionFilter, AdmissionRepository, MovementRecord, SaveOutcome } from '../../domain/ports';
import {
  AdmissionId, AdmissionNumber, AdmissionStatus, AdmissionType, AppointmentRef, BedRef, DischargeType, parseEnum, PatientRef, PractitionerRef, ReasonCode, ServiceRef,
} from '../../domain/values';

interface AdmissionRow {
  id: string;
  admission_number: string;
  patient_id: string;
  admission_type: string;
  status: string;
  service_id: string;
  bed_id: string | null;
  practitioner_id: string | null;
  appointment_id: string | null;
  reason_code: string | null;
  admitted_at: Date;
  discharged_at: Date | null;
  discharge_type: string | null;
  cancellation_reason: string | null;
}

const COLUMNS = 'id, admission_number, patient_id, admission_type, status, service_id, bed_id, practitioner_id, appointment_id, reason_code, admitted_at, discharged_at, discharge_type, cancellation_reason';

function toAdmission(row: AdmissionRow): Admission {
  const need = <T>(r: { ok: true; value: T } | { ok: false }): T => {
    if (!r.ok) throw new Error(`Admission corrompue en base : ${row.id}`);
    return r.value;
  };
  const maybe = <T>(raw: string | null, parse: (v: string) => { ok: true; value: T } | { ok: false }): T | null => (raw === null ? null : need(parse(raw)));
  return Admission.restore({
    id: need(AdmissionId.create(row.id)),
    number: need(AdmissionNumber.create(row.admission_number)),
    patientId: need(PatientRef.create(row.patient_id)),
    type: need(parseEnum(AdmissionType, row.admission_type, 'type')),
    status: need(parseEnum(AdmissionStatus, row.status, 'status')),
    serviceId: need(ServiceRef.create(row.service_id)),
    bedId: maybe(row.bed_id, BedRef.create),
    practitionerId: maybe(row.practitioner_id, PractitionerRef.create),
    appointmentId: maybe(row.appointment_id, AppointmentRef.create),
    reasonCode: maybe(row.reason_code, ReasonCode.create),
    admittedAt: requiredInstantFromDb(row.admitted_at),
    dischargedAt: instantFromDb(row.discharged_at),
    dischargeType: maybe(row.discharge_type, (v) => parseEnum(DischargeType, v, 'dischargeType')),
    cancellationReason: row.cancellation_reason,
  });
}

/** Contraintes d'unicité qui expriment des règles du métier : leur violation est une réponse, pas une panne. */
const RULES: readonly [string, SaveOutcome][] = [
  ['ux_admissions_bed_active', 'BED_OCCUPIED'],
  ['ux_admissions_patient_inpatient', 'PATIENT_ALREADY_INPATIENT'],
  ['ux_admissions_appointment', 'APPOINTMENT_ALREADY_USED'],
];

export class PgAdmissionRepository implements AdmissionRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<AdmissionNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('admissions_number_seq')::text AS n");
    const number = AdmissionNumber.fromSequence(Number(rows[0].n));
    if (!number.ok) throw new Error(number.error.message);
    return number.value;
  }

  async findById(id: AdmissionId): Promise<Admission | null> {
    const rows = await this.sql.query<AdmissionRow>(`SELECT ${COLUMNS} FROM admissions WHERE id = $1`, [id.value]);
    return rows[0] ? toAdmission(rows[0]) : null;
  }

  async save(admission: Admission, movement: Movement): Promise<SaveOutcome> {
    const s = admission.state;
    try {
      await this.sql.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO admissions (id, admission_number, patient_id, admission_type, status, service_id, bed_id, practitioner_id, appointment_id, reason_code, admitted_at,
             discharged_at, discharge_type, cancellation_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13, $14)
           ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, service_id = EXCLUDED.service_id, bed_id = EXCLUDED.bed_id, discharged_at = EXCLUDED.discharged_at,
             discharge_type = EXCLUDED.discharge_type, cancellation_reason = EXCLUDED.cancellation_reason, updated_at = now()`,
          [
            s.id.value, s.number.value, s.patientId.value, s.type, s.status, s.serviceId.value, s.bedId?.value ?? null, s.practitionerId?.value ?? null, s.appointmentId?.value ?? null,
            s.reasonCode?.value ?? null, s.admittedAt.toString(), s.dischargedAt?.toString() ?? null, s.dischargeType, s.cancellationReason,
          ],
        );
        // Le verrou de ligne pris par l'écriture ci-dessus sérialise les mouvements concurrents de la même admission : numéros sans doublon.
        await tx.query(
          `INSERT INTO admission_movements (admission_id, seq, kind, at, actor_id, service_id, bed_id)
           SELECT $1::uuid, COALESCE(MAX(seq), 0) + 1, $2::text, $3::timestamptz, $4::text, $5::uuid, $6::uuid FROM admission_movements WHERE admission_id = $1::uuid`,
          [s.id.value, movement.kind, movement.at.toString(), movement.actorId, movement.serviceId, movement.bedId],
        );
      });
      return 'OK';
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const rule = RULES.find(([index]) => message.includes(index));
      if (rule) return rule[1];
      throw e;
    }
  }

  async list(filter: AdmissionFilter, offset: number, limit: number): Promise<{ items: Admission[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.status) where.push(`status = ${arg(filter.status)}`);
    if (filter.type) where.push(`admission_type = ${arg(filter.type)}`);
    if (filter.patientId) where.push(`patient_id = ${arg(filter.patientId.value)}`);
    if (filter.practitionerId) where.push(`practitioner_id = ${arg(filter.practitionerId.value)}`);
    if (filter.from) where.push(`admitted_at >= ${arg(filter.from)}::timestamptz`);
    if (filter.to) where.push(`admitted_at < ${arg(filter.to)}::timestamptz`);
    if (filter.serviceIds) where.push(`service_id = ANY(${arg([...filter.serviceIds])}::uuid[])`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<AdmissionRow>(
      `SELECT ${COLUMNS} FROM admissions ${condition} ORDER BY admitted_at DESC, id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM admissions ${condition}`, args.slice(0, args.length - 2));
    return { items: rows.map(toAdmission), total: total[0]?.n ?? 0 };
  }

  async movements(id: AdmissionId): Promise<MovementRecord[]> {
    const rows = await this.sql.query<{ seq: number; kind: string; at: Date; actor_id: string; service_id: string; bed_id: string | null }>(
      'SELECT seq, kind, at, actor_id, service_id, bed_id FROM admission_movements WHERE admission_id = $1 ORDER BY seq',
      [id.value],
    );
    return rows.map((r) => ({ seq: r.seq, kind: r.kind as MovementKind, at: requiredInstantFromDb(r.at), actorId: r.actor_id, serviceId: r.service_id, bedId: r.bed_id }));
  }

  async findInpatientOf(patientId: PatientRef): Promise<Admission | null> {
    const rows = await this.sql.query<AdmissionRow>(`SELECT ${COLUMNS} FROM admissions WHERE patient_id = $1 AND admission_type = 'INPATIENT' AND status = 'IN_PROGRESS'`, [patientId.value]);
    return rows[0] ? toAdmission(rows[0]) : null;
  }

  async occupants(beds: readonly BedRef[]): Promise<Map<string, Admission>> {
    if (beds.length === 0) return new Map();
    const rows = await this.sql.query<AdmissionRow>(`SELECT ${COLUMNS} FROM admissions WHERE status = 'IN_PROGRESS' AND bed_id = ANY($1::uuid[])`, [beds.map((b) => b.value)]);
    const map = new Map<string, Admission>();
    for (const row of rows) map.set(row.bed_id as string, toAdmission(row));
    return map;
  }
}

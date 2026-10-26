import { SqlExecutor } from '../../../../database/sql-executor';
import { requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { Appointment, AppointmentNumber } from '../../domain/appointment';
import { AppointmentFilter, AppointmentRepository, Conflicts } from '../../domain/ports';
import {
  AppointmentId, AppointmentStatus, isActiveStatus, LocationRef, parseStatus, PatientRef, PractitionerRef, ReasonCode, ServiceRef, TimeSlot,
} from '../../domain/values';

interface AppointmentRow {
  id: string;
  appointment_number: string;
  patient_id: string;
  practitioner_id: string;
  location_id: string;
  service_id: string;
  starts_at: Date;
  duration_minutes: number;
  reason_code: string | null;
  status: string;
  cancellation_reason: string | null;
}

const COLUMNS = 'id, appointment_number, patient_id, practitioner_id, location_id, service_id, starts_at, duration_minutes, reason_code, status, cancellation_reason';

function toAppointment(row: AppointmentRow): Appointment {
  const need = <T>(r: { ok: true; value: T } | { ok: false }): T => {
    if (!r.ok) throw new Error(`Rendez-vous corrompu en base : ${row.id}`);
    return r.value;
  };
  return Appointment.restore({
    id: need(AppointmentId.create(row.id)),
    number: need(AppointmentNumber.create(row.appointment_number)),
    patientId: need(PatientRef.create(row.patient_id)),
    practitionerId: need(PractitionerRef.create(row.practitioner_id)),
    locationId: need(LocationRef.create(row.location_id)),
    serviceId: need(ServiceRef.create(row.service_id)),
    slot: TimeSlot.restore(requiredInstantFromDb(row.starts_at), row.duration_minutes),
    reasonCode: row.reason_code === null ? null : need(ReasonCode.create(row.reason_code)),
    status: need(parseStatus(row.status)) as AppointmentStatus,
    cancellationReason: row.cancellation_reason,
  });
}

const OVERLAP = 'starts_at < $3::timestamptz AND ends_at > $2::timestamptz';

export class PgAppointmentRepository implements AppointmentRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<AppointmentNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('appointments_number_seq')::text AS n");
    const number = AppointmentNumber.fromSequence(Number(rows[0].n));
    if (!number.ok) throw new Error(number.error.message);
    return number.value;
  }

  async findById(id: AppointmentId): Promise<Appointment | null> {
    const rows = await this.sql.query<AppointmentRow>(`SELECT ${COLUMNS} FROM appointments WHERE id = $1`, [id.value]);
    return rows[0] ? toAppointment(rows[0]) : null;
  }

  async save(appointment: Appointment): Promise<Conflicts> {
    const s = appointment.state;
    return this.sql.transaction(async (tx) => {
      if (isActiveStatus(s.status)) {
        // Deux réservations simultanées pour le même professionnel (ou le même patient) se mettent en file : la seconde voit la première.
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0)), pg_advisory_xact_lock(hashtextextended($2, 0))', [`practitioner:${s.practitionerId.value}`, `patient:${s.patientId.value}`]);
        const conflicts = await this.conflicts(tx, s.practitionerId, s.patientId, s.slot, s.id);
        if (conflicts.practitionerBusy || conflicts.patientBusy) return conflicts;
      }
      await tx.query(
        `INSERT INTO appointments (id, appointment_number, patient_id, practitioner_id, location_id, service_id, starts_at, duration_minutes, ends_at, reason_code, status, cancellation_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9::timestamptz, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET practitioner_id = EXCLUDED.practitioner_id, location_id = EXCLUDED.location_id, service_id = EXCLUDED.service_id,
           starts_at = EXCLUDED.starts_at, duration_minutes = EXCLUDED.duration_minutes, ends_at = EXCLUDED.ends_at, reason_code = EXCLUDED.reason_code,
           status = EXCLUDED.status, cancellation_reason = EXCLUDED.cancellation_reason, updated_at = now()`,
        [
          s.id.value, s.number.value, s.patientId.value, s.practitionerId.value, s.locationId.value, s.serviceId.value, s.slot.start.toString(), s.slot.durationMinutes,
          s.slot.end.toString(), s.reasonCode?.value ?? null, s.status, s.cancellationReason,
        ],
      );
      return { practitionerBusy: false, patientBusy: false };
    });
  }

  async list(filter: AppointmentFilter, offset: number, limit: number): Promise<{ items: Appointment[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.from) where.push(`starts_at >= ${arg(filter.from)}::timestamptz`);
    if (filter.to) where.push(`starts_at < ${arg(filter.to)}::timestamptz`);
    if (filter.practitionerId) where.push(`practitioner_id = ${arg(filter.practitionerId.value)}`);
    if (filter.patientId) where.push(`patient_id = ${arg(filter.patientId.value)}`);
    if (filter.status) where.push(`status = ${arg(filter.status)}`);
    if (filter.serviceIds) where.push(`service_id = ANY(${arg([...filter.serviceIds])}::uuid[])`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<AppointmentRow>(
      `SELECT ${COLUMNS} FROM appointments ${condition} ORDER BY starts_at, id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM appointments ${condition}`, args.slice(0, args.length - 2));
    return { items: rows.map(toAppointment), total: total[0]?.n ?? 0 };
  }

  findConflicts(practitionerId: PractitionerRef, patientId: PatientRef, slot: TimeSlot, excludeId?: AppointmentId): Promise<Conflicts> {
    return this.conflicts(this.sql, practitionerId, patientId, slot, excludeId);
  }

  private async conflicts(db: SqlExecutor, practitionerId: PractitionerRef, patientId: PatientRef, slot: TimeSlot, excludeId?: AppointmentId): Promise<Conflicts> {
    const rows = await db.query<{ practitioner_busy: boolean; patient_busy: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM appointments WHERE practitioner_id = $1 AND status IN ('SCHEDULED', 'ARRIVED') AND ${OVERLAP} AND ($4::uuid IS NULL OR id <> $4::uuid)) AS practitioner_busy,
              EXISTS (SELECT 1 FROM appointments WHERE patient_id = $5 AND status IN ('SCHEDULED', 'ARRIVED') AND ${OVERLAP} AND ($4::uuid IS NULL OR id <> $4::uuid)) AS patient_busy`,
      [practitionerId.value, slot.start.toString(), slot.end.toString(), excludeId?.value ?? null, patientId.value],
    );
    return { practitionerBusy: rows[0]?.practitioner_busy === true, patientBusy: rows[0]?.patient_busy === true };
  }
}

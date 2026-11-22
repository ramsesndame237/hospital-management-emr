import { SqlExecutor } from '../../../../database/sql-executor';
import { requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { Consciousness, Risk } from '../../domain/news2';
import { Administration, AdministrationStatus, ChartRepository, NursingNote, Observation } from '../../domain/ports';

interface ObservationRow {
  id: string;
  admission_id: string;
  patient_id: string;
  service_id: string;
  recorded_by: string;
  recorded_at: Date | string;
  temperature: string | number;
  pulse: number;
  systolic: number;
  diastolic: number | null;
  respiratory_rate: number;
  spo2: number;
  supplemental_o2: boolean;
  consciousness: string;
  news2: number;
  risk: string;
  note: string | null;
}

interface AdministrationRow {
  id: string;
  admission_id: string;
  patient_id: string;
  service_id: string;
  prescription_id: string;
  position: number;
  status: string;
  reason: string | null;
  administered_by: string;
  administered_at: Date | string;
}

interface NoteRow {
  id: string;
  admission_id: string;
  patient_id: string;
  service_id: string;
  author_id: string;
  written_at: Date | string;
  text: string;
}

const OBS_COLUMNS = 'id, admission_id, patient_id, service_id, recorded_by, recorded_at, temperature, pulse, systolic, diastolic, respiratory_rate, spo2, supplemental_o2, consciousness, news2, risk, note';

const toObservation = (r: ObservationRow): Observation => ({
  id: r.id, admissionId: r.admission_id, patientId: r.patient_id, serviceId: r.service_id, recordedBy: r.recorded_by, recordedAt: requiredInstantFromDb(r.recorded_at),
  temperature: Number(r.temperature), pulse: r.pulse, systolic: r.systolic, diastolic: r.diastolic, respiratoryRate: r.respiratory_rate, spo2: r.spo2, supplementalOxygen: r.supplemental_o2,
  consciousness: r.consciousness as Consciousness, news2: r.news2, risk: r.risk as Risk, note: r.note,
});

export class PgChartRepository implements ChartRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async insertObservation(o: Observation): Promise<void> {
    await this.sql.query(
      `INSERT INTO inpatient_observations (${OBS_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [o.id, o.admissionId, o.patientId, o.serviceId, o.recordedBy, o.recordedAt.toString(), o.temperature, o.pulse, o.systolic, o.diastolic, o.respiratoryRate, o.spo2, o.supplementalOxygen, o.consciousness, o.news2, o.risk, o.note],
    );
  }

  async observations(admissionId: string, limit: number): Promise<Observation[]> {
    const rows = await this.sql.query<ObservationRow>(`SELECT ${OBS_COLUMNS} FROM inpatient_observations WHERE admission_id = $1 ORDER BY recorded_at DESC, id LIMIT $2`, [admissionId, limit]);
    return rows.map(toObservation);
  }

  async latestObservations(admissionIds: readonly string[]): Promise<Map<string, Observation>> {
    if (admissionIds.length === 0) return new Map();
    const rows = await this.sql.query<ObservationRow>(
      `SELECT DISTINCT ON (admission_id) ${OBS_COLUMNS} FROM inpatient_observations WHERE admission_id = ANY($1::uuid[]) ORDER BY admission_id, recorded_at DESC, id`,
      [admissionIds],
    );
    return new Map(rows.map((r) => [r.admission_id, toObservation(r)]));
  }

  async insertAdministration(a: Administration): Promise<void> {
    await this.sql.query(
      'INSERT INTO inpatient_administrations (id, admission_id, patient_id, service_id, prescription_id, position, status, reason, administered_by, administered_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)',
      [a.id, a.admissionId, a.patientId, a.serviceId, a.prescriptionId, a.position, a.status, a.reason, a.administeredBy, a.administeredAt.toString()],
    );
  }

  async administrations(admissionId: string, limit: number): Promise<Administration[]> {
    const rows = await this.sql.query<AdministrationRow>(
      'SELECT id, admission_id, patient_id, service_id, prescription_id, position, status, reason, administered_by, administered_at FROM inpatient_administrations WHERE admission_id = $1 ORDER BY administered_at DESC, id LIMIT $2',
      [admissionId, limit],
    );
    return rows.map((r) => ({
      id: r.id, admissionId: r.admission_id, patientId: r.patient_id, serviceId: r.service_id, prescriptionId: r.prescription_id, position: r.position, status: r.status as AdministrationStatus,
      reason: r.reason, administeredBy: r.administered_by, administeredAt: requiredInstantFromDb(r.administered_at),
    }));
  }

  async insertNote(n: NursingNote): Promise<void> {
    await this.sql.query('INSERT INTO inpatient_notes (id, admission_id, patient_id, service_id, author_id, written_at, text) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7)', [
      n.id, n.admissionId, n.patientId, n.serviceId, n.authorId, n.writtenAt.toString(), n.text,
    ]);
  }

  async notes(admissionId: string, limit: number): Promise<NursingNote[]> {
    const rows = await this.sql.query<NoteRow>('SELECT id, admission_id, patient_id, service_id, author_id, written_at, text FROM inpatient_notes WHERE admission_id = $1 ORDER BY written_at DESC, id LIMIT $2', [admissionId, limit]);
    return rows.map((r) => ({ id: r.id, admissionId: r.admission_id, patientId: r.patient_id, serviceId: r.service_id, authorId: r.author_id, writtenAt: requiredInstantFromDb(r.written_at), text: r.text }));
  }
}

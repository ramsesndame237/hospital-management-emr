import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { CriticalNotification, NotificationMethod, ResultFlag, ResultStatus, ResultVersion, TestResult } from '../../domain/result';
import { OrderedTest, Requisition, RequisitionStatus, Specimen, SpecimenEvent, SpecimenEventKind, SpecimenStatus } from '../../domain/requisition';
import { PreviousResult, RequisitionFilter, RequisitionRepository, RequisitionSummary } from '../../domain/ports';
import {
  Container, parseContainer, parsePriority, parseRejectionReason, parseSection, parseSource, parseSpecimenType, PatientRef, Reason, RequisitionId, RequisitionNumber, Section, SpecimenBarcode, SpecimenId,
  SpecimenType, TestCode, TestId, TestName,
} from '../../domain/values';

interface RequisitionRow {
  id: string;
  requisition_number: string;
  patient_id: string;
  priority: string;
  source: string;
  status: string;
  clinical_notes: string | null;
  ordered_by: string;
  ordered_at: Date | string;
  cancelled_by: string | null;
  cancelled_at: Date | string | null;
  cancellation_reason: string | null;
  version: number;
}

interface TestRow {
  test_id: string;
  test_code: string;
  test_name: string;
  section: string;
  specimen_id: string;
}

interface SpecimenRow {
  id: string;
  barcode: string;
  specimen_type: string;
  container: string;
  status: string;
  collected_by: string | null;
  collected_at: Date | string | null;
  received_by: string | null;
  received_at: Date | string | null;
  rejection_reason: string | null;
  rejection_note: string | null;
  rejected_by: string | null;
  rejected_at: Date | string | null;
  recollection_of: string | null;
}

interface ResultRow {
  test_id: string;
  status: string;
  released_version: number | null;
  return_reason: string | null;
  verified_by: string | null;
  verified_at: Date | string | null;
  released_by: string | null;
  released_at: Date | string | null;
}

interface VersionRow {
  test_id: string;
  version: number;
  value: string;
  value_number: string | number | null;
  flag: string | null;
  ref_low: string | number | null;
  ref_high: string | number | null;
  critical_low: string | number | null;
  critical_high: string | number | null;
  unit: string | null;
  previous_value: string | number | null;
  delta_alert: boolean;
  entered_by: string;
  entered_at: Date | string;
  comment: string | null;
  amendment_reason: string | null;
}

interface NotificationRow {
  test_id: string;
  version: number;
  notified_name: string;
  notified_role: string;
  method: string;
  read_back: boolean;
  at: Date | string;
  by: string;
}

const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

function toResult(row: ResultRow | undefined, versions: VersionRow[], notifications: NotificationRow[]): TestResult | null {
  if (!row) return null;
  return {
    status: row.status as ResultStatus,
    versions: versions.map((v): ResultVersion => ({
      version: v.version, value: v.value, valueNumber: num(v.value_number), flag: v.flag as ResultFlag | null, refLow: num(v.ref_low), refHigh: num(v.ref_high), criticalLow: num(v.critical_low),
      criticalHigh: num(v.critical_high), unit: v.unit, previousValue: num(v.previous_value), deltaAlert: v.delta_alert, enteredBy: v.entered_by, enteredAt: requiredInstantFromDb(v.entered_at),
      comment: v.comment, amendmentReason: v.amendment_reason,
    })),
    releasedVersion: row.released_version,
    returnReason: row.return_reason,
    verifiedBy: row.verified_by,
    verifiedAt: instantFromDb(row.verified_at),
    releasedBy: row.released_by,
    releasedAt: instantFromDb(row.released_at),
    notifications: notifications.map((n): CriticalNotification => ({
      version: n.version, notifiedName: n.notified_name, notifiedRole: n.notified_role, method: n.method as NotificationMethod, readBackConfirmed: n.read_back, at: requiredInstantFromDb(n.at), by: n.by,
    })),
  };
}

interface EventRow {
  specimen_id: string;
  seq: number;
  kind: string;
  at: Date | string;
  actor_id: string | null;
  note: string | null;
}

const COLUMNS = 'id, requisition_number, patient_id, priority, source, status, clinical_notes, ordered_by, ordered_at, cancelled_by, cancelled_at, cancellation_reason, version';
const SPECIMEN_COLUMNS = 'id, barcode, specimen_type, container, status, collected_by, collected_at, received_by, received_at, rejection_reason, rejection_note, rejected_by, rejected_at, recollection_of';

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

function toRequisition(row: RequisitionRow, tests: TestRow[], specimens: SpecimenRow[], events: EventRow[], results: ResultRow[], versions: VersionRow[], notifications: NotificationRow[]): Requisition {
  const what = `Demande ${row.id}`;
  return Requisition.restore({
    id: need(RequisitionId.create(row.id), what),
    number: need(RequisitionNumber.create(row.requisition_number), what),
    patientId: need(PatientRef.create(row.patient_id), what),
    priority: need(parsePriority(row.priority), what),
    source: need(parseSource(row.source), what),
    clinicalNotes: row.clinical_notes,
    orderedBy: row.ordered_by,
    orderedAt: requiredInstantFromDb(row.ordered_at),
    tests: tests.map((t): OrderedTest => ({
      testId: need(TestId.create(t.test_id), what), code: need(TestCode.create(t.test_code), what), name: need(TestName.create(t.test_name), what),
      section: need(parseSection(t.section), what) as Section, specimenId: need(SpecimenId.create(t.specimen_id), what),
      result: toResult(results.find((r) => r.test_id === t.test_id), versions.filter((v) => v.test_id === t.test_id), notifications.filter((n) => n.test_id === t.test_id)),
    })),
    specimens: specimens.map((s): Specimen => ({
      id: need(SpecimenId.create(s.id), what), barcode: need(SpecimenBarcode.create(s.barcode), what), specimenType: need(parseSpecimenType(s.specimen_type), what) as SpecimenType,
      container: need(parseContainer(s.container), what) as Container, status: s.status as SpecimenStatus, collectedBy: s.collected_by, collectedAt: instantFromDb(s.collected_at),
      receivedBy: s.received_by, receivedAt: instantFromDb(s.received_at), rejectionReason: s.rejection_reason === null ? null : need(parseRejectionReason(s.rejection_reason), what),
      rejectionNote: s.rejection_note, rejectedBy: s.rejected_by, rejectedAt: instantFromDb(s.rejected_at),
      recollectionOf: s.recollection_of === null ? null : need(SpecimenId.create(s.recollection_of), what),
      events: events.filter((e) => e.specimen_id === s.id).sort((a, b) => a.seq - b.seq).map((e): SpecimenEvent => ({ kind: e.kind as SpecimenEventKind, at: requiredInstantFromDb(e.at), actorId: e.actor_id, note: e.note })),
    })),
    cancelledBy: row.cancelled_by,
    cancelledAt: instantFromDb(row.cancelled_at),
    cancellationReason: row.cancellation_reason === null ? null : need(Reason.create(row.cancellation_reason), what),
    version: row.version,
  });
}

async function load(db: SqlExecutor, id: string, lock = false): Promise<Requisition | null> {
  const rows = await db.query<RequisitionRow>(`SELECT ${COLUMNS} FROM lab_requisitions WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!rows[0]) return null;
  const tests = await db.query<TestRow>('SELECT test_id, test_code, test_name, section, specimen_id FROM lab_requisition_tests WHERE requisition_id = $1 ORDER BY position', [id]);
  const specimens = await db.query<SpecimenRow>(`SELECT ${SPECIMEN_COLUMNS} FROM lab_specimens WHERE requisition_id = $1 ORDER BY created_at, barcode`, [id]);
  const events = await db.query<EventRow>('SELECT specimen_id, seq, kind, at, actor_id, note FROM lab_specimen_events WHERE specimen_id = ANY($1::uuid[]) ORDER BY specimen_id, seq', [specimens.map((s) => s.id)]);
  const results = await db.query<ResultRow>('SELECT test_id, status, released_version, return_reason, verified_by, verified_at, released_by, released_at FROM lab_results WHERE requisition_id = $1', [id]);
  const versions = await db.query<VersionRow>(
    `SELECT test_id, version, value, value_number, flag, ref_low, ref_high, critical_low, critical_high, unit, previous_value, delta_alert, entered_by, entered_at, comment, amendment_reason
       FROM lab_result_versions WHERE requisition_id = $1 ORDER BY test_id, version`,
    [id],
  );
  const notifications = await db.query<NotificationRow>('SELECT test_id, version, notified_name, notified_role, method, read_back, at, by FROM lab_critical_notifications WHERE requisition_id = $1 ORDER BY test_id, seq', [id]);
  return toRequisition(rows[0], tests, specimens, events, results, versions, notifications);
}

/** Écrit les échantillons (nouveaux ou modifiés), leurs nouvelles étapes de traçabilité, et le rattachement des analyses. */
async function writeChildren(db: SqlExecutor, requisition: Requisition): Promise<void> {
  const s = requisition.state;
  for (const sp of s.specimens) {
    await db.query(
      `INSERT INTO lab_specimens (id, barcode, requisition_id, specimen_type, container, status, collected_by, collected_at, received_by, received_at, rejection_reason, rejection_note, rejected_by, rejected_at, recollection_of)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10::timestamptz, $11, $12, $13, $14::timestamptz, $15)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, collected_by = EXCLUDED.collected_by, collected_at = EXCLUDED.collected_at, received_by = EXCLUDED.received_by, received_at = EXCLUDED.received_at,
         rejection_reason = EXCLUDED.rejection_reason, rejection_note = EXCLUDED.rejection_note, rejected_by = EXCLUDED.rejected_by, rejected_at = EXCLUDED.rejected_at, updated_at = now()`,
      [
        sp.id.value, sp.barcode.value, s.id.value, sp.specimenType, sp.container, sp.status, sp.collectedBy, sp.collectedAt?.toString() ?? null, sp.receivedBy, sp.receivedAt?.toString() ?? null,
        sp.rejectionReason, sp.rejectionNote, sp.rejectedBy, sp.rejectedAt?.toString() ?? null, sp.recollectionOf?.value ?? null,
      ],
    );
    const stored = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM lab_specimen_events WHERE specimen_id = $1', [sp.id.value]))[0]?.n ?? 0;
    for (let i = stored; i < sp.events.length; i++) {
      const e = sp.events[i];
      await db.query('INSERT INTO lab_specimen_events (specimen_id, seq, kind, at, actor_id, note) VALUES ($1, $2, $3, $4::timestamptz, $5, $6)', [sp.id.value, i + 1, e.kind, e.at.toString(), e.actorId, e.note]);
    }
  }
  let position = 0;
  for (const t of s.tests) {
    await db.query(
      `INSERT INTO lab_requisition_tests (requisition_id, test_id, position, test_code, test_name, section, specimen_id) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (requisition_id, test_id) DO UPDATE SET specimen_id = EXCLUDED.specimen_id`,
      [s.id.value, t.testId.value, position++, t.code.value, t.name.value, t.section, t.specimenId.value],
    );
  }
  // Résultats : l'état est réécrit, les saisies et les appels aux cliniciens s'ajoutent (jamais réécrits).
  for (const t of s.tests) {
    const r = t.result;
    if (!r) continue;
    await db.query(
      `INSERT INTO lab_results (requisition_id, test_id, status, released_version, return_reason, verified_by, verified_at, released_by, released_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9::timestamptz)
       ON CONFLICT (requisition_id, test_id) DO UPDATE SET status = EXCLUDED.status, released_version = EXCLUDED.released_version, return_reason = EXCLUDED.return_reason,
         verified_by = EXCLUDED.verified_by, verified_at = EXCLUDED.verified_at, released_by = EXCLUDED.released_by, released_at = EXCLUDED.released_at, updated_at = now()`,
      [s.id.value, t.testId.value, r.status, r.releasedVersion, r.returnReason, r.verifiedBy, r.verifiedAt?.toString() ?? null, r.releasedBy, r.releasedAt?.toString() ?? null],
    );
    const stored = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM lab_result_versions WHERE requisition_id = $1 AND test_id = $2', [s.id.value, t.testId.value]))[0]?.n ?? 0;
    for (const v of r.versions.slice(stored)) {
      await db.query(
        `INSERT INTO lab_result_versions (requisition_id, test_id, version, value, value_number, flag, ref_low, ref_high, critical_low, critical_high, unit, previous_value, delta_alert, entered_by, entered_at, comment, amendment_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::timestamptz, $16, $17)`,
        [s.id.value, t.testId.value, v.version, v.value, v.valueNumber, v.flag, v.refLow, v.refHigh, v.criticalLow, v.criticalHigh, v.unit, v.previousValue, v.deltaAlert, v.enteredBy, v.enteredAt.toString(), v.comment, v.amendmentReason],
      );
    }
    const storedNotifications = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM lab_critical_notifications WHERE requisition_id = $1 AND test_id = $2', [s.id.value, t.testId.value]))[0]?.n ?? 0;
    for (const [i, n] of r.notifications.entries()) {
      if (i < storedNotifications) continue;
      await db.query(
        'INSERT INTO lab_critical_notifications (requisition_id, test_id, seq, version, notified_name, notified_role, method, read_back, at, by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10)',
        [s.id.value, t.testId.value, i + 1, n.version, n.notifiedName, n.notifiedRole, n.method, n.readBackConfirmed, n.at.toString(), n.by],
      );
    }
  }
}

export class PgRequisitionRepository implements RequisitionRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<RequisitionNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('lab_requisition_number_seq')::text AS n");
    return need(RequisitionNumber.fromSequence(Number(rows[0].n)), 'Numéro de demande');
  }

  async nextBarcodes(count: number): Promise<SpecimenBarcode[]> {
    const out: SpecimenBarcode[] = [];
    for (let i = 0; i < count; i++) {
      const rows = await this.sql.query<{ n: string }>("SELECT nextval('lab_specimen_barcode_seq')::text AS n");
      out.push(need(SpecimenBarcode.fromSequence(Number(rows[0].n)), 'Code-barres'));
    }
    return out;
  }

  findById(id: RequisitionId): Promise<Requisition | null> {
    return load(this.sql, id.value);
  }

  async findBySpecimen(id: SpecimenId): Promise<Requisition | null> {
    const rows = await this.sql.query<{ requisition_id: string }>('SELECT requisition_id FROM lab_specimens WHERE id = $1', [id.value]);
    return rows[0] ? load(this.sql, rows[0].requisition_id) : null;
  }

  async findByBarcode(barcode: SpecimenBarcode): Promise<Requisition | null> {
    const rows = await this.sql.query<{ requisition_id: string }>('SELECT requisition_id FROM lab_specimens WHERE barcode = $1', [barcode.value]);
    return rows[0] ? load(this.sql, rows[0].requisition_id) : null;
  }

  async previousReleased(patientId: PatientRef, testId: TestId, except: RequisitionId): Promise<PreviousResult | null> {
    const rows = await this.sql.query<{ value_number: string | number; released_at: Date | string; requisition_number: string }>(
      `SELECT v.value_number, r.released_at, q.requisition_number
         FROM lab_results r
         JOIN lab_requisitions q ON q.id = r.requisition_id
         JOIN lab_result_versions v ON v.requisition_id = r.requisition_id AND v.test_id = r.test_id AND v.version = r.released_version
        WHERE q.patient_id = $1 AND r.test_id = $2 AND q.id <> $3 AND r.released_version IS NOT NULL AND v.value_number IS NOT NULL
        ORDER BY r.released_at DESC LIMIT 1`,
      [patientId.value, testId.value, except.value],
    );
    return rows[0] ? { value: Number(rows[0].value_number), releasedAt: requiredInstantFromDb(rows[0].released_at), requisitionNumber: rows[0].requisition_number } : null;
  }

  async insert(requisition: Requisition): Promise<void> {
    const s = requisition.state;
    await this.sql.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO lab_requisitions (id, requisition_number, patient_id, priority, source, status, clinical_notes, ordered_by, ordered_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)`,
        [s.id.value, s.number.value, s.patientId.value, s.priority, s.source, requisition.status, s.clinicalNotes, s.orderedBy, s.orderedAt.toString()],
      );
      await writeChildren(tx, requisition);
    });
  }

  async mutate(id: RequisitionId, mutate: (requisition: Requisition) => Result<void>): Promise<Result<Requisition> | null> {
    return this.sql.transaction(async (tx) => {
      // Le verrou fait attendre toute autre action sur la même demande : ce qui est lu ici est à jour.
      const requisition = await load(tx, id.value, true);
      if (!requisition) return null;
      const done = mutate(requisition);
      if (!done.ok) return err(done.error);
      const s = requisition.state;
      await tx.query(
        `UPDATE lab_requisitions SET status = $2, cancelled_by = $3, cancelled_at = $4::timestamptz, cancellation_reason = $5, version = version + 1, updated_at = now() WHERE id = $1`,
        [s.id.value, requisition.status, s.cancelledBy, s.cancelledAt?.toString() ?? null, s.cancellationReason?.value ?? null],
      );
      await writeChildren(tx, requisition);
      return ok((await load(tx, id.value))!);
    });
  }

  async list(filter: RequisitionFilter, offset: number, limit: number): Promise<{ items: RequisitionSummary[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.status) where.push(`r.status = ${arg(filter.status satisfies RequisitionStatus)}`);
    if (filter.priority) where.push(`r.priority = ${arg(filter.priority)}`);
    if (filter.source) where.push(`r.source = ${arg(filter.source)}`);
    if (filter.patientId) where.push(`r.patient_id = ${arg(filter.patientId.value)}`);
    if (filter.number) where.push(`r.requisition_number = ${arg(filter.number.value)}`);
    if (filter.orderedBy) where.push(`r.ordered_by = ${arg(filter.orderedBy)}`);
    if (filter.section) where.push(`EXISTS (SELECT 1 FROM lab_requisition_tests t WHERE t.requisition_id = r.id AND t.section = ${arg(filter.section)})`);
    if (filter.barcode) where.push(`EXISTS (SELECT 1 FROM lab_specimens sp WHERE sp.requisition_id = r.id AND sp.barcode = ${arg(filter.barcode.value)})`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const finished = "r.status IN ('RECEIVED', 'CANCELLED')";
    const rows = await this.sql.query<{
      id: string; requisition_number: string; patient_id: string; priority: string; source: string; status: string; ordered_at: Date | string; ordered_by: string; test_codes: string[]; sections: string[];
    }>(
      `SELECT r.id, r.requisition_number, r.patient_id, r.priority, r.source, r.status, r.ordered_at, r.ordered_by,
              COALESCE((SELECT array_agg(t.test_code ORDER BY t.position) FROM lab_requisition_tests t WHERE t.requisition_id = r.id), '{}') AS test_codes,
              COALESCE((SELECT array_agg(DISTINCT t.section) FROM lab_requisition_tests t WHERE t.requisition_id = r.id), '{}') AS sections
         FROM lab_requisitions r ${condition}
        ORDER BY CASE WHEN ${finished} THEN 1 ELSE 0 END,
                 CASE WHEN ${finished} THEN 0 ELSE CASE r.priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END END,
                 CASE WHEN ${finished} THEN NULL ELSE r.ordered_at END ASC, r.ordered_at DESC, r.id
        OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM lab_requisitions r ${condition}`, args.slice(0, args.length - 2));
    return {
      items: rows.map((r): RequisitionSummary => ({
        id: r.id, number: r.requisition_number, patientId: r.patient_id, priority: need(parsePriority(r.priority), `Demande ${r.id}`), source: need(parseSource(r.source), `Demande ${r.id}`),
        status: r.status as RequisitionStatus, orderedAt: requiredInstantFromDb(r.ordered_at), orderedBy: r.ordered_by, testCodes: r.test_codes, sections: r.sections as Section[],
      })),
      total: total[0]?.n ?? 0,
    };
  }
}

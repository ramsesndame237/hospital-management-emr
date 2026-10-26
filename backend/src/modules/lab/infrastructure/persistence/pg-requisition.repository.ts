import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { OrderedTest, Requisition, RequisitionStatus, Specimen, SpecimenEvent, SpecimenEventKind, SpecimenStatus } from '../../domain/requisition';
import { RequisitionFilter, RequisitionRepository, RequisitionSummary } from '../../domain/ports';
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

function toRequisition(row: RequisitionRow, tests: TestRow[], specimens: SpecimenRow[], events: EventRow[]): Requisition {
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
  return toRequisition(rows[0], tests, specimens, events);
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

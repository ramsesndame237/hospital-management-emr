import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { CriticalCommunication, ImagingOrder, OrderStatus, ReportDraft, ReportVersion } from '../../domain/order';
import { OrderFilter, OrderRepository, OrderSummary } from '../../domain/ports';
import { ExamCode, ExamName, ExamTypeId, parseMethod, parseModality, parsePriority, parseSource, OrderId, OrderNumber, PatientRef, Reason } from '../../domain/values';

interface OrderRow {
  id: string;
  order_number: string;
  patient_id: string;
  exam_type_id: string;
  exam_code: string;
  exam_name: string;
  modality: string;
  priority: string;
  source: string;
  clinical_question: string;
  encounter_id: string | null;
  ordered_by: string;
  ordered_at: Date | string;
  scheduled_for: Date | string | null;
  scheduled_by: string | null;
  performed_at: Date | string | null;
  performed_by: string | null;
  technique_note: string | null;
  screening_pregnant: boolean | null;
  screening_allergy: boolean | null;
  override_reason: string | null;
  draft_technique: string | null;
  draft_findings: string | null;
  draft_impression: string | null;
  draft_critical: boolean | null;
  draft_by: string | null;
  draft_at: Date | string | null;
  cancelled_by: string | null;
  cancelled_at: Date | string | null;
  cancellation_reason: string | null;
  version: number;
}

interface VersionRow {
  version: number;
  technique: string | null;
  findings: string;
  impression: string;
  critical: boolean;
  reason: string | null;
  signed_by: string;
  signed_at: Date | string;
}

interface CommunicationRow {
  version: number;
  notified_name: string;
  notified_role: string;
  method: string;
  at: Date | string;
  by: string;
}

const COLUMNS = `id, order_number, patient_id, exam_type_id, exam_code, exam_name, modality, priority, source, clinical_question, encounter_id, ordered_by, ordered_at, scheduled_for, scheduled_by,
  performed_at, performed_by, technique_note, screening_pregnant, screening_allergy, override_reason, draft_technique, draft_findings, draft_impression, draft_critical, draft_by, draft_at,
  cancelled_by, cancelled_at, cancellation_reason, version`;

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

function toOrder(row: OrderRow, versions: VersionRow[], communications: CommunicationRow[]): ImagingOrder {
  const what = `Demande ${row.id}`;
  const draft: ReportDraft | null = row.draft_by === null
    ? null
    : { technique: row.draft_technique, findings: row.draft_findings, impression: row.draft_impression, critical: row.draft_critical ?? false, by: row.draft_by, at: requiredInstantFromDb(row.draft_at as Date | string) };
  return ImagingOrder.restore({
    id: need(OrderId.create(row.id), what),
    number: need(OrderNumber.create(row.order_number), what),
    patientId: need(PatientRef.create(row.patient_id), what),
    examTypeId: need(ExamTypeId.create(row.exam_type_id), what),
    examCode: need(ExamCode.create(row.exam_code), what),
    examName: need(ExamName.create(row.exam_name), what),
    modality: need(parseModality(row.modality), what),
    priority: need(parsePriority(row.priority), what),
    source: need(parseSource(row.source), what),
    clinicalQuestion: row.clinical_question,
    encounterId: row.encounter_id,
    orderedBy: row.ordered_by,
    orderedAt: requiredInstantFromDb(row.ordered_at),
    scheduledFor: instantFromDb(row.scheduled_for),
    scheduledBy: row.scheduled_by,
    performedAt: instantFromDb(row.performed_at),
    performedBy: row.performed_by,
    techniqueNote: row.technique_note,
    screening: row.screening_pregnant === null || row.screening_allergy === null ? null : { pregnant: row.screening_pregnant, contrastAllergy: row.screening_allergy, overrideReason: row.override_reason },
    draft,
    versions: versions.map((v): ReportVersion => ({ version: v.version, technique: v.technique, findings: v.findings, impression: v.impression, critical: v.critical, reason: v.reason, signedBy: v.signed_by, signedAt: requiredInstantFromDb(v.signed_at) })),
    communications: communications.map((c): CriticalCommunication => ({
      version: c.version, notifiedName: c.notified_name, notifiedRole: c.notified_role, method: need(parseMethod(c.method), what), readBackConfirmed: true, at: requiredInstantFromDb(c.at), by: c.by,
    })),
    cancelledBy: row.cancelled_by,
    cancelledAt: instantFromDb(row.cancelled_at),
    cancellationReason: row.cancellation_reason === null ? null : need(Reason.create(row.cancellation_reason), what),
    version: row.version,
  });
}

async function load(db: SqlExecutor, id: string, lock = false): Promise<ImagingOrder | null> {
  const rows = await db.query<OrderRow>(`SELECT ${COLUMNS} FROM imaging_orders WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!rows[0]) return null;
  const versions = await db.query<VersionRow>('SELECT version, technique, findings, impression, critical, reason, signed_by, signed_at FROM imaging_report_versions WHERE order_id = $1 ORDER BY version', [id]);
  const communications = await db.query<CommunicationRow>('SELECT version, notified_name, notified_role, method, at, by FROM imaging_critical_communications WHERE order_id = $1 ORDER BY seq', [id]);
  return toOrder(rows[0], versions, communications);
}

/** Versions signées et appels documentés : ajout seul, on n'écrit que ce qui n'est pas encore en base. */
async function writeAppendOnly(db: SqlExecutor, order: ImagingOrder): Promise<void> {
  const s = order.state;
  const storedVersions = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM imaging_report_versions WHERE order_id = $1', [s.id.value]))[0]?.n ?? 0;
  for (const v of s.versions.slice(storedVersions)) {
    await db.query(
      'INSERT INTO imaging_report_versions (order_id, version, technique, findings, impression, critical, reason, signed_by, signed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)',
      [s.id.value, v.version, v.technique, v.findings, v.impression, v.critical, v.reason, v.signedBy, v.signedAt.toString()],
    );
  }
  const storedCommunications = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM imaging_critical_communications WHERE order_id = $1', [s.id.value]))[0]?.n ?? 0;
  for (const [i, c] of s.communications.entries()) {
    if (i < storedCommunications) continue;
    await db.query(
      'INSERT INTO imaging_critical_communications (order_id, seq, version, notified_name, notified_role, method, read_back, at, by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9)',
      [s.id.value, i + 1, c.version, c.notifiedName, c.notifiedRole, c.method, c.readBackConfirmed, c.at.toString(), c.by],
    );
  }
}

export class PgOrderRepository implements OrderRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<OrderNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('imaging_order_number_seq')::text AS n");
    return need(OrderNumber.fromSequence(Number(rows[0].n)), 'Numéro de demande');
  }

  findById(id: OrderId): Promise<ImagingOrder | null> {
    return load(this.sql, id.value);
  }

  async insert(order: ImagingOrder): Promise<void> {
    const s = order.state;
    await this.sql.query(
      `INSERT INTO imaging_orders (id, order_number, patient_id, exam_type_id, exam_code, exam_name, modality, priority, source, status, clinical_question, encounter_id, ordered_by, ordered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::timestamptz)`,
      [s.id.value, s.number.value, s.patientId.value, s.examTypeId.value, s.examCode.value, s.examName.value, s.modality, s.priority, s.source, order.status, s.clinicalQuestion, s.encounterId, s.orderedBy, s.orderedAt.toString()],
    );
  }

  async mutate(id: OrderId, mutate: (order: ImagingOrder) => Result<void>): Promise<Result<ImagingOrder> | null> {
    return this.sql.transaction(async (tx) => {
      // Le verrou fait attendre toute autre action sur la même demande : ce qui est lu ici est à jour.
      const order = await load(tx, id.value, true);
      if (!order) return null;
      const done = mutate(order);
      if (!done.ok) return err(done.error);
      const s = order.state;
      await tx.query(
        `UPDATE imaging_orders SET status = $2, scheduled_for = $3::timestamptz, scheduled_by = $4, performed_at = $5::timestamptz, performed_by = $6, technique_note = $7,
                screening_pregnant = $8, screening_allergy = $9, override_reason = $10, draft_technique = $11, draft_findings = $12, draft_impression = $13, draft_critical = $14,
                draft_by = $15, draft_at = $16::timestamptz, cancelled_by = $17, cancelled_at = $18::timestamptz, cancellation_reason = $19, version = version + 1, updated_at = now()
          WHERE id = $1`,
        [
          s.id.value, order.status, s.scheduledFor?.toString() ?? null, s.scheduledBy, s.performedAt?.toString() ?? null, s.performedBy, s.techniqueNote, s.screening?.pregnant ?? null,
          s.screening?.contrastAllergy ?? null, s.screening?.overrideReason ?? null, s.draft?.technique ?? null, s.draft?.findings ?? null, s.draft?.impression ?? null, s.draft?.critical ?? null,
          s.draft?.by ?? null, s.draft?.at.toString() ?? null, s.cancelledBy, s.cancelledAt?.toString() ?? null, s.cancellationReason?.value ?? null,
        ],
      );
      await writeAppendOnly(tx, order);
      return ok((await load(tx, id.value))!);
    });
  }

  async list(filter: OrderFilter, offset: number, limit: number): Promise<{ items: OrderSummary[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.status) where.push(`o.status = ${arg(filter.status satisfies OrderStatus)}`);
    if (filter.priority) where.push(`o.priority = ${arg(filter.priority)}`);
    if (filter.source) where.push(`o.source = ${arg(filter.source)}`);
    if (filter.modality) where.push(`o.modality = ${arg(filter.modality)}`);
    if (filter.patientId) where.push(`o.patient_id = ${arg(filter.patientId.value)}`);
    if (filter.number) where.push(`o.order_number = ${arg(filter.number.value)}`);
    if (filter.orderedBy) where.push(`o.ordered_by = ${arg(filter.orderedBy)}`);
    if (filter.encounterId) where.push(`o.encounter_id = ${arg(filter.encounterId)}`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const finished = "o.status IN ('REPORTED', 'CANCELLED')";
    const rows = await this.sql.query<{
      id: string; order_number: string; patient_id: string; exam_code: string; exam_name: string; modality: string; priority: string; source: string; status: string; ordered_at: Date | string;
      ordered_by: string; scheduled_for: Date | string | null; critical: boolean;
    }>(
      `SELECT o.id, o.order_number, o.patient_id, o.exam_code, o.exam_name, o.modality, o.priority, o.source, o.status, o.ordered_at, o.ordered_by, o.scheduled_for,
              COALESCE((SELECT v.critical FROM imaging_report_versions v WHERE v.order_id = o.id ORDER BY v.version DESC LIMIT 1), false) AS critical
         FROM imaging_orders o ${condition}
        ORDER BY CASE WHEN ${finished} THEN 1 ELSE 0 END,
                 CASE WHEN ${finished} THEN 0 ELSE CASE o.priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END END,
                 CASE WHEN ${finished} THEN NULL ELSE o.ordered_at END ASC, o.ordered_at DESC, o.id
        OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM imaging_orders o ${condition}`, args.slice(0, args.length - 2));
    return {
      items: rows.map((r): OrderSummary => ({
        id: r.id, number: r.order_number, patientId: r.patient_id, examCode: r.exam_code, examName: r.exam_name, modality: need(parseModality(r.modality), `Demande ${r.id}`),
        priority: need(parsePriority(r.priority), `Demande ${r.id}`), source: need(parseSource(r.source), `Demande ${r.id}`), status: r.status as OrderStatus,
        orderedAt: requiredInstantFromDb(r.ordered_at), orderedBy: r.ordered_by, scheduledFor: instantFromDb(r.scheduled_for), critical: r.critical,
      })),
      total: total[0]?.n ?? 0,
    };
  }
}

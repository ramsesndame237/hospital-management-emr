import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { ApprovalId, ApprovalRequest, ApprovalState, parseApprovalKind, parseApprovalStatus } from '../../domain/approval';
import { Invoice } from '../../domain/invoice';
import { ApprovalFilter, ApprovalRecord, ApprovalRepository, CreateApprovalOutcome } from '../../domain/ports';
import { Amount, InvoiceId, parseInvoiceStatus, Reason } from '../../domain/values';
import { PgInvoiceRepository } from './pg-invoice.repository';

interface ApprovalRow {
  id: string;
  invoice_id: string;
  kind: string;
  status: string;
  amount: string | number | null;
  reason: string;
  invoice_version: number;
  requested_by: string;
  requested_at: Date | string;
  decided_by: string | null;
  decided_at: Date | string | null;
  decision_comment: string | null;
}

interface JoinedRow extends ApprovalRow {
  invoice_number: string;
  patient_id: string;
  invoice_status: string;
  invoice_currency: string;
  discount_amount: string | number;
  current_version: number;
  subtotal: string | number;
}

const COLUMNS = 'a.id, a.invoice_id, a.kind, a.status, a.amount, a.reason, a.invoice_version, a.requested_by, a.requested_at, a.decided_by, a.decided_at, a.decision_comment';
const JOINED = `SELECT ${COLUMNS}, i.invoice_number, i.patient_id, i.status AS invoice_status, i.currency AS invoice_currency, i.discount_amount, i.version AS current_version,
       COALESCE((SELECT sum(l.unit_price * l.quantity) FROM billing_invoice_lines l WHERE l.invoice_id = i.id), 0) AS subtotal
  FROM billing_approvals a JOIN billing_invoices i ON i.id = a.invoice_id`;

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

function toRequest(row: ApprovalRow): ApprovalRequest {
  const what = `Demande ${row.id}`;
  const state: ApprovalState = {
    id: need(ApprovalId.create(row.id), what),
    invoiceId: need(InvoiceId.create(row.invoice_id), what),
    kind: need(parseApprovalKind(row.kind), what),
    status: need(parseApprovalStatus(row.status), what),
    amount: row.amount === null ? null : Amount.restore(Number(row.amount)),
    reason: need(Reason.create(row.reason), what),
    invoiceVersion: row.invoice_version,
    requestedBy: row.requested_by,
    requestedAt: requiredInstantFromDb(row.requested_at),
    decidedBy: row.decided_by,
    decidedAt: instantFromDb(row.decided_at),
    decisionComment: row.decision_comment,
  };
  return ApprovalRequest.restore(state);
}

function toRecord(row: JoinedRow): ApprovalRecord {
  return {
    request: toRequest(row),
    invoice: {
      id: row.invoice_id, number: row.invoice_number, patientId: row.patient_id, status: need(parseInvoiceStatus(row.invoice_status), `Facture ${row.invoice_id}`), currency: row.invoice_currency,
      subtotal: Number(row.subtotal), discount: Number(row.discount_amount), version: row.current_version,
    },
  };
}

async function write(db: SqlExecutor, request: ApprovalRequest): Promise<void> {
  const s = request.state;
  await db.query(
    'UPDATE billing_approvals SET status = $2, decided_by = $3, decided_at = $4::timestamptz, decision_comment = $5, updated_at = now() WHERE id = $1',
    [s.id.value, s.status, s.decidedBy, s.decidedAt?.toString() ?? null, s.decisionComment],
  );
}

async function read(db: SqlExecutor, id: string): Promise<ApprovalRecord> {
  const rows = await db.query<JoinedRow>(`${JOINED} WHERE a.id = $1`, [id]);
  return toRecord(rows[0]);
}

export class PgApprovalRepository implements ApprovalRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: ApprovalId): Promise<ApprovalRecord | null> {
    const rows = await this.sql.query<JoinedRow>(`${JOINED} WHERE a.id = $1`, [id.value]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async hasPending(invoiceId: InvoiceId): Promise<boolean> {
    const rows = await this.sql.query("SELECT 1 FROM billing_approvals WHERE invoice_id = $1 AND status = 'PENDING'", [invoiceId.value]);
    return rows.length > 0;
  }

  async create(request: ApprovalRequest): Promise<CreateApprovalOutcome> {
    const s = request.state;
    return this.sql.transaction(async (tx) => {
      // Même ordre de verrous partout (facture, puis demande) : deux demandes simultanées sur la même facture se mettent en file.
      const invoice = await tx.query<{ version: number }>('SELECT version FROM billing_invoices WHERE id = $1 FOR UPDATE', [s.invoiceId.value]);
      if (!invoice[0] || invoice[0].version !== s.invoiceVersion) return 'INVOICE_CHANGED';
      if ((await tx.query("SELECT 1 FROM billing_approvals WHERE invoice_id = $1 AND status = 'PENDING'", [s.invoiceId.value])).length > 0) return 'ALREADY_PENDING';
      await tx.query(
        `INSERT INTO billing_approvals (id, invoice_id, kind, status, amount, reason, invoice_version, requested_by, requested_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)`,
        [s.id.value, s.invoiceId.value, s.kind, s.status, s.amount?.value ?? null, s.reason.value, s.invoiceVersion, s.requestedBy, s.requestedAt.toString()],
      );
      return 'CREATED';
    });
  }

  async decide(id: ApprovalId, apply: (request: ApprovalRequest, invoice: Invoice) => Result<boolean>): Promise<Result<ApprovalRecord> | null> {
    return this.sql.transaction(async (tx) => {
      const known = await tx.query<{ invoice_id: string }>('SELECT invoice_id FROM billing_approvals WHERE id = $1', [id.value]);
      if (!known[0]) return null;
      const invoices = new PgInvoiceRepository(tx);
      const invoice = await invoices.findByIdForUpdate(need(InvoiceId.create(known[0].invoice_id), `Demande ${id.value}`));
      const rows = await tx.query<ApprovalRow>(`SELECT ${COLUMNS} FROM billing_approvals a WHERE a.id = $1 FOR UPDATE`, [id.value]);
      if (!invoice || !rows[0]) return null;
      const request = toRequest(rows[0]);
      const done = apply(request, invoice);
      if (!done.ok) return err(done.error);
      // La facture est verrouillée et relue dans cette transaction : sa version est celle que la décision vient de contrôler.
      if (done.value && (await invoices.save(invoice)) !== 'SAVED') throw new Error('Facture modifiée sous verrou');
      await write(tx, request);
      return ok(await read(tx, id.value));
    });
  }

  async mutate(id: ApprovalId, apply: (request: ApprovalRequest) => Result<void>): Promise<Result<ApprovalRecord> | null> {
    return this.sql.transaction(async (tx) => {
      const rows = await tx.query<ApprovalRow>(`SELECT ${COLUMNS} FROM billing_approvals a WHERE a.id = $1 FOR UPDATE`, [id.value]);
      if (!rows[0]) return null;
      const request = toRequest(rows[0]);
      const done = apply(request);
      if (!done.ok) return err(done.error);
      await write(tx, request);
      return ok(await read(tx, id.value));
    });
  }

  async list(filter: ApprovalFilter, offset: number, limit: number): Promise<{ items: ApprovalRecord[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.requestedBy) where.push(`a.requested_by = ${arg(filter.requestedBy)}`);
    if (filter.status) where.push(`a.status = ${arg(filter.status)}`);
    if (filter.kind) where.push(`a.kind = ${arg(filter.kind)}`);
    if (filter.invoiceId) where.push(`a.invoice_id = ${arg(filter.invoiceId.value)}`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<JoinedRow>(
      `${JOINED} ${condition}
        ORDER BY CASE WHEN a.status = 'PENDING' THEN 0 ELSE 1 END, CASE WHEN a.status = 'PENDING' THEN a.requested_at END ASC, a.requested_at DESC, a.id
        OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM billing_approvals a ${condition}`, args.slice(0, args.length - 2));
    return { items: rows.map(toRecord), total: total[0]?.n ?? 0 };
  }
}

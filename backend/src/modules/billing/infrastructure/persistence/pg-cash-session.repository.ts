import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { err, ok, Result } from '../../../../shared-kernel/result';
import { CashSession, CounterName, Denominations, emptyTakings, parseSessionStatus, SessionId, SessionNumber, SessionState, Takings } from '../../domain/cash-session';
import { CashSessionRepository, OpenOutcome, SessionFilter, SessionPayment, SessionRecord } from '../../domain/ports';
import { Amount, Currency, parsePaymentMode } from '../../domain/values';

interface SessionRow {
  id: string;
  session_number: string;
  cashier_id: string;
  counter: string;
  currency: string;
  status: string;
  opened_at: Date | string;
  opening_count: Record<string, number>;
  opening_float: string | number;
  closed_at: Date | string | null;
  closing_count: Record<string, number> | null;
  counted_cash: string | number | null;
  expected_cash: string | number | null;
  variance: string | number | null;
  variance_reason: string | null;
  requires_cosign: boolean;
  cosigned_by: string | null;
  cosigned_at: Date | string | null;
  cosign_comment: string | null;
}

const COLUMNS = `id, session_number, cashier_id, counter, currency, status, opened_at, opening_count, opening_float, closed_at, closing_count, counted_cash, expected_cash,
  variance, variance_reason, requires_cosign, cosigned_by, cosigned_at, cosign_comment`;

function need<T>(r: { ok: true; value: T } | { ok: false }, id: string): T {
  if (!r.ok) throw new Error(`Session de caisse ${id} corrompue en base`);
  return r.value;
}

const optionalAmount = (v: string | number | null): Amount | null => (v === null ? null : Amount.restore(Number(v)));

function toSession(row: SessionRow): CashSession {
  const state: SessionState = {
    id: need(SessionId.create(row.id), row.id),
    number: need(SessionNumber.create(row.session_number), row.id),
    cashierId: row.cashier_id,
    counter: need(CounterName.create(row.counter), row.id),
    currency: need(Currency.create(row.currency), row.id),
    status: need(parseSessionStatus(row.status), row.id),
    openedAt: requiredInstantFromDb(row.opened_at),
    openingCount: Denominations.restore(row.opening_count ?? {}),
    openingFloat: Amount.restore(Number(row.opening_float)),
    closedAt: instantFromDb(row.closed_at),
    closingCount: row.closing_count === null ? null : Denominations.restore(row.closing_count),
    countedCash: optionalAmount(row.counted_cash),
    expectedCash: optionalAmount(row.expected_cash),
    variance: row.variance === null ? null : Number(row.variance),
    varianceReason: row.variance_reason,
    requiresCosign: row.requires_cosign,
    cosignedBy: row.cosigned_by,
    cosignedAt: instantFromDb(row.cosigned_at),
    cosignComment: row.cosign_comment,
  };
  return CashSession.restore(state);
}

interface TakingRow {
  session_id: string;
  mode: string;
  total: string | number;
  n: number;
}

/** Ce qui a été encaissé dans chaque session, par mode de paiement. */
async function takingsFor(db: SqlExecutor, ids: readonly string[]): Promise<Map<string, { takings: Takings; count: number }>> {
  const result = new Map<string, { takings: Record<string, Amount>; count: number }>();
  for (const id of ids) result.set(id, { takings: { ...emptyTakings() }, count: 0 });
  if (ids.length === 0) return result as never;
  const rows = await db.query<TakingRow>(
    'SELECT session_id, mode, sum(amount) AS total, count(*)::int AS n FROM billing_payments WHERE session_id = ANY($1::uuid[]) GROUP BY session_id, mode',
    [[...ids]],
  );
  for (const row of rows) {
    const entry = result.get(row.session_id)!;
    const mode = parsePaymentMode(row.mode);
    if (!mode.ok) throw new Error(`Mode de paiement corrompu en base : ${row.mode}`);
    entry.takings[mode.value] = Amount.restore(Number(row.total));
    entry.count += row.n;
  }
  return result as never;
}

async function records(db: SqlExecutor, rows: SessionRow[]): Promise<SessionRecord[]> {
  const takings = await takingsFor(db, rows.map((r) => r.id));
  return rows.map((row) => {
    const t = takings.get(row.id)!;
    return { session: toSession(row), takings: t.takings, paymentCount: t.count };
  });
}

export class PgCashSessionRepository implements CashSessionRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextSessionNumber(): Promise<SessionNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('billing_session_number_seq')::text AS n");
    const number = SessionNumber.fromSequence(Number(rows[0].n));
    if (!number.ok) throw new Error(number.error.message);
    return number.value;
  }

  async findById(id: SessionId): Promise<SessionRecord | null> {
    const rows = await this.sql.query<SessionRow>(`SELECT ${COLUMNS} FROM billing_cash_sessions WHERE id = $1`, [id.value]);
    return rows[0] ? (await records(this.sql, rows))[0] : null;
  }

  async findOpenByCashier(cashierId: string): Promise<SessionRecord | null> {
    const rows = await this.sql.query<SessionRow>(`SELECT ${COLUMNS} FROM billing_cash_sessions WHERE cashier_id = $1 AND status = 'OPEN'`, [cashierId]);
    return rows[0] ? (await records(this.sql, rows))[0] : null;
  }

  async open(session: CashSession): Promise<OpenOutcome> {
    const s = session.state;
    return this.sql.transaction(async (tx) => {
      // Deux ouvertures simultanées (même caissier, ou même poste) se mettent en file : la seconde voit la première.
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0)), pg_advisory_xact_lock(hashtextextended($2, 0))', [`session-cashier:${s.cashierId}`, `session-counter:${s.counter.value.toLowerCase()}`]);
      const busy = await tx.query<{ by_cashier: boolean; by_counter: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM billing_cash_sessions WHERE cashier_id = $1 AND status = 'OPEN') AS by_cashier,
                EXISTS (SELECT 1 FROM billing_cash_sessions WHERE lower(counter) = lower($2) AND status = 'OPEN') AS by_counter`,
        [s.cashierId, s.counter.value],
      );
      if (busy[0]?.by_cashier) return 'CASHIER_BUSY';
      if (busy[0]?.by_counter) return 'COUNTER_BUSY';
      await tx.query(
        `INSERT INTO billing_cash_sessions (id, session_number, cashier_id, counter, currency, status, opened_at, opening_count, opening_float)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::jsonb, $9)`,
        [s.id.value, s.number.value, s.cashierId, s.counter.value, s.currency.value, s.status, s.openedAt.toString(), JSON.stringify(s.openingCount.counts), s.openingFloat.value],
      );
      return 'OPENED';
    });
  }

  async mutate(id: SessionId, mutate: (record: SessionRecord) => Result<void>): Promise<Result<SessionRecord> | null> {
    return this.sql.transaction(async (tx) => {
      // Le verrou exclusif sur la session fait attendre tout encaissement en cours (qui la verrouille en partage) : ce qui est relu ici est définitif.
      const rows = await tx.query<SessionRow>(`SELECT ${COLUMNS} FROM billing_cash_sessions WHERE id = $1 FOR UPDATE`, [id.value]);
      if (!rows[0]) return null;
      const [record] = await records(tx, rows);
      const done = mutate(record);
      if (!done.ok) return err(done.error);
      const s = record.session.state;
      await tx.query(
        `UPDATE billing_cash_sessions SET status = $2, closed_at = $3::timestamptz, closing_count = $4::jsonb, counted_cash = $5, expected_cash = $6, variance = $7, variance_reason = $8,
                requires_cosign = $9, cosigned_by = $10, cosigned_at = $11::timestamptz, cosign_comment = $12, updated_at = now() WHERE id = $1`,
        [
          s.id.value, s.status, s.closedAt?.toString() ?? null, s.closingCount === null ? null : JSON.stringify(s.closingCount.counts), s.countedCash?.value ?? null, s.expectedCash?.value ?? null,
          s.variance, s.varianceReason, s.requiresCosign, s.cosignedBy, s.cosignedAt?.toString() ?? null, s.cosignComment,
        ],
      );
      return ok(record);
    });
  }

  async list(filter: SessionFilter, offset: number, limit: number): Promise<{ items: SessionRecord[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.cashierId) where.push(`cashier_id = ${arg(filter.cashierId)}`);
    if (filter.status) where.push(`status = ${arg(filter.status)}`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<SessionRow>(`SELECT ${COLUMNS} FROM billing_cash_sessions ${condition} ORDER BY opened_at DESC, id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`, args);
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM billing_cash_sessions ${condition}`, args.slice(0, args.length - 2));
    return { items: await records(this.sql, rows), total: total[0]?.n ?? 0 };
  }

  async payments(sessionId: SessionId): Promise<SessionPayment[]> {
    const rows = await this.sql.query<{ id: string; receipt_number: string; invoice_number: string; mode: string; amount: string | number; received_at: Date | string }>(
      `SELECT p.id, p.receipt_number, i.invoice_number, p.mode, p.amount, p.received_at
         FROM billing_payments p JOIN billing_invoices i ON i.id = p.invoice_id WHERE p.session_id = $1 ORDER BY p.received_at, p.receipt_number`,
      [sessionId.value],
    );
    return rows.map((r) => ({ id: r.id, receiptNumber: r.receipt_number, invoiceNumber: r.invoice_number, mode: r.mode, amount: Number(r.amount), receivedAt: requiredInstantFromDb(r.received_at) }));
  }
}

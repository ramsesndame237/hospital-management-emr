import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { Invoice, InvoiceLine, InvoiceState, Payment, statusFor } from '../../domain/invoice';
import { InvoiceFilter, InvoiceRepository, InvoiceSummary, SaveOutcome } from '../../domain/ports';
import {
  Amount, Currency, InvoiceId, InvoiceNumber, InvoiceStatus, ItemCode, ItemId, ItemName, LineId, parseInvoiceStatus, parsePaymentMode, PatientRef, PaymentId, Quantity, Reason, ReceiptNumber,
} from '../../domain/values';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  patient_id: string;
  status: string;
  currency: string;
  discount_amount: string | number;
  discount_reason: string | null;
  note: string | null;
  cancellation_reason: string | null;
  issued_at: Date | string | null;
  version: number;
  created_by: string;
}

interface LineRow {
  id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  unit_price: string | number;
  quantity: number;
}

interface PaymentRow {
  id: string;
  invoice_id: string;
  receipt_number: string;
  mode: string;
  amount: string | number;
  reference: string | null;
  received_by: string;
  received_at: Date | string;
}

const COLUMNS = 'id, invoice_number, patient_id, status, currency, discount_amount, discount_reason, note, cancellation_reason, issued_at, version, created_by';

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: need(PaymentId.create(row.id), `Encaissement ${row.id}`),
    receiptNumber: need(ReceiptNumber.create(row.receipt_number), `Encaissement ${row.id}`),
    mode: need(parsePaymentMode(row.mode), `Encaissement ${row.id}`),
    amount: Amount.restore(Number(row.amount)),
    reference: row.reference,
    receivedBy: row.received_by,
    receivedAt: requiredInstantFromDb(row.received_at),
  };
}

function toInvoice(row: InvoiceRow, lines: LineRow[], payments: PaymentRow[]): Invoice {
  const what = `Facture ${row.id}`;
  const state: InvoiceState = {
    id: need(InvoiceId.create(row.id), what),
    number: need(InvoiceNumber.create(row.invoice_number), what),
    patientId: need(PatientRef.create(row.patient_id), what),
    currency: need(Currency.create(row.currency), what),
    status: need(parseInvoiceStatus(row.status), what),
    lines: lines.map((l): InvoiceLine => ({
      id: need(LineId.create(l.id), what), itemId: need(ItemId.create(l.item_id), what), itemCode: need(ItemCode.create(l.item_code), what),
      itemName: need(ItemName.create(l.item_name), what), unitPrice: Amount.restore(Number(l.unit_price)), quantity: Quantity.restore(l.quantity),
    })),
    discount: Amount.restore(Number(row.discount_amount)),
    discountReason: row.discount_reason === null ? null : need(Reason.create(row.discount_reason), what),
    note: row.note,
    cancellationReason: row.cancellation_reason === null ? null : need(Reason.create(row.cancellation_reason), what),
    payments: payments.map(toPayment),
    createdBy: row.created_by,
    issuedAt: instantFromDb(row.issued_at),
    version: row.version,
  };
  return Invoice.restore(state);
}

const LINES = 'id, item_id, item_code, item_name, unit_price, quantity';
const PAYMENTS = 'id, invoice_id, receipt_number, mode, amount, reference, received_by, received_at';

export class PgInvoiceRepository implements InvoiceRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextInvoiceNumber(): Promise<InvoiceNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('billing_invoice_number_seq')::text AS n");
    const number = InvoiceNumber.fromSequence(Number(rows[0].n));
    if (!number.ok) throw new Error(number.error.message);
    return number.value;
  }

  async nextReceiptNumber(): Promise<ReceiptNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('billing_receipt_number_seq')::text AS n");
    const number = ReceiptNumber.fromSequence(Number(rows[0].n));
    if (!number.ok) throw new Error(number.error.message);
    return number.value;
  }

  async findById(id: InvoiceId): Promise<Invoice | null> {
    return this.load(this.sql, id.value);
  }

  async findByPayment(paymentId: PaymentId): Promise<{ invoice: Invoice; payment: Payment } | null> {
    const rows = await this.sql.query<{ invoice_id: string }>('SELECT invoice_id FROM billing_payments WHERE id = $1', [paymentId.value]);
    if (!rows[0]) return null;
    const invoice = await this.load(this.sql, rows[0].invoice_id);
    const payment = invoice?.state.payments.find((p) => p.id.equals(paymentId));
    return invoice && payment ? { invoice, payment } : null;
  }

  private async load(db: SqlExecutor, id: string, lock = false): Promise<Invoice | null> {
    const rows = await db.query<InvoiceRow>(`SELECT ${COLUMNS} FROM billing_invoices WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
    if (!rows[0]) return null;
    const lines = await db.query<LineRow>(`SELECT ${LINES} FROM billing_invoice_lines WHERE invoice_id = $1 ORDER BY position`, [id]);
    const payments = await db.query<PaymentRow>(`SELECT ${PAYMENTS} FROM billing_payments WHERE invoice_id = $1 ORDER BY received_at, receipt_number`, [id]);
    return toInvoice(rows[0], lines, payments);
  }

  async insert(invoice: Invoice): Promise<void> {
    const s = invoice.state;
    await this.sql.query(
      `INSERT INTO billing_invoices (id, invoice_number, patient_id, status, currency, discount_amount, discount_reason, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [s.id.value, s.number.value, s.patientId.value, s.status, s.currency.value, s.discount.value, s.discountReason?.value ?? null, s.note, s.createdBy],
    );
    if (s.lines.length > 0) await this.writeLines(this.sql, invoice);
  }

  private async writeLines(db: SqlExecutor, invoice: Invoice): Promise<void> {
    await db.query('DELETE FROM billing_invoice_lines WHERE invoice_id = $1', [invoice.id.value]);
    let position = 1;
    for (const l of invoice.state.lines) {
      await db.query(
        'INSERT INTO billing_invoice_lines (id, invoice_id, position, item_id, item_code, item_name, unit_price, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [l.id.value, invoice.id.value, position++, l.itemId.value, l.itemCode.value, l.itemName.value, l.unitPrice.value, l.quantity.value],
      );
    }
  }

  async save(invoice: Invoice): Promise<SaveOutcome> {
    const s = invoice.state;
    return this.sql.transaction(async (tx) => {
      // Version comparée à celle lue : si quelqu'un est passé entre-temps, aucune ligne n'est touchée.
      const updated = await tx.query<{ id: string }>(
        `UPDATE billing_invoices SET status = $3, discount_amount = $4, discount_reason = $5, cancellation_reason = $6, issued_at = $7::timestamptz,
                note = $8, version = version + 1, updated_at = now()
          WHERE id = $1 AND version = $2 RETURNING id`,
        [s.id.value, s.version, s.status, s.discount.value, s.discountReason?.value ?? null, s.cancellationReason?.value ?? null, s.issuedAt?.toString() ?? null, s.note],
      );
      if (updated.length === 0) return 'CHANGED';
      await this.writeLines(tx, invoice);
      return 'SAVED';
    });
  }

  async addPayment(invoice: Invoice, payment: Payment): Promise<SaveOutcome> {
    return this.sql.transaction(async (tx) => {
      // Deux caisses qui encaissent la même facture se mettent en file : la seconde relit ce que la première a déjà perçu.
      const fresh = await this.load(tx, invoice.id.value, true);
      if (!fresh) return 'CHANGED';
      const status = fresh.status;
      if (status !== InvoiceStatus.ISSUED && status !== InvoiceStatus.PARTIALLY_PAID) return 'CHANGED';
      const alreadyPaid = fresh.paid;
      if (alreadyPaid.value + payment.amount.value > fresh.total.value) return 'OVERPAYMENT';
      await tx.query(
        'INSERT INTO billing_payments (id, invoice_id, receipt_number, mode, amount, reference, received_by, received_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)',
        [payment.id.value, invoice.id.value, payment.receiptNumber.value, payment.mode, payment.amount.value, payment.reference, payment.receivedBy, payment.receivedAt.toString()],
      );
      const next = statusFor(fresh.total, alreadyPaid.plus(payment.amount));
      await tx.query('UPDATE billing_invoices SET status = $2, version = version + 1, updated_at = now() WHERE id = $1', [invoice.id.value, next]);
      return 'SAVED';
    });
  }

  async list(filter: InvoiceFilter, offset: number, limit: number): Promise<{ items: InvoiceSummary[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.patientId) where.push(`i.patient_id = ${arg(filter.patientId.value)}`);
    if (filter.status) where.push(`i.status = ${arg(filter.status)}`);
    if (filter.number) where.push(`i.invoice_number = ${arg(filter.number.value)}`);
    if (filter.from) where.push(`i.created_at >= ${arg(filter.from)}::timestamptz`);
    if (filter.to) where.push(`i.created_at < ${arg(filter.to)}::timestamptz`);
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<{
      id: string; invoice_number: string; patient_id: string; status: string; currency: string; discount_amount: string | number; issued_at: Date | string | null; created_at: Date | string;
      subtotal: string | number; paid: string | number;
    }>(
      `SELECT i.id, i.invoice_number, i.patient_id, i.status, i.currency, i.discount_amount, i.issued_at, i.created_at,
              COALESCE((SELECT sum(l.unit_price * l.quantity) FROM billing_invoice_lines l WHERE l.invoice_id = i.id), 0) AS subtotal,
              COALESCE((SELECT sum(p.amount) FROM billing_payments p WHERE p.invoice_id = i.id), 0) AS paid
         FROM billing_invoices i ${condition} ORDER BY i.created_at DESC, i.id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM billing_invoices i ${condition}`, args.slice(0, args.length - 2));
    return {
      items: rows.map((r): InvoiceSummary => {
        const subtotal = Number(r.subtotal);
        const discount = Number(r.discount_amount);
        return {
          id: r.id, number: r.invoice_number, patientId: r.patient_id, status: need(parseInvoiceStatus(r.status), `Facture ${r.id}`), currency: r.currency,
          subtotal, discount, total: Math.max(0, subtotal - discount), paid: Number(r.paid), issuedAt: instantFromDb(r.issued_at), createdAt: requiredInstantFromDb(r.created_at),
        };
      }),
      total: total[0]?.n ?? 0,
    };
  }
}

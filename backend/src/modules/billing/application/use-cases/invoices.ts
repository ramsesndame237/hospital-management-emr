import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Temporal } from '../../../../shared-kernel/temporal';
import { discountNeedsApproval } from '../../domain/approval';
import { Invoice, InvoiceLine, lineTotal, Payment } from '../../domain/invoice';
import { ApprovalRepository, CashSessionRepository, InvoiceRepository, ItemRepository, PatientDirectory, SaveOutcome, UserDirectory } from '../../domain/ports';
import { ApprovalSummaryView, summarize } from './approval-views';
import {
  Amount, Currency, InvoiceId, InvoiceNumber, InvoiceStatus, ItemId, LineId, parseInvoiceStatus, parseNote, parsePaymentMode, parsePaymentReference, PatientRef, PaymentId, PaymentMode, Quantity, Reason,
} from '../../domain/values';

const NOT_FOUND = new DomainError('BILLING_INVOICE_NOT_FOUND', 'Facture introuvable.');
const PAYMENT_NOT_FOUND = new DomainError('BILLING_PAYMENT_NOT_FOUND', 'Encaissement introuvable.');
const PATIENT_NOT_FOUND = new DomainError('BILLING_PATIENT_NOT_FOUND', 'Patient introuvable.');
const ITEM_NOT_FOUND = new DomainError('BILLING_ITEM_NOT_FOUND', 'Acte introuvable.');
const ITEM_INACTIVE = new DomainError('BILLING_ITEM_INACTIVE', 'Cet acte est retiré du catalogue : on ne peut plus le facturer.');
const NO_OPEN_SESSION = new DomainError('BILLING_NO_OPEN_SESSION', "Ouvrez votre caisse avant d'encaisser : aucune session de caisse ouverte à votre nom.");
const CHANGED = new DomainError('BILLING_INVOICE_CHANGED', 'Cette facture vient d\'être modifiée par quelqu\'un d\'autre : rechargez-la puis recommencez.');
const APPROVAL_PENDING = new DomainError('BILLING_APPROVAL_PENDING', "Une demande d'approbation attend la décision d'un responsable pour cette facture : attendez-la ou retirez-la.");
const APPROVAL_REQUIRED = (kind: 'DISCOUNT' | 'CANCEL', extra: Record<string, string | number> = {}) =>
  new DomainError(kind === 'DISCOUNT' ? 'BILLING_DISCOUNT_APPROVAL_REQUIRED' : 'BILLING_CANCEL_APPROVAL_REQUIRED', kind === 'DISCOUNT' ? "Cette remise dépasse le seuil autorisé : demandez l'accord d'un responsable." : "Une facture émise ne s'annule qu'avec l'accord d'un responsable : envoyez une demande.", { kind, ...extra });
const OVERPAYMENT = (balance: number) => new DomainError('BILLING_OVERPAYMENT', 'Le montant dépasse le solde de la facture.', { balance });

export interface InvoiceLineView {
  readonly id: string;
  readonly itemId: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly total: number;
}

export interface PaymentView {
  readonly id: string;
  readonly receiptNumber: string;
  readonly mode: string;
  readonly amount: number;
  readonly reference: string | null;
  readonly receivedAt: string;
}

export interface PatientSummary {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
}

export interface InvoiceView {
  readonly id: string;
  readonly number: string;
  readonly status: string;
  readonly currency: string;
  /** Nombre de décimales de la plus petite unité de la devise, pour l'affichage (0 pour le franc CFA). */
  readonly currencyDigits: number;
  readonly patient: PatientSummary | null;
  readonly lines: readonly InvoiceLineView[];
  readonly subtotal: number;
  readonly discount: number;
  readonly discountReason: string | null;
  readonly total: number;
  readonly paid: number;
  readonly balance: number;
  readonly note: string | null;
  readonly cancellationReason: string | null;
  readonly issuedAt: string | null;
  readonly payments: readonly PaymentView[];
  /** Demandes d'approbation de cette facture (remise, annulation), la plus récente en premier. */
  readonly approvals: readonly ApprovalSummaryView[];
  /** Remise (en % du sous-total) au-delà de laquelle un responsable doit l'approuver. */
  readonly discountApprovalPercent: number;
}

export interface InvoiceDependencies {
  readonly invoices: InvoiceRepository;
  readonly items: ItemRepository;
  readonly patients: PatientDirectory;
  readonly sessions: CashSessionRepository;
  readonly approvals: ApprovalRepository;
  readonly users: UserDirectory;
  /** Remise (en % du sous-total) au-delà de laquelle un responsable doit l'approuver. */
  readonly discountApprovalPercent: number;
  readonly currency: Currency;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

const toPaymentView = (p: Payment): PaymentView => ({
  id: p.id.value, receiptNumber: p.receiptNumber.value, mode: p.mode, amount: p.amount.value, reference: p.reference, receivedAt: p.receivedAt.toString(),
});

async function toView(d: InvoiceDependencies, invoice: Invoice): Promise<InvoiceView> {
  const s = invoice.state;
  const patient = (await d.patients.find([s.patientId.value])).get(s.patientId.value) ?? null;
  const approvals = await summarize(d.users, (await d.approvals.list({ invoiceId: s.id }, 0, 50)).items);
  return {
    id: s.id.value, number: s.number.value, status: s.status, currency: s.currency.value, currencyDigits: s.currency.minorDigits,
    patient: patient ? { id: patient.id, number: patient.number, lastName: patient.lastName, firstName: patient.firstName } : null,
    lines: s.lines.map((l): InvoiceLineView => ({
      id: l.id.value, itemId: l.itemId.value, itemCode: l.itemCode.value, itemName: l.itemName.value, unitPrice: l.unitPrice.value, quantity: l.quantity.value, total: lineTotal(l).value,
    })),
    subtotal: invoice.subtotal.value, discount: s.discount.value, discountReason: s.discountReason?.value ?? null, total: invoice.total.value, paid: invoice.paid.value, balance: invoice.balance.value,
    note: s.note, cancellationReason: s.cancellationReason?.value ?? null, issuedAt: s.issuedAt?.toString() ?? null, payments: s.payments.map(toPaymentView),
    approvals, discountApprovalPercent: d.discountApprovalPercent,
  };
}

async function loadInvoice(d: InvoiceDependencies, rawId: string): Promise<Result<Invoice>> {
  const id = InvoiceId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.invoices.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

/** L'écriture est refusée si la facture a changé depuis sa lecture. */
function saved(outcome: SaveOutcome): Result<void> {
  return outcome === 'SAVED' ? ok(undefined) : err(CHANGED);
}

/** Tant qu'une demande attend une décision, la facture ne bouge pas : ce que le responsable examine est ce qui sera appliqué. */
async function ensureNoPendingApproval(d: InvoiceDependencies, invoice: Invoice): Promise<Result<void>> {
  return (await d.approvals.hasPending(invoice.id)) ? err(APPROVAL_PENDING) : ok(undefined);
}

function record(d: InvoiceDependencies, actorId: string, action: string, invoice: Invoice, extra: Record<string, string | number | boolean | null> = {}, reason?: string): Promise<void> {
  return d.audit.record({
    action, outcome: 'SUCCESS', actorId, resourceType: 'invoice', resourceId: invoice.id.value, ...(reason ? { reason } : {}),
    metadata: { invoiceNumber: invoice.state.number.value, patientId: invoice.state.patientId.value, ...extra }, occurredAt: d.clock.now(),
  });
}

/** Ligne de facture d'après l'acte du catalogue : le code, le libellé et le prix sont copiés, la facture ne suit plus le catalogue. */
async function buildLine(d: InvoiceDependencies, ids: IdGenerator, rawItemId: string, rawQuantity: number): Promise<Result<InvoiceLine>> {
  const itemId = ItemId.create(rawItemId);
  if (!itemId.ok) return err(ITEM_NOT_FOUND);
  const quantity = Quantity.create(rawQuantity);
  if (!quantity.ok) return err(quantity.error);
  const item = await d.items.findById(itemId.value);
  if (!item) return err(ITEM_NOT_FOUND);
  if (!item.active) return err(ITEM_INACTIVE);
  const id = LineId.create(ids.next());
  if (!id.ok) return err(id.error);
  const s = item.state;
  return ok({ id: id.value, itemId: s.id, itemCode: s.code, itemName: s.name, unitPrice: s.unitPrice, quantity: quantity.value });
}

export class CreateInvoiceUseCase {
  constructor(private readonly d: InvoiceDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, input: { patientId: string; note?: string | null; lines?: readonly { itemId: string; quantity: number }[] }): Promise<Result<InvoiceView>> {
    const patientRef = PatientRef.create(input.patientId);
    if (!patientRef.ok) return err(patientRef.error);
    const note = parseNote(input.note);
    if (!note.ok) return err(note.error);
    if (!(await this.d.patients.find([patientRef.value.value])).has(patientRef.value.value)) return err(PATIENT_NOT_FOUND);

    const id = InvoiceId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const invoice = Invoice.draft({ id: id.value, number: await this.d.invoices.nextInvoiceNumber(), patientId: patientRef.value, currency: this.d.currency, note: note.value, createdBy: actorId });
    for (const wanted of input.lines ?? []) {
      const line = await buildLine(this.d, this.ids, wanted.itemId, wanted.quantity);
      if (!line.ok) return err(line.error);
      const added = invoice.addLine(line.value);
      if (!added.ok) return err(added.error);
    }
    await this.d.invoices.insert(invoice);
    await record(this.d, actorId, 'billing.invoice.create', invoice, { lines: invoice.state.lines.length });
    return ok(await toView(this.d, invoice));
  }
}

/** Modifications d'un brouillon (lignes, remise), émission et annulation. Chacune est inscrite au journal d'audit. */
export class ManageInvoiceUseCases {
  constructor(private readonly d: InvoiceDependencies, private readonly ids: IdGenerator) {}

  async addLine(actorId: string, id: string, input: { itemId: string; quantity: number }): Promise<Result<InvoiceView>> {
    const loaded = await loadInvoice(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const invoice = loaded.value;
    const pending = await ensureNoPendingApproval(this.d, invoice);
    if (!pending.ok) return err(pending.error);
    const line = await buildLine(this.d, this.ids, input.itemId, input.quantity);
    if (!line.ok) return err(line.error);
    const added = invoice.addLine(line.value);
    if (!added.ok) return err(added.error);
    const written = saved(await this.d.invoices.save(invoice));
    if (!written.ok) return err(written.error);
    await record(this.d, actorId, 'billing.invoice.add-line', invoice, { itemCode: line.value.itemCode.value, quantity: line.value.quantity.value });
    return ok(await toView(this.d, invoice));
  }

  async removeLine(actorId: string, id: string, rawLineId: string): Promise<Result<InvoiceView>> {
    const loaded = await loadInvoice(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const invoice = loaded.value;
    const pending = await ensureNoPendingApproval(this.d, invoice);
    if (!pending.ok) return err(pending.error);
    const lineId = LineId.create(rawLineId);
    if (!lineId.ok) return err(new DomainError('BILLING_LINE_NOT_FOUND', 'Ligne de facture introuvable.'));
    const removed = invoice.removeLine(lineId.value);
    if (!removed.ok) return err(removed.error);
    const written = saved(await this.d.invoices.save(invoice));
    if (!written.ok) return err(written.error);
    await record(this.d, actorId, 'billing.invoice.remove-line', invoice);
    return ok(await toView(this.d, invoice));
  }

  /** Remise sur toute la facture ; un montant nul la retire, sinon un motif est obligatoire. */
  async setDiscount(actorId: string, id: string, input: { amount: number; reason?: string | null }): Promise<Result<InvoiceView>> {
    const loaded = await loadInvoice(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const invoice = loaded.value;
    const pending = await ensureNoPendingApproval(this.d, invoice);
    if (!pending.ok) return err(pending.error);
    const amount = Amount.create(input.amount);
    if (!amount.ok) return err(amount.error);
    const reason = input.reason === undefined || input.reason === null || input.reason.trim() === '' ? ok(null) : Reason.create(input.reason);
    if (!reason.ok) return err(reason.error);
    const done = invoice.setDiscount(amount.value, reason.value);
    if (!done.ok) return err(done.error);
    if (discountNeedsApproval(amount.value, invoice.subtotal, this.d.discountApprovalPercent)) {
      return err(APPROVAL_REQUIRED('DISCOUNT', { percent: this.d.discountApprovalPercent }));
    }
    const written = saved(await this.d.invoices.save(invoice));
    if (!written.ok) return err(written.error);
    await record(this.d, actorId, 'billing.invoice.discount', invoice, { discount: amount.value.value }, reason.value?.value);
    return ok(await toView(this.d, invoice));
  }

  async issue(actorId: string, id: string): Promise<Result<InvoiceView>> {
    const loaded = await loadInvoice(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const invoice = loaded.value;
    const pending = await ensureNoPendingApproval(this.d, invoice);
    if (!pending.ok) return err(pending.error);
    const done = invoice.issue(this.d.clock.now());
    if (!done.ok) return err(done.error);
    const written = saved(await this.d.invoices.save(invoice));
    if (!written.ok) return err(written.error);
    await record(this.d, actorId, 'billing.invoice.issue', invoice, { total: invoice.total.value });
    return ok(await toView(this.d, invoice));
  }

  async cancel(actorId: string, id: string, rawReason: string): Promise<Result<InvoiceView>> {
    const reason = Reason.create(rawReason);
    if (!reason.ok) return err(reason.error);
    const loaded = await loadInvoice(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const invoice = loaded.value;
    const pending = await ensureNoPendingApproval(this.d, invoice);
    if (!pending.ok) return err(pending.error);
    // Une facture émise est un document numéroté : l'annuler demande l'accord d'un responsable (une facture encore en brouillon, non).
    if (invoice.status === InvoiceStatus.ISSUED && invoice.state.payments.length === 0) return err(APPROVAL_REQUIRED('CANCEL'));
    const done = invoice.cancel(reason.value);
    if (!done.ok) return err(done.error);
    const written = saved(await this.d.invoices.save(invoice));
    if (!written.ok) return err(written.error);
    await record(this.d, actorId, 'billing.invoice.cancel', invoice, {}, reason.value.value);
    return ok(await toView(this.d, invoice));
  }
}

export interface CollectInput {
  readonly mode: string;
  readonly amount: number;
  readonly reference?: string | null;
  /** Espèces remises par le patient (pour rendre la monnaie) ; seulement pour le mode `CASH`. */
  readonly tendered?: number;
}

export interface CollectedPayment {
  readonly payment: PaymentView;
  /** Monnaie à rendre (espèces) ; 0 sinon. */
  readonly change: number;
  readonly invoice: InvoiceView;
}

export class CollectPaymentUseCase {
  constructor(private readonly d: InvoiceDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, id: string, input: CollectInput): Promise<Result<CollectedPayment>> {
    const mode = parsePaymentMode(input.mode);
    if (!mode.ok) return err(mode.error);
    const amount = Amount.positive(input.amount);
    if (!amount.ok) return err(amount.error);
    const reference = parsePaymentReference(input.reference);
    if (!reference.ok) return err(reference.error);
    let change = 0;
    if (input.tendered !== undefined) {
      if (mode.value !== PaymentMode.CASH) return err(new DomainError('BILLING_TENDERED_NOT_ALLOWED', 'Le montant remis ne concerne que les paiements en espèces.'));
      const tendered = Amount.positive(input.tendered);
      if (!tendered.ok) return err(tendered.error);
      if (tendered.value.value < amount.value.value) return err(new DomainError('BILLING_TENDERED_TOO_LOW', 'Le montant remis est inférieur au montant encaissé.', { amount: amount.value.value }));
      change = tendered.value.value - amount.value.value;
    }

    // Pas d'encaissement sans caisse ouverte : l'argent perçu doit pouvoir être compté à la clôture.
    const session = await this.d.sessions.findOpenByCashier(actorId);
    if (!session) return err(NO_OPEN_SESSION);
    const loaded = await loadInvoice(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const invoice = loaded.value;
    const payable = invoice.canBePaid();
    if (!payable.ok) return err(payable.error);
    if (amount.value.value > invoice.balance.value) return err(OVERPAYMENT(invoice.balance.value));

    const paymentId = PaymentId.create(this.ids.next());
    if (!paymentId.ok) return err(paymentId.error);
    const payment: Payment = {
      id: paymentId.value, receiptNumber: await this.d.invoices.nextReceiptNumber(), mode: mode.value, amount: amount.value, reference: reference.value, receivedBy: actorId, receivedAt: this.d.clock.now(), sessionId: session.session.id.value,
    };
    const outcome = await this.d.invoices.addPayment(invoice, payment);
    if (outcome === 'OVERPAYMENT') {
      const fresh = await this.d.invoices.findById(invoice.id);
      return err(OVERPAYMENT(fresh?.balance.value ?? 0));
    }
    if (outcome === 'SESSION_CLOSED') return err(NO_OPEN_SESSION);
    if (outcome === 'CHANGED') return err(CHANGED);

    const done = invoice.collect(payment); // même calcul que la base : met à jour le statut de la vue
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'billing.payment.collect', invoice, { receiptNumber: payment.receiptNumber.value, mode: mode.value, amount: amount.value.value, balance: invoice.balance.value, sessionNumber: session.session.state.number.value });
    return ok({ payment: toPaymentView(payment), change, invoice: await toView(this.d, invoice) });
  }
}

export interface ReceiptView {
  readonly receiptNumber: string;
  readonly invoiceNumber: string;
  readonly patient: PatientSummary | null;
  readonly mode: string;
  readonly amount: number;
  readonly currency: string;
  readonly currencyDigits: number;
  readonly reference: string | null;
  readonly receivedAt: string;
  /** Toujours vrai : seul le reçu remis à l'encaissement est un original ; une réimpression est une copie (« DUPLICATA »). */
  readonly duplicate: true;
  readonly invoiceBalance: number;
}

export class ReprintReceiptUseCase {
  constructor(private readonly d: InvoiceDependencies) {}

  /** Chaque réimpression est inscrite au journal avec son motif, qui est obligatoire. */
  async execute(actorId: string, rawPaymentId: string, rawReason: string): Promise<Result<ReceiptView>> {
    const reason = Reason.create(rawReason);
    if (!reason.ok) return err(reason.error);
    const paymentId = PaymentId.create(rawPaymentId);
    if (!paymentId.ok) return err(PAYMENT_NOT_FOUND);
    const found = await this.d.invoices.findByPayment(paymentId.value);
    if (!found) return err(PAYMENT_NOT_FOUND);
    const { invoice, payment } = found;
    const patient = (await this.d.patients.find([invoice.state.patientId.value])).get(invoice.state.patientId.value) ?? null;
    await record(this.d, actorId, 'billing.payment.reprint', invoice, { receiptNumber: payment.receiptNumber.value }, reason.value.value);
    return ok({
      receiptNumber: payment.receiptNumber.value, invoiceNumber: invoice.state.number.value,
      patient: patient ? { id: patient.id, number: patient.number, lastName: patient.lastName, firstName: patient.firstName } : null,
      mode: payment.mode, amount: payment.amount.value, currency: invoice.state.currency.value, currencyDigits: invoice.state.currency.minorDigits, reference: payment.reference,
      receivedAt: payment.receivedAt.toString(), duplicate: true, invoiceBalance: invoice.balance.value,
    });
  }
}

export class GetInvoiceUseCase {
  constructor(private readonly d: InvoiceDependencies) {}

  async execute(actorId: string, id: string): Promise<Result<InvoiceView>> {
    const loaded = await loadInvoice(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    await record(this.d, actorId, 'billing.invoice.read', loaded.value);
    return ok(await toView(this.d, loaded.value));
  }
}

export interface InvoiceListInput {
  patientId?: string;
  status?: string;
  number?: string;
  from?: string;
  to?: string;
  offset: number;
  limit: number;
}

export interface InvoiceSummaryView {
  readonly id: string;
  readonly number: string;
  readonly status: string;
  readonly currency: string;
  readonly patient: PatientSummary | null;
  readonly subtotal: number;
  readonly discount: number;
  readonly total: number;
  readonly paid: number;
  readonly balance: number;
  readonly issuedAt: string | null;
  readonly createdAt: string;
}

export class ListInvoicesUseCase {
  constructor(private readonly d: InvoiceDependencies) {}

  async execute(actorId: string, input: InvoiceListInput): Promise<Result<{ items: InvoiceSummaryView[]; total: number; offset: number; limit: number }>> {
    const instant = (raw: string | undefined, field: string): Result<string | undefined> => {
      if (!raw?.trim()) return ok(undefined);
      if (!/(Z|[+-]\d{2}:\d{2})$/i.test(raw.trim())) return err(new DomainError('BILLING_DATE_INVALID', `Le filtre « ${field} » doit être une date et heure ISO 8601 avec fuseau.`, { field }));
      try {
        return ok(Temporal.Instant.from(raw.trim()).toString());
      } catch {
        return err(new DomainError('BILLING_DATE_INVALID', `Le filtre « ${field} » doit être une date et heure ISO 8601 avec fuseau.`, { field }));
      }
    };
    const from = instant(input.from, 'from');
    if (!from.ok) return err(from.error);
    const to = instant(input.to, 'to');
    if (!to.ok) return err(to.error);
    const patientId = input.patientId?.trim() ? PatientRef.create(input.patientId) : ok(undefined);
    if (!patientId.ok) return err(patientId.error);
    const status = input.status?.trim() ? parseInvoiceStatus(input.status) : ok(undefined);
    if (!status.ok) return err(status.error);
    const number = input.number?.trim() ? InvoiceNumber.create(input.number) : ok(undefined);
    if (!number.ok) return err(number.error);

    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.d.invoices.list({ patientId: patientId.value, status: status.value as InvoiceStatus | undefined, number: number.value, from: from.value, to: to.value }, offset, limit);
    const patients = await this.d.patients.find([...new Set(page.items.map((i) => i.patientId))]);
    await this.d.audit.record({
      action: 'billing.invoice.list', outcome: 'SUCCESS', actorId,
      metadata: { criteria: ['patientId', 'status', 'number', 'from', 'to'].filter((k) => (input as unknown as Record<string, unknown>)[k]).join(','), returned: page.items.length, total: page.total },
      occurredAt: this.d.clock.now(),
    });
    return ok({
      items: page.items.map((i): InvoiceSummaryView => {
        const p = patients.get(i.patientId);
        return {
          id: i.id, number: i.number, status: i.status, currency: i.currency, patient: p ? { id: p.id, number: p.number, lastName: p.lastName, firstName: p.firstName } : null,
          subtotal: i.subtotal, discount: i.discount, total: i.total, paid: i.paid, balance: Math.max(0, i.total - i.paid), issuedAt: i.issuedAt?.toString() ?? null, createdAt: i.createdAt.toString(),
        };
      }),
      total: page.total, offset, limit,
    });
  }
}

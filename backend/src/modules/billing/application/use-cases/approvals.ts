import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ServiceAccess } from '../../../../shared-kernel/service-access';
import { ApprovalId, ApprovalKind, ApprovalRequest, ApprovalStatus, discountNeedsApproval, parseApprovalKind, parseApprovalStatus } from '../../domain/approval';
import { ApprovalRecord, ApprovalRepository, InvoiceRepository, PatientDirectory, UserDirectory } from '../../domain/ports';
import { Amount, Currency, InvoiceId, InvoiceStatus, Reason } from '../../domain/values';
import { ApprovalSummaryView, summarize } from './approval-views';

const NOT_FOUND = new DomainError('BILLING_APPROVAL_NOT_FOUND', 'Demande introuvable.');
const INVOICE_NOT_FOUND = new DomainError('BILLING_INVOICE_NOT_FOUND', 'Facture introuvable.');
const PENDING = new DomainError('BILLING_APPROVAL_PENDING', "Une demande d'approbation attend déjà la décision d'un responsable pour cette facture.");
const CHANGED = new DomainError('BILLING_INVOICE_CHANGED', "Cette facture vient d'être modifiée par quelqu'un d'autre : rechargez-la puis recommencez.");
const STALE = new DomainError('BILLING_APPROVAL_STALE', "La facture a changé depuis cette demande : elle ne peut plus être acceptée. Refusez-la, l'auteur en enverra une nouvelle.");
const NOT_NEEDED = (kind: ApprovalKind) =>
  new DomainError(kind === ApprovalKind.DISCOUNT ? 'BILLING_DISCOUNT_APPROVAL_NOT_NEEDED' : 'BILLING_CANCEL_APPROVAL_NOT_NEEDED', kind === ApprovalKind.DISCOUNT ? "Cette remise est dans le seuil autorisé : appliquez-la directement, sans demande." : "Cette facture n'est pas encore émise : annulez-la directement, sans demande.", { kind });

export interface PatientSummary {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
}

export interface ApprovalView extends ApprovalSummaryView {
  readonly currency: string;
  readonly currencyDigits: number;
  /** La facture concernée, telle qu'elle est maintenant. */
  readonly invoice: {
    readonly id: string;
    readonly number: string;
    readonly status: string;
    readonly patient: PatientSummary | null;
    readonly subtotal: number;
    readonly discount: number;
    readonly total: number;
  };
  /** Remise (en % du sous-total) au-delà de laquelle un responsable doit l'approuver. */
  readonly discountApprovalPercent: number;
}

export interface ApprovalDependencies {
  readonly approvals: ApprovalRepository;
  readonly invoices: InvoiceRepository;
  readonly patients: PatientDirectory;
  readonly users: UserDirectory;
  readonly access: ServiceAccess;
  readonly currency: Currency;
  readonly discountApprovalPercent: number;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

async function toViews(d: ApprovalDependencies, records: readonly ApprovalRecord[]): Promise<ApprovalView[]> {
  const summaries = await summarize(d.users, records);
  const patients = await d.patients.find([...new Set(records.map((r) => r.invoice.patientId))]);
  return records.map(({ invoice }, i): ApprovalView => {
    const p = patients.get(invoice.patientId);
    const currency = Currency.create(invoice.currency);
    return {
      ...summaries[i], currency: invoice.currency, currencyDigits: currency.ok ? currency.value.minorDigits : 2,
      invoice: {
        id: invoice.id, number: invoice.number, status: invoice.status, patient: p ? { id: p.id, number: p.number, lastName: p.lastName, firstName: p.firstName } : null,
        subtotal: invoice.subtotal, discount: invoice.discount, total: Math.max(0, invoice.subtotal - invoice.discount),
      },
      discountApprovalPercent: d.discountApprovalPercent,
    };
  });
}

/** Un responsable lit toutes les demandes (portée « all ») ; les autres, seulement les leurs. */
async function isReviewer(d: ApprovalDependencies, actorId: string): Promise<boolean> {
  return (await d.access.visibleServices(actorId, 'billing.approvals:read')) === 'ALL';
}

function auditApproval(d: ApprovalDependencies, actorId: string, action: string, record: ApprovalRecord, reason?: string, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  const s = record.request.state;
  return d.audit.record({
    action, outcome: 'SUCCESS', actorId, resourceType: 'approval', resourceId: s.id.value, ...(reason ? { reason } : {}),
    metadata: { invoiceNumber: record.invoice.number, invoiceId: s.invoiceId.value, kind: s.kind, amount: s.amount?.value ?? null, requestedBy: s.requestedBy, ...extra }, occurredAt: d.clock.now(),
  });
}

export interface RequestApprovalInput {
  readonly invoiceId: string;
  readonly kind: string;
  /** Montant de la remise demandée (pour `DISCOUNT`). */
  readonly amount?: number;
  readonly reason: string;
}

export class RequestApprovalUseCase {
  constructor(private readonly d: ApprovalDependencies, private readonly ids: IdGenerator) {}

  /**
   * Le caissier demande l'accord d'un responsable : pour une remise au-delà du seuil, ou pour annuler une facture émise. Une demande qui n'a
   * pas lieu d'être (remise dans le seuil, facture encore en brouillon) est refusée : le caissier agit directement.
   */
  async execute(actorId: string, input: RequestApprovalInput): Promise<Result<ApprovalView>> {
    const kind = parseApprovalKind(input.kind);
    if (!kind.ok) return err(kind.error);
    const reason = Reason.create(input.reason);
    if (!reason.ok) return err(reason.error);
    const invoiceId = InvoiceId.create(input.invoiceId);
    if (!invoiceId.ok) return err(INVOICE_NOT_FOUND);
    const invoice = await this.d.invoices.findById(invoiceId.value);
    if (!invoice) return err(INVOICE_NOT_FOUND);

    let amount: Amount | null = null;
    if (kind.value === ApprovalKind.DISCOUNT) {
      const requested = Amount.positive(input.amount ?? 0);
      if (!requested.ok) return err(requested.error);
      amount = requested.value;
      // Les règles du domaine (brouillon, remise inférieure au total) valident la demande sur une copie en mémoire : rien n'est enregistré.
      const check = invoice.setDiscount(amount, reason.value);
      if (!check.ok) return err(check.error);
      if (!discountNeedsApproval(amount, invoice.subtotal, this.d.discountApprovalPercent)) return err(NOT_NEEDED(kind.value));
    } else {
      if (invoice.status === InvoiceStatus.DRAFT) return err(NOT_NEEDED(kind.value));
      const check = invoice.cancel(reason.value);
      if (!check.ok) return err(check.error);
    }

    const id = ApprovalId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const request = ApprovalRequest.request({
      id: id.value, invoiceId: invoiceId.value, kind: kind.value, amount, reason: reason.value, invoiceVersion: invoice.state.version, requestedBy: actorId, requestedAt: this.d.clock.now(),
    });
    if (!request.ok) return err(request.error);
    const outcome = await this.d.approvals.create(request.value);
    if (outcome === 'ALREADY_PENDING') return err(PENDING);
    if (outcome === 'INVOICE_CHANGED') return err(CHANGED);
    const record = (await this.d.approvals.findById(id.value))!;
    await auditApproval(this.d, actorId, 'billing.approval.request', record, reason.value.value);
    return ok((await toViews(this.d, [record]))[0]);
  }
}

export class DecideApprovalUseCase {
  constructor(private readonly d: ApprovalDependencies) {}

  /**
   * Un responsable accepte ou refuse (jamais sa propre demande ; un refus s'explique). L'acceptation applique la remise ou l'annulation à la
   * facture dans la même transaction, à condition que la facture n'ait pas bougé depuis la demande.
   */
  async execute(actorId: string, rawId: string, approve: boolean, comment: string | null): Promise<Result<ApprovalView>> {
    const id = ApprovalId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const done = await this.d.approvals.decide(id.value, (request, invoice) => {
      const decided = request.decide(actorId, approve, comment, this.d.clock.now());
      if (!decided.ok) return err(decided.error);
      if (!approve) return ok(false);
      const s = request.state;
      if (invoice.state.version !== s.invoiceVersion) return err(STALE);
      const applied = s.kind === ApprovalKind.DISCOUNT ? invoice.setDiscount(s.amount!, s.reason) : invoice.cancel(s.reason);
      return applied.ok ? ok(true) : err(applied.error);
    });
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    const s = done.value.request.state;
    await auditApproval(this.d, actorId, approve ? 'billing.approval.approve' : 'billing.approval.reject', done.value, s.decisionComment ?? undefined, { requestReason: s.reason.value });
    if (approve) {
      // Le journal de la facture garde aussi la trace de l'effet, avec l'accord qui l'a permis.
      await this.d.audit.record({
        action: s.kind === ApprovalKind.DISCOUNT ? 'billing.invoice.discount' : 'billing.invoice.cancel', outcome: 'SUCCESS', actorId, resourceType: 'invoice', resourceId: s.invoiceId.value, reason: s.reason.value,
        metadata: { invoiceNumber: done.value.invoice.number, approvalId: s.id.value, requestedBy: s.requestedBy, ...(s.amount ? { discount: s.amount.value } : {}) }, occurredAt: this.d.clock.now(),
      });
    }
    return ok((await toViews(this.d, [done.value]))[0]);
  }
}

export class WithdrawApprovalUseCase {
  constructor(private readonly d: ApprovalDependencies) {}

  /** L'auteur retire sa demande tant qu'elle n'est pas décidée ; pour les autres elle n'existe pas. */
  async execute(actorId: string, rawId: string): Promise<Result<ApprovalView>> {
    const id = ApprovalId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const done = await this.d.approvals.mutate(id.value, (request) => request.withdraw(actorId, this.d.clock.now()));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await auditApproval(this.d, actorId, 'billing.approval.withdraw', done.value);
    return ok((await toViews(this.d, [done.value]))[0]);
  }
}

export class GetApprovalUseCase {
  constructor(private readonly d: ApprovalDependencies) {}

  async execute(actorId: string, rawId: string): Promise<Result<ApprovalView>> {
    const id = ApprovalId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const found = await this.d.approvals.findById(id.value);
    // Une demande qui n'est pas la sienne (et qu'on n'a pas à décider) est « introuvable » : on ne révèle pas son existence.
    if (!found || (found.request.state.requestedBy !== actorId && !(await isReviewer(this.d, actorId)))) return err(NOT_FOUND);
    return ok((await toViews(this.d, [found]))[0]);
  }
}

export interface ApprovalListInput {
  status?: string;
  kind?: string;
  invoiceId?: string;
  requestedBy?: string;
  offset: number;
  limit: number;
}

export class ListApprovalsUseCase {
  constructor(private readonly d: ApprovalDependencies) {}

  /** Un responsable voit toutes les demandes (et peut filtrer par auteur) ; un caissier ne voit que les siennes, quoi qu'il demande. */
  async execute(actorId: string, input: ApprovalListInput): Promise<Result<{ items: ApprovalView[]; total: number; offset: number; limit: number }>> {
    const status = input.status?.trim() ? parseApprovalStatus(input.status) : ok(undefined);
    if (!status.ok) return err(status.error);
    const kind = input.kind?.trim() ? parseApprovalKind(input.kind) : ok(undefined);
    if (!kind.ok) return err(kind.error);
    const invoiceId = input.invoiceId?.trim() ? InvoiceId.create(input.invoiceId) : ok(undefined);
    if (!invoiceId.ok) return err(INVOICE_NOT_FOUND);
    const reviewer = await isReviewer(this.d, actorId);
    const requestedBy = reviewer ? (input.requestedBy?.trim() ? input.requestedBy.trim().toLowerCase() : undefined) : actorId;
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.d.approvals.list({ requestedBy, status: status.value as ApprovalStatus | undefined, kind: kind.value as ApprovalKind | undefined, invoiceId: invoiceId.value }, offset, limit);
    return ok({ items: await toViews(this.d, page.items), total: page.total, offset, limit });
  }
}

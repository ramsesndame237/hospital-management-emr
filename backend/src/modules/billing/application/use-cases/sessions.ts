import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ServiceAccess } from '../../../../shared-kernel/service-access';
import { CashSession, CounterName, Denominations, denominationsOf, parseSessionStatus, SessionId, SessionStatus, Takings } from '../../domain/cash-session';
import { CashSessionRepository, SessionPayment, SessionRecord, UserDirectory } from '../../domain/ports';
import { Currency, PaymentMode } from '../../domain/values';

const NOT_FOUND = new DomainError('BILLING_SESSION_NOT_FOUND', 'Session de caisse introuvable.');

export interface UserSummary {
  readonly id: string;
  readonly username: string;
}

export interface SessionView {
  readonly id: string;
  readonly number: string;
  readonly status: string;
  readonly currency: string;
  readonly currencyDigits: number;
  readonly cashier: UserSummary | null;
  readonly counter: string;
  readonly openedAt: string;
  readonly openingFloat: number;
  readonly openingCount: Readonly<Record<string, number>>;
  /** Encaissé pendant la session, par mode de paiement. */
  readonly takings: Readonly<Record<string, number>>;
  readonly paymentCount: number;
  readonly totalTaken: number;
  /** Espèces qui devraient être en caisse (fonds + espèces encaissées) : vivant tant que la session est ouverte, figé à la clôture. */
  readonly expectedCash: number;
  readonly closedAt: string | null;
  readonly closingCount: Readonly<Record<string, number>> | null;
  readonly countedCash: number | null;
  /** Espèces comptées − espèces attendues (négatif : il manque de l'argent). */
  readonly variance: number | null;
  readonly varianceReason: string | null;
  readonly requiresCosign: boolean;
  readonly cosignedBy: UserSummary | null;
  readonly cosignedAt: string | null;
  readonly cosignComment: string | null;
  /** Écart au-delà duquel la clôture attend la contre-signature d'un responsable. */
  readonly varianceLimit: number;
}

export interface SessionDetailView extends SessionView {
  readonly payments: readonly { id: string; receiptNumber: string; invoiceNumber: string; mode: string; amount: number; receivedAt: string }[];
}

export interface SessionDependencies {
  readonly sessions: CashSessionRepository;
  readonly users: UserDirectory;
  readonly access: ServiceAccess;
  readonly currency: Currency;
  readonly varianceLimit: number;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

const takingsView = (takings: Takings): Record<string, number> => Object.fromEntries(Object.values(PaymentMode).map((mode) => [mode, takings[mode].value]));
const totalOf = (takings: Takings): number => Object.values(PaymentMode).reduce((sum, mode) => sum + takings[mode].value, 0);

async function toViews(d: SessionDependencies, records: readonly SessionRecord[]): Promise<SessionView[]> {
  const ids = new Set<string>();
  for (const r of records) {
    ids.add(r.session.state.cashierId);
    if (r.session.state.cosignedBy) ids.add(r.session.state.cosignedBy);
  }
  const users = await d.users.find([...ids]);
  const who = (id: string | null): UserSummary | null => (id && users.get(id) ? { id, username: users.get(id)!.username } : null);
  return records.map(({ session, takings, paymentCount }) => {
    const s = session.state;
    return {
      id: s.id.value, number: s.number.value, status: s.status, currency: s.currency.value, currencyDigits: s.currency.minorDigits, cashier: who(s.cashierId), counter: s.counter.value,
      openedAt: s.openedAt.toString(), openingFloat: s.openingFloat.value, openingCount: s.openingCount.counts, takings: takingsView(takings), paymentCount, totalTaken: totalOf(takings),
      expectedCash: (s.expectedCash ?? session.expectedCashWith(takings)).value, closedAt: s.closedAt?.toString() ?? null, closingCount: s.closingCount?.counts ?? null,
      countedCash: s.countedCash?.value ?? null, variance: s.variance, varianceReason: s.varianceReason, requiresCosign: s.requiresCosign, cosignedBy: who(s.cosignedBy),
      cosignedAt: s.cosignedAt?.toString() ?? null, cosignComment: s.cosignComment, varianceLimit: d.varianceLimit,
    };
  });
}

/** Responsable de la caisse : il peut lire toutes les sessions (portée « all »). Les autres ne voient que les leurs. */
async function isReviewer(d: SessionDependencies, actorId: string): Promise<boolean> {
  return (await d.access.visibleServices(actorId, 'billing.sessions:read')) === 'ALL';
}

async function loadFor(d: SessionDependencies, actorId: string, rawId: string): Promise<Result<SessionRecord>> {
  const id = SessionId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.sessions.findById(id.value);
  if (!found) return err(NOT_FOUND);
  // Une session qui n'est pas la sienne (et qu'on n'a pas à contrôler) est « introuvable » : on ne révèle pas son existence.
  if (found.session.state.cashierId !== actorId && !(await isReviewer(d, actorId))) return err(NOT_FOUND);
  return ok(found);
}

function record(d: SessionDependencies, actorId: string, action: string, session: CashSession, extra: Record<string, string | number | boolean | null> = {}, reason?: string): Promise<void> {
  const s = session.state;
  return d.audit.record({
    action, outcome: 'SUCCESS', actorId, resourceType: 'cash-session', resourceId: s.id.value, ...(reason ? { reason } : {}),
    metadata: { sessionNumber: s.number.value, counter: s.counter.value, ...extra }, occurredAt: d.clock.now(),
  });
}

export interface DenominationsView {
  readonly currency: string;
  readonly currencyDigits: number;
  /** Valeurs des billets et pièces, de la plus grande à la plus petite, dans la plus petite unité de la devise. */
  readonly denominations: readonly number[];
  readonly varianceLimit: number;
}

export class GetDenominationsUseCase {
  constructor(private readonly d: SessionDependencies) {}

  execute(): DenominationsView {
    return { currency: this.d.currency.value, currencyDigits: this.d.currency.minorDigits, denominations: denominationsOf(this.d.currency), varianceLimit: this.d.varianceLimit };
  }
}

export class OpenSessionUseCase {
  constructor(private readonly d: SessionDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, input: { counter: string; openingCount?: unknown }): Promise<Result<SessionView>> {
    const counter = CounterName.create(input.counter);
    if (!counter.ok) return err(counter.error);
    const count = Denominations.create(input.openingCount, this.d.currency);
    if (!count.ok) return err(count.error);
    const id = SessionId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const session = CashSession.open({ id: id.value, number: await this.d.sessions.nextSessionNumber(), cashierId: actorId, counter: counter.value, currency: this.d.currency, openedAt: this.d.clock.now(), openingCount: count.value });
    const outcome = await this.d.sessions.open(session);
    if (outcome === 'CASHIER_BUSY') return err(new DomainError('BILLING_CASHIER_HAS_OPEN_SESSION', 'Vous avez déjà une caisse ouverte : clôturez-la avant d\'en ouvrir une autre.'));
    if (outcome === 'COUNTER_BUSY') return err(new DomainError('BILLING_COUNTER_IN_USE', 'Ce poste de caisse est déjà tenu par une session ouverte.'));
    await record(this.d, actorId, 'billing.session.open', session, { openingFloat: session.state.openingFloat.value });
    const opened = await this.d.sessions.findById(id.value);
    return ok((await toViews(this.d, [opened!]))[0]);
  }
}

export class GetCurrentSessionUseCase {
  constructor(private readonly d: SessionDependencies) {}

  /** La caisse ouverte du caissier, ou `null` : sans caisse ouverte, il ne peut pas encaisser. */
  async execute(actorId: string): Promise<SessionDetailView | null> {
    const found = await this.d.sessions.findOpenByCashier(actorId);
    if (!found) return null;
    return detail(this.d, found);
  }
}

async function detail(d: SessionDependencies, found: SessionRecord): Promise<SessionDetailView> {
  const [view] = await toViews(d, [found]);
  const payments: SessionPayment[] = await d.sessions.payments(found.session.id);
  return { ...view, payments: payments.map((p) => ({ id: p.id, receiptNumber: p.receiptNumber, invoiceNumber: p.invoiceNumber, mode: p.mode, amount: p.amount, receivedAt: p.receivedAt.toString() })) };
}

export class GetSessionUseCase {
  constructor(private readonly d: SessionDependencies) {}

  async execute(actorId: string, id: string): Promise<Result<SessionDetailView>> {
    const loaded = await loadFor(this.d, actorId, id);
    return loaded.ok ? ok(await detail(this.d, loaded.value)) : err(loaded.error);
  }
}

export interface SessionListInput {
  status?: string;
  cashierId?: string;
  offset: number;
  limit: number;
}

export class ListSessionsUseCase {
  constructor(private readonly d: SessionDependencies) {}

  /** Un responsable voit toutes les sessions (et peut filtrer par caissier) ; un caissier ne voit que les siennes, quoi qu'il demande. */
  async execute(actorId: string, input: SessionListInput): Promise<Result<{ items: SessionView[]; total: number; offset: number; limit: number }>> {
    const status = input.status?.trim() ? parseSessionStatus(input.status) : ok(undefined);
    if (!status.ok) return err(status.error);
    const reviewer = await isReviewer(this.d, actorId);
    const cashierId = reviewer ? (input.cashierId?.trim() ? input.cashierId.trim().toLowerCase() : undefined) : actorId;
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.d.sessions.list({ cashierId, status: status.value as SessionStatus | undefined }, offset, limit);
    return ok({ items: await toViews(this.d, page.items), total: page.total, offset, limit });
  }
}

export class CloseSessionUseCase {
  constructor(private readonly d: SessionDependencies) {}

  /** Seul le caissier clôture sa propre caisse. L'écart (espèces comptées − attendues) exige une explication ; au-delà de la limite, un responsable doit contre-signer. */
  async execute(actorId: string, rawId: string, input: { count: unknown; reason?: string | null }): Promise<Result<SessionDetailView>> {
    const id = SessionId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const current = await this.d.sessions.findById(id.value);
    if (!current || current.session.state.cashierId !== actorId) return err(NOT_FOUND);
    const count = Denominations.create(input.count, this.d.currency);
    if (!count.ok) return err(count.error);
    const done = await this.d.sessions.mutate(id.value, (r) =>
      r.session.close({ count: count.value, reason: input.reason ?? null, now: this.d.clock.now(), takings: r.takings, varianceLimit: this.d.varianceLimit }),
    );
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    const s = done.value.session.state;
    await record(this.d, actorId, 'billing.session.close', done.value.session, {
      openingFloat: s.openingFloat.value, expectedCash: s.expectedCash?.value ?? null, countedCash: s.countedCash?.value ?? null, variance: s.variance, requiresCosign: s.requiresCosign, totalTaken: totalOf(done.value.takings),
    }, s.varianceReason ?? undefined);
    return ok(await detail(this.d, done.value));
  }
}

export class CosignSessionUseCase {
  constructor(private readonly d: SessionDependencies) {}

  /** Un responsable (jamais le caissier lui-même) valide une clôture dont l'écart dépasse la limite. */
  async execute(actorId: string, rawId: string, comment: string | null): Promise<Result<SessionDetailView>> {
    const id = SessionId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const done = await this.d.sessions.mutate(id.value, (r) => r.session.cosign(actorId, comment, this.d.clock.now()));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    const s = done.value.session.state;
    await record(this.d, actorId, 'billing.session.cosign', done.value.session, { cashierId: s.cashierId, variance: s.variance }, s.cosignComment ?? undefined);
    return ok(await detail(this.d, done.value));
  }
}

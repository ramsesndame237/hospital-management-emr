import { Clock } from '../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, Temporal } from '../../../shared-kernel/temporal';
import { AuditChainStatus, AuditLog, AuditOutcome, AuditQuery, AuditReader, AuditRecord } from '../domain/audit-log.port';

const OUTCOMES: readonly string[] = ['SUCCESS', 'FAILURE', 'DENIED'];
const invalid = (field: string, detail: string) => new DomainError('AUDIT_FILTER_INVALID', `Filtre « ${field} » invalide : ${detail}`, { field });

/** Qui consulte, et d'où : la consultation du journal est elle-même journalisée. */
export interface AuditViewer {
  readonly userId: string;
  readonly username: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export interface AuditSearchInput {
  action?: string;
  actionPrefix?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: string;
  from?: string;
  to?: string;
  before?: string;
  limit?: number;
}

export interface AuditEventView {
  readonly id: string;
  readonly occurredAt: string;
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly actorId: string | null;
  readonly actorUsername: string | null;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly reason: string | null;
  readonly metadata: AuditRecord['metadata'];
  readonly prevHash: string;
  readonly hash: string;
}

const toView = (r: AuditRecord): AuditEventView => ({ ...r, occurredAt: r.occurredAt.toString() });

function instant(raw: string | undefined, field: string): Result<Instant | undefined> {
  if (raw === undefined || raw.trim() === '') return ok(undefined);
  try {
    return ok(Temporal.Instant.from(raw.trim()));
  } catch {
    return err(invalid(field, 'date et heure ISO 8601 avec fuseau attendues (ex. 2026-10-23T10:00:00Z).'));
  }
}

const text = (raw: string | undefined): string | undefined => (raw?.trim() ? raw.trim() : undefined);

/**
 * Consultation du journal d'audit (preuve en cas de litige). Chaque consultation est elle-même inscrite au journal : qui a lu
 * quoi, quand, avec quels filtres. Le journal est en ajout seul : aucune opération ici ne modifie ni ne supprime une entrée.
 */
export class SearchAuditUseCase {
  constructor(private readonly reader: AuditReader, private readonly audit: AuditLog, private readonly clock: Clock) {}

  async execute(viewer: AuditViewer, input: AuditSearchInput): Promise<Result<{ items: AuditEventView[]; nextBefore: string | null; limit: number }>> {
    const from = instant(input.from, 'from');
    if (!from.ok) return err(from.error);
    const to = instant(input.to, 'to');
    if (!to.ok) return err(to.error);
    if (from.value && to.value && Temporal.Instant.compare(from.value, to.value) > 0) return err(invalid('from', 'la date de début suit la date de fin.'));
    const outcome = text(input.outcome)?.toUpperCase();
    if (outcome !== undefined && !OUTCOMES.includes(outcome)) return err(invalid('outcome', 'SUCCESS, FAILURE ou DENIED attendu.'));
    const before = text(input.before);
    if (before !== undefined && !/^\d{1,18}$/.test(before)) return err(invalid('before', 'curseur invalide (utiliser la valeur `nextBefore` de la page précédente).'));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit ?? 50)));

    const query: AuditQuery = {
      action: text(input.action), actionPrefix: text(input.actionPrefix), actorId: text(input.actorId), resourceType: text(input.resourceType),
      resourceId: text(input.resourceId), outcome: outcome as AuditOutcome | undefined, from: from.value, to: to.value, before, limit,
    };
    const page = await this.reader.search(query);

    const filters = Object.fromEntries(
      (['action', 'actionPrefix', 'actorId', 'resourceType', 'resourceId', 'outcome'] as const).flatMap((k) => (query[k] ? [[`filter.${k}`, query[k] as string]] : [])),
    );
    await this.audit.record({
      action: 'audit.log.read', outcome: 'SUCCESS', actorId: viewer.userId, actorUsername: viewer.username, ip: viewer.ip, userAgent: viewer.userAgent,
      metadata: {
        returned: page.items.length, ...filters,
        ...(query.from ? { 'filter.from': query.from.toString() } : {}), ...(query.to ? { 'filter.to': query.to.toString() } : {}),
        ...(query.before ? { 'filter.before': query.before } : {}),
      },
      occurredAt: this.clock.now(),
    });
    return ok({ items: page.items.map(toView), nextBefore: page.nextBefore, limit });
  }
}

/** Vérifie la chaîne de hachage de tout le journal ; une rupture est inscrite en échec, avec la première ligne altérée. */
export class VerifyAuditChainUseCase {
  constructor(private readonly reader: AuditReader, private readonly audit: AuditLog, private readonly clock: Clock) {}

  async execute(viewer: AuditViewer): Promise<AuditChainStatus> {
    const status = await this.reader.verifyChain();
    await this.audit.record({
      action: 'audit.log.verify', outcome: status.valid ? 'SUCCESS' : 'FAILURE', actorId: viewer.userId, actorUsername: viewer.username,
      ip: viewer.ip, userAgent: viewer.userAgent, reason: status.valid ? undefined : 'chain-broken',
      metadata: { checked: status.checked, brokenAtId: status.brokenAtId }, occurredAt: this.clock.now(),
    });
    return status;
  }
}

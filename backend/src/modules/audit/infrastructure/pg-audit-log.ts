import { createHash } from 'node:crypto';
import { SqlExecutor } from '../../../database/sql-executor';
import { requiredInstantFromDb } from '../../../database/temporal-mapping';
import { Temporal } from '../../../shared-kernel/temporal';
import { AuditChainStatus, AuditEntry, AuditLog, AuditPage, AuditQuery, AuditReader, AuditRecord } from '../domain/audit-log.port';

const GENESIS = '0'.repeat(64);
/** Verrou consultatif : sérialise les écritures pour que la chaîne de hachage reste linéaire. */
const CHAIN_LOCK = 7_001;

interface Row {
  id: string;
  occurred_at: Date;
  action: string;
  outcome: string;
  actor_id: string | null;
  actor_username: string | null;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  reason: string | null;
  metadata: unknown;
  prev_hash: string;
  hash: string;
}

/** JSON à clés triées : `jsonb` ne conserve pas l'ordre des clés, la relecture doit donner les mêmes octets qu'à l'écriture. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Empreinte canonique d'une ligne : tout champ modifié a posteriori rompt la chaîne. */
export function computeHash(prev: string, e: Pick<Row, 'action' | 'outcome' | 'actor_id' | 'actor_username' | 'resource_type' | 'resource_id' | 'ip' | 'user_agent' | 'reason' | 'metadata'> & { occurredAt: string }): string {
  const canonical = canonicalJson([
    prev, e.occurredAt, e.action, e.outcome, e.actor_id, e.actor_username,
    e.resource_type, e.resource_id, e.ip, e.user_agent, e.reason, e.metadata ?? null,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Journal d'audit en ajout seul (trigger SQL) et chaîné par hachage, façon registre : chaque entrée engage la précédente.
 * `verifyChain` permet à un auditeur de détecter toute altération, y compris par un administrateur de base de données.
 */
export class PgAuditLog implements AuditLog, AuditReader {
  constructor(private readonly sql: SqlExecutor) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.sql.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock($1)', [CHAIN_LOCK]);
      const last = await tx.query<{ hash: string }>('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1');
      const prev = last[0]?.hash ?? GENESIS;
      // PostgreSQL conserve la microseconde, pas la nanoseconde : on normalise à la milliseconde avant de hacher,
      // sinon la relecture ne redonnerait pas la même empreinte.
      const at = Temporal.Instant.fromEpochMilliseconds(entry.occurredAt.epochMilliseconds).toString();
      const row = {
        occurredAt: at,
        action: entry.action,
        outcome: entry.outcome,
        actor_id: entry.actorId ?? null,
        actor_username: entry.actorUsername ?? null,
        resource_type: entry.resourceType ?? null,
        resource_id: entry.resourceId ?? null,
        ip: entry.ip ?? null,
        user_agent: entry.userAgent ? entry.userAgent.slice(0, 300) : null,
        reason: entry.reason ?? null,
        metadata: entry.metadata ?? null,
      };
      await tx.query(
        `INSERT INTO audit_log (occurred_at, action, outcome, actor_id, actor_username, resource_type, resource_id, ip, user_agent, reason, metadata, prev_hash, hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
        [
          row.occurredAt, row.action, row.outcome, row.actor_id, row.actor_username, row.resource_type, row.resource_id,
          row.ip, row.user_agent, row.reason, row.metadata === null ? null : JSON.stringify(row.metadata), prev, computeHash(prev, row),
        ],
      );
    });
  }

  /** Recherche paginée par curseur, des plus récentes aux plus anciennes. Tous les filtres sont paramétrés (aucune concaténation). */
  async search(query: AuditQuery): Promise<AuditPage> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (query.action) where.push(`action = ${arg(query.action)}`);
    // `starts_with` plutôt que `LIKE` : le préfixe est pris tel quel, sans caractères joker à échapper.
    if (query.actionPrefix) where.push(`starts_with(action, ${arg(query.actionPrefix)})`);
    if (query.actorId) where.push(`actor_id = ${arg(query.actorId)}`);
    if (query.resourceType) where.push(`resource_type = ${arg(query.resourceType)}`);
    if (query.resourceId) where.push(`resource_id = ${arg(query.resourceId)}`);
    if (query.outcome) where.push(`outcome = ${arg(query.outcome)}`);
    if (query.from) where.push(`occurred_at >= ${arg(query.from.toString())}::timestamptz`);
    if (query.to) where.push(`occurred_at <= ${arg(query.to.toString())}::timestamptz`);
    if (query.before) where.push(`id < ${arg(query.before)}::bigint`);
    const rows = await this.sql.query<Row>(
      `SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ${arg(query.limit + 1)}`,
      args,
    );
    const page = rows.slice(0, query.limit);
    const toRecord = (r: Row): AuditRecord => ({
      id: String(r.id),
      occurredAt: requiredInstantFromDb(r.occurred_at),
      action: r.action,
      outcome: r.outcome as AuditRecord['outcome'],
      actorId: r.actor_id,
      actorUsername: r.actor_username,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      ip: r.ip,
      userAgent: r.user_agent,
      reason: r.reason,
      metadata: (r.metadata ?? null) as AuditRecord['metadata'],
      prevHash: r.prev_hash,
      hash: r.hash,
    });
    return { items: page.map(toRecord), nextBefore: rows.length > query.limit ? String(page[page.length - 1].id) : null };
  }

  /** Revérifie toute la chaîne. Renvoie l'identifiant de la première ligne altérée, ou `null` si tout est intact. */
  async verifyChain(): Promise<AuditChainStatus> {
    const rows = await this.sql.query<Row>('SELECT * FROM audit_log ORDER BY id');
    let prev = GENESIS;
    for (const r of rows) {
      if (r.prev_hash !== prev || r.hash !== computeHash(prev, { ...r, occurredAt: requiredInstantFromDb(r.occurred_at).toString() })) return { valid: false, brokenAtId: String(r.id), checked: rows.length };
      prev = r.hash;
    }
    return { valid: true, brokenAtId: null, checked: rows.length };
  }
}

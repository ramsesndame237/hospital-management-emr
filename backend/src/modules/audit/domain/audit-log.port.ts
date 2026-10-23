export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';

/**
 * Entrée du journal d'audit. Ne contient jamais de donnée de santé ni de secret :
 * seulement qui a fait quoi, sur quelle ressource, depuis où, avec quel résultat.
 */
export interface AuditEntry {
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly actorId?: string | null;
  readonly actorUsername?: string | null;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: Date;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export const AUDIT_LOG = Symbol('AUDIT_LOG');

import { Instant } from '../../../shared-kernel/temporal';

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
  readonly occurredAt: Instant;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export const AUDIT_LOG = Symbol('AUDIT_LOG');

/** Entrée du journal telle qu'elle est relue, avec son empreinte et celle de la précédente (chaîne de hachage). */
export interface AuditRecord {
  readonly id: string;
  readonly occurredAt: Instant;
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly actorId: string | null;
  readonly actorUsername: string | null;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>> | null;
  readonly prevHash: string;
  readonly hash: string;
}

export interface AuditQuery {
  /** Action exacte (p. ex. `staff.member.depart`). */
  readonly action?: string;
  /** Début d'action (p. ex. `staff.` pour tout le module Personnel). */
  readonly actionPrefix?: string;
  readonly actorId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly outcome?: AuditOutcome;
  /** Bornes de date, incluses. */
  readonly from?: Instant;
  readonly to?: Instant;
  /** Curseur : seules les entrées d'identifiant strictement inférieur sont renvoyées (le journal grossit, la pagination par décalage dériverait). */
  readonly before?: string;
  readonly limit: number;
}

export interface AuditPage {
  /** Plus récentes d'abord. */
  readonly items: AuditRecord[];
  /** À passer comme `before` pour la page suivante ; `null` à la fin du journal. */
  readonly nextBefore: string | null;
}

export interface AuditChainStatus {
  readonly valid: boolean;
  readonly brokenAtId: string | null;
  readonly checked: number;
}

/** Lecture du journal d'audit : recherche et vérification d'intégrité. Aucune écriture, aucune suppression, jamais. */
export interface AuditReader {
  search(query: AuditQuery): Promise<AuditPage>;
  verifyChain(): Promise<AuditChainStatus>;
}

export const AUDIT_READER = Symbol('AUDIT_READER');

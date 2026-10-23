import { AuditLog } from '../../../audit/domain/audit-log.port';
import { safeEqual, sha256 } from '../../../../shared-kernel/crypto';
import { Clock } from '../../../../shared-kernel/ports';
import { Temporal } from '../../../../shared-kernel/temporal';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { AccessPolicy } from '../../domain/role';
import { RefreshSessionStore, RoleRepository, UserRepository } from '../../domain/ports';
import { UserId } from '../../domain/value-objects/user-id';
import { ClientContext, SessionIssuer, TokenPair } from '../session-issuer';

export const SESSION_INVALID = new DomainError('SESSION_INVALID', 'Session expirée ou invalide. Veuillez vous reconnecter.');

/**
 * Échange un jeton de rafraîchissement contre une nouvelle paire (rotation à usage unique).
 * Un jeton déjà consommé qui revient est la signature d'un vol : toute la famille de sessions est révoquée.
 * La portée est recalculée à chaque rotation : une fois mot de passe changé et MFA inscrite, le jeton `setup` devient `full`.
 */
export class RefreshSessionUseCase {
  constructor(
    private readonly store: RefreshSessionStore,
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly sessions: SessionIssuer,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string, ctx: ClientContext): Promise<Result<TokenPair>> {
    const now = this.clock.now();
    const [id, secret, ...rest] = (refreshToken ?? '').split('.');
    if (!id || !secret || rest.length > 0) return err(SESSION_INVALID);

    const found = await this.store.find(id);
    if (!found) return err(SESSION_INVALID);
    const { session, used } = found;

    if (!safeEqual(session.secretHash, sha256(secret))) return err(SESSION_INVALID);

    if (used || !(await this.store.markUsed(id))) {
      await this.store.revokeFamily(session.familyId);
      await this.audit.record({
        action: 'auth.refresh',
        outcome: 'DENIED',
        actorId: session.userId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        reason: 'refresh-token-reuse',
        occurredAt: now,
      });
      return err(SESSION_INVALID);
    }
    if (Temporal.Instant.compare(session.expiresAt, now) <= 0) return err(SESSION_INVALID);

    const userId = UserId.create(session.userId);
    const user = userId.ok ? await this.users.findById(userId.value) : null;
    if (!user || !user.canAuthenticate(now)) {
      await this.store.revokeFamily(session.familyId);
      return err(SESSION_INVALID);
    }

    const roles = await this.roles.findByCodes(user.roles);
    const setupNeeded = user.mustChangePassword || (AccessPolicy.requiresMfa(roles) && !user.hasMfa);
    const tokens = await this.sessions.open(user, setupNeeded ? 'setup' : 'full', ctx, session.familyId);
    await this.audit.record({
      action: 'auth.refresh',
      outcome: 'SUCCESS',
      actorId: user.id.value,
      actorUsername: user.username.value,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      occurredAt: now,
    });
    return ok(tokens);
  }
}

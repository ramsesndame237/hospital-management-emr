import { AuditLog } from '../../../audit/domain/audit-log.port';
import { safeEqual, sha256 } from '../../../../shared-kernel/crypto';
import { Clock } from '../../../../shared-kernel/ports';
import { RefreshSessionStore } from '../../domain/ports';
import { ClientContext } from '../session-issuer';

/** Termine la session : révoque toute la famille de jetons (idempotent, ne révèle rien si le jeton est inconnu). */
export class LogoutUseCase {
  constructor(
    private readonly store: RefreshSessionStore,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string | undefined, ctx: ClientContext): Promise<void> {
    const [id, secret] = (refreshToken ?? '').split('.');
    if (!id || !secret) return;
    const found = await this.store.find(id);
    if (!found || !safeEqual(found.session.secretHash, sha256(secret))) return;
    await this.store.revokeFamily(found.session.familyId);
    await this.audit.record({
      action: 'auth.logout',
      outcome: 'SUCCESS',
      actorId: found.session.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      occurredAt: this.clock.now(),
    });
  }
}

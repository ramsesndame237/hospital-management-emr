import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import {
  BreachedPasswordChecker,
  LegacyPasswordVerifier,
  PasswordHasher,
  RefreshSessionStore,
  UserRepository,
} from '../../domain/ports';
import { PlainPassword } from '../../domain/value-objects/plain-password';
import { UserId } from '../../domain/value-objects/user-id';
import { ClientContext, SessionIssuer, TokenPair } from '../session-issuer';
import { PermissionResolver } from '../permission-resolver';

/** Distinct de INVALID_CREDENTIALS (401) : l'utilisateur est bien connecté, c'est sa saisie qui est fausse (422). */
const CURRENT_INVALID = new DomainError('CURRENT_PASSWORD_INVALID', 'Le mot de passe actuel est incorrect.');
const BREACHED = new DomainError('PASSWORD_BREACHED', 'Ce mot de passe figure dans une liste de mots de passe compromis. Choisissez-en un autre.');
const SAME = new DomainError('PASSWORD_UNCHANGED', "Le nouveau mot de passe doit différer de l'ancien.");

/**
 * Changement de mot de passe : exige l'ancien, applique la politique NIST (longueur, valeurs triviales, compromis connus),
 * puis révoque toutes les sessions existantes et en ouvre une nouvelle.
 */
export class ChangePasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly legacy: LegacyPasswordVerifier,
    private readonly breached: BreachedPasswordChecker,
    private readonly store: RefreshSessionStore,
    private readonly sessions: SessionIssuer,
    private readonly resolver: PermissionResolver,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ctx: ClientContext,
  ): Promise<Result<TokenPair>> {
    const id = UserId.create(userId);
    const user = id.ok ? await this.users.findById(id.value) : null;
    if (!user) return err(CURRENT_INVALID);

    const current = PlainPassword.forVerification(currentPassword);
    if (!current.ok) return err(CURRENT_INVALID);
    const valid =
      user.passwordHash.scheme === 'legacy-3des'
        ? this.legacy.verify(user.passwordHash, current.value)
        : await this.hasher.verify(user.passwordHash, current.value);
    if (!valid) {
      await this.audit.record({
        action: 'auth.password.change',
        outcome: 'FAILURE',
        actorId: user.id.value,
        actorUsername: user.username.value,
        ip: ctx.ip,
        reason: 'bad-current-password',
        occurredAt: this.clock.now(),
      });
      return err(CURRENT_INVALID);
    }

    const next = PlainPassword.create(newPassword, { username: user.username.value, email: user.email.value });
    if (!next.ok) return err(next.error);
    if (next.value.reveal() === current.value.reveal()) return err(SAME);
    if (await this.breached.isBreached(next.value)) return err(BREACHED);

    const now = this.clock.now();
    user.changePassword(await this.hasher.hash(next.value), now);
    await this.users.save(user);
    await this.store.revokeAllForUser(user.id.value);
    await this.resolver.invalidate(user.id.value);
    await this.audit.record({
      action: 'auth.password.change',
      outcome: 'SUCCESS',
      actorId: user.id.value,
      actorUsername: user.username.value,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      occurredAt: now,
    });
    // Portée recalculée : `setup` seulement s'il reste l'inscription MFA à faire.
    const authz = await this.resolver.authorizationOf(user.id.value);
    const mfaPending = (authz?.requiresMfa ?? false) && !user.hasMfa;
    return ok(await this.sessions.open(user, mfaPending ? 'setup' : 'full', ctx));
  }
}

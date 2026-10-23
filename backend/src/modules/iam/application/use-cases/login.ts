import { AuditLog } from '../../../audit/domain/audit-log.port';
import { sha256 } from '../../../../shared-kernel/crypto';
import { Clock } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { AccessPolicy } from '../../domain/role';
import {
  LegacyPasswordVerifier,
  PasswordHasher,
  RoleRepository,
  SecretCipher,
  TotpService,
  UserRepository,
} from '../../domain/ports';
import { LockoutPolicy, User } from '../../domain/user';
import { PlainPassword } from '../../domain/value-objects/plain-password';
import { Username } from '../../domain/value-objects/username';
import { ClientContext, SessionIssuer, TokenPair } from '../session-issuer';

export interface LoginInput extends ClientContext {
  readonly username: string;
  readonly password: string;
  readonly totpCode?: string;
  readonly recoveryCode?: string;
}

export type LoginOutcome =
  | {
      kind: 'authenticated';
      tokens: TokenPair;
      /** Le compte doit encore changer son mot de passe et/ou inscrire la MFA : le jeton est alors restreint (`setup`). */
      mustChangePassword: boolean;
      mfaEnrollmentRequired: boolean;
    }
  | { kind: 'mfa_required' };

/** Message unique pour toute cause d'échec d'identification : on ne révèle pas si le compte existe, est verrouillé ou désactivé. */
export const INVALID_CREDENTIALS = new DomainError('INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.');
export const MFA_CODE_INVALID = new DomainError('MFA_CODE_INVALID', 'Code de vérification incorrect.');

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly hasher: PasswordHasher,
    private readonly legacy: LegacyPasswordVerifier,
    private readonly totp: TotpService,
    private readonly cipher: SecretCipher,
    private readonly sessions: SessionIssuer,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
    private readonly lockout: LockoutPolicy = new LockoutPolicy(),
  ) {}

  async execute(input: LoginInput): Promise<Result<LoginOutcome>> {
    const now = this.clock.now();
    const username = Username.create(input.username);
    const password = PlainPassword.forVerification(input.password);
    const user = username.ok ? await this.users.findByUsername(username.value) : null;

    if (!user || !password.ok) {
      if (password.ok) await this.hasher.equalizeTiming(password.value);
      await this.fail(input, now, 'unknown-user', null);
      return err(INVALID_CREDENTIALS);
    }

    if (!user.canAuthenticate(now)) {
      await this.hasher.equalizeTiming(password.value);
      await this.fail(input, now, user.isActive ? 'locked' : 'disabled', user);
      return err(INVALID_CREDENTIALS);
    }

    const passwordOk = await this.verifyPassword(user, password.value);
    if (!passwordOk) {
      user.recordFailedLogin(now, this.lockout);
      await this.users.save(user);
      await this.fail(input, now, 'bad-password', user);
      return err(INVALID_CREDENTIALS);
    }

    if (user.hasMfa) {
      if (!input.totpCode && !input.recoveryCode) return ok({ kind: 'mfa_required' });
      const secondFactor = this.checkSecondFactor(user, input);
      if (!secondFactor) {
        user.recordFailedLogin(now, this.lockout);
        await this.users.save(user);
        await this.fail(input, now, 'bad-mfa-code', user);
        return err(MFA_CODE_INVALID);
      }
    }

    // Migration transparente : tout mot de passe hérité (3DES) ou aux paramètres périmés est ré-haché maintenant.
    if (user.passwordHash.scheme === 'legacy-3des' || this.hasher.needsRehash(user.passwordHash)) {
      const upgraded = await this.hasher.hash(password.value);
      user.upgradePasswordHash(upgraded);
    }
    user.recordSuccessfulLogin(now);
    await this.users.save(user);

    const roles = await this.roles.findByCodes(user.roles);
    const mfaEnrollmentRequired = AccessPolicy.requiresMfa(roles) && !user.hasMfa;
    const setup = user.mustChangePassword || mfaEnrollmentRequired;
    const tokens = await this.sessions.open(user, setup ? 'setup' : 'full', input);

    await this.audit.record({
      action: 'auth.login',
      outcome: 'SUCCESS',
      actorId: user.id.value,
      actorUsername: user.username.value,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: { scope: tokens.scope },
      occurredAt: now,
    });
    return ok({ kind: 'authenticated', tokens, mustChangePassword: user.mustChangePassword, mfaEnrollmentRequired });
  }

  private verifyPassword(user: User, password: PlainPassword): Promise<boolean> | boolean {
    return user.passwordHash.scheme === 'legacy-3des'
      ? this.legacy.verify(user.passwordHash, password)
      : this.hasher.verify(user.passwordHash, password);
  }

  /** TOTP, ou à défaut un code de récupération (à usage unique). */
  private checkSecondFactor(user: User, input: LoginInput): boolean {
    if (input.totpCode && user.mfaSecret) {
      return this.totp.verify(this.cipher.decrypt(user.mfaSecret), input.totpCode.replace(/\s/g, ''));
    }
    if (input.recoveryCode) return user.consumeRecoveryCode(sha256(input.recoveryCode.trim().toUpperCase()));
    return false;
  }

  private fail(input: LoginInput, now: Date, reason: string, user: User | null): Promise<void> {
    return this.audit.record({
      action: 'auth.login',
      outcome: reason === 'locked' || reason === 'disabled' ? 'DENIED' : 'FAILURE',
      actorId: user?.id.value ?? null,
      actorUsername: user?.username.value ?? null,
      ip: input.ip,
      userAgent: input.userAgent,
      reason,
      occurredAt: now,
    });
  }
}

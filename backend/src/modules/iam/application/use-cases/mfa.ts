import { AuditLog } from '../../../audit/domain/audit-log.port';
import { randomRecoveryCode, sha256 } from '../../../../shared-kernel/crypto';
import { Clock } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { SecretCipher, TotpService, UserRepository } from '../../domain/ports';
import { TotpCode } from '../../domain/value-objects/totp-code';
import { UserId } from '../../domain/value-objects/user-id';
import { MFA_CODE_INVALID } from './login';

const ISSUER = 'Sanjeevani EMR';
const RECOVERY_CODES = 10;
const NOT_FOUND = new DomainError('USER_NOT_FOUND', 'Utilisateur introuvable.');
const ALREADY = new DomainError('MFA_ALREADY_ENABLED', "L'authentification à deux facteurs est déjà activée.");
const NOT_STARTED = new DomainError('MFA_NOT_STARTED', "Aucune inscription en cours : démarrez d'abord l'inscription.");

export interface MfaEnrollment {
  /** URI `otpauth://` à afficher en QR code. */
  readonly keyUri: string;
  /** Secret en clair pour la saisie manuelle ; montré une seule fois. */
  readonly secret: string;
}

/** Étape 1 : génère un secret TOTP (chiffré au repos) en attente de confirmation. */
export class BeginMfaEnrollmentUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly totp: TotpService,
    private readonly cipher: SecretCipher,
  ) {}

  async execute(userId: string): Promise<Result<MfaEnrollment>> {
    const id = UserId.create(userId);
    const user = id.ok ? await this.users.findById(id.value) : null;
    if (!user) return err(NOT_FOUND);
    if (user.hasMfa) return err(ALREADY);
    const secret = this.totp.generateSecret();
    user.beginMfaEnrollment(this.cipher.encrypt(secret));
    await this.users.save(user);
    return ok({ keyUri: this.totp.keyUri(secret, user.email.value, ISSUER), secret });
  }
}

/** Étape 2 : un premier code valide prouve que l'application d'authentification est bien configurée ; émet les codes de secours. */
export class ActivateMfaUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly totp: TotpService,
    private readonly cipher: SecretCipher,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  /** Renvoie les codes de récupération en clair, une seule fois (seuls leurs hachages sont conservés). */
  async execute(userId: string, rawCode: string): Promise<Result<string[]>> {
    const id = UserId.create(userId);
    const user = id.ok ? await this.users.findById(id.value) : null;
    if (!user) return err(NOT_FOUND);
    if (!user.pendingMfaSecret) return err(NOT_STARTED);
    const code = TotpCode.create(rawCode);
    if (!code.ok) return err(code.error);
    if (!this.totp.verify(this.cipher.decrypt(user.pendingMfaSecret), code.value.value)) return err(MFA_CODE_INVALID);

    const codes = Array.from({ length: RECOVERY_CODES }, randomRecoveryCode);
    user.confirmMfaEnrollment(codes.map((c) => sha256(c)));
    await this.users.save(user);
    await this.audit.record({
      action: 'auth.mfa.enabled',
      outcome: 'SUCCESS',
      actorId: user.id.value,
      actorUsername: user.username.value,
      occurredAt: this.clock.now(),
    });
    return ok(codes);
  }
}

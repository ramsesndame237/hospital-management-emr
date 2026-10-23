import { AggregateRoot } from '../../../shared-kernel/domain-event';
import { Email } from './value-objects/email';
import { PasswordHash } from './value-objects/password-hash';
import { RoleCode } from './value-objects/role-code';
import { UserId } from './value-objects/user-id';
import { Username } from './value-objects/username';

/**
 * Verrouillage progressif après échecs consécutifs : 5 échecs → 15 min, puis le délai double à chaque échec
 * supplémentaire, plafonné à 24 h (OWASP ASVS 2.2, NIST 800-63B §5.2.2). Formule sans état : pas de compteur de verrouillages.
 */
export class LockoutPolicy {
  constructor(
    readonly maxAttempts = 5,
    readonly baseMs = 15 * 60_000,
    readonly maxMs = 24 * 3_600_000,
  ) {}

  lockDurationMs(failedAttempts: number): number {
    if (failedAttempts < this.maxAttempts) return 0;
    return Math.min(this.baseMs * 2 ** (failedAttempts - this.maxAttempts), this.maxMs);
  }
}

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface UserState {
  id: UserId;
  username: Username;
  email: Email;
  passwordHash: PasswordHash;
  roles: RoleCode[];
  status: UserStatus;
  failedAttempts: number;
  lockedUntil: Date | null;
  mustChangePassword: boolean;
  /** Secret TOTP chiffré (le domaine ne connaît pas la clé). `null` tant que l'inscription MFA n'est pas confirmée. */
  mfaSecret: string | null;
  /** Secret en cours d'inscription, non encore confirmé par un premier code valide. */
  pendingMfaSecret: string | null;
  recoveryCodeHashes: string[];
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  /** Identifiant du compte dans l'ancien backend .NET (`rbac_user.user_id`), pour la reprise des données. */
  legacyRbacUserId: number | null;
}

/** Agrégat Utilisateur : toutes les transitions d'état passent par des comportements nommés, jamais par des setters. */
export class User extends AggregateRoot {
  private constructor(private s: UserState) {
    super();
  }

  static register(input: {
    id: UserId;
    username: Username;
    email: Email;
    passwordHash: PasswordHash;
    roles: RoleCode[];
    now: Date;
    mustChangePassword?: boolean;
    legacyRbacUserId?: number | null;
  }): User {
    return new User({
      id: input.id,
      username: input.username,
      email: input.email,
      passwordHash: input.passwordHash,
      roles: dedupe(input.roles),
      status: 'ACTIVE',
      failedAttempts: 0,
      lockedUntil: null,
      mustChangePassword: input.mustChangePassword ?? true,
      mfaSecret: null,
      pendingMfaSecret: null,
      recoveryCodeHashes: [],
      passwordChangedAt: null,
      lastLoginAt: null,
      createdAt: input.now,
      legacyRbacUserId: input.legacyRbacUserId ?? null,
    });
  }

  static rehydrate(state: UserState): User {
    return new User({ ...state, roles: [...state.roles], recoveryCodeHashes: [...state.recoveryCodeHashes] });
  }

  snapshot(): Readonly<UserState> {
    return { ...this.s, roles: [...this.s.roles], recoveryCodeHashes: [...this.s.recoveryCodeHashes] };
  }

  get id(): UserId { return this.s.id; }
  get username(): Username { return this.s.username; }
  get email(): Email { return this.s.email; }
  get passwordHash(): PasswordHash { return this.s.passwordHash; }
  get roles(): readonly RoleCode[] { return this.s.roles; }
  get isActive(): boolean { return this.s.status === 'ACTIVE'; }
  get mustChangePassword(): boolean { return this.s.mustChangePassword; }
  get hasMfa(): boolean { return this.s.mfaSecret !== null; }
  get mfaSecret(): string | null { return this.s.mfaSecret; }
  get pendingMfaSecret(): string | null { return this.s.pendingMfaSecret; }
  get lockedUntil(): Date | null { return this.s.lockedUntil; }

  isLocked(now: Date): boolean {
    return this.s.lockedUntil !== null && this.s.lockedUntil.getTime() > now.getTime();
  }

  /** Un compte désactivé ou verrouillé ne peut pas s'authentifier. */
  canAuthenticate(now: Date): boolean {
    return this.isActive && !this.isLocked(now);
  }

  recordFailedLogin(now: Date, policy: LockoutPolicy = new LockoutPolicy()): void {
    this.s.failedAttempts += 1;
    const ms = policy.lockDurationMs(this.s.failedAttempts);
    this.s.lockedUntil = ms > 0 ? new Date(now.getTime() + ms) : null;
  }

  recordSuccessfulLogin(now: Date): void {
    this.s.failedAttempts = 0;
    this.s.lockedUntil = null;
    this.s.lastLoginAt = now;
  }

  /** Changement volontaire de mot de passe : lève l'obligation de changement. */
  changePassword(hash: PasswordHash, now: Date): void {
    this.s.passwordHash = hash;
    this.s.mustChangePassword = false;
    this.s.passwordChangedAt = now;
    this.s.failedAttempts = 0;
    this.s.lockedUntil = null;
  }

  /** Remplace l'empreinte par un schéma plus fort sans rien changer d'autre (migration transparente des comptes hérités). */
  upgradePasswordHash(hash: PasswordHash): void {
    this.s.passwordHash = hash;
  }

  requirePasswordChange(): void {
    this.s.mustChangePassword = true;
  }

  beginMfaEnrollment(encryptedSecret: string): void {
    this.s.pendingMfaSecret = encryptedSecret;
  }

  confirmMfaEnrollment(recoveryCodeHashes: string[]): void {
    if (this.s.pendingMfaSecret === null) throw new Error('Aucune inscription MFA en cours.');
    this.s.mfaSecret = this.s.pendingMfaSecret;
    this.s.pendingMfaSecret = null;
    this.s.recoveryCodeHashes = [...recoveryCodeHashes];
  }

  resetMfa(): void {
    this.s.mfaSecret = null;
    this.s.pendingMfaSecret = null;
    this.s.recoveryCodeHashes = [];
  }

  /** Un code de récupération n'est utilisable qu'une fois. */
  consumeRecoveryCode(hash: string): boolean {
    const i = this.s.recoveryCodeHashes.indexOf(hash);
    if (i < 0) return false;
    this.s.recoveryCodeHashes.splice(i, 1);
    return true;
  }

  assignRoles(roles: RoleCode[]): void {
    this.s.roles = dedupe(roles);
  }

  disable(): void {
    this.s.status = 'DISABLED';
  }

  enable(): void {
    this.s.status = 'ACTIVE';
    this.s.failedAttempts = 0;
    this.s.lockedUntil = null;
  }

  unlock(): void {
    this.s.failedAttempts = 0;
    this.s.lockedUntil = null;
  }
}

function dedupe(roles: RoleCode[]): RoleCode[] {
  return [...new Map(roles.map((r) => [r.value, r])).values()];
}

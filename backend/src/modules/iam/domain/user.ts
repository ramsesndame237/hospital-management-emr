import { AggregateRoot } from '../../../shared-kernel/domain-event';
import { Duration, Instant, Temporal } from '../../../shared-kernel/temporal';
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
    readonly base: Duration = Temporal.Duration.from({ minutes: 15 }),
    readonly max: Duration = Temporal.Duration.from({ hours: 24 }),
  ) {}

  /** Durée de verrouillage après ce nombre d'échecs consécutifs, ou `null` si le seuil n'est pas atteint. */
  lockDuration(failedAttempts: number): Duration | null {
    if (failedAttempts < this.maxAttempts) return null;
    const factor = 2 ** Math.min(failedAttempts - this.maxAttempts, 20); // borne l'exposant : pas de dépassement numérique
    const ms = Math.min(this.base.total('milliseconds') * factor, this.max.total('milliseconds'));
    return Temporal.Duration.from({ milliseconds: ms });
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
  lockedUntil: Instant | null;
  mustChangePassword: boolean;
  /** Secret TOTP chiffré (le domaine ne connaît pas la clé). `null` tant que l'inscription MFA n'est pas confirmée. */
  mfaSecret: string | null;
  /** Secret en cours d'inscription, non encore confirmé par un premier code valide. */
  pendingMfaSecret: string | null;
  recoveryCodeHashes: string[];
  passwordChangedAt: Instant | null;
  lastLoginAt: Instant | null;
  createdAt: Instant;
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
    now: Instant;
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
  get lockedUntil(): Instant | null { return this.s.lockedUntil; }

  isLocked(now: Instant): boolean {
    return this.s.lockedUntil !== null && Temporal.Instant.compare(this.s.lockedUntil, now) > 0;
  }

  /** Un compte désactivé ou verrouillé ne peut pas s'authentifier. */
  canAuthenticate(now: Instant): boolean {
    return this.isActive && !this.isLocked(now);
  }

  recordFailedLogin(now: Instant, policy: LockoutPolicy = new LockoutPolicy()): void {
    this.s.failedAttempts += 1;
    const duration = policy.lockDuration(this.s.failedAttempts);
    this.s.lockedUntil = duration ? now.add(duration) : null;
  }

  recordSuccessfulLogin(now: Instant): void {
    this.s.failedAttempts = 0;
    this.s.lockedUntil = null;
    this.s.lastLoginAt = now;
  }

  /** Changement volontaire de mot de passe : lève l'obligation de changement. */
  changePassword(hash: PasswordHash, now: Instant): void {
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

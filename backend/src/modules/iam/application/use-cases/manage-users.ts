import { AuditLog } from '../../../audit/domain/audit-log.port';
import { randomPassword } from '../../../../shared-kernel/crypto';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { Instant } from '../../../../shared-kernel/temporal';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { PasswordHasher, RefreshSessionStore, RoleRepository, UserRepository } from '../../domain/ports';
import { User } from '../../domain/user';
import { Email } from '../../domain/value-objects/email';
import { PlainPassword } from '../../domain/value-objects/plain-password';
import { RoleCode } from '../../domain/value-objects/role-code';
import { UserId } from '../../domain/value-objects/user-id';
import { Username } from '../../domain/value-objects/username';
import { PermissionResolver } from '../permission-resolver';

const NOT_FOUND = new DomainError('USER_NOT_FOUND', 'Utilisateur introuvable.');
const DUPLICATE = new DomainError('USER_ALREADY_EXISTS', 'Un compte existe déjà avec cet identifiant ou cet e-mail.');
const UNKNOWN_ROLE = new DomainError('ROLE_UNKNOWN', "Un des rôles demandés n'existe pas.");

export interface UserView {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly active: boolean;
  readonly locked: boolean;
  readonly mfaEnabled: boolean;
  readonly mustChangePassword: boolean;
}

export const toUserView = (u: User, now: Instant): UserView => ({
  id: u.id.value,
  username: u.username.value,
  email: u.email.value,
  roles: u.roles.map((r) => r.value),
  active: u.isActive,
  locked: u.isLocked(now),
  mfaEnabled: u.hasMfa,
  mustChangePassword: u.mustChangePassword,
});

async function parseRoles(raw: readonly string[], repo: RoleRepository): Promise<Result<RoleCode[]>> {
  const codes: RoleCode[] = [];
  for (const r of raw) {
    const c = RoleCode.create(r);
    if (!c.ok) return err(c.error);
    codes.push(c.value);
  }
  const found = await repo.findByCodes(codes);
  return found.length === new Set(codes.map((c) => c.value)).size ? ok(codes) : err(UNKNOWN_ROLE);
}

/** Création d'un compte par un administrateur : mot de passe temporaire aléatoire, changement obligatoire à la première connexion. */
export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(
    actorId: string,
    input: { username: string; email: string; roles: readonly string[] },
  ): Promise<Result<{ user: UserView; temporaryPassword: string }>> {
    const username = Username.create(input.username);
    if (!username.ok) return err(username.error);
    const email = Email.create(input.email);
    if (!email.ok) return err(email.error);
    const roles = await parseRoles(input.roles, this.roles);
    if (!roles.ok) return err(roles.error);
    if (await this.users.existsByUsernameOrEmail(username.value, email.value)) return err(DUPLICATE);

    const id = UserId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const temporary = randomPassword();
    const password = PlainPassword.forVerification(temporary);
    if (!password.ok) return err(password.error);
    const now = this.clock.now();
    const user = User.register({
      id: id.value,
      username: username.value,
      email: email.value,
      passwordHash: await this.hasher.hash(password.value),
      roles: roles.value,
      now,
      mustChangePassword: true,
    });
    await this.users.save(user);
    await this.audit.record({
      action: 'iam.user.create',
      outcome: 'SUCCESS',
      actorId,
      resourceType: 'user',
      resourceId: user.id.value,
      metadata: { roles: roles.value.map((r) => r.value).join(',') },
      occurredAt: now,
    });
    return ok({ user: toUserView(user, now), temporaryPassword: temporary });
  }
}

/** Opérations d'administration d'un compte existant. Toute modification de droits invalide le cache d'autorisation. */
export class ManageUserUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly store: RefreshSessionStore,
    private readonly resolver: PermissionResolver,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async assignRoles(actorId: string, userId: string, roleCodes: readonly string[]): Promise<Result<UserView>> {
    const roles = await parseRoles(roleCodes, this.roles);
    if (!roles.ok) return err(roles.error);
    return this.mutate(actorId, userId, 'iam.user.roles', (u) => u.assignRoles(roles.value), true, {
      roles: roles.value.map((r) => r.value).join(','),
    });
  }

  /** Désactiver un compte coupe aussi toutes ses sessions : l'effet est immédiat. */
  setActive(actorId: string, userId: string, active: boolean): Promise<Result<UserView>> {
    return this.mutate(actorId, userId, active ? 'iam.user.enable' : 'iam.user.disable', (u) => (active ? u.enable() : u.disable()), !active);
  }

  unlock(actorId: string, userId: string): Promise<Result<UserView>> {
    return this.mutate(actorId, userId, 'iam.user.unlock', (u) => u.unlock(), false);
  }

  /** Perte de téléphone : l'administrateur efface la MFA ; l'utilisateur devra la réinscrire à la prochaine connexion. */
  resetMfa(actorId: string, userId: string): Promise<Result<UserView>> {
    return this.mutate(actorId, userId, 'iam.user.mfa-reset', (u) => u.resetMfa(), true);
  }

  private async mutate(
    actorId: string,
    userId: string,
    action: string,
    apply: (u: User) => void,
    revokeSessions: boolean,
    metadata?: Record<string, string>,
  ): Promise<Result<UserView>> {
    const id = UserId.create(userId);
    const user = id.ok ? await this.users.findById(id.value) : null;
    if (!user) return err(NOT_FOUND);
    apply(user);
    await this.users.save(user);
    if (revokeSessions) await this.store.revokeAllForUser(user.id.value);
    await this.resolver.invalidate(user.id.value);
    const now = this.clock.now();
    await this.audit.record({
      action,
      outcome: 'SUCCESS',
      actorId,
      resourceType: 'user',
      resourceId: user.id.value,
      metadata,
      occurredAt: now,
    });
    return ok(toUserView(user, now));
  }
}

import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { TokenScope, UserRepository } from '../../domain/ports';
import { UserId } from '../../domain/value-objects/user-id';
import { PermissionResolver } from '../permission-resolver';

export interface CurrentUserView {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly roles: readonly string[];
  /** Pilote l'interface (menus, boutons) ; l'API revérifie toujours côté serveur. */
  readonly permissions: readonly string[];
  readonly mfaEnabled: boolean;
  readonly mfaRequired: boolean;
  readonly mustChangePassword: boolean;
  readonly scope: TokenScope;
}

const NOT_FOUND = new DomainError('USER_NOT_FOUND', 'Utilisateur introuvable.');

export class GetCurrentUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly resolver: PermissionResolver,
  ) {}

  async execute(userId: string, scope: TokenScope): Promise<Result<CurrentUserView>> {
    const id = UserId.create(userId);
    const user = id.ok ? await this.users.findById(id.value) : null;
    const authz = user ? await this.resolver.authorizationOf(userId) : null;
    if (!user || !authz) return err(NOT_FOUND);
    return ok({
      id: user.id.value,
      username: user.username.value,
      email: user.email.value,
      roles: authz.roles,
      permissions: authz.permissions,
      mfaEnabled: user.hasMfa,
      mfaRequired: authz.requiresMfa,
      mustChangePassword: user.mustChangePassword,
      scope,
    });
  }
}

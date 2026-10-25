import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { DepartmentDirectory, RoleRepository, UserRepository } from '../../domain/ports';
import { UserId } from '../../domain/value-objects/user-id';
import { AccessContext, AccessDecider, AccessDecision } from '../access-decider';
import { PermissionResolver } from '../permission-resolver';

const NOT_FOUND = new DomainError('USER_NOT_FOUND', 'Utilisateur introuvable.');

export interface UserAccessView {
  readonly userId: string;
  readonly username: string;
  readonly active: boolean;
  readonly roles: readonly { readonly code: string; readonly name: string; readonly requiresMfa: boolean }[];
  /** Permissions effectives (`ressource:action:portée`), union de celles des rôles. */
  readonly permissions: readonly string[];
  /** Services auxquels le compte est rattaché aujourd'hui (portée `department`). */
  readonly departments: readonly string[];
}

/**
 * « Que peut faire ce compte, et pourquoi ? » — pour l'administrateur et l'auditeur, notamment en cas de litige : droits
 * effectifs aujourd'hui, et explication d'une décision d'accès précise sans rien exécuter.
 */
export class GetUserAccessUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly resolver: PermissionResolver,
    private readonly decider: AccessDecider,
    private readonly departments: DepartmentDirectory | null,
  ) {}

  async execute(userId: string): Promise<Result<UserAccessView>> {
    const id = UserId.create(userId);
    const user = id.ok ? await this.users.findById(id.value) : null;
    const authz = user ? await this.resolver.authorizationOf(userId) : null;
    if (!user || !authz) return err(NOT_FOUND);
    const roles = await this.roles.findByCodes(user.roles);
    return ok({
      userId: user.id.value,
      username: user.username.value,
      active: authz.active,
      roles: roles.map((r) => ({ code: r.code.value, name: r.name, requiresMfa: r.requiresMfa })),
      permissions: authz.permissions,
      departments: this.departments ? await this.departments.departmentsOf(userId) : [],
    });
  }

  /** Décision d'accès « à blanc » : même calcul que celui des cas d'usage, sans effet. */
  async explain(userId: string, permission: string, context: AccessContext): Promise<Result<AccessDecision>> {
    const id = UserId.create(userId);
    if (!id.ok || !(await this.users.findById(id.value))) return err(NOT_FOUND);
    return this.decider.decide(userId, permission, context);
  }
}

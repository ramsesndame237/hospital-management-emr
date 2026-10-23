import { CachePort, readThrough } from '../../cache/cache.port';
import { AccessPolicy } from '../domain/role';
import { RoleRepository, UserRepository } from '../domain/ports';
import { Permission } from '../domain/value-objects/permission';
import { UserId } from '../domain/value-objects/user-id';

export interface Authorization {
  readonly active: boolean;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly requiresMfa: boolean;
}

const TTL_SECONDS = 60;
export const userTag = (userId: string): string => `iam:user:${userId}`;

/**
 * Résout « que peut faire cet utilisateur maintenant ? » à chaque requête. Mis en cache 60 s par utilisateur,
 * invalidé immédiatement par étiquette dès qu'un rôle change ou qu'un compte est désactivé : la révocation est donc
 * effective sans attendre l'expiration du jeton d'accès. Ne contient aucune donnée de santé.
 */
export class PermissionResolver {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly cache: CachePort,
  ) {}

  async authorizationOf(userId: string): Promise<Authorization | null> {
    return readThrough(this.cache, `v1:iam:authz:${userId}`, TTL_SECONDS, [userTag(userId)], async () => {
      const id = UserId.create(userId);
      if (!id.ok) return null;
      const user = await this.users.findById(id.value);
      if (!user) return null;
      const roles = await this.roles.findByCodes(user.roles);
      return {
        active: user.isActive,
        roles: roles.map((r) => r.code.value),
        permissions: AccessPolicy.permissionsOf(roles).map((p) => p.value),
        requiresMfa: AccessPolicy.requiresMfa(roles),
      } satisfies Authorization;
    });
  }

  async can(userId: string, required: Permission): Promise<boolean> {
    const authz = await this.authorizationOf(userId);
    if (!authz || !authz.active) return false;
    const granted = authz.permissions.map((p) => Permission.create(p)).flatMap((r) => (r.ok ? [r.value] : []));
    return AccessPolicy.can(granted, required);
  }

  invalidate(userId: string): Promise<void> {
    return this.cache.deleteByTag(userTag(userId));
  }
}

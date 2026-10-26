import { Permission } from './value-objects/permission';
import { RoleCode } from './value-objects/role-code';

/** Rôle : un nom, un ensemble de permissions et l'exigence (ou non) d'une authentification à deux facteurs. */
export class Role {
  constructor(
    readonly code: RoleCode,
    readonly name: string,
    readonly permissions: readonly Permission[],
    readonly requiresMfa: boolean,
    /** Les rôles système ne sont ni modifiables ni supprimables depuis l'interface. */
    readonly isSystem: boolean,
  ) {}
}

/** Service de domaine : calcule ce qu'un ensemble de rôles autorise. */
export const AccessPolicy = {
  permissionsOf(roles: readonly Role[]): Permission[] {
    const unique = new Map<string, Permission>();
    for (const role of roles) for (const p of role.permissions) unique.set(p.value, p);
    return [...unique.values()];
  },

  can(granted: readonly Permission[], required: Permission): boolean {
    return granted.some((p) => p.implies(required));
  },

  requiresMfa(roles: readonly Role[]): boolean {
    return roles.some((r) => r.requiresMfa);
  },
};

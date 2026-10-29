/** Compte tel que l'administrateur le voit (jamais de mot de passe ni de secret). */
export interface ManagedUser {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly active: boolean;
  /** Verrouillé temporairement après des échecs de connexion. */
  readonly locked: boolean;
  readonly mfaEnabled: boolean;
  /** Mot de passe provisoire : le compte n'a pas encore été activé par son titulaire. */
  readonly mustChangePassword: boolean;
}

export interface UserPage {
  readonly items: readonly ManagedUser[];
  readonly total: number;
}

export interface CreateUserInput {
  readonly username: string;
  readonly email: string;
  readonly roles: readonly string[];
}

/** Réponse à la création : le mot de passe provisoire n'est renvoyé QU'UNE FOIS. */
export interface CreatedUser {
  readonly user: ManagedUser;
  readonly temporaryPassword: string;
}

export interface RoleInfo {
  readonly code: string;
  readonly name: string;
  readonly requiresMfa: boolean;
  /** Rôle fourni par le système : non modifiable depuis l'interface. */
  readonly isSystem: boolean;
  /** `ressource:action:portée` (portée : `own` < `department` < `all`). */
  readonly permissions: readonly string[];
}

export interface AccessRole {
  readonly code: string;
  readonly name: string;
  readonly requiresMfa: boolean;
}

/** Ce qu'un compte peut faire aujourd'hui : rôles, permissions effectives et services de rattachement. */
export interface UserAccess {
  readonly userId: string;
  readonly username: string;
  readonly active: boolean;
  readonly roles: readonly AccessRole[];
  readonly permissions: readonly string[];
  readonly departments: readonly string[];
}

export interface PermissionGroup {
  readonly resource: string;
  /** Actions autorisées sur la ressource, avec leur portée (`read (service)`), triées. */
  readonly grants: readonly { readonly action: string; readonly scope: 'own' | 'department' | 'all' }[];
}

const SCOPE_ORDER = ['own', 'department', 'all'] as const;

/**
 * Regroupe des permissions `ressource:action[:portée]` par ressource, pour les lire d'un coup d'œil. Sans portée, la
 * permission porte sur tout (`all`) ; une permission mal formée est ignorée.
 */
export function groupPermissions(permissions: readonly string[]): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup['grants'][number][]>();
  for (const raw of permissions) {
    const [resource, action, scope = 'all', ...rest] = raw.split(':');
    if (!resource || !action || rest.length > 0 || !SCOPE_ORDER.includes(scope as 'all')) continue;
    const grants = groups.get(resource) ?? [];
    grants.push({ action, scope: scope as 'all' });
    groups.set(resource, grants);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resource, grants]) => ({ resource, grants: [...grants].sort((a, b) => a.action.localeCompare(b.action) || SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope)) }));
}

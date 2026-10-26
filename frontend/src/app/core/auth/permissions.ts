/** Portées, de la plus étroite à la plus large : même règle que le backend (`Permission.implies`). */
const SCOPES = ['own', 'department', 'all'] as const;
type PermissionScope = (typeof SCOPES)[number];

interface ParsedPermission {
  readonly resource: string;
  readonly action: string;
  readonly scope: PermissionScope;
}

function parse(raw: string): ParsedPermission | null {
  const [resource, action, scope = 'all', ...rest] = raw.split(':');
  if (!resource || !action || rest.length > 0 || !SCOPES.includes(scope as PermissionScope)) return null;
  return { resource, action, scope: scope as PermissionScope };
}

/**
 * Vrai si l'une des permissions accordées couvre `required` : même ressource et même action, portée au moins aussi large.
 * `files:read:all` couvre `files:read:own` ; l'inverse est faux. Ne sert qu'à l'affichage : l'API tranche.
 */
export function hasPermission(granted: readonly string[], required: string): boolean {
  const need = parse(required);
  if (!need) return false;
  return granted.some((g) => {
    const have = parse(g);
    return !!have && have.resource === need.resource && have.action === need.action && SCOPES.indexOf(have.scope) >= SCOPES.indexOf(need.scope);
  });
}

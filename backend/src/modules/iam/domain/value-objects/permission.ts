import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ValueObject } from '../../../../shared-kernel/value-object';

/** Portée d'une permission, de la plus étroite à la plus large. */
export const SCOPES = ['own', 'department', 'all'] as const;
export type Scope = (typeof SCOPES)[number];

const PATTERN = /^([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*):([a-z][a-z0-9-]*)(?::(own|department|all))?$/;

/**
 * Permission `ressource:action[:portée]`, p. ex. `files.clinical:read:department`.
 * Sans portée explicite, la portée est `all`. Pas de joker : le moindre privilège exige d'énumérer.
 */
export class Permission extends ValueObject<string> {
  static create(raw: string): Result<Permission> {
    const m = PATTERN.exec((raw ?? '').trim());
    if (!m) return err(new DomainError('PERMISSION_INVALID', `Permission invalide : « ${raw} ».`));
    return ok(new Permission(`${m[1]}:${m[2]}:${m[3] ?? 'all'}`));
  }

  // La valeur canonique est toujours `ressource:action:portée` : on la décompose à la demande (l'objet reste gelé).
  get resource(): string { return this.value.split(':')[0]; }
  get action(): string { return this.value.split(':')[1]; }
  get scope(): Scope { return this.value.split(':')[2] as Scope; }

  /** Vrai si cette permission accorde au moins ce que `required` demande (même ressource/action, portée ≥). */
  implies(required: Permission): boolean {
    return (
      this.resource === required.resource &&
      this.action === required.action &&
      SCOPES.indexOf(this.scope) >= SCOPES.indexOf(required.scope)
    );
  }
}

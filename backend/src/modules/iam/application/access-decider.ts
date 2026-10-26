import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { AccessPolicy } from '../domain/role';
import { DepartmentDirectory } from '../domain/ports';
import { Permission, Scope } from '../domain/value-objects/permission';
import { PermissionResolver } from './permission-resolver';

/** Ce que l'on sait de la ressource à laquelle l'utilisateur veut accéder. Une information absente ne donne jamais accès. */
export interface AccessContext {
  /** Titulaire de la ressource (p. ex. le patient d'un document personnel). */
  readonly ownerId?: string;
  /** Service (département) auquel la ressource appartient. */
  readonly departmentId?: string;
}

export type AccessDenial = 'INACTIVE' | 'NO_PERMISSION' | 'OUT_OF_SCOPE';

export interface AccessDecision {
  readonly allowed: boolean;
  /** Portée la plus large accordée à l'utilisateur pour cette action (`null` s'il n'en a aucune). */
  readonly grantedScope: Scope | null;
  /** `ALL`, `DEPARTMENT` ou `OWN` : la portée qui a permis l'accès. Sinon la cause du refus. */
  readonly reason: 'ALL' | 'DEPARTMENT' | 'OWN' | AccessDenial;
}

const INVALID_PERMISSION = (raw: string) =>
  new DomainError('PERMISSION_INVALID', `Permission invalide : « ${raw} » (attendu : ressource:action).`, { value: raw });

/**
 * « Cet utilisateur peut-il faire cette action sur CETTE ressource ? » — la décision d'accès avec portée.
 *
 * Les permissions ont une portée : `own` (ses propres ressources), `department` (celles de son service), `all`. Le garde des
 * routes ne sait vérifier que « a-t-il la permission quelque part » ; dès qu'une ressource précise est en jeu, un cas d'usage
 * appelle ce service avec le contexte de la ressource. Règles :
 * - compte inconnu ou désactivé : refus (`INACTIVE`) ; aucune permission pour cette action : refus (`NO_PERMISSION`) ;
 * - `all` : accès ; `department` : le service de la ressource doit figurer parmi ceux de l'utilisateur ; `own` : il doit
 *   en être le titulaire ;
 * - toute information manquante (ressource sans service, sans titulaire) refuse (`OUT_OF_SCOPE`) : échec fermé ;
 * - les services de l'utilisateur sont relus à chaque décision, sans cache : une affectation terminée ne donne plus rien
 *   à l'instant même.
 */
export class AccessDecider {
  constructor(
    private readonly resolver: PermissionResolver,
    private readonly departments: DepartmentDirectory | null,
  ) {}

  /**
   * « Sur quels services cet utilisateur peut-il agir ? » — pour filtrer une liste plutôt que juger une ressource. `'ALL'` avec la
   * portée « all » ; sinon ses services si la portée « department » est accordée ; sinon aucun (la portée « own » ne désigne pas
   * de service). Compte inconnu, désactivé ou sans permission : aucun service.
   */
  async visibleDepartments(userId: string, permission: string): Promise<Result<'ALL' | readonly string[]>> {
    const parts = (permission ?? '').split(':');
    const parsed = parts.length === 2 ? Permission.create(permission) : null;
    if (!parsed?.ok) return err(INVALID_PERMISSION(permission));
    const authz = await this.resolver.authorizationOf(userId);
    if (!authz || !authz.active) return ok([]);
    const granted = authz.permissions.flatMap((p) => {
      const r = Permission.create(p);
      return r.ok ? [r.value] : [];
    });
    const scopes = AccessPolicy.scopesOf(granted, parsed.value.resource, parsed.value.action);
    if (scopes.includes('all')) return ok('ALL');
    if (scopes.includes('department') && this.departments) return ok(await this.departments.departmentsOf(userId));
    return ok([]);
  }

  /** `permission` est `ressource:action` (sans portée : c'est justement ce que l'on détermine). */
  async decide(userId: string, permission: string, context: AccessContext = {}): Promise<Result<AccessDecision>> {
    const parts = (permission ?? '').split(':');
    const parsed = parts.length === 2 ? Permission.create(permission) : null;
    if (!parsed?.ok) return err(INVALID_PERMISSION(permission));

    const authz = await this.resolver.authorizationOf(userId);
    if (!authz || !authz.active) return ok({ allowed: false, grantedScope: null, reason: 'INACTIVE' });
    const granted = authz.permissions.flatMap((p) => {
      const r = Permission.create(p);
      return r.ok ? [r.value] : [];
    });
    const scopes = AccessPolicy.scopesOf(granted, parsed.value.resource, parsed.value.action);
    const widest = scopes[scopes.length - 1] ?? null;
    if (!widest) return ok({ allowed: false, grantedScope: null, reason: 'NO_PERMISSION' });
    if (scopes.includes('all')) return ok({ allowed: true, grantedScope: widest, reason: 'ALL' });

    if (scopes.includes('department') && context.departmentId && this.departments) {
      const mine = await this.departments.departmentsOf(userId);
      if (mine.includes(context.departmentId)) return ok({ allowed: true, grantedScope: widest, reason: 'DEPARTMENT' });
    }
    if (scopes.includes('own') && context.ownerId && context.ownerId === userId) return ok({ allowed: true, grantedScope: widest, reason: 'OWN' });
    return ok({ allowed: false, grantedScope: widest, reason: 'OUT_OF_SCOPE' });
  }
}

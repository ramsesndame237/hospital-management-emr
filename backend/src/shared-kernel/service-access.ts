/**
 * Droits « par service » vus par un module métier. Les permissions ont une portée (`own`, `department`, `all`) ; un module qui
 * gère des ressources rattachées à un service (rendez-vous, admissions…) ne sait ni lire les rôles ni savoir à quels services
 * appartient un utilisateur : il pose cette question, et la racine de composition y répond avec l'IAM.
 *
 * `permission` est `ressource:action` (sans portée). Dans tous les cas un compte inconnu ou désactivé n'a accès à rien.
 */
export interface ServiceAccess {
  /** Services dont l'utilisateur peut traiter les ressources : `'ALL'` (portée « all »), sinon la liste de ses services (éventuellement vide). */
  visibleServices(userId: string, permission: string): Promise<'ALL' | readonly string[]>;
  /** L'utilisateur peut-il traiter une ressource de ce service ? */
  canAccess(userId: string, permission: string, serviceId: string): Promise<boolean>;
}

export const SERVICE_ACCESS = Symbol('SERVICE_ACCESS');

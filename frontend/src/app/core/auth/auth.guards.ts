import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { hasPermission } from './permissions';
import { SessionService } from './session.service';
import { SessionStore } from './session.store';

/**
 * Les gardes protègent la NAVIGATION (confort et sobriété de l'interface), pas les données : c'est l'API qui refuse
 * réellement l'accès. Un utilisateur qui contournerait une garde ne verrait qu'un écran vide et des erreurs 401/403.
 */

/** Réservé aux sessions complètes. Retrouve d'abord une session existante (rechargement de page). */
export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const session = inject(SessionService);
  const store = inject(SessionStore);
  const router = inject(Router);

  await session.ensureRestored();
  if (store.isSignedIn()) return true;
  if (store.needsSetup()) return router.createUrlTree(['/account/setup']);
  return router.createUrlTree(['/login'], { queryParams: state.url && state.url !== '/' ? { returnUrl: state.url } : {} });
};

/** Page de connexion : inutile (et trompeuse) pour quelqu'un déjà connecté. */
export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const session = inject(SessionService);
  const store = inject(SessionStore);
  const router = inject(Router);

  await session.ensureRestored();
  if (store.isSignedIn()) return router.createUrlTree(['/']);
  if (store.needsSetup()) return router.createUrlTree(['/account/setup']);
  return true;
};

/** Finalisation de compte : uniquement pour une session restreinte (`scope: setup`). */
export const setupGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const session = inject(SessionService);
  const store = inject(SessionStore);
  const router = inject(Router);

  await session.ensureRestored();
  if (store.needsSetup()) return true;
  return router.createUrlTree([store.isSignedIn() ? '/' : '/login']);
};

/** Fabrique une garde qui exige une permission (`files:read`, `iam.users:manage`…). */
export function permissionGuard(permission: string): CanActivateFn {
  return async (): Promise<boolean | UrlTree> => {
    const store = inject(SessionStore);
    const router = inject(Router);
    await inject(SessionService).ensureRestored();
    if (!store.isSignedIn()) return router.createUrlTree(['/login']);
    return hasPermission(store.user()?.permissions ?? [], permission) ? true : router.createUrlTree(['/']);
  };
}

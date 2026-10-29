import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { hasPermission } from '../auth/permissions';
import { SessionStore } from '../auth/session.store';

/**
 * Accueil de l'administrateur système : il n'a pas de patients à suivre, son tableau de bord est l'écran « Organisation ».
 * Un profil qui cumule un rôle clinique garde l'accueil habituel. Simple confort de navigation : l'API tranche les droits.
 */
export const homeGuard: CanActivateFn = (): boolean | UrlTree => {
  const user = inject(SessionStore).user();
  const administrator = !!user?.roles.includes('SYSTEM_ADMIN') && user.roles.length === 1 && hasPermission(user.permissions, 'administration.organization:read');
  return administrator ? inject(Router).createUrlTree(['/admin/organization']) : true;
};

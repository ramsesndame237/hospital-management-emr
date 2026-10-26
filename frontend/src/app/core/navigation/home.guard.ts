import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { hasPermission } from '../auth/permissions';
import { SessionStore } from '../auth/session.store';

/** Écran d'accueil des profils qui n'ont pas de patients à suivre : le rôle, la permission qui prouve qu'il sert, et l'écran. */
const HOMES: Readonly<Record<string, { readonly permission: string; readonly route: string }>> = {
  SYSTEM_ADMIN: { permission: 'administration.organization:read', route: '/admin/organization' },
  CASHIER: { permission: 'billing.invoices:read', route: '/billing/invoices' },
};

/**
 * Accueil d'un profil administratif : l'administrateur système arrive sur « Organisation », la caisse sur ses factures (leur tableau de bord
 * de médecin n'aurait aucun sens). Un profil qui cumule plusieurs rôles garde l'accueil habituel. Simple confort de navigation : l'API tranche.
 */
export const homeGuard: CanActivateFn = (): boolean | UrlTree => {
  const user = inject(SessionStore).user();
  const home = user && user.roles.length === 1 ? HOMES[user.roles[0]] : undefined;
  return home && user && hasPermission(user.permissions, home.permission) ? inject(Router).createUrlTree([home.route]) : true;
};

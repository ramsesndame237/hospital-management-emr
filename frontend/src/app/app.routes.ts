import { ActivatedRouteSnapshot, Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard, setupGuard } from './core/auth/auth.guards';
import { homeGuard } from './core/navigation/home.guard';
import { findNavItem } from './core/navigation/navigation';

/** Titre (clé de catalogue) de l'écran provisoire d'un module : celui de son entrée de menu. */
const moduleTitle = (route: ActivatedRouteSnapshot): string => {
  const id = route.paramMap.get('module') ?? '';
  return findNavItem(id)?.labelKey ?? `nav.${id}`;
};

/**
 * Chaque écran est chargé à la demande (lazy) : la page de connexion n'embarque rien de l'espace connecté. Trois layouts :
 * authentification (panneau de confiance), espace de travail (navigation + barre de contexte) et, hors routes, le contexte masqué
 * de l'avertissement d'inactivité. Les gardes ne servent qu'à la navigation ; l'API refuse réellement les accès non autorisés.
 * Le `title` d'une route est une clé de catalogue (voir `TranslatedTitleStrategy`).
 */
export const routes: Routes = [
  // L'espace de travail est déclaré AVANT les écrans d'authentification : un parent à chemin vide dont aucun enfant ne correspond
  // à « / » s'activerait quand même (layout affiché, zone vide). Ici « / » trouve d'abord le tableau de bord.
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/shell-layout/shell-layout').then((m) => m.ShellLayout),
    children: [
      { path: '', pathMatch: 'full', canActivate: [homeGuard], title: 'nav.dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      // Administration de l'installation (administrateur système) : organisation, sites, structure des sites.
      { path: 'admin/organization', canActivate: [permissionGuard('administration.organization:read')], title: 'nav.adminOrganization', loadComponent: () => import('./features/admin/organization/organization.page').then((m) => m.OrganizationPage) },
      { path: 'admin/sites', canActivate: [permissionGuard('administration.facilities:read')], title: 'nav.adminSites', loadComponent: () => import('./features/admin/sites/sites.page').then((m) => m.SitesPage) },
      { path: 'admin/structure', canActivate: [permissionGuard('administration.structure:read')], title: 'nav.adminStructure', loadComponent: () => import('./features/admin/structure/structure.page').then((m) => m.StructurePage) },
      { path: 'admin/structure/:facilityId', canActivate: [permissionGuard('administration.structure:read')], title: 'nav.adminStructure', loadComponent: () => import('./features/admin/structure/structure.page').then((m) => m.StructurePage) },
      { path: 'profile', title: 'profile.title', loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage) },
      { path: 'modules/:module', title: moduleTitle, loadComponent: () => import('./features/modules/module-placeholder.page').then((m) => m.ModulePlaceholderPage) },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [
      { path: 'login', canActivate: [guestGuard], title: 'login.pageTitle', loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage) },
      { path: 'forgot-password', canActivate: [guestGuard], title: 'forgot.title', loadComponent: () => import('./features/auth/forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage) },
      { path: 'session-expired', canActivate: [guestGuard], title: 'expired.pageTitle', loadComponent: () => import('./features/auth/session-expired/session-expired.page').then((m) => m.SessionExpiredPage) },
      { path: 'account/setup', canActivate: [setupGuard], title: 'setup.pageTitle', loadComponent: () => import('./features/account-setup/account-setup.page').then((m) => m.AccountSetupPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];

import { Routes } from '@angular/router';
import { authGuard, guestGuard, setupGuard } from './core/auth/auth.guards';

/**
 * Chaque écran est chargé à la demande (lazy) : la page de connexion n'embarque rien de l'espace connecté.
 * Les gardes ne servent qu'à la navigation ; l'API refuse réellement les accès non autorisés.
 */
export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], title: 'Connexion', loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage) },
  { path: 'account/setup', canActivate: [setupGuard], title: 'Finalisation du compte', loadComponent: () => import('./features/account-setup/account-setup.page').then((m) => m.AccountSetupPage) },
  { path: '', canActivate: [authGuard], pathMatch: 'full', title: 'Accueil', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage) },
  { path: '**', redirectTo: '' },
];

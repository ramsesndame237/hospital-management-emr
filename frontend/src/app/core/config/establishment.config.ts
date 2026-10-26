import { InjectionToken } from '@angular/core';

/** L'établissement et le réseau affichés dans l'interface (barre de navigation, pieds de page, assistance). */
export interface EstablishmentConfig {
  readonly name: string;
  readonly city: string;
  /** Sigle affiché quand la navigation est réduite (« CM » : Centre médical). */
  readonly shortName: string;
  readonly network: string;
  /** Numéro de l'administrateur à joindre en cas de blocage de connexion. */
  readonly supportPhone: string;
  /** Page d'état du service, ouverte quand le service de connexion est indisponible. */
  readonly statusUrl: string;
}

/**
 * Valeurs de démarrage : l'API n'expose pas encore l'établissement de l'utilisateur. Le jour où elle le fera, on fournira ce
 * jeton depuis la session (`useFactory`) sans modifier un seul écran.
 */
export const ESTABLISHMENT = new InjectionToken<EstablishmentConfig>('ESTABLISHMENT', {
  providedIn: 'root',
  factory: () => ({ name: 'Bonapriso', city: 'Douala', shortName: 'CM', network: 'Réseau Sanjeevani', supportPhone: '+237 6 70 12 34 56', statusUrl: '/api/Health' }),
});

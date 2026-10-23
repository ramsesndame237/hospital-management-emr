import { InjectionToken } from '@angular/core';

/**
 * Racine de l'API. Chemin relatif : en développement le proxy d'Angular le renvoie vers le backend, en production le
 * reverse proxy (Dokploy/Traefik) sert l'application et l'API sur la même origine. Même origine = cookies
 * `SameSite=Strict` fonctionnels et aucun besoin de CORS.
 */
export const API_BASE = new InjectionToken<string>('API_BASE', { providedIn: 'root', factory: () => '/api/v1' });

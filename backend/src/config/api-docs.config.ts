import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApiDocsOptions } from '../modules/api-docs';

function packageVersion(): string {
  try {
    // dist/config → ../../package.json ; src/config (tests) → idem. Présent dans l'image Docker (COPY package.json).
    return (JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const DESCRIPTION = [
  "API de **Sanjeevani EMR**, le dossier patient informatisé de l'établissement.",
  '',
  '### Tester les endpoints',
  "1. Vous êtes déjà connecté : votre jeton d'accès est **enregistré automatiquement** dans *Authorize* (cadenas, en haut) et renouvelé avant son expiration. Tous les appels l'utilisent.",
  '2. Ouvrez un endpoint, cliquez sur *Try it out*, puis *Execute*.',
  "3. Pour essayer un autre compte, déconnectez-vous (en haut à droite) puis reconnectez-vous avec lui.",
  "4. Les opérations indiquent les **permissions requises** ; un refus (`403`) est normal si le profil connecté ne les a pas.",
  '',
  '### Conventions',
  "- **Erreurs** : toujours `{ statusCode, code, message }` (et `errors` pour une validation). Le `code` est stable, le `message` suit la langue de la requête (`?lang=fr|en`, en-tête `X-Locale`, ou `Accept-Language` ; français par défaut).",
  "- **Sécurité** : jeton d'accès de 15 minutes ; renouvellement par cookie `httpOnly` (`/auth/refresh`) ; la double authentification est obligatoire pour les profils cliniques et administrateur.",
  "- **Dates** : ISO 8601 en UTC (`2026-10-23T10:15:00Z`).",
  '',
  '> Ce document décrit uniquement la nouvelle API `/api/v1`. Les routes historiques (`api/<Contrôleur>/<action>`) ne sont pas documentées ici.',
].join('\n');

/** Documentation interactive : activée hors production par défaut (voir `API_DOCS_ENABLED`). */
export function buildApiDocsOptions(enabled: boolean): ApiDocsOptions {
  return { enabled, path: 'api-docs', title: 'Sanjeevani EMR — API', description: DESCRIPTION, version: packageVersion() };
}

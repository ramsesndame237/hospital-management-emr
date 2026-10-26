import { existsSync } from 'node:fs';

/**
 * Charge `.env` dans `process.env` AVANT toute validation de configuration (sinon `main.ts` validait des valeurs
 * incomplètes puis Nest chargeait le fichier plus tard). Une variable déjà définie dans l'environnement réel l'emporte
 * sur le fichier : c'est le comportement attendu en production (Docker, Dokploy), où `.env` n'existe pas.
 * Ignoré sous test : un test ne doit jamais dépendre du fichier local d'un développeur.
 */
export function loadLocalEnv(file = '.env'): void {
  if (process.env.NODE_ENV === 'test' || !existsSync(file)) return;
  process.loadEnvFile(file);
}

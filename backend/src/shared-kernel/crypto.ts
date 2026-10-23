import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Utilitaires cryptographiques de la bibliothèque standard de Node (pas de dépendance tierce). */
export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Mot de passe temporaire aléatoire, sans caractères ambigus (0/O, 1/l/I). */
export function randomPassword(length = 16): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Code de récupération MFA : 10 caractères lisibles (≈ 50 bits), formaté `XXXXX-XXXXX`. */
export function randomRecoveryCode(): string {
  let raw = '';
  for (let i = 0; i < 10; i++) raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Validation minimale des variables d'environnement au démarrage : on échoue tôt avec un message clair. */
export interface Env {
  PORT: number;
  NODE_ENV: string;
  CORS_ORIGINS: string[];
  DB_ENABLED: boolean;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_SSL: boolean;
  DB_SYNCHRONIZE: boolean;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_VALID_MINUTES: number;
  /** Durée du jeton d'accès (IAM). Court : la révocation passe par le cache d'autorisation et la rotation du refresh. */
  ACCESS_TOKEN_MINUTES: number;
  REFRESH_TOKEN_DAYS: number;
  /** `redis://:motdepasse@hote:6379`. Vide = adaptateurs en mémoire (développement et tests uniquement). */
  REDIS_URL: string;
  /** Clé AES-256 (32 octets en base64) qui chiffre les secrets TOTP au repos. */
  SECRET_ENCRYPTION_KEY: string;
  /** Sel de l'ancien chiffrement 3DES du backend .NET. Vide = migration des comptes hérités désactivée. */
  LEGACY_PASSWORD_SALT: string;
  /** Fuseau horaire de l'établissement (nom IANA, p. ex. `Africa/Douala`) : il décide du jour courant (affectations, départs). */
  TIME_ZONE: string;
  /** Devise de l'installation (code ISO 4217, p. ex. `XAF` pour le franc CFA) : les montants de la facturation sont des entiers dans sa plus petite unité. */
  BILLING_CURRENCY: string;
  COOKIE_SECURE: boolean;
  /** Vérification des mots de passe compromis (API HIBP, k-anonymité : seuls 5 caractères du hachage SHA-1 sont envoyés). */
  BREACH_CHECK_ENABLED: boolean;
  /** Bibliothèque d'i18n derrière le port `Translator` : `nestjs-i18n` (@nestjs/i18n) ou `json` (sans bibliothèque). */
  I18N_ADAPTER: 'nestjs-i18n' | 'json';
  I18N_LOCALES: string[];
  I18N_DEFAULT_LOCALE: string;
  /** Dossier des catalogues ; vide = ceux livrés avec le code. */
  I18N_CATALOGS_DIR: string;
  /** Documentation interactive de l'API (`/api-docs`). Désactivée par défaut en production. */
  API_DOCS_ENABLED: boolean;
}

const bool = (v: unknown, d: boolean) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

export function validateEnv(raw: Record<string, unknown>): Env {
  const env: Env = {
    PORT: Number(raw.PORT ?? 3000),
    NODE_ENV: String(raw.NODE_ENV ?? 'development'),
    CORS_ORIGINS: String(raw.CORS_ORIGINS ?? 'http://localhost:4200').split(',').map((s) => s.trim()).filter(Boolean),
    DB_ENABLED: bool(raw.DB_ENABLED, true),
    DB_HOST: String(raw.DB_HOST ?? 'localhost'),
    DB_PORT: Number(raw.DB_PORT ?? 5432),
    DB_NAME: String(raw.DB_NAME ?? 'sanjeevani'),
    DB_USER: String(raw.DB_USER ?? 'sanjeevani'),
    DB_PASSWORD: String(raw.DB_PASSWORD ?? ''),
    DB_SSL: bool(raw.DB_SSL, false),
    DB_SYNCHRONIZE: bool(raw.DB_SYNCHRONIZE, false),
    JWT_SECRET: String(raw.JWT_SECRET ?? ''),
    JWT_ISSUER: String(raw.JWT_ISSUER ?? 'sanjeevani'),
    JWT_AUDIENCE: String(raw.JWT_AUDIENCE ?? 'sanjeevani-web'),
    JWT_VALID_MINUTES: Number(raw.JWT_VALID_MINUTES ?? 480),
    ACCESS_TOKEN_MINUTES: Number(raw.ACCESS_TOKEN_MINUTES ?? 15),
    REFRESH_TOKEN_DAYS: Number(raw.REFRESH_TOKEN_DAYS ?? 7),
    REDIS_URL: String(raw.REDIS_URL ?? ''),
    SECRET_ENCRYPTION_KEY: String(raw.SECRET_ENCRYPTION_KEY ?? ''),
    LEGACY_PASSWORD_SALT: String(raw.LEGACY_PASSWORD_SALT ?? ''),
    TIME_ZONE: String(raw.TIME_ZONE ?? 'UTC').trim(),
    BILLING_CURRENCY: String(raw.BILLING_CURRENCY ?? 'XAF').trim().toUpperCase(),
    COOKIE_SECURE: bool(raw.COOKIE_SECURE, String(raw.NODE_ENV) === 'production'),
    BREACH_CHECK_ENABLED: bool(raw.BREACH_CHECK_ENABLED, String(raw.NODE_ENV) === 'production'),
    I18N_ADAPTER: String(raw.I18N_ADAPTER ?? 'nestjs-i18n') as Env['I18N_ADAPTER'],
    I18N_LOCALES: String(raw.I18N_LOCALES ?? 'fr,en').split(',').map((s) => s.trim()).filter(Boolean),
    I18N_DEFAULT_LOCALE: String(raw.I18N_DEFAULT_LOCALE ?? 'fr').trim(),
    I18N_CATALOGS_DIR: String(raw.I18N_CATALOGS_DIR ?? ''),
    API_DOCS_ENABLED: bool(raw.API_DOCS_ENABLED, String(raw.NODE_ENV ?? 'development') !== 'production'),
  };
  const errors: string[] = [];
  if (!['nestjs-i18n', 'json'].includes(env.I18N_ADAPTER)) errors.push("I18N_ADAPTER doit valoir 'nestjs-i18n' ou 'json'");
  const tag = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/;
  if (env.I18N_LOCALES.length === 0 || !env.I18N_LOCALES.every((l) => tag.test(l))) errors.push('I18N_LOCALES : liste de langues BCP 47 séparées par des virgules (ex. fr,en)');
  else if (!env.I18N_LOCALES.some((l) => l.toLowerCase() === env.I18N_DEFAULT_LOCALE.toLowerCase())) errors.push('I18N_DEFAULT_LOCALE doit figurer dans I18N_LOCALES');
  try {
    new Intl.DateTimeFormat('en', { timeZone: env.TIME_ZONE });
  } catch {
    errors.push('TIME_ZONE doit être un fuseau IANA valide (ex. Africa/Douala, UTC)');
  }
  if (!/^[A-Z]{3}$/.test(env.BILLING_CURRENCY)) errors.push('BILLING_CURRENCY doit être un code de devise ISO 4217 (ex. XAF, EUR)');
  if (!Number.isInteger(env.PORT) || env.PORT <= 0) errors.push('PORT invalide');
  if (!Number.isInteger(env.DB_PORT) || env.DB_PORT <= 0) errors.push('DB_PORT invalide');
  if (env.NODE_ENV === 'production') {
    if (env.JWT_SECRET.length < 32) errors.push('JWT_SECRET doit faire au moins 32 caractères en production');
    if (env.DB_SYNCHRONIZE) errors.push('DB_SYNCHRONIZE=true est interdit en production');
    if (env.DB_ENABLED && !env.DB_PASSWORD) errors.push('DB_PASSWORD est obligatoire en production');
    if (!env.REDIS_URL) errors.push('REDIS_URL est obligatoire en production (sessions et cache)');
    if (!env.COOKIE_SECURE) errors.push('COOKIE_SECURE=false est interdit en production');
  }
  if (env.SECRET_ENCRYPTION_KEY && Buffer.from(env.SECRET_ENCRYPTION_KEY, 'base64').length !== 32) {
    errors.push(
      `SECRET_ENCRYPTION_KEY doit être 32 octets encodés en base64 (reçu : ${Buffer.from(env.SECRET_ENCRYPTION_KEY, 'base64').length} octets). ` +
        `Générer : node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  if (env.NODE_ENV === 'production' && !env.SECRET_ENCRYPTION_KEY) errors.push('SECRET_ENCRYPTION_KEY est obligatoire en production');
  if (!(env.ACCESS_TOKEN_MINUTES > 0 && env.ACCESS_TOKEN_MINUTES <= 60)) errors.push('ACCESS_TOKEN_MINUTES doit être entre 1 et 60');
  if (!(env.REFRESH_TOKEN_DAYS > 0 && env.REFRESH_TOKEN_DAYS <= 30)) errors.push('REFRESH_TOKEN_DAYS doit être entre 1 et 30');
  if (errors.length) throw new Error(`Configuration invalide : ${errors.join(' ; ')}`);
  return env;
}

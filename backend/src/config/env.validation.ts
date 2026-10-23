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
  };
  const errors: string[] = [];
  if (!Number.isInteger(env.PORT) || env.PORT <= 0) errors.push('PORT invalide');
  if (!Number.isInteger(env.DB_PORT) || env.DB_PORT <= 0) errors.push('DB_PORT invalide');
  if (env.NODE_ENV === 'production') {
    if (env.JWT_SECRET.length < 32) errors.push('JWT_SECRET doit faire au moins 32 caractères en production');
    if (env.DB_SYNCHRONIZE) errors.push('DB_SYNCHRONIZE=true est interdit en production');
    if (env.DB_ENABLED && !env.DB_PASSWORD) errors.push('DB_PASSWORD est obligatoire en production');
  }
  if (errors.length) throw new Error(`Configuration invalide : ${errors.join(' ; ')}`);
  return env;
}

import { randomBytes } from 'node:crypto';
import { validateEnv } from '../src/config/env.validation';

const KEY = randomBytes(32).toString('base64');
const PROD = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), DB_PASSWORD: 'mdp', REDIS_URL: 'redis://:pwd@redis:6379', SECRET_ENCRYPTION_KEY: KEY };

describe('validation de la configuration', () => {
  it('applique des valeurs par défaut sûres en développement', () => {
    const env = validateEnv({});
    expect(env.PORT).toBe(3000);
    expect(env.DB_SYNCHRONIZE).toBe(false);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:4200']);
  });

  it('refuse un secret JWT court en production', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'court', DB_PASSWORD: 'x' })).toThrow(/JWT_SECRET/);
  });

  it('refuse synchronize=true en production', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), DB_PASSWORD: 'x', DB_SYNCHRONIZE: 'true' })).toThrow(/DB_SYNCHRONIZE/);
  });

  it('exige un mot de passe de base en production', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) })).toThrow(/DB_PASSWORD/);
  });

  it('accepte une configuration de production complète', () => {
    const env = validateEnv(PROD);
    expect(env.NODE_ENV).toBe('production');
    expect(env.COOKIE_SECURE).toBe(true); // cookies Secure par défaut en production
    expect(env.BREACH_CHECK_ENABLED).toBe(true);
  });

  describe('IAM', () => {
    it('applique des durées de session courtes par défaut', () => {
      const env = validateEnv({});
      expect(env.ACCESS_TOKEN_MINUTES).toBe(15);
      expect(env.REFRESH_TOKEN_DAYS).toBe(7);
      expect(env.COOKIE_SECURE).toBe(false); // développement en HTTP
    });

    it('exige Redis et la clé de chiffrement des secrets en production', () => {
      expect(() => validateEnv({ ...PROD, REDIS_URL: '' })).toThrow(/REDIS_URL/);
      expect(() => validateEnv({ ...PROD, SECRET_ENCRYPTION_KEY: '' })).toThrow(/SECRET_ENCRYPTION_KEY/);
    });

    it('refuse des cookies non sécurisés en production', () => {
      expect(() => validateEnv({ ...PROD, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    });

    it('refuse une clé de chiffrement qui ne fait pas 32 octets', () => {
      expect(() => validateEnv({ SECRET_ENCRYPTION_KEY: randomBytes(16).toString('base64') })).toThrow(/32 octets/);
    });

    it("borne la durée des jetons (un jeton d'accès long annule l'intérêt de la rotation)", () => {
      expect(() => validateEnv({ ACCESS_TOKEN_MINUTES: '480' })).toThrow(/ACCESS_TOKEN_MINUTES/);
      expect(() => validateEnv({ ACCESS_TOKEN_MINUTES: '0' })).toThrow(/ACCESS_TOKEN_MINUTES/);
      expect(() => validateEnv({ REFRESH_TOKEN_DAYS: '365' })).toThrow(/REFRESH_TOKEN_DAYS/);
    });
  });
});

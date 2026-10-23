import { validateEnv } from '../src/config/env.validation';

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
    expect(validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), DB_PASSWORD: 'mdp' }).NODE_ENV).toBe('production');
  });
});

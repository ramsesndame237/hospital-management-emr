import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';

/** Mots de passe les plus courants : la liste complète (compromis connus) est vérifiée par le port `BreachedPasswordChecker`. */
const COMMON = new Set([
  'password', 'password1', 'password123', '123456789012', 'qwertyuiopas', 'azertyuiop12', 'motdepasse12',
  'administrator', 'admin1234567', 'welcome12345', 'changeme1234', 'letmein12345', 'hospital1234',
  'sanjeevani123', 'danphe123456', 'iloveyou1234', 'abcdefghijkl', '111111111111', '000000000000',
]);

export interface PasswordContext {
  readonly username?: string;
  readonly email?: string;
}

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Mot de passe en clair, durée de vie très courte. Politique NIST SP 800-63B : longueur plutôt que règles de composition,
 * refus des valeurs triviales ou dérivées de l'identité. `toString`/`toJSON` masquent la valeur pour éviter les fuites dans les logs.
 */
export class PlainPassword {
  private constructor(private readonly secret: string) {
    Object.freeze(this);
  }

  static create(raw: string, ctx: PasswordContext = {}): Result<PlainPassword> {
    const v = raw ?? '';
    if (v.length < PASSWORD_MIN_LENGTH) {
      return err(new DomainError('PASSWORD_TOO_SHORT', `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`, { min: PASSWORD_MIN_LENGTH }));
    }
    if (v.length > PASSWORD_MAX_LENGTH) {
      return err(new DomainError('PASSWORD_TOO_LONG', `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`, { max: PASSWORD_MAX_LENGTH }));
    }
    const lower = v.toLowerCase();
    if (COMMON.has(lower) || /^(.)\1+$/.test(v)) {
      return err(new DomainError('PASSWORD_TOO_COMMON', 'Ce mot de passe est trop courant.'));
    }
    for (const part of [ctx.username, ctx.email?.split('@')[0]]) {
      if (part && part.length >= 3 && lower.includes(part.toLowerCase())) {
        return err(new DomainError('PASSWORD_CONTAINS_IDENTITY', "Le mot de passe ne doit pas contenir l'identifiant ou l'e-mail."));
      }
    }
    return ok(new PlainPassword(v));
  }

  /**
   * Mot de passe saisi à la connexion : aucune règle de politique (un mot de passe hérité peut être court),
   * seulement une borne de taille contre les abus (hachage coûteux).
   */
  static forVerification(raw: string): Result<PlainPassword> {
    const v = raw ?? '';
    if (v.length === 0 || v.length > 1024) return err(new DomainError('INVALID_CREDENTIALS', 'Identifiants invalides.'));
    return ok(new PlainPassword(v));
  }

  /** Accès volontairement explicite : seul le hasher et les vérificateurs doivent lire la valeur. */
  reveal(): string {
    return this.secret;
  }

  toString(): string {
    return '[PlainPassword]';
  }

  toJSON(): string {
    return '[PlainPassword]';
  }
}

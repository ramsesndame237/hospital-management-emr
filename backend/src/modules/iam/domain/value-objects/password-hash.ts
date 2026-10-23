import { ValueObject } from '../../../../shared-kernel/value-object';

export type HashScheme = 'argon2id' | 'legacy-3des';

/**
 * Empreinte opaque d'un mot de passe. Le schéma est lisible dans la valeur stockée :
 * `$argon2id$…` (actuel) ou `legacy-3des$<base64>` (comptes importés du backend .NET, à migrer à la première connexion).
 */
export class PasswordHash extends ValueObject<string> {
  static fromStored(stored: string): PasswordHash {
    return new PasswordHash(stored);
  }

  static legacy(encryptedBase64: string): PasswordHash {
    return new PasswordHash(`legacy-3des$${encryptedBase64}`);
  }

  get scheme(): HashScheme {
    return this.value.startsWith('legacy-3des$') ? 'legacy-3des' : 'argon2id';
  }

  get legacyPayload(): string {
    return this.value.slice('legacy-3des$'.length);
  }

  /** Ne jamais journaliser l'empreinte. */
  override toString(): string {
    return '[PasswordHash]';
  }
}

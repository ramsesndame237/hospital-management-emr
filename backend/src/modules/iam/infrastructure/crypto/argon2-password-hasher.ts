import * as argon2 from 'argon2';
import { PasswordHasher } from '../../domain/ports';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { PlainPassword } from '../../domain/value-objects/plain-password';

/** Paramètres au-dessus du minimum OWASP (m=19 Mio, t=2, p=1) ; à ajuster selon le matériel, `needsRehash` migrera les anciens. */
export const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 4 } as const;

export class Argon2PasswordHasher implements PasswordHasher {
  private dummy?: Promise<string>;

  constructor(private readonly options: typeof ARGON2_OPTIONS = ARGON2_OPTIONS) {}

  async hash(password: PlainPassword): Promise<PasswordHash> {
    return PasswordHash.fromStored(await argon2.hash(password.reveal(), this.options));
  }

  async verify(hash: PasswordHash, password: PlainPassword): Promise<boolean> {
    try {
      return await argon2.verify(hash.value, password.reveal());
    } catch {
      return false; // empreinte illisible : jamais d'accès
    }
  }

  needsRehash(hash: PasswordHash): boolean {
    try {
      return argon2.needsRehash(hash.value, this.options);
    } catch {
      return true;
    }
  }

  async equalizeTiming(password: PlainPassword): Promise<void> {
    this.dummy ??= argon2.hash('timing-equalization-only', this.options);
    await argon2.verify(await this.dummy, password.reveal()).catch(() => false);
  }
}

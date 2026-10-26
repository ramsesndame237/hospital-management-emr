import { createDecipheriv, createHash } from 'node:crypto';
import { safeEqual } from '../../../../shared-kernel/crypto';
import { LegacyPasswordVerifier } from '../../domain/ports';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { PlainPassword } from '../../domain/value-objects/plain-password';

/**
 * Lecture SEULE des mots de passe de l'ancien backend (3DES-ECB, clé = MD5(sel), PKCS7, base64).
 * Ce schéma est réversible et faible : il n'est conservé que le temps de convertir chaque compte en Argon2id à sa première
 * connexion réussie (voir `LoginUseCase`). Il n'est jamais utilisé pour écrire un mot de passe.
 * Sans sel configuré, la migration est désactivée : les comptes hérités ne peuvent pas se connecter (échec fermé).
 */
export class Legacy3desVerifier implements LegacyPasswordVerifier {
  private readonly key: Buffer | null;

  constructor(salt: string) {
    // MD5 donne 16 octets : « 3DES à deux clés » (K1,K2,K1), ce que `des-ede` implémente.
    this.key = salt ? createHash('md5').update(salt, 'utf8').digest() : null;
  }

  verify(hash: PasswordHash, password: PlainPassword): boolean {
    if (!this.key) return false;
    try {
      const decipher = createDecipheriv('des-ede', this.key, null);
      const plain = Buffer.concat([decipher.update(Buffer.from(hash.legacyPayload, 'base64')), decipher.final()]).toString('utf8');
      return safeEqual(plain, password.reveal());
    } catch {
      return false;
    }
  }
}

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SecretCipher } from '../../domain/ports';

const VERSION = 'v1';

/**
 * Chiffrement authentifié AES-256-GCM des secrets stockés (secret TOTP). Format : `v1.<iv>.<tag>.<données>` (base64url).
 * Un IV aléatoire par chiffrement ; le tag GCM détecte toute altération. Le préfixe de version permettra la rotation de clé.
 */
export class AesGcmSecretCipher implements SecretCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) throw new Error('SECRET_ENCRYPTION_KEY doit faire 32 octets (base64).');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
  }

  decrypt(cipherText: string): string {
    const [version, iv, tag, data] = cipherText.split('.');
    if (version !== VERSION || !iv || !tag || !data) throw new Error('Secret chiffré illisible.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }
}

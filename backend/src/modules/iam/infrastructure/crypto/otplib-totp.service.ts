import { generateSecret, generateURI, verifySync } from 'otplib';
import { TotpService } from '../../domain/ports';

/** TOTP RFC 6238 (SHA-1, 6 chiffres, 30 s), compatible Google Authenticator, Microsoft Authenticator, Aegis, 1Password… */
export class OtplibTotpService implements TotpService {
  generateSecret(): string {
    return generateSecret();
  }

  keyUri(secret: string, accountName: string, issuer: string): string {
    return generateURI({ issuer, label: accountName, secret });
  }

  /** Tolère ±1 pas de 30 s (dérive d'horloge du téléphone). */
  verify(secret: string, code: string): boolean {
    try {
      return verifySync({ secret, token: code, epochTolerance: 30 }).valid;
    } catch {
      return false;
    }
  }
}

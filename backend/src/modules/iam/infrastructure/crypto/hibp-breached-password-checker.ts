import { createHash } from 'node:crypto';
import { BreachedPasswordChecker } from '../../domain/ports';
import { PlainPassword } from '../../domain/value-objects/plain-password';

/**
 * Interroge « Have I Been Pwned – Pwned Passwords » en k-anonymité (NIST 800-63B §5.1.1.2) : seuls les 5 premiers
 * caractères du SHA-1 quittent le serveur, jamais le mot de passe. Si le service est injoignable, on accepte
 * (la disponibilité du changement de mot de passe prime ; la politique locale s'applique déjà).
 */
export class HibpBreachedPasswordChecker implements BreachedPasswordChecker {
  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = 2_000,
  ) {}

  async isBreached(password: PlainPassword): Promise<boolean> {
    const sha1 = createHash('sha1').update(password.reveal(), 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const res = await this.fetchFn(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return false;
      const body = await res.text();
      return body.split('\n').some((line) => {
        const [hash, count] = line.trim().split(':');
        return hash === suffix && Number(count) > 0; // les lignes de remplissage ont un compte de 0
      });
    } catch {
      return false;
    }
  }
}

/** Désactivé (développement, tests, réseau fermé). */
export class NoBreachedPasswordChecker implements BreachedPasswordChecker {
  async isBreached(): Promise<boolean> {
    return false;
  }
}

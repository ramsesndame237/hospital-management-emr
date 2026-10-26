import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ValueObject } from '../../../../shared-kernel/value-object';

const PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class Email extends ValueObject<string> {
  static create(raw: string): Result<Email> {
    const v = (raw ?? '').trim().toLowerCase();
    if (v.length === 0 || v.length > 254 || !PATTERN.test(v)) {
      return err(new DomainError('EMAIL_INVALID', 'Adresse e-mail invalide.'));
    }
    return ok(new Email(v));
  }

  /** Partie avant l'arobase, utilisée par la politique de mot de passe. */
  get localPart(): string {
    return this.value.split('@')[0];
  }
}

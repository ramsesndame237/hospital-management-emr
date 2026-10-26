import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ValueObject } from '../../../../shared-kernel/value-object';

const PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;

/** Identifiant de connexion : insensible à la casse, normalisé en minuscules. */
export class Username extends ValueObject<string> {
  static create(raw: string): Result<Username> {
    const v = (raw ?? '').trim().toLowerCase();
    if (!PATTERN.test(v)) {
      return err(
        new DomainError('USERNAME_INVALID', "Identifiant invalide : 3 à 64 caractères (lettres, chiffres, '.', '_' ou '-')."),
      );
    }
    return ok(new Username(v));
  }
}

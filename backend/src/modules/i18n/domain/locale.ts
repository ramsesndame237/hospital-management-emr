import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { ValueObject } from '../../../shared-kernel/value-object';

const TAG = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/;

/**
 * Langue de l'utilisateur au format BCP 47 normalisé (`fr`, `en`, `fr-CM`) : langue en minuscules, région en majuscules,
 * séparateur `-` (`fr_cm` → `fr-CM`). Indépendant de toute bibliothèque : c'est le vocabulaire du métier.
 */
export class Locale extends ValueObject<string> {
  static create(raw: string): Result<Locale> {
    const v = (raw ?? '').trim();
    if (v.length === 0 || v.length > 35 || !TAG.test(v)) {
      return err(new DomainError('LOCALE_INVALID', `Langue invalide : « ${raw} ».`, { value: raw }));
    }
    const [language, ...rest] = v.split(/[-_]/);
    const subtags = rest.map((s) => (s.length === 2 ? s.toUpperCase() : s.length === 4 ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s.toLowerCase()));
    return ok(new Locale([language.toLowerCase(), ...subtags].join('-')));
  }

  /** Version non validée pour les constantes du code ; lève si le littéral est faux (bug de programmation). */
  static of(raw: string): Locale {
    const r = Locale.create(raw);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  }

  get language(): string {
    return this.value.split('-')[0];
  }

  /** `fr-CM` → `fr` ; `null` si la locale n'a pas de région à retirer. */
  get parent(): Locale | null {
    const i = this.value.lastIndexOf('-');
    return i < 0 ? null : new Locale(this.value.slice(0, i));
  }
}

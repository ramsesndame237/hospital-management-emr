import { Locale } from '../domain/locale';
import { TranslationParams, Translator } from '../domain/ports';

/**
 * Décorateur : ajoute le repli « locale demandée → langue par défaut » à n'importe quel `Translator`.
 * Les adaptateurs restent minimalistes, et le comportement de repli est identique quelle que soit la bibliothèque.
 * (`fr-CM` → `fr` est déjà couvert par l'adaptateur ; ici, c'est le saut vers la langue par défaut.)
 */
export class FallbackTranslator implements Translator {
  constructor(
    private readonly inner: Translator,
    private readonly defaultLocale: Locale,
  ) {}

  translate(key: string, locale: Locale, params?: TranslationParams): string | null {
    const direct = this.inner.translate(key, locale, params);
    if (direct !== null || locale.equals(this.defaultLocale)) return direct;
    return this.inner.translate(key, this.defaultLocale, params);
  }

  exists(key: string, locale: Locale): boolean {
    return this.inner.exists(key, locale) || (!locale.equals(this.defaultLocale) && this.inner.exists(key, this.defaultLocale));
  }
}

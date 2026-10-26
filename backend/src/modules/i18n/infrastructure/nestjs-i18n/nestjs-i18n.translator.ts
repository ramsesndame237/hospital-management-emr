import { I18nService } from '@nestjs/i18n';
import { Locale } from '../../domain/locale';
import { TranslationParams, Translator } from '../../domain/ports';

/**
 * Adaptateur de `@nestjs/i18n` : SEUL fichier (avec son module) qui connaît cette bibliothèque.
 * Il ne fait que traduire le port `Translator` vers l'API de la bibliothèque. La résolution de langue, le repli vers la
 * langue par défaut et le message de dernier recours restent dans notre code (`LocaleResolver`, `FallbackTranslator`).
 */
export class NestI18nTranslator implements Translator {
  constructor(private readonly i18n: I18nService) {}

  translate(key: string, locale: Locale, params?: TranslationParams): string | null {
    const supported = this.supported(locale);
    // Pas de repli vers la langue par défaut ici (politique `missingKey: 'key'`) : `exists` dit la vérité.
    if (!supported || !this.i18n.exists(key, supported)) return null;
    return this.i18n.translate(key, { locale: supported, args: params as Record<string, unknown> | undefined });
  }

  exists(key: string, locale: Locale): boolean {
    const supported = this.supported(locale);
    return supported !== undefined && this.i18n.exists(key, supported);
  }

  /**
   * Particularité de la bibliothèque absorbée ici : pour une langue qu'elle ne propose pas, elle sert silencieusement
   * la langue par défaut. Le contrat du port dit « pas de message » (`null`) ; on rapproche donc la langue demandée
   * d'une langue réellement supportée (`fr-CM` → `fr`) et on abandonne si aucune ne convient.
   */
  private supported(locale: Locale): string | undefined {
    return this.i18n.matchLocale(locale.value);
  }
}

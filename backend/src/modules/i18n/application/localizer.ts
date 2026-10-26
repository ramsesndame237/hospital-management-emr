import { Locale } from '../domain/locale';
import { LocaleContext, TranslationParams, Translator } from '../domain/ports';

/**
 * Façade que le reste de l'application utilise pour obtenir du texte localisé. Elle combine le traducteur et la langue
 * de la requête en cours, et ne tombe jamais en erreur : sans traduction, elle renvoie le texte de repli puis la clé.
 */
export class Localizer {
  constructor(
    private readonly translator: Translator,
    private readonly context: LocaleContext,
  ) {}

  /** Langue de la requête en cours. */
  get locale(): Locale {
    return this.context.current();
  }

  text(key: string, params?: TranslationParams, fallback?: string): string {
    return this.textIn(this.context.current(), key, params, fallback);
  }

  textIn(locale: Locale, key: string, params?: TranslationParams, fallback?: string): string {
    return this.translator.translate(key, locale, params) ?? fallback ?? key;
  }

  /** Message d'une erreur métier : clé `errors.<CODE>`. */
  error(code: string, params?: TranslationParams, fallback?: string): string {
    return this.text(`errors.${code}`, params, fallback);
  }

  hasError(code: string): boolean {
    return this.translator.exists(`errors.${code}`, this.context.current());
  }

  /** Libellé d'un champ de formulaire (`fields.username` → « identifiant »), à défaut le nom technique. */
  field(name: string): string {
    return this.text(`fields.${name}`, undefined, name);
  }
}

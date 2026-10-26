import { Locale } from './locale';

export type TranslationParams = Readonly<Record<string, string | number | boolean>>;

/**
 * Traducteur : le seul contrat que le reste de l'application connaît. Aucune bibliothèque d'i18n n'apparaît ici ;
 * en changer = écrire un nouvel adaptateur de ce port (voir `infrastructure/`), sans toucher au métier.
 *
 * Contrat : `null` si la clé n'existe pas pour cette locale (ni pour sa langue : `fr-CM` essaie `fr`).
 * Le repli sur la langue par défaut n'est PAS l'affaire de l'adaptateur mais du décorateur `FallbackTranslator`,
 * pour que tous les adaptateurs se comportent pareil.
 */
export interface Translator {
  translate(key: string, locale: Locale, params?: TranslationParams): string | null;
  exists(key: string, locale: Locale): boolean;
}

/** Langues proposées par l'application (ségrégation d'interface : savoir traduire ≠ savoir quelles langues existent). */
export interface LocaleSupport {
  readonly defaultLocale: Locale;
  readonly supportedLocales: readonly Locale[];
  /** Associe une langue demandée (`fr-CM`, `en-US`) à une langue supportée (`fr`, `en`), ou `null`. */
  match(candidate: string): Locale | null;
}

/** Langue de la requête en cours, propagée sans paramètre supplémentaire à travers les couches. */
export interface LocaleContext {
  current(): Locale;
  run<T>(locale: Locale, work: () => T): T;
}

export const TRANSLATOR = Symbol('TRANSLATOR');
export const LOCALE_SUPPORT = Symbol('LOCALE_SUPPORT');
export const LOCALE_CONTEXT = Symbol('LOCALE_CONTEXT');

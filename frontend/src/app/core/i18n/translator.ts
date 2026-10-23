import type { Signal } from '@angular/core';

export type TranslationParams = Readonly<Record<string, string | number>>;

/**
 * Port d'internationalisation de l'interface. Les composants ne dépendent que de ce contrat, jamais d'une bibliothèque
 * (Transloco, ngx-translate, @angular/localize…) : en changer = écrire un nouvel adaptateur et le brancher dans
 * `app.config.ts`, sans toucher aux écrans.
 */
export abstract class Translator {
  /** Langue courante ; signal, donc les gabarits se mettent à jour d'eux-mêmes au changement de langue. */
  abstract readonly locale: Signal<string>;
  abstract readonly locales: readonly string[];
  abstract setLocale(locale: string): void;
  /** Texte traduit ; la clé elle-même si elle est introuvable (on repère l'oubli sans casser l'écran). */
  abstract t(key: string, params?: TranslationParams): string;
}

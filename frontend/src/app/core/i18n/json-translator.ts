import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import en from '../../i18n/catalogs/en.json';
import fr from '../../i18n/catalogs/fr.json';
import { TranslationParams, Translator } from './translator';

type Catalog = { readonly [key: string]: string | Catalog };

const CATALOGS: Readonly<Record<string, Catalog>> = { fr, en };
const DEFAULT_LOCALE = 'fr';
const STORAGE_KEY = 'sanjeevani.locale';

function lookup(catalog: Catalog | undefined, key: string): string | undefined {
  let node: string | Catalog | undefined = catalog;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Adaptateur sans bibliothèque : catalogues JSON embarqués dans l'application. Choix de la langue : préférence enregistrée,
 * puis langue du navigateur, puis français. La préférence n'est qu'un confort : si le stockage est indisponible
 * (navigation privée, politique du navigateur), l'application fonctionne quand même.
 */
@Injectable()
export class JsonTranslator extends Translator {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal(DEFAULT_LOCALE);

  override readonly locale = this.current.asReadonly();
  override readonly locales = Object.keys(CATALOGS);

  constructor() {
    super();
    this.apply(this.initialLocale());
  }

  override setLocale(locale: string): void {
    if (!this.supports(locale)) return;
    this.apply(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // stockage indisponible : la préférence ne sera simplement pas retenue
    }
  }

  override t(key: string, params?: TranslationParams): string {
    const message = lookup(CATALOGS[this.current()], key) ?? lookup(CATALOGS[DEFAULT_LOCALE], key) ?? key;
    return params ? message.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole)) : message;
  }

  private supports(locale: string): boolean {
    return this.locales.includes(locale);
  }

  private initialLocale(): string {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && this.supports(stored)) return stored;
    const browser = (typeof navigator === 'undefined' ? '' : navigator.language).slice(0, 2).toLowerCase();
    return this.supports(browser) ? browser : DEFAULT_LOCALE;
  }

  private apply(locale: string): void {
    this.current.set(locale);
    this.document.documentElement.lang = locale;
  }
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Locale } from '../../domain/locale';
import { TranslationParams, Translator } from '../../domain/ports';
import { formatMessage } from '../message-format';

type Catalog = { [key: string]: string | Catalog };

/**
 * Adaptateur sans aucune dépendance : lit `<dossier>/<langue>/<espace>.json` (`fr/errors.json` → clés `errors.*`).
 * Sert de solution de secours, de référence pour les tests de contrat, et prouve que le port tient sans bibliothèque.
 */
export class JsonCatalogTranslator implements Translator {
  private readonly catalogs = new Map<string, Catalog>();

  constructor(directory: string) {
    for (const entry of readdirSync(directory)) {
      const dir = join(directory, entry);
      if (!statSync(dir).isDirectory()) continue;
      const locale = Locale.create(entry);
      if (!locale.ok) continue;
      const catalog: Catalog = {};
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        catalog[file.slice(0, -'.json'.length)] = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Catalog;
      }
      this.catalogs.set(locale.value.value, catalog);
    }
  }

  translate(key: string, locale: Locale, params?: TranslationParams): string | null {
    for (let l: Locale | null = locale; l; l = l.parent) {
      const message = this.lookup(l.value, key);
      if (message !== null) return formatMessage(message, params);
    }
    return null;
  }

  exists(key: string, locale: Locale): boolean {
    return this.translate(key, locale) !== null;
  }

  private lookup(locale: string, key: string): string | null {
    let node: string | Catalog | undefined = this.catalogs.get(locale);
    for (const part of key.split('.')) {
      if (node === undefined || typeof node === 'string') return null;
      node = node[part];
    }
    return typeof node === 'string' ? node : null;
  }
}

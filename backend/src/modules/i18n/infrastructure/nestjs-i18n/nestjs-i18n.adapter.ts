import { I18nModule, I18nService, JsonI18nLoader } from '@nestjs/i18n';
import { AdapterOptions, AdapterWiring, RAW_TRANSLATOR } from '../adapter-wiring';
import { NestI18nTranslator } from './nestjs-i18n.translator';

/**
 * Branche `@nestjs/i18n` derrière le port `Translator`. La bibliothèque est configurée pour ne faire que ce qu'on lui
 * demande : charger et formater les catalogues. Sa résolution de langue (`resolvers: []`), ses en-têtes de réponse
 * (`responseHeaders: false`) et son repli vers la langue par défaut (`missingKey: 'key'`) sont désactivés, car
 * ils appartiennent à notre code et doivent se comporter pareil avec n'importe quel adaptateur.
 */
export function nestI18nAdapter(options: AdapterOptions): AdapterWiring {
  return {
    imports: [
      I18nModule.forRoot({
        loader: new JsonI18nLoader({ path: options.catalogsDir, watch: options.watch }),
        defaultLocale: options.defaultLocale.value,
        supportedLocales: options.locales.map((l) => l.value),
        missingKey: 'key',
        logMissingKeys: 'never',
        resolvers: [],
        responseHeaders: false,
      }),
    ],
    provider: { provide: RAW_TRANSLATOR, inject: [I18nService], useFactory: (i18n: I18nService) => new NestI18nTranslator(i18n) },
  };
}

import { DynamicModule, Inject, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { join } from 'node:path';
import { FallbackTranslator } from './application/fallback-translator';
import { LocaleResolver } from './application/locale-resolver';
import { AcceptLanguageStrategy, HeaderLocaleStrategy, QueryLocaleStrategy } from './application/locale-strategies';
import { StaticLocaleSupport } from './application/locale-support';
import { Localizer } from './application/localizer';
import { Locale } from './domain/locale';
import { LOCALE_CONTEXT, LOCALE_SUPPORT, TRANSLATOR } from './domain/ports';
import type { LocaleContext, LocaleSupport, Translator } from './domain/ports';
import { AdapterOptions, RAW_TRANSLATOR } from './infrastructure/adapter-wiring';
import { AsyncLocalStorageLocaleContext } from './infrastructure/async-local-storage-locale-context';
import { jsonCatalogAdapter } from './infrastructure/json/json-catalog.adapter';
import { nestI18nAdapter } from './infrastructure/nestjs-i18n/nestjs-i18n.adapter';
import { createLocaleMiddleware } from './presentation/locale.middleware';
import { LocalizedExceptionFilter } from './presentation/localized-exception.filter';

export type I18nAdapterName = 'nestjs-i18n' | 'json';

export interface LocalizationOptions {
  /** Quelle bibliothèque derrière le port `Translator`. Changer ce choix ne touche aucun autre fichier. */
  readonly adapter: I18nAdapterName;
  readonly locales: readonly string[];
  readonly defaultLocale: string;
  readonly catalogsDir?: string;
  readonly watch?: boolean;
}

/** Catalogues livrés avec le code (copiés dans `dist` par `nest build`, voir `nest-cli.json`). */
export const DEFAULT_CATALOGS_DIR = join(__dirname, 'catalogs');

/**
 * Module d'internationalisation : racine de composition du sous-système. C'est ici que s'assemblent le choix de
 * l'adaptateur, la chaîne de décorateurs (adaptateur → repli sur la langue par défaut) et la résolution de langue.
 * Le reste de l'application ne dépend que de `Localizer` et des ports du dossier `domain/`.
 */
@Module({})
export class LocalizationModule implements NestModule {
  constructor(
    private readonly resolver: LocaleResolver,
    @Inject(LOCALE_CONTEXT) private readonly context: LocaleContext,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(createLocaleMiddleware(this.resolver, this.context)).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }

  static register(options: LocalizationOptions): DynamicModule {
    const locales = options.locales.map((l) => Locale.of(l));
    const defaultLocale = Locale.of(options.defaultLocale);
    const adapterOptions: AdapterOptions = { catalogsDir: options.catalogsDir ?? DEFAULT_CATALOGS_DIR, locales, defaultLocale, watch: options.watch ?? false };
    const wiring = options.adapter === 'json' ? jsonCatalogAdapter(adapterOptions) : nestI18nAdapter(adapterOptions);

    return {
      module: LocalizationModule,
      global: true,
      imports: wiring.imports,
      providers: [
        wiring.provider,
        { provide: LOCALE_SUPPORT, useValue: new StaticLocaleSupport(locales, defaultLocale) },
        { provide: LOCALE_CONTEXT, useValue: new AsyncLocalStorageLocaleContext(defaultLocale) },
        { provide: TRANSLATOR, inject: [RAW_TRANSLATOR], useFactory: (raw: Translator) => new FallbackTranslator(raw, defaultLocale) },
        { provide: Localizer, inject: [TRANSLATOR, LOCALE_CONTEXT], useFactory: (t: Translator, c: LocaleContext) => new Localizer(t, c) },
        {
          provide: LocaleResolver,
          inject: [LOCALE_SUPPORT],
          // Ordre de priorité : choix explicite (?lang=) > en-tête X-Locale > préférences du navigateur > langue par défaut.
          useFactory: (support: LocaleSupport) => new LocaleResolver([new QueryLocaleStrategy(), new HeaderLocaleStrategy(), new AcceptLanguageStrategy()], support),
        },
        { provide: APP_FILTER, useClass: LocalizedExceptionFilter },
      ],
      exports: [Localizer, LocaleResolver, TRANSLATOR, LOCALE_SUPPORT, LOCALE_CONTEXT],
    };
  }
}

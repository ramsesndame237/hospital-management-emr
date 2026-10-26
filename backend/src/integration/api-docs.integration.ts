import { DynamicModule, Module } from '@nestjs/common';
import { API_DOCS_ACCESS, PORTAL_TEXTS_PROVIDER, PORTAL_TEXT_KEYS } from '../modules/api-docs';
import type { ApiDocsAccess, DocsAccessDecision, PortalLocalization, PortalTextsProvider } from '../modules/api-docs';
import { LocaleResolver } from '../modules/i18n/application/locale-resolver';
import { Localizer } from '../modules/i18n/application/localizer';
import { LOCALE_SUPPORT } from '../modules/i18n/domain/ports';
import type { LocaleSupport } from '../modules/i18n/domain/ports';
import type { LocaleRequest } from '../modules/i18n/domain/locale-strategy';
import { PermissionResolver } from '../modules/iam/application/permission-resolver';
import { TOKEN_ISSUER } from '../modules/iam/domain/ports';
import type { TokenIssuer } from '../modules/iam/domain/ports';
import { Permission } from '../modules/iam/domain/value-objects/permission';
import { Temporal } from '../shared-kernel/temporal';

/** Permission qui ouvre la documentation (donnée par défaut au seul administrateur système, voir `iam.pg.sql`). */
export const DOCS_PERMISSION = 'api.docs:read';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module de documentation est relié à l'identité (IAM) et à
 * l'internationalisation. Ni `api-docs`, ni `iam`, ni `i18n` ne se connaissent entre eux.
 */

/** « Ce jeton peut-il lire la documentation ? » répondu par l'IAM : jeton valide, session complète, compte actif, permission. */
export class IamApiDocsAccess implements ApiDocsAccess {
  private readonly required: Permission;

  constructor(
    private readonly tokens: TokenIssuer,
    private readonly resolver: PermissionResolver,
  ) {
    const p = Permission.create(DOCS_PERMISSION);
    if (!p.ok) throw new Error(p.error.message);
    this.required = p.value;
  }

  async authorize(accessToken: string): Promise<DocsAccessDecision> {
    const claims = await this.tokens.verify(accessToken);
    if (!claims) return { allowed: false, reason: 'invalid' };
    if (claims.scope !== 'full') return { allowed: false, reason: 'setup-required' };
    const authz = await this.resolver.authorizationOf(claims.userId);
    if (!authz?.active) return { allowed: false, reason: 'invalid' }; // compte désactivé : on ne révèle rien de plus
    if (!(await this.resolver.can(claims.userId, this.required))) return { allowed: false, reason: 'forbidden' };
    const remaining = claims.expiresAt ? Math.floor((claims.expiresAt.epochMilliseconds - Temporal.Now.instant().epochMilliseconds) / 1000) : 900;
    return { allowed: true, displayName: claims.username, expiresInSeconds: Math.max(1, remaining) };
  }
}

/** Textes de la page d'accueil pris dans les catalogues (`docs-portal.*`), dans la langue de la requête. */
export class LocalizedPortalTexts implements PortalTextsProvider {
  constructor(
    private readonly resolver: LocaleResolver,
    private readonly localizer: Localizer,
    private readonly support: LocaleSupport,
  ) {}

  forRequest(request: LocaleRequest): PortalLocalization {
    const locale = this.resolver.resolve(request);
    const texts = Object.fromEntries(PORTAL_TEXT_KEYS.map((key) => [key, this.localizer.textIn(locale, `docs-portal.${key}`)]));
    return { locale: locale.value, locales: this.support.supportedLocales.map((l) => l.value), texts: texts as PortalLocalization['texts'] };
  }
}

@Module({})
export class ApiDocsIntegrationModule {
  /**
   * `identity: false` (base désactivée) : le fournisseur d'accès EXISTE quand même, avec la valeur `null`. On ne cherche
   * ainsi jamais un fournisseur absent : sous `NestFactory`, `app.get()` sur un fournisseur inconnu arrête le processus
   * (zone d'exceptions de Nest) au lieu de lever une erreur rattrapable.
   */
  static register(options: { identity: boolean } = { identity: true }): DynamicModule {
    const access = options.identity
      ? { provide: API_DOCS_ACCESS, inject: [TOKEN_ISSUER, PermissionResolver], useFactory: (t: TokenIssuer, r: PermissionResolver) => new IamApiDocsAccess(t, r) }
      : { provide: API_DOCS_ACCESS, useValue: null };
    return {
      module: ApiDocsIntegrationModule,
      providers: [
        access,
        {
          provide: PORTAL_TEXTS_PROVIDER,
          inject: [LocaleResolver, Localizer, LOCALE_SUPPORT],
          useFactory: (r: LocaleResolver, l: Localizer, s: LocaleSupport) => new LocalizedPortalTexts(r, l, s),
        },
      ],
      exports: [API_DOCS_ACCESS, PORTAL_TEXTS_PROVIDER],
    };
  }
}

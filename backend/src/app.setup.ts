import { Logger, ValidationPipe } from '@nestjs/common';
import { API_DOCS_ACCESS, PORTAL_TEXTS_PROVIDER, mountApiDocs } from './modules/api-docs';
import type { ApiDocsAccess, ApiDocsOptions, PortalTextsProvider } from './modules/api-docs';
import { Localizer } from './modules/i18n/application/localizer';
import { createLocalizedValidationPipe } from './modules/i18n/presentation/localized-validation.pipe';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

/**
 * Configuration HTTP commune à la production et aux tests : un test qui passe valide donc la vraie configuration,
 * pas une variante simplifiée.
 */
export interface AppSetupOptions {
  corsOrigins: string[];
  /** Documentation interactive ; absente ou `enabled: false` = non publiée. */
  docs?: ApiDocsOptions;
  /** Attribut `Secure` des cookies (cookie de documentation). Vrai en production. */
  secureCookies?: boolean;
}

/**
 * Récupère un fournisseur qui DOIT être enregistré (sa valeur peut être `null`/`undefined`). Ne jamais l'appeler pour un
 * fournisseur éventuellement absent : sous `NestFactory`, `app.get()` sur un inconnu arrête le processus au lieu de lever
 * une erreur rattrapable (zone d'exceptions de Nest), ce que les tests ne montrent pas.
 */
function provided<T>(app: NestExpressApplication, token: symbol | (abstract new (...args: never[]) => T)): T | undefined {
  return (app.get(token as never, { strict: false }) ?? undefined) as T | undefined;
}

export function configureApp(app: NestExpressApplication, options: AppSetupOptions): void {
  // Derrière le reverse proxy (Traefik/Dokploy) : sans cela `req.ip` serait celui du proxy et la limitation de débit globale.
  app.set('trust proxy', 1);
  // CSP stricte partout, sauf sur la documentation : `upgrade-insecure-requests` (défaut de helmet) force le
  // chargement des scripts de l'interface en https et la casse en HTTP local. Sur ce seul chemin, on l'omet.
  const docsPath = `/${options.docs?.path ?? 'api-docs'}`;
  const strict = helmet();
  const defaults = helmet.contentSecurityPolicy.getDefaultDirectives();
  delete defaults['upgrade-insecure-requests'];
  // `useDefaults: false` : sinon helmet réinjecterait la directive qu'on vient de retirer.
  const forDocs = helmet({ contentSecurityPolicy: { useDefaults: false, directives: defaults } });
  app.use((req: Request, res: Response, next: NextFunction) => (options.docs?.enabled && req.path.startsWith(docsPath) ? forDocs(req, res, next) : strict(req, res, next)));
  app.use(cookieParser());
  app.enableCors({ origin: options.corsOrigins, credentials: true });
  // Corps JSON volumineux : le backend .NET autorisait de gros formulaires (RequestFormSizeLimit).
  app.useBodyParser('json', { limit: '25mb' });
  // Erreurs de validation dans la langue de la requête quand le module d'i18n est présent, comportement d'origine sinon.
  const localizer = provided<Localizer>(app, Localizer);
  app.useGlobalPipes(localizer ? createLocalizedValidationPipe(localizer) : new ValidationPipe({ whitelist: true, transform: true }));
  if (options.docs?.enabled) {
    const access = provided<ApiDocsAccess>(app, API_DOCS_ACCESS);
    if ((options.docs.requireLogin ?? true) && !access) {
      // Échec fermé : pas d'identité branchée (base désactivée) = pas de documentation, plutôt qu'une documentation ouverte.
      new Logger('ApiDocs').warn("Documentation non publiée : elle exige une connexion et aucun système d'identité n'est disponible.");
    } else {
      mountApiDocs(app, options.docs, { access, texts: provided<PortalTextsProvider>(app, PORTAL_TEXTS_PROVIDER), secureCookie: options.secureCookies ?? true });
    }
  }
}

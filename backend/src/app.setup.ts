import { ValidationPipe } from '@nestjs/common';
import { Localizer } from './modules/i18n/application/localizer';
import { createLocalizedValidationPipe } from './modules/i18n/presentation/localized-validation.pipe';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Configuration HTTP commune à la production et aux tests : un test qui passe valide donc la vraie configuration,
 * pas une variante simplifiée.
 */
export function configureApp(app: NestExpressApplication, options: { corsOrigins: string[] }): void {
  // Derrière le reverse proxy (Traefik/Dokploy) : sans cela `req.ip` serait celui du proxy et la limitation de débit globale.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: options.corsOrigins, credentials: true });
  // Corps JSON volumineux : le backend .NET autorisait de gros formulaires (RequestFormSizeLimit).
  app.useBodyParser('json', { limit: '25mb' });
  // Erreurs de validation dans la langue de la requête quand le module d'i18n est présent, comportement d'origine sinon.
  let localizer: Localizer | undefined;
  try {
    localizer = app.get(Localizer, { strict: false });
  } catch {
    localizer = undefined;
  }
  app.useGlobalPipes(localizer ? createLocalizedValidationPipe(localizer) : new ValidationPipe({ whitelist: true, transform: true }));
}

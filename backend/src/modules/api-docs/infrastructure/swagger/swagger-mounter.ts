import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import type { ApiDocsAccess, ApiDocsOptions, PortalTextsProvider } from '../../domain/api-docs.port';
import { createDocsPortal } from '../portal/docs-portal';
import { BEARER_SCHEME, groups, PERMISSIONS_EXTENSION, SETUP_EXTENSION } from './swagger-decorators';

type Operation = { description?: string; [extension: string]: unknown };

/**
 * Après chaque connexion, rafraîchissement ou changement de mot de passe réussi, le jeton d'accès renvoyé est
 * enregistré dans « Authorize » : les autres appels deviennent testables sans copier-coller.
 * ATTENTION : cette fonction est sérialisée (`toString`) dans le script de l'interface ; elle doit rester autonome,
 * sans aucune référence à une variable du module.
 */
function autoAuthorize(response: { ok: boolean; url: string; obj?: { accessToken?: string } }) {
  try {
    const token = response.obj && response.obj.accessToken;
    const ui = (globalThis as unknown as { ui?: { preauthorizeApiKey(name: string, value: string): void } }).ui;
    if (response.ok && token && ui && /\/api\/v1\/auth\/(login|refresh|password\/change)$/.test(response.url)) {
      ui.preauthorizeApiKey('bearer', token);
    }
  } catch {
    // l'aide à l'authentification ne doit jamais casser un appel
  }
  return response;
}

/** Ajoute à la description de chaque opération ce qui est déclaré par extensions (permissions, session restreinte). */
function enrich(document: OpenAPIObject): void {
  for (const item of Object.values(document.paths)) {
    for (const value of Object.values(item)) {
      if (typeof value !== 'object' || value === null) continue;
      const op = value as Operation;
      const notes: string[] = [];
      const permissions = op[PERMISSIONS_EXTENSION];
      if (Array.isArray(permissions) && permissions.length > 0) {
        notes.push(`**Permissions requises :** ${permissions.map((p) => `\`${String(p)}\``).join(', ')}`);
      }
      if (op[SETUP_EXTENSION] === true) {
        notes.push('**Accessible avec une session restreinte** (`scope: setup`), c\'est-à-dire avant d\'avoir changé le mot de passe provisoire ou inscrit la double authentification.');
      }
      if (notes.length > 0) op.description = [op.description, ...notes].filter(Boolean).join('\n\n');
    }
  }
}

/**
 * Publie la documentation interactive (Swagger UI) et le document OpenAPI brut. Seul fichier qui assemble la
 * bibliothèque ; le reste de l'application passe par la façade `modules/api-docs`.
 */
export interface ApiDocsIntegration {
  /** Qui peut lire la documentation (obligatoire tant que `requireLogin` n'est pas explicitement désactivé). */
  readonly access?: ApiDocsAccess;
  /** Textes localisés de la page d'accueil ; à défaut, le français intégré. */
  readonly texts?: PortalTextsProvider;
  /** Attribut `Secure` du cookie de session de documentation. */
  readonly secureCookie?: boolean;
}

export function mountApiDocs(app: INestApplication, options: ApiDocsOptions, integration: ApiDocsIntegration = {}): void {
  if (!options.enabled) return;
  const path = options.path ?? 'api-docs';
  const requireLogin = options.requireLogin ?? true;

  if (requireLogin) {
    // Échec fermé : sans moyen de vérifier l'accès, on refuse de publier plutôt que de publier en clair.
    if (!integration.access) throw new Error("La documentation exige une connexion mais aucun accès (ApiDocsAccess) n'est branché.");
    // AVANT SwaggerModule.setup : le garde doit précéder les routes de l'interface.
    app.use(createDocsPortal({ path: `/${path}`, access: integration.access, texts: integration.texts, secureCookie: integration.secureCookie ?? true }));
  }

  const builder = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setVersion(options.version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: "Jeton d'accès (15 min) obtenu avec `POST /api/v1/auth/login`. Dans cette page il est enregistré automatiquement après une connexion réussie.",
      },
      BEARER_SCHEME,
    );
  for (const [name, { description }] of [...groups].sort((a, b) => a[1].order - b[1].order)) builder.addTag(name, description);

  const document = SwaggerModule.createDocument(app, builder.build(), {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
  enrich(document);

  SwaggerModule.setup(path, app, document, {
    // Sous `<chemin>/` pour que le cookie de session de documentation (limité à ce chemin) les couvre.
    jsonDocumentUrl: `${path}/json`,
    yamlDocumentUrl: `${path}/yaml`,
    ...(requireLogin ? { customJs: [`/${path}/_portal/toolbar.js`] } : {}),
    customSiteTitle: options.title,
    swaggerOptions: {
      // Pas de persistance : le jeton est pré-rempli à l'ouverture (voir toolbar.js), jamais stocké dans le navigateur.
      persistAuthorization: false,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
      responseInterceptor: autoAuthorize,
    },
  });
}

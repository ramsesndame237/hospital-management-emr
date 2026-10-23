import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ApiDocsAccess, PortalTextsProvider } from '../../domain/api-docs.port';
import { DEFAULT_LOCALIZATION } from './default-texts';
import { renderPortalPage } from './portal-page';

export const DOCS_COOKIE = 'sanjeevani_docs';

export interface DocsPortalDeps {
  /** Chemin de la documentation, avec barre oblique initiale : `/api-docs`. */
  readonly path: string;
  readonly access: ApiDocsAccess;
  readonly texts?: PortalTextsProvider;
  readonly secureCookie: boolean;
}

const ASSET_TYPES: Readonly<Record<string, string>> = {
  'portal.css': 'text/css; charset=utf-8',
  'portal.js': 'application/javascript; charset=utf-8',
  'toolbar.js': 'application/javascript; charset=utf-8',
};

const readCookie = (req: Request, name: string): string | undefined => {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
};

const bearer = (req: Request): string | undefined => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
};

/**
 * Portail d'accès à la documentation : page d'accueil de connexion + barrière.
 *
 *  - Tout ce qui est sous `<chemin>/` est protégé, y compris le document OpenAPI et les scripts de l'interface
 *    (ils contiennent l'inventaire complet de l'API). Seuls la page d'accueil et ses fichiers (`/_portal/*.css|js`)
 *    sont publics, et ils ne contiennent aucun secret.
 *  - L'accès s'ouvre en échangeant un jeton d'accès contre un cookie `httpOnly` / `SameSite=Strict` limité à ce chemin.
 *    Le jeton est revérifié à CHAQUE requête (compte désactivé ou rôle retiré = accès fermé immédiatement).
 */
export function createDocsPortal(deps: DocsPortalDeps): RequestHandler {
  const base = deps.path;
  const asset = (name: string) => readFileSync(join(__dirname, 'assets', name));
  const assets = new Map(Object.keys(ASSET_TYPES).map((n) => [n, asset(n)]));
  const localize = (req: Request) =>
    (deps.texts ?? { forRequest: () => DEFAULT_LOCALIZATION }).forRequest({
      query: (n) => (typeof req.query[n] === 'string' ? (req.query[n] as string) : undefined),
      header: (n) => req.get(n) ?? undefined,
    });

  const cookieOptions = (maxAgeMs?: number) => ({ httpOnly: true, secure: deps.secureCookie, sameSite: 'strict' as const, path: base, ...(maxAgeMs === undefined ? {} : { maxAge: maxAgeMs }) });
  const noStore = (res: Response) => res.setHeader('Cache-Control', 'no-store');

  async function portal(rest: string, req: Request, res: Response): Promise<void> {
    if ((req.method === 'GET' || req.method === 'HEAD') && assets.has(rest)) {
      res.setHeader('Content-Type', ASSET_TYPES[rest]);
      // `no-cache` : le navigateur revalide à chaque fois (ETag, réponse 304 si inchangé) ; un déploiement est vu tout de suite.
      res.setHeader('Cache-Control', 'no-cache');
      res.send(assets.get(rest));
      return;
    }

    if (req.method === 'POST' && rest === 'session') {
      noStore(res);
      const token = bearer(req);
      const decision = token ? await deps.access.authorize(token) : ({ allowed: false, reason: 'invalid' } as const);
      if (decision.allowed) {
        res.cookie(DOCS_COOKIE, token, cookieOptions(decision.expiresInSeconds * 1000));
        res.status(200).json({ displayName: decision.displayName });
      } else if (decision.reason === 'invalid') {
        res.status(401).json({ statusCode: 401, code: 'TOKEN_INVALID', reason: decision.reason });
      } else {
        res.status(403).json({ statusCode: 403, code: decision.reason === 'setup-required' ? 'SETUP_REQUIRED' : 'DOCS_FORBIDDEN', reason: decision.reason });
      }
      return;
    }

    if (req.method === 'GET' && rest === 'me') {
      noStore(res);
      const token = readCookie(req, DOCS_COOKIE);
      const decision = token ? await deps.access.authorize(token) : undefined;
      if (decision?.allowed) res.json({ displayName: decision.displayName, signOut: localize(req).texts.signOut });
      else res.status(401).json({ statusCode: 401, code: 'UNAUTHENTICATED' });
      return;
    }

    if (req.method === 'POST' && rest === 'logout') {
      noStore(res);
      res.clearCookie(DOCS_COOKIE, cookieOptions());
      res.status(204).end();
      return;
    }

    res.status(404).json({ statusCode: 404, code: 'HTTP_404' });
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.path !== base && !req.path.startsWith(`${base}/`)) return next();
    try {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      const rest = req.path.slice(base.length).replace(/^\//, '');

      if (rest.startsWith('_portal/')) return await portal(rest.slice('_portal/'.length), req, res);

      const token = readCookie(req, DOCS_COOKIE);
      const decision = token ? await deps.access.authorize(token) : undefined;
      if (decision?.allowed) {
        noStore(res);
        return next();
      }

      // Pas (ou plus) autorisé : la page d'accueil pour une navigation, un 401 pour tout le reste (scripts, document).
      noStore(res);
      if (req.method === 'GET' && rest === '') {
        res.status(200).type('html').send(renderPortalPage({ localization: localize(req), docsPath: base }));
        return;
      }
      res.status(401).json({ statusCode: 401, code: 'UNAUTHENTICATED' });
    } catch (error) {
      next(error);
    }
  };
}

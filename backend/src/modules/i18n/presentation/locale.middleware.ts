import type { NextFunction, Request, Response } from 'express';
import { LocaleResolver } from '../application/locale-resolver';
import { LocaleRequest } from '../domain/locale-strategy';
import { LocaleContext } from '../domain/ports';

/** Adapte une requête Express au `LocaleRequest` neutre que lisent les stratégies. */
export const toLocaleRequest = (req: Request): LocaleRequest => ({
  query: (name) => (typeof req.query[name] === 'string' ? (req.query[name] as string) : undefined),
  header: (name) => req.get(name) ?? undefined,
});

/**
 * Détermine la langue de chaque requête, la propage dans le contexte (disponible dans toutes les couches) et l'annonce
 * dans `Content-Language`. `Vary` indique aux caches que la réponse dépend de la langue demandée.
 */
export function createLocaleMiddleware(resolver: LocaleResolver, context: LocaleContext) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const locale = resolver.resolve(toLocaleRequest(req));
    res.setHeader('Content-Language', locale.value);
    res.vary('Accept-Language');
    context.run(locale, next);
  };
}

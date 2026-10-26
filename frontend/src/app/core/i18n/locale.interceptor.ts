import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE } from '../config/api.config';
import { Translator } from './translator';

/**
 * Annonce la langue de l'interface à l'API (`X-Locale`) : les messages d'erreur du serveur (« Identifiant ou mot de passe
 * incorrect. ») arrivent ainsi déjà dans la langue de l'écran, sans table de correspondance côté client.
 */
export const localeInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(inject(API_BASE))) return next(request);
  return next(request.clone({ setHeaders: { 'X-Locale': inject(Translator).locale() } }));
};

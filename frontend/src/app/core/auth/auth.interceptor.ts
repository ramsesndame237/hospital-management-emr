import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { SessionService } from './session.service';
import { SessionStore } from './session.store';

/** Les routes d'authentification ne portent pas de jeton et ne déclenchent jamais de renouvellement (évite toute boucle). */
const AUTH_ENDPOINT = /\/auth\/(login|refresh|logout)$/;
/** Marque une requête déjà rejouée : une seule nouvelle tentative, jamais plus. */
const ALREADY_RETRIED = new HttpContextToken<boolean>(() => false);

const withToken = (request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> =>
  token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

/**
 * Joint le jeton d'accès aux appels de l'API. Sur un 401, renouvelle le jeton UNE fois (les rafraîchissements simultanés
 * sont fusionnés par `SessionService`) puis rejoue la requête ; si la session est perdue, renvoie à la connexion.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(inject(API_BASE))) return next(request);

  const store = inject(SessionStore);
  const session = inject(SessionService);
  const isAuthEndpoint = AUTH_ENDPOINT.test(request.url);

  return next(isAuthEndpoint ? request : withToken(request, store.accessToken())).pipe(
    catchError((error: unknown) => {
      const unauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!unauthorized || isAuthEndpoint || request.context.get(ALREADY_RETRIED)) return throwError(() => error);

      return from(session.refresh()).pipe(
        switchMap((renewed) => {
          if (!renewed) {
            void session.expire();
            return throwError(() => error);
          }
          const retry = request.clone({ context: request.context.set(ALREADY_RETRIED, true) });
          return next(withToken(retry, store.accessToken()));
        }),
      );
    }),
  );
};

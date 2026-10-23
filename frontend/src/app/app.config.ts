import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { routes } from './app.routes';
import { HttpAuthGateway, AuthGateway } from './core/auth/auth.gateway';
import { authInterceptor } from './core/auth/auth.interceptor';
import { JsonTranslator } from './core/i18n/json-translator';
import { localeInterceptor } from './core/i18n/locale.interceptor';
import { Translator } from './core/i18n/translator';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Ordre : la langue d'abord, puis le jeton (et le renouvellement sur 401).
    provideHttpClient(withFetch(), withInterceptors([localeInterceptor, authInterceptor])),
    provideSpartanHlm(),
    // Ports → adaptateurs. Changer de serveur d'identité ou de bibliothèque d'i18n = changer ces deux lignes.
    { provide: AuthGateway, useClass: HttpAuthGateway },
    { provide: Translator, useClass: JsonTranslator },
  ],
};

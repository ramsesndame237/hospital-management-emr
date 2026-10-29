import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding, withNavigationErrorHandler } from '@angular/router';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { routes } from './app.routes';
import { AdministrationGateway, HttpAdministrationGateway } from './core/administration/administration.gateway';
import { ApprovalGateway, HttpApprovalGateway } from './core/billing/approval.gateway';
import { BillingGateway, HttpBillingGateway } from './core/billing/billing.gateway';
import { CashSessionGateway, HttpCashSessionGateway } from './core/billing/cash-session.gateway';
import { HttpPatientSearchGateway, PatientSearchGateway } from './core/patients/patient-search.gateway';
import { HttpAuthGateway, AuthGateway } from './core/auth/auth.gateway';
import { HttpIdentityAdminGateway, IdentityAdminGateway } from './core/iam/identity-admin.gateway';
import { PasswordResetGateway, UnavailablePasswordResetGateway } from './core/auth/password-reset.gateway';
import { authInterceptor } from './core/auth/auth.interceptor';
import { JsonTranslator } from './core/i18n/json-translator';
import { reloadOnStaleChunk } from './core/navigation/stale-chunk';
import { localeInterceptor } from './core/i18n/locale.interceptor';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { Translator } from './core/i18n/translator';
import { DashboardGateway, SampleDashboardGateway } from './features/dashboard/dashboard.gateway';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withNavigationErrorHandler(reloadOnStaleChunk)),
    // Ordre : la langue d'abord, puis le jeton (et le renouvellement sur 401).
    provideHttpClient(withFetch(), withInterceptors([localeInterceptor, authInterceptor])),
    provideSpartanHlm(),
    // Ports → adaptateurs. Changer de serveur d'identité ou de bibliothèque d'i18n = changer ces deux lignes.
    { provide: AuthGateway, useClass: HttpAuthGateway },
    { provide: Translator, useClass: JsonTranslator },
    { provide: AdministrationGateway, useClass: HttpAdministrationGateway },
    { provide: IdentityAdminGateway, useClass: HttpIdentityAdminGateway },
    { provide: BillingGateway, useClass: HttpBillingGateway },
    { provide: CashSessionGateway, useClass: HttpCashSessionGateway },
    { provide: ApprovalGateway, useClass: HttpApprovalGateway },
    { provide: PatientSearchGateway, useClass: HttpPatientSearchGateway },
    // Réinitialisation du mot de passe : adaptateur provisoire tant que l'API n'a pas d'endpoint (voir le fichier du port).
    { provide: PasswordResetGateway, useClass: UnavailablePasswordResetGateway },
    { provide: TitleStrategy, useExisting: TranslatedTitleStrategy },
    // Données d'exemple du tableau de bord, jusqu'à la migration des modules cliniques (voir `dashboard.gateway.ts`).
    { provide: DashboardGateway, useClass: SampleDashboardGateway },
  ],
};

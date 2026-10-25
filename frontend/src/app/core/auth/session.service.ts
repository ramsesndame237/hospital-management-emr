import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../http/api-error';
import { AuthGateway } from './auth.gateway';
import { LoginCredentials, LoginOutcome, MfaEnrollment, TokenResponse } from './auth.models';
import { SessionStore } from './session.store';

/** Marge avant expiration : on renouvelle le jeton une minute avant qu'il ne tombe, pour qu'aucune requête n'échoue en 401. */
const RENEW_BEFORE_MS = 60_000;
const MIN_DELAY_MS = 5_000;

/**
 * Orchestration de la session : connexion, restauration silencieuse, renouvellement du jeton, déconnexion.
 * Les écrans et les gardes passent par ici ; seul `SessionStore` détient l'état, seul `AuthGateway` parle au serveur.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly gateway = inject(AuthGateway);
  private readonly store = inject(SessionStore);
  private readonly router = inject(Router);

  private restoring: Promise<void> | null = null;
  private refreshing: Promise<boolean> | null = null;
  private renewTimer: ReturnType<typeof setTimeout> | null = null;

  /** Ouvre une session. Rejette avec `ApiError` (identifiants invalides, compte verrouillé, code MFA faux, réseau…). */
  async login(credentials: LoginCredentials): Promise<LoginOutcome> {
    const response = await this.gateway.login(credentials);
    if (response.status === 'mfa_required') return { kind: 'mfa_required' };
    await this.open(response);
    return { kind: 'signed_in', setupRequired: response.scope === 'setup', recoveryCodesRemaining: response.recoveryCodesRemaining };
  }

  /**
   * À appeler avant de décider d'une route : au premier chargement (état `unknown`), retrouve une session existante grâce
   * au cookie de rafraîchissement. Plusieurs appels simultanés n'en font qu'un.
   */
  ensureRestored(): Promise<void> {
    if (this.store.status() !== 'unknown') return Promise.resolve();
    this.restoring ??= this.restore().finally(() => (this.restoring = null));
    return this.restoring;
  }

  /**
   * Renouvelle le jeton d'accès. Appels simultanés fusionnés (un seul aller-retour, une seule rotation du cookie :
   * deux rafraîchissements parallèles seraient pris pour un vol de jeton par le serveur). `false` si la session est perdue.
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= this.doRefresh().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      await this.gateway.logout();
    } catch {
      // même si le serveur est injoignable, on ferme la session localement
    }
    this.end();
    await this.router.navigate(['/login']);
  }

  /**
   * Session terminée sans action de l'utilisateur : refus du serveur (jeton de rafraîchissement invalide) ou inactivité.
   * `revoke` ferme aussi la session côté serveur : indispensable pour l'inactivité, sinon le cookie de rafraîchissement,
   * encore valable, rouvrirait la session au rechargement.
   *
   * Si l'utilisateur travaillait dans l'application, on garde l'écran en place sous un dialogue « session expirée » qui masque
   * son contenu et retient la page à reprendre ; sinon on affiche l'écran « session expirée » pleine page.
   */
  async expire(revoke = false): Promise<void> {
    const returnUrl = this.router.url;
    if (revoke) {
      try {
        await this.gateway.logout();
      } catch {
        // serveur injoignable : la session locale est fermée quand même
      }
    }
    this.end();
    const usable = returnUrl && !returnUrl.startsWith('/login') && !returnUrl.startsWith('/session-expired') && !returnUrl.startsWith('/account');
    if (usable) this.store.markExpired({ returnUrl });
    else await this.router.navigate(['/session-expired']);
  }

  /** Quitte le dialogue « session expirée » pour la connexion, avec ou sans reprise de la page où l'on travaillait. */
  async leaveExpired(resume: boolean): Promise<void> {
    const returnUrl = this.store.expired()?.returnUrl;
    this.store.dismissExpired();
    await this.router.navigate(['/login'], { queryParams: resume && returnUrl && returnUrl !== '/' ? { returnUrl } : {} });
  }

  /** Démarre l'inscription de la double authentification (session de finalisation). Rejette avec `ApiError`. */
  enrollMfa(): Promise<MfaEnrollment> {
    return this.gateway.enrollMfa();
  }

  /** Confirme l'inscription avec un premier code valide ; renvoie les codes de secours (à montrer une seule fois). */
  activateMfa(code: string): Promise<readonly string[]> {
    return this.gateway.activateMfa(code);
  }

  /**
   * Dernière étape de la sécurisation : le serveur recalcule la portée (`setup` → `full`) au renouvellement du jeton.
   * `false` si la session n'a pas pu être renouvelée.
   */
  async finishSetup(): Promise<boolean> {
    if (!(await this.refresh())) return false;
    try {
      this.store.setUser(await this.gateway.me());
      return true;
    } catch {
      return false;
    }
  }

  /** Change le mot de passe (étape de finalisation du compte). Rejette avec `ApiError` (mot de passe actuel faux, politique non respectée…). */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ readonly setupRequired: boolean }> {
    const token = await this.gateway.changePassword(currentPassword, newPassword);
    await this.open(token);
    return { setupRequired: token.scope === 'setup' };
  }

  private async restore(): Promise<void> {
    try {
      this.applyToken(await this.gateway.refresh());
      this.store.setUser(await this.gateway.me());
    } catch {
      this.end();
    }
  }

  private async doRefresh(): Promise<boolean> {
    try {
      this.applyToken(await this.gateway.refresh());
      return true;
    } catch (error) {
      // 401 = session vraiment perdue ; une panne réseau ne doit pas déconnecter l'utilisateur
      if (error instanceof ApiError && error.status === 401) this.end();
      return false;
    }
  }

  private async open(token: TokenResponse): Promise<void> {
    this.applyToken(token);
    try {
      this.store.setUser(await this.gateway.me());
    } catch (error) {
      this.end();
      throw error;
    }
  }

  private applyToken(token: TokenResponse): void {
    const expiresAtMs = Date.parse(token.accessExpiresAt);
    this.store.setToken(token.accessToken, expiresAtMs, token.scope);
    this.scheduleRenewal(expiresAtMs);
  }

  private scheduleRenewal(expiresAtMs: number): void {
    this.cancelRenewal();
    const delay = Math.max(MIN_DELAY_MS, expiresAtMs - Date.now() - RENEW_BEFORE_MS);
    this.renewTimer = setTimeout(() => void this.refresh(), delay);
  }

  private cancelRenewal(): void {
    if (this.renewTimer !== null) clearTimeout(this.renewTimer);
    this.renewTimer = null;
  }

  private end(): void {
    this.cancelRenewal();
    this.store.clear();
  }
}

import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../http/api-error';
import { AuthGateway } from './auth.gateway';
import { LoginCredentials, LoginOutcome, TokenResponse } from './auth.models';
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
    return { kind: 'signed_in', setupRequired: response.scope === 'setup' };
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

  /** Session perdue côté serveur (refresh refusé) : on revient à la connexion en retenant la page demandée. */
  async expire(): Promise<void> {
    const returnUrl = this.router.url;
    this.end();
    await this.router.navigate(['/login'], { queryParams: returnUrl && returnUrl !== '/login' ? { returnUrl, reason: 'expired' } : { reason: 'expired' } });
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

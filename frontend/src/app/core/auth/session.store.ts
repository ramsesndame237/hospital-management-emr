import { Injectable, computed, signal } from '@angular/core';
import { CurrentUser, Scope } from './auth.models';

/** `unknown` : session pas encore interrogée (premier chargement). `anonymous` : personne de connecté. `active` : jeton valide. */
export type SessionStatus = 'unknown' | 'anonymous' | 'active';

interface SessionState {
  readonly status: SessionStatus;
  readonly accessToken: string | null;
  /** Instant d'expiration du jeton d'accès, en millisecondes. */
  readonly expiresAtMs: number | null;
  readonly scope: Scope | null;
  readonly user: CurrentUser | null;
}

const INITIAL: SessionState = { status: 'unknown', accessToken: null, expiresAtMs: null, scope: null, user: null };

/**
 * État de la session, en signaux. Le jeton d'accès vit UNIQUEMENT en mémoire : jamais dans `localStorage` ni
 * `sessionStorage`, que lirait n'importe quel script injecté (XSS). Un rechargement de page le perd, et on le retrouve
 * silencieusement grâce au cookie de rafraîchissement `httpOnly` (voir `SessionService.ensureRestored`).
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly state = signal<SessionState>(INITIAL);

  readonly status = computed(() => this.state().status);
  readonly accessToken = computed(() => this.state().accessToken);
  readonly expiresAtMs = computed(() => this.state().expiresAtMs);
  readonly scope = computed(() => this.state().scope);
  readonly user = computed(() => this.state().user);
  /** Session complète : accès à l'application. */
  readonly isSignedIn = computed(() => this.state().status === 'active' && this.state().scope === 'full');
  /** Session restreinte : compte à finaliser (mot de passe provisoire, MFA). */
  readonly needsSetup = computed(() => this.state().status === 'active' && this.state().scope === 'setup');

  setToken(accessToken: string, expiresAtMs: number, scope: Scope): void {
    this.state.update((s) => ({ ...s, status: 'active', accessToken, expiresAtMs, scope }));
  }

  setUser(user: CurrentUser): void {
    this.state.update((s) => ({ ...s, user }));
  }

  clear(): void {
    this.state.set({ ...INITIAL, status: 'anonymous' });
  }
}

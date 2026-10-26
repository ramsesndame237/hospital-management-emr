import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, computed, effect, inject, signal, untracked } from '@angular/core';
import { Clock } from '../time/clock';
import { SessionService } from '../auth/session.service';
import { SessionStore } from '../auth/session.store';

export interface IdleConfig {
  /** Inactivité tolérée avant l'avertissement. */
  readonly warnAfterMs: number;
  /** Délai laissé pour confirmer sa présence avant la déconnexion. */
  readonly countdownMs: number;
}

/** Quinze minutes en tout (14 + 1) : usage courant en milieu hospitalier (déconnexion automatique des postes partagés). */
export const IDLE_CONFIG = new InjectionToken<IdleConfig>('IDLE_CONFIG', {
  providedIn: 'root',
  factory: () => ({ warnAfterMs: 14 * 60_000, countdownMs: 60_000 }),
});

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const TICK_MS = 1_000;

/**
 * Surveille l'inactivité de la personne connectée. Passé le délai, l'avertissement s'affiche (et masque le contenu) avec un
 * compte à rebours ; sans confirmation explicite, la session est fermée côté serveur. Le calcul repose sur des horodatages et
 * non sur un minuteur unique : un poste mis en veille se déconnecte dès son réveil, au lieu de reprendre là où il s'était arrêté.
 *
 * Pendant l'avertissement, les mouvements de souris ou les frappes ne comptent pas : il faut cliquer sur « Rester connecté »,
 * sinon quelqu'un passant devant un poste ouvert prolongerait sans le vouloir la session d'un autre.
 */
@Injectable({ providedIn: 'root' })
export class IdleService {
  private readonly document = inject(DOCUMENT);
  private readonly clock = inject(Clock);
  private readonly config = inject(IDLE_CONFIG);
  private readonly session = inject(SessionService);
  private readonly store = inject(SessionStore);

  private lastActivityMs = this.clock.nowMs();
  private deadlineMs: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly remaining = signal(this.config.countdownMs);
  private readonly warningState = signal(false);

  /** L'avertissement est affiché. */
  readonly warning = this.warningState.asReadonly();
  readonly remainingMs = this.remaining.asReadonly();
  /** Part du délai restante, de 1 (début) à 0 (fin) : alimente la barre de progression. */
  readonly remainingRatio = computed(() => Math.max(0, Math.min(1, this.remaining() / this.config.countdownMs)));

  constructor() {
    const onActivity = (): void => {
      if (!this.warningState()) this.lastActivityMs = this.clock.nowMs();
    };
    for (const name of ACTIVITY_EVENTS) this.document.addEventListener(name, onActivity, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      for (const name of ACTIVITY_EVENTS) this.document.removeEventListener(name, onActivity);
      this.disarm();
    });

    // Surveillance active seulement pendant une session complète.
    effect(() => {
      const active = this.store.isSignedIn();
      untracked(() => (active ? this.arm() : this.disarm()));
    });
  }

  /** « Rester connecté » : prouve la présence, renouvelle la session et ferme l'avertissement. */
  async stayConnected(): Promise<void> {
    const renewed = await this.session.refresh();
    if (!renewed && !this.store.isSignedIn()) return; // session perdue : l'expiration est déjà gérée ailleurs
    this.reset();
  }

  signOut(): Promise<void> {
    this.disarm();
    return this.session.logout();
  }

  private arm(): void {
    this.reset();
    this.timer ??= setInterval(() => void this.tick(), TICK_MS);
  }

  private disarm(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.deadlineMs = null;
    this.warningState.set(false);
  }

  private reset(): void {
    this.lastActivityMs = this.clock.nowMs();
    this.deadlineMs = null;
    this.remaining.set(this.config.countdownMs);
    this.warningState.set(false);
  }

  private async tick(): Promise<void> {
    const now = this.clock.nowMs();
    if (this.deadlineMs === null) {
      if (now - this.lastActivityMs < this.config.warnAfterMs) return;
      // Échéance comptée depuis la dernière activité : un poste réveillé après des heures est déconnecté tout de suite.
      this.deadlineMs = this.lastActivityMs + this.config.warnAfterMs + this.config.countdownMs;
      this.warningState.set(true);
    }
    const left = this.deadlineMs - now;
    this.remaining.set(Math.max(0, left));
    if (left <= 0) {
      this.disarm();
      await this.session.expire(true);
    }
  }
}

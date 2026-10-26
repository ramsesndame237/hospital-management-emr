import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router } from '@angular/router';
import { Translator } from '../core/i18n/translator';

/** Une navigation plus rapide que ce délai ne montre rien : pas de clignotement quand l'écran est déjà en mémoire. */
export const ROUTE_PROGRESS_DELAY_MS = 120;

/**
 * Barre de chargement des pages, fixée en haut de la fenêtre : visible tant qu'une navigation est en cours (téléchargement
 * de l'écran, gardes d'accès). Elle suit le routeur et n'a besoin d'aucun réglage. Pour les utilisateurs qui demandent moins
 * de mouvement, la barre reste pleine et immobile au lieu de glisser.
 */
@Component({
  selector: 'app-route-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden' },
  template: `
    @if (loading()) {
      <div role="progressbar" [attr.aria-label]="i18n.t('common.pageLoading')" aria-busy="true" class="h-full w-full">
        <div class="h-full w-full bg-primary motion-reduce:animate-none motion-safe:w-1/4 motion-safe:animate-route-progress"></div>
      </div>
    }
  `,
})
export class RouteProgress {
  protected readonly i18n = inject(Translator);
  protected readonly loading = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const router = inject(Router);
    router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) this.start();
      else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError || event instanceof NavigationSkipped) this.stop();
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  private start(): void {
    this.clear();
    this.timer = setTimeout(() => this.loading.set(true), ROUTE_PROGRESS_DELAY_MS);
  }

  private stop(): void {
    this.clear();
    this.loading.set(false);
  }

  private clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

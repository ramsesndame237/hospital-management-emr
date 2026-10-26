import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionStore } from './core/auth/session.store';
import { IdleService } from './core/session/idle.service';
import { ThemeService } from './core/theme/theme.service';
import { InactivityOverlay } from './layouts/context-layout/inactivity-overlay';
import { SessionExpiredOverlay } from './layouts/context-layout/session-expired-overlay';
import { RouteProgress } from './shared/route-progress';
import { ToastHost } from './shared/toast/toast-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, InactivityOverlay, SessionExpiredOverlay, ToastHost, RouteProgress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Pendant un dialogue de sécurité, l'application est inerte : ni clavier, ni lecteur d'écran n'atteignent les données masquées. -->
    <app-route-progress />
    <div [attr.inert]="masked() ? '' : null"><router-outlet /></div>
    @if (idle.warning()) {
      <app-inactivity-overlay />
    } @else if (store.expired()) {
      <app-session-expired-overlay />
    }
    <app-toast-host />
  `,
})
export class App {
  // Instancié dès le démarrage pour appliquer le thème (classe `dark`) avant le premier affichage.
  protected readonly theme = inject(ThemeService);
  protected readonly idle = inject(IdleService);
  protected readonly store = inject(SessionStore);
  protected readonly masked = computed(() => this.idle.warning() || this.store.expired() !== null);
}

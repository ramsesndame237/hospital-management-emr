import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdleService } from './core/session/idle.service';
import { ThemeService } from './core/theme/theme.service';
import { InactivityOverlay } from './layouts/context-layout/inactivity-overlay';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, InactivityOverlay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Pendant l'avertissement d'inactivité, l'application est inerte : ni clavier, ni lecteur d'écran n'atteignent les données masquées. -->
    <div [attr.inert]="idle.warning() ? '' : null"><router-outlet /></div>
    @if (idle.warning()) {
      <app-inactivity-overlay />
    }
  `,
})
export class App {
  // Instancié dès le démarrage pour appliquer le thème (classe `dark`) avant le premier affichage.
  protected readonly theme = inject(ThemeService);
  protected readonly idle = inject(IdleService);
}

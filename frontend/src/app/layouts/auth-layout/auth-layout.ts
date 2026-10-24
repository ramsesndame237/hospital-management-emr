import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Translator } from '../../core/i18n/translator';
import { Clock } from '../../core/time/clock';
import { DateTimeFormatter } from '../../core/time/date-time-formatter';
import { BrandEmblem } from '../../shared/brand-emblem';
import { Preferences } from '../../shared/preferences';

/**
 * Layout n° 1 — écrans d'authentification (connexion, session expirée, première connexion) : à gauche le panneau de confiance
 * (identité, engagements de sécurité, ligne de vie), à droite la zone de formulaire dans laquelle s'affiche l'écran de la route.
 * Sur mobile le panneau se réduit à l'identité : le formulaire passe en premier.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, BrandEmblem, Preferences],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-layout.html',
})
export class AuthLayout {
  protected readonly i18n = inject(Translator);
  private readonly formatter = inject(DateTimeFormatter);
  private readonly today = inject(Clock).now();

  protected readonly guarantees = ['g1', 'g2', 'g3', 'g4'] as const;
  protected readonly date = computed(() => this.formatter.date(this.today));
  protected readonly appName = computed(() => this.i18n.t('app.name'));
}

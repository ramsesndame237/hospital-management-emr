import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Translator } from '../core/i18n/translator';
import { ThemeService } from '../core/theme/theme.service';
import { Icon } from './icons/icon';

/**
 * Langue et thème, partagés par les écrans d'authentification et la barre de l'espace de travail. Rendu du design :
 * « FR / EN » (la langue active en gras) puis le thème courant (« ☼ Clair »). `compact` n'affiche que le pictogramme du thème.
 */
@Component({
  selector: 'app-preferences',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-5 text-xs leading-none' },
  template: `
    <div class="flex items-center gap-1" role="group" [attr.aria-label]="i18n.t('common.language')">
      @for (locale of i18n.locales; track locale; let last = $last) {
        <button
          type="button"
          class="rounded-[2px] px-0.5 py-1 uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          [class]="i18n.locale() === locale ? 'font-semibold text-foreground' : 'text-muted-foreground'"
          [attr.aria-pressed]="i18n.locale() === locale"
          [attr.lang]="locale"
          (click)="i18n.setLocale(locale)"
        >
          {{ locale }}
        </button>
        @if (!last) {
          <span class="text-muted-foreground" aria-hidden="true">/</span>
        }
      }
    </div>

    <button
      type="button"
      class="flex items-center gap-1.5 rounded-[2px] py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      [attr.aria-label]="theme.isDark() ? i18n.t('common.themeLight') : i18n.t('common.themeDark')"
      [attr.title]="theme.isDark() ? i18n.t('common.themeLight') : i18n.t('common.themeDark')"
      (click)="theme.toggle()"
    >
      <app-icon [name]="theme.isDark() ? 'moon' : 'sun'" class="text-sm" />
      @if (!compact()) {
        <span>{{ theme.isDark() ? i18n.t('common.themeDark') : i18n.t('common.themeLight') }}</span>
      }
    </button>
  `,
})
export class Preferences {
  protected readonly i18n = inject(Translator);
  protected readonly theme = inject(ThemeService);

  readonly compact = input(false);
}

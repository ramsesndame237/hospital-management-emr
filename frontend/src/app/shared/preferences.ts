import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Translator } from '../core/i18n/translator';
import { ThemeService } from '../core/theme/theme.service';

/** Choix de la langue et du thème, partagé par la page de connexion et l'espace connecté. */
@Component({
  selector: 'app-preferences',
  imports: [HlmButtonImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2' },
  template: `
    <div class="inline-flex border border-border bg-card p-0.5" role="group" [attr.aria-label]="i18n.t('common.language')">
      @for (locale of i18n.locales; track locale) {
        <button
          type="button"
          class="px-3 py-1 text-xs font-semibold tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          [class.bg-primary]="i18n.locale() === locale"
          [class.text-primary-foreground]="i18n.locale() === locale"
          [class.text-muted-foreground]="i18n.locale() !== locale"
          [attr.aria-pressed]="i18n.locale() === locale"
          [attr.lang]="locale"
          (click)="i18n.setLocale(locale)"
        >
          {{ locale }}
        </button>
      }
    </div>

    <button
      hlmBtn
      variant="outline"
      size="icon"
      type="button"
      [attr.aria-label]="theme.isDark() ? i18n.t('common.themeLight') : i18n.t('common.themeDark')"
      [attr.title]="i18n.t('common.theme')"
      (click)="theme.toggle()"
    >
      @if (theme.isDark()) {
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      }
    </button>
  `,
})
export class Preferences {
  protected readonly i18n = inject(Translator);
  protected readonly theme = inject(ThemeService);
}

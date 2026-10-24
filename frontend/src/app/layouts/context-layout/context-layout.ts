import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SessionStore } from '../../core/auth/session.store';
import { ESTABLISHMENT } from '../../core/config/establishment.config';
import { Translator } from '../../core/i18n/translator';
import { BrandEmblem } from '../../shared/brand-emblem';

/**
 * Layout n° 3 — contexte masqué : en-tête d'identité et silhouette grisée du dossier ouvert, sur fond voilé. Il recouvre
 * l'écran réel quand la session est suspendue (avertissement d'inactivité) : aucune donnée de santé ne reste lisible sur un poste
 * laissé sans surveillance. Le contenu projeté (la boîte de dialogue) se place par-dessus.
 */
@Component({
  selector: 'app-context-layout',
  imports: [BrandEmblem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col bg-surface-overlay text-foreground' },
  template: `
    <header class="flex min-h-[72px] items-center justify-between gap-4 border-b border-border bg-card px-4 sm:px-8">
      <div class="flex items-center gap-3">
        <app-brand-emblem />
        <p class="text-xl font-semibold">{{ i18n.t('app.name') }}</p>
      </div>
      <p class="truncate text-sm text-muted-foreground">{{ establishment.name }} · {{ username() }}</p>
    </header>

    <!-- Silhouette du dossier : purement décorative, elle ne contient aucune donnée -->
    <div class="flex flex-col gap-6 p-4 sm:p-8" aria-hidden="true">
      <p class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('inactivity.maskedContext') }}</p>
      <div class="flex items-start justify-between gap-4 border border-border bg-card p-6">
        <div class="flex flex-col gap-2">
          <div class="h-[30px] w-48 bg-border"></div>
          <div class="h-3 w-64 max-w-full bg-border"></div>
        </div>
        <p class="hidden text-xs text-muted-foreground sm:block">{{ i18n.t('inactivity.dataMasked') }}</p>
      </div>
      <div class="grid gap-6 md:grid-cols-2">
        @for (card of [1, 2]; track card) {
          <div class="flex min-h-[180px] flex-col gap-4 border border-border bg-card p-6">
            <div class="h-[22px] w-40 bg-border"></div>
            <div class="h-3 w-full bg-border"></div>
            <div class="h-3 w-60 max-w-full bg-border"></div>
          </div>
        }
      </div>
    </div>

    <ng-content />
  `,
})
export class ContextLayout {
  protected readonly i18n = inject(Translator);
  protected readonly establishment = inject(ESTABLISHMENT);
  private readonly user = inject(SessionStore).user;
  protected readonly username = computed(() => this.user()?.username ?? '');
}

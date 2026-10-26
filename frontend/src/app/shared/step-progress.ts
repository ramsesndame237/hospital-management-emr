import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Translator } from '../core/i18n/translator';

/**
 * Progression d'un parcours en étapes (« ÉTAPE 1 / 3 · Mot de passe ») : une barre fine par étape, les étapes atteintes en
 * couleur de marque. Le libellé est un texte lisible par les lecteurs d'écran ; les barres sont décoratives.
 */
@Component({
  selector: 'app-step-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    <div class="flex gap-1" aria-hidden="true">
      @for (n of steps(); track n) {
        <div class="h-[3px] min-w-px flex-1" [class]="n <= current() ? 'bg-primary' : 'bg-border'"></div>
      }
    </div>
    <p class="text-xs leading-[18px] text-muted-foreground">{{ label() }}</p>
  `,
})
export class StepProgress {
  private readonly i18n = inject(Translator);

  /** Numéro de l'étape en cours (à partir de 1). */
  readonly current = input.required<number>();
  readonly total = input.required<number>();
  /** Clé de catalogue du nom de l'étape (« setup.steps.password »). */
  readonly nameKey = input.required<string>();

  protected readonly steps = computed(() => Array.from({ length: this.total() }, (_, i) => i + 1));
  protected readonly label = computed(() => this.i18n.t('common.step', { current: this.current(), total: this.total(), name: this.i18n.t(this.nameKey()) }));
}

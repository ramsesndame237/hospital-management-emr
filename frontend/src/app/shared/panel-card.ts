import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Bloc de contenu de l'espace de travail : fond de carte, filet de 1 px, titre de 18 px (design : Vue du jour, Mon activité…). */
@Component({
  selector: 'app-panel-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4 border border-border bg-card p-6' },
  template: `
    @if (heading()) {
      <h2 class="text-lg leading-[26px] font-semibold text-foreground">{{ heading() }}</h2>
    }
    <ng-content />
  `,
})
export class PanelCard {
  readonly heading = input<string>('');
}

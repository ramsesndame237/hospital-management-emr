import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { DisplayRenderer } from '../field-context';
import { CodesField } from '../form-schema';

/**
 * Liste de codes à chasse fixe sur deux colonnes (codes de récupération). La classe `print-area` désigne ce bloc comme la seule
 * partie à imprimer : « Imprimer » ne sort que les codes, pas le reste de l'écran (voir `styles.css`).
 */
@Component({
  selector: 'app-codes-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="print-area grid gap-x-5 gap-y-3 border border-border p-4 font-mono text-sm leading-[22px] text-foreground" [class]="columnsClass()">
      @for (value of field().values; track value) {
        <li class="select-all">{{ value }}</li>
      }
    </ul>
  `,
})
export class CodesFieldComponent extends DisplayRenderer<CodesField> {
  protected readonly columnsClass = computed(() => (this.field().columns === 1 ? 'grid-cols-1' : 'grid-cols-2'));
}

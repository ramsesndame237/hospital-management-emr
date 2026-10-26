import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { Icon } from '../../icons/icon';
import { DisplayRenderer } from '../field-context';
import { ChecklistField } from '../form-schema';

/** Récapitulatif de points acquis : une coche et une phrase par ligne (design AUTH-10, « Votre compte est prêt »). */
@Component({
  selector: 'app-checklist-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="flex flex-col gap-4 border border-border p-5 text-sm leading-[22px] text-foreground">
      @for (line of lines(); track line) {
        <li class="flex gap-2"><app-icon name="success" class="w-4 shrink-0 text-status-success" />{{ line }}</li>
      }
    </ul>
  `,
})
export class ChecklistFieldComponent extends DisplayRenderer<ChecklistField> {
  private readonly i18n = inject(Translator);
  protected readonly lines = computed(() => this.field().items.map((key) => this.i18n.t(key, this.field().params)));
}

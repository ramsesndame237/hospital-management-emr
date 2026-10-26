import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { Icon } from '../../icons/icon';
import { DisplayRenderer } from '../field-context';
import { DisclosureField } from '../form-schema';

/** Section dépliable (aide « Le code n'est pas reconnu ? »). Élément natif `<details>` : accessible au clavier sans code en plus. */
@Component({
  selector: 'app-disclosure-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="border border-border p-3" [open]="field().open ?? false" (toggle)="opened.set($any($event.target).open)">
      <summary class="flex cursor-pointer list-none items-center gap-1.5 text-sm leading-[22px] font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <app-icon [name]="opened() ? 'caretUp' : 'caretDown'" />
        {{ title() }}
      </summary>
      <p class="mt-1.5 text-xs leading-[18px] text-muted-foreground">{{ text() }}</p>
    </details>
  `,
})
export class DisclosureFieldComponent extends DisplayRenderer<DisclosureField> {
  private readonly i18n = inject(Translator);
  protected readonly opened = signal(false);
  protected readonly title = computed(() => this.i18n.t(this.field().title));
  protected readonly text = computed(() => this.i18n.t(this.field().text));
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Translator } from '../../../core/i18n/translator';
import { InputRenderer } from '../field-context';
import { fieldLabelClass } from '../field-styles';
import { ChoiceField } from '../form-schema';
import { useFieldAttributes } from './field-attributes';
import { FieldMessages } from './field-shell';

/** Groupe de boutons radio (un seul choix parmi peu d'options visibles d'un coup). */
@Component({
  selector: 'app-radio-field',
  imports: [ReactiveFormsModule, FieldMessages],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="flex flex-col gap-[6px]" [attr.aria-describedby]="attrs.describedBy()">
      @if (label()) {
        <legend [class]="legendClass()">{{ label() }}</legend>
      }
      <div class="flex flex-col gap-2">
        @for (option of field().options; track option.value) {
          <label class="flex cursor-pointer items-center gap-3 text-sm leading-[22px] text-foreground">
            <input type="radio" [formControl]="control()" [value]="option.value" [attr.name]="field().name" [disabled]="!!option.disabled" class="size-4 shrink-0 cursor-pointer accent-primary" />
            <span>{{ i18n.t(option.label) }}</span>
          </label>
        }
      </div>
    </fieldset>
    <app-field-messages [field]="field()" [control]="control()" [inputId]="attrs.id()" />
  `,
  host: { class: 'flex flex-col gap-[6px]' },
})
export class RadioFieldComponent extends InputRenderer<ChoiceField> {
  protected readonly i18n = inject(Translator);
  protected readonly attrs = useFieldAttributes(this.field, this.control);
  protected readonly legendClass = computed(() => fieldLabelClass(this.field().appearance ?? 'default'));
  protected readonly label = computed(() => (this.field().label ? this.i18n.t(this.field().label!) + (this.attrs.required() ? ' *' : '') : ''));
}

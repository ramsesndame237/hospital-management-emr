import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Translator } from '../../../core/i18n/translator';
import { InputRenderer } from '../field-context';
import { fieldControlClass } from '../field-styles';
import { ChoiceField } from '../form-schema';
import { useFieldAttributes } from './field-attributes';
import { FieldShell } from './field-shell';

/** Liste déroulante native : accessible au clavier et sur mobile sans code supplémentaire. */
@Component({
  selector: 'app-select-field',
  imports: [ReactiveFormsModule, FieldShell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-field-shell [field]="field()" [control]="control()" [inputId]="attrs.id()">
      <select
        [id]="attrs.id()"
        [formControl]="control()"
        [class]="inputClass()"
        [attr.aria-required]="attrs.required() || null"
        [attr.aria-invalid]="attrs.invalid() || null"
        [attr.aria-describedby]="attrs.describedBy()"
      >
        @if (attrs.placeholder(); as placeholder) {
          <option value="">{{ placeholder }}</option>
        }
        @for (option of field().options; track option.value) {
          <option [value]="option.value" [disabled]="!!option.disabled">{{ i18n.t(option.label) }}</option>
        }
      </select>
    </app-field-shell>
  `,
})
export class SelectFieldComponent extends InputRenderer<ChoiceField> {
  protected readonly i18n = inject(Translator);
  protected readonly attrs = useFieldAttributes(this.field, this.control);
  protected readonly inputClass = computed(() => fieldControlClass(this.field().appearance ?? 'default', `cursor-pointer ${this.field().inputClass ?? ''}`));
}

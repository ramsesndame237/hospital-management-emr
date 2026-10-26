import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { InputRenderer } from '../field-context';
import { fieldControlClass } from '../field-styles';
import { TextField } from '../form-schema';
import { useFieldAttributes } from './field-attributes';
import { FieldShell } from './field-shell';

const HTML_TYPE = { text: 'text', email: 'email', tel: 'tel', number: 'number', code: 'text' } as const;
const INPUT_MODE = { text: null, email: 'email', tel: 'tel', number: 'decimal', code: 'text' } as const;

/** Champ de saisie sur une ligne : texte, e-mail, téléphone, nombre et « code » (saisie courte en police à chasse fixe). */
@Component({
  selector: 'app-text-field',
  imports: [ReactiveFormsModule, FieldShell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-field-shell [field]="field()" [control]="control()" [inputId]="attrs.id()">
      <input
        [id]="attrs.id()"
        [formControl]="control()"
        [type]="htmlType()"
        [class]="inputClass()"
        [attr.placeholder]="attrs.placeholder()"
        [attr.autocomplete]="field().autocomplete ?? null"
        [attr.inputmode]="inputMode()"
        [attr.maxlength]="attrs.maxLength()"
        [readOnly]="!!field().readonly"
        [attr.aria-required]="attrs.required() || null"
        [attr.aria-invalid]="attrs.invalid() || null"
        [attr.aria-describedby]="attrs.describedBy()"
        autocapitalize="none"
        spellcheck="false"
      />
    </app-field-shell>
  `,
})
export class TextFieldComponent extends InputRenderer<TextField> {
  protected readonly attrs = useFieldAttributes(this.field, this.control);
  protected readonly htmlType = computed(() => HTML_TYPE[this.field().type]);
  protected readonly inputMode = computed(() => this.field().inputMode ?? INPUT_MODE[this.field().type]);
  protected readonly inputClass = computed(() =>
    fieldControlClass(this.field().appearance ?? 'default', [this.field().type === 'code' && 'font-mono tracking-wider', this.field().inputClass].filter(Boolean).join(' ')),
  );
}

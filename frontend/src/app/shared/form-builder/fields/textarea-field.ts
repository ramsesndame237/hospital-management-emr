import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { InputRenderer } from '../field-context';
import { fieldControlClass } from '../field-styles';
import { TextareaField } from '../form-schema';
import { useFieldAttributes } from './field-attributes';
import { FieldShell } from './field-shell';

/** Saisie sur plusieurs lignes (notes, motifs, commentaires). */
@Component({
  selector: 'app-textarea-field',
  imports: [ReactiveFormsModule, FieldShell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-field-shell [field]="field()" [control]="control()" [inputId]="attrs.id()">
      <textarea
        [id]="attrs.id()"
        [formControl]="control()"
        [class]="inputClass()"
        [rows]="field().rows ?? 4"
        [attr.placeholder]="attrs.placeholder()"
        [attr.maxlength]="attrs.maxLength()"
        [readOnly]="!!field().readonly"
        [attr.aria-required]="attrs.required() || null"
        [attr.aria-invalid]="attrs.invalid() || null"
        [attr.aria-describedby]="attrs.describedBy()"
      ></textarea>
    </app-field-shell>
  `,
})
export class TextareaFieldComponent extends InputRenderer<TextareaField> {
  protected readonly attrs = useFieldAttributes(this.field, this.control);
  protected readonly inputClass = computed(() => fieldControlClass(this.field().appearance ?? 'default', `resize-y ${this.field().inputClass ?? ''}`));
}

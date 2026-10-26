import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Translator } from '../../../core/i18n/translator';
import { InputRenderer } from '../field-context';
import { CheckboxField } from '../form-schema';
import { useFieldAttributes } from './field-attributes';
import { FieldMessages } from './field-shell';

/** Case à cocher avec son libellé cliquable (consentement, « se souvenir de moi »…). */
@Component({
  selector: 'app-checkbox-field',
  imports: [ReactiveFormsModule, FieldMessages],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[6px]' },
  template: `
    <label class="flex cursor-pointer items-start gap-3 text-sm leading-[22px] text-foreground">
      <input
        type="checkbox"
        [id]="attrs.id()"
        [formControl]="control()"
        class="mt-[3px] size-4 shrink-0 cursor-pointer accent-primary"
        [attr.aria-required]="attrs.required() || null"
        [attr.aria-invalid]="attrs.invalid() || null"
        [attr.aria-describedby]="attrs.describedBy()"
      />
      <span [class]="field().inputClass ?? ''">{{ label() }}</span>
    </label>
    <app-field-messages [field]="field()" [control]="control()" [inputId]="attrs.id()" />
  `,
})
export class CheckboxFieldComponent extends InputRenderer<CheckboxField> {
  private readonly i18n = inject(Translator);
  protected readonly attrs = useFieldAttributes(this.field, this.control);
  protected readonly label = computed(() => (this.field().label ? this.i18n.t(this.field().label!) + (this.attrs.required() ? ' *' : '') : ''));
}

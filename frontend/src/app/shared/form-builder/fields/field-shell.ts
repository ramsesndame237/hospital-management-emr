import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Translator } from '../../../core/i18n/translator';
import { FieldContext } from '../field-context';
import { FIELD_ERROR_CLASS, FIELD_HINT_CLASS, fieldBoxClass, fieldLabelClass } from '../field-styles';
import { InputFieldSchema } from '../form-schema';

/** Aide et message d'erreur d'un champ (aussi utilisés seuls par les cases à cocher et les boutons radio). */
@Component({
  selector: 'app-field-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (hint(); as text) {
      <p [id]="inputId() + '-hint'" [class]="hintClass">{{ text }}</p>
    }
    @if (error(); as text) {
      <p [id]="inputId() + '-error'" role="alert" [class]="errorClass">{{ text }}</p>
    }
  `,
})
export class FieldMessages {
  private readonly i18n = inject(Translator);
  private readonly ctx = inject(FieldContext);

  readonly field = input.required<InputFieldSchema>();
  readonly control = input.required<FormControl>();
  readonly inputId = input.required<string>();

  protected readonly hintClass = FIELD_HINT_CLASS;
  protected readonly errorClass = FIELD_ERROR_CLASS;
  protected readonly hint = computed(() => (this.field().hint ? this.i18n.t(this.field().hint!) : null));
  protected readonly error = computed(() => {
    this.ctx.version(); // l'état du contrôle (touché, erreurs) n'est pas un signal : le compteur du formulaire fait le lien
    return this.ctx.showError(this.control()) ? this.ctx.errorMessage(this.field(), this.control()) : null;
  });
}

/**
 * Habillage commun des champs de saisie : étiquette (avec « * » si obligatoire), cadre, aide et erreur. Le contenu projeté
 * est l'élément de saisie (et ses boutons éventuels, comme « Afficher »). Deux apparences : `default` (étiquette au-dessus)
 * et `boxed` (étiquette dans le cadre, utilisée pour les fiches).
 */
@Component({
  selector: 'app-field-shell',
  imports: [FieldMessages],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[6px]' },
  template: `
    @if (label() && !boxed()) {
      <label [for]="inputId()" [class]="labelClass()">{{ label() }}</label>
    }
    <div [class]="boxClass()">
      @if (label() && boxed()) {
        <label [for]="inputId()" [class]="labelClass()">{{ label() }}</label>
      }
      <div class="flex w-full items-center gap-2"><ng-content /></div>
    </div>
    <app-field-messages [field]="field()" [control]="control()" [inputId]="inputId()" />
  `,
})
export class FieldShell {
  private readonly i18n = inject(Translator);
  private readonly ctx = inject(FieldContext);

  readonly field = input.required<InputFieldSchema>();
  readonly control = input.required<FormControl>();
  readonly inputId = input.required<string>();

  protected readonly boxed = computed(() => this.field().appearance === 'boxed');
  protected readonly labelClass = computed(() => fieldLabelClass(this.field().appearance ?? 'default'));
  protected readonly label = computed(() => {
    const text = this.field().label;
    if (!text) return '';
    const required = (this.field().validators ?? []).some((v) => v.type === 'required');
    return this.i18n.t(text) + (required ? ' *' : '');
  });
  protected readonly boxClass = computed(() => {
    this.ctx.version();
    const invalid = this.ctx.showError(this.control()) && this.control().invalid;
    return fieldBoxClass(this.field().appearance ?? 'default', invalid, this.control().disabled);
  });
}

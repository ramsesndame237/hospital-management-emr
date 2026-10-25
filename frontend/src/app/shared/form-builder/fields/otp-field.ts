import { ChangeDetectionStrategy, Component, ElementRef, computed, inject } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { FieldContext, InputRenderer } from '../field-context';
import { fieldLabelClass } from '../field-styles';
import { OtpField } from '../form-schema';
import { useFieldAttributes } from './field-attributes';
import { FieldMessages } from './field-shell';

const DEFAULT_LENGTH = 6;

/**
 * Code à chiffres en cases séparées (design AUTH-02 / AUTH-08). Se comporte comme UN seul champ : la valeur du formulaire est la
 * chaîne de chiffres. Saisie rapide (le curseur avance), correction au clavier (Retour arrière recule), flèches, et collage
 * d'un code entier (ou remplissage automatique du navigateur) réparti sur les cases.
 */
@Component({
  selector: 'app-otp-field',
  imports: [FieldMessages],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    <div role="group" class="flex flex-col gap-2" [attr.aria-labelledby]="label() ? attrs.id() + '-label' : null" [attr.aria-describedby]="attrs.describedBy()" (focusout)="onFocusOut($event)">
      @if (label()) {
        <p [id]="attrs.id() + '-label'" [class]="labelClass()">{{ label() }}</p>
      }
      <div class="flex gap-3">
        @for (index of indexes(); track index) {
          <input
            type="text"
            inputmode="numeric"
            [id]="index === 0 ? attrs.id() : attrs.id() + '-' + index"
            [value]="digits()[index] ?? ''"
            [class]="cellClass()"
            [disabled]="control().disabled"
            [attr.aria-label]="i18n.t('form.otp.digit', { index: index + 1, total: length() })"
            [attr.aria-invalid]="attrs.invalid() || null"
            [attr.autocomplete]="index === 0 ? 'one-time-code' : 'off'"
            autocapitalize="none"
            spellcheck="false"
            (input)="onInput(index, $event)"
            (keydown)="onKeydown(index, $event)"
            (paste)="onPaste($event)"
            (focus)="select($event)"
          />
        }
      </div>
    </div>
    <app-field-messages [field]="field()" [control]="control()" [inputId]="attrs.id()" />
  `,
})
export class OtpFieldComponent extends InputRenderer<OtpField> {
  protected readonly i18n = inject(Translator);
  private readonly ctx = inject(FieldContext);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly attrs = useFieldAttributes(this.field, this.control);
  protected readonly length = computed(() => this.field().length ?? DEFAULT_LENGTH);
  protected readonly indexes = computed(() => Array.from({ length: this.length() }, (_, i) => i));
  protected readonly labelClass = computed(() => fieldLabelClass('default'));
  protected readonly label = computed(() => {
    const text = this.field().label;
    return text ? this.i18n.t(text) + (this.attrs.required() ? ' *' : '') : '';
  });

  /** Chiffres saisis, une entrée par case (vide si la case l'est). */
  protected readonly digits = computed(() => {
    this.ctx.version(); // la valeur du contrôle n'est pas un signal : le compteur du formulaire signale ses changements
    return String(this.control().value ?? '').slice(0, this.length()).split('');
  });

  /** Même cadre que les autres champs (1 px, focus en couleur de marque, rouge si invalide), mais une case par chiffre. */
  protected readonly cellClass = computed(() => {
    this.ctx.version();
    const invalid = this.attrs.invalid();
    return [
      'h-14 min-w-0 flex-1 border bg-card text-center font-mono text-[22px] leading-[30px] text-foreground outline-none rounded-[2px] transition-colors disabled:opacity-60',
      invalid ? 'border-status-critical focus:ring-1 focus:ring-status-critical' : 'border-border focus:border-primary focus:ring-1 focus:ring-primary',
    ].join(' ');
  });

  protected onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    let entered = input.value.replace(/\D/g, '');
    // Pas de `maxlength` : un clavier mobile, un remplissage automatique ou un collage peuvent livrer plusieurs chiffres d'un coup.
    // Si la case contenait déjà un chiffre et que le curseur était derrière lui, le nouveau chiffre vient s'y ajouter : on ne garde que lui.
    const previous = this.digits()[index];
    if (previous && entered.length === 2 && entered.startsWith(previous)) entered = entered.slice(1);
    if (entered.length > 1) {
      input.value = previous ?? '';
      return this.fill(index, entered);
    }
    this.write(index, entered);
    input.value = entered; // un caractère refusé (lettre) ne reste pas affiché
    if (entered) this.focusCell(index + 1);
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    const digits = this.digits();
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      this.write(index - 1, '');
      this.focusCell(index - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focusCell(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusCell(index + 1);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    this.fill(0, event.clipboardData?.getData('text') ?? '');
  }

  protected select(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  /** Le champ n'est « quitté » que si le curseur sort de TOUTES les cases (passer d'une case à l'autre n'est pas un blur). */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.host.nativeElement.contains(next)) this.control().markAsTouched();
  }

  private fill(from: number, raw: string): void {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) return;
    const cells = this.padded();
    const room = this.length() - from;
    incoming.slice(0, room).split('').forEach((digit, offset) => (cells[from + offset] = digit));
    this.commit(cells);
    this.focusCell(Math.min(from + incoming.length, this.length() - 1));
  }

  private write(index: number, digit: string): void {
    const cells = this.padded();
    cells[index] = digit;
    this.commit(cells);
  }

  private padded(): string[] {
    const cells = this.digits().slice();
    while (cells.length < this.length()) cells.push('');
    return cells;
  }

  /** La valeur est la suite des chiffres saisis ; les cases vides sont ignorées (« 1 3 » devient « 13 »). */
  private commit(cells: readonly string[]): void {
    const value = cells.join('');
    this.control().setValue(value);
    this.control().markAsDirty();
  }

  private focusCell(index: number): void {
    const target = Math.max(0, Math.min(index, this.length() - 1));
    this.host.nativeElement.querySelectorAll<HTMLInputElement>('input')[target]?.focus();
  }
}

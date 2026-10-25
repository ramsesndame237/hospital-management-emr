import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Translator } from '../../../core/i18n/translator';
import { DisplayRenderer, FieldContext } from '../field-context';
import { evaluateCondition } from '../form-model';
import { ButtonField, ButtonVariant, SubmitField } from '../form-schema';

const VARIANT = { primary: 'default', outline: 'outline', link: 'link' } as const;

/**
 * Boutons du formulaire : `submit` (envoie), `button` (déclenche une action) et `link` (lien discret, interne ou action).
 * Le bouton est celui de Spartan ; seules les dimensions du design (44 px minimum, angles de 2 px) sont imposées ici.
 * Les classes sont écrites en dur dans le gabarit : Spartan les fusionne avec les siennes (ce qu'un `[class]` ne ferait pas).
 */
@Component({
  selector: 'app-action-field',
  imports: [HlmButtonImports, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (field().type) {
      @case ('submit') {
        <button hlmBtn type="submit" [variant]="variant()" [attr.form]="submit().form ?? null" [disabled]="ctx.busy() || inactive()" [attr.aria-busy]="ctx.busy() || null" class="h-auto min-h-11 w-full gap-2 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none data-disabled:border-border data-disabled:bg-border data-disabled:text-muted-foreground data-disabled:opacity-100">
          @if (ctx.busy()) {
            <span class="h-[3px] w-4 animate-pulse bg-current" aria-hidden="true"></span>
            {{ i18n.t(submit().busyLabel ?? field().label) }}
          } @else {
            {{ i18n.t(field().label) }}
          }
        </button>
      }
      @case ('button') {
        <button hlmBtn type="button" [variant]="variant()" [disabled]="ctx.busy() || inactive()" (click)="ctx.dispatch(action())" class="h-auto min-h-11 w-full rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none data-disabled:border-border data-disabled:bg-border data-disabled:text-muted-foreground data-disabled:opacity-100">
          {{ i18n.t(field().label) }}
        </button>
      }
      @default {
        @if (href(); as external) {
          <a hlmBtn variant="link" [href]="external" target="_blank" rel="noopener noreferrer" class="h-auto min-h-0 w-fit justify-start rounded-[2px] p-0 text-sm leading-[22px] font-medium underline-offset-4">{{ i18n.t(field().label) }}</a>
        } @else if (link(); as target) {
          <a hlmBtn variant="link" [routerLink]="target" class="h-auto min-h-0 w-fit justify-start rounded-[2px] p-0 text-sm leading-[22px] font-medium underline-offset-4">{{ i18n.t(field().label) }}</a>
        } @else {
          <button hlmBtn variant="link" type="button" (click)="ctx.dispatch(action())" class="h-auto min-h-0 w-fit justify-start rounded-[2px] p-0 text-sm leading-[22px] font-medium underline-offset-4">{{ i18n.t(field().label) }}</button>
        }
      }
    }
  `,
})
export class ActionFieldComponent extends DisplayRenderer<SubmitField | ButtonField> {
  protected readonly i18n = inject(Translator);
  protected readonly ctx = inject(FieldContext);

  protected readonly submit = computed(() => this.field() as SubmitField);
  /** Bouton inactif par choix du JSON (`disabled`) ou tant que sa condition (`disabledIf`) est vraie. */
  protected readonly inactive = computed(() => {
    const field = this.field();
    if ('disabled' in field && field.disabled) return true;
    return 'disabledIf' in field && !!field.disabledIf && evaluateCondition(field.disabledIf, this.ctx.values());
  });
  protected readonly link = computed(() => (this.field().type === 'link' ? ((this.field() as ButtonField).routerLink ?? null) : null));
  protected readonly action = computed(() => {
    const field = this.field();
    return 'action' in field && field.action ? field.action : field.name;
  });
  protected readonly variant = computed(() => {
    const field = this.field();
    const fallback: ButtonVariant = field.type === 'submit' ? 'primary' : field.type === 'button' ? 'outline' : 'link';
    return VARIANT[field.variant ?? fallback];
  });

  protected readonly href = computed(() => {
    const field = this.field();
    return field.type === 'link' ? field.href ?? null : null;
  });
}

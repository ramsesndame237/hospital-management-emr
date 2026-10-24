import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { Icon, IconName } from '../../icons/icon';
import { DisplayRenderer } from '../field-context';
import { TONE_BORDER, TONE_TEXT } from '../field-styles';
import { MessageField } from '../form-schema';

/**
 * Message d'état (information, réussite, avertissement, erreur) : pictogramme, titre coloré, texte d'explication.
 * `inset` pour les écrans d'authentification (filet épais à gauche), `outlined` pour l'espace de travail (cadre coloré).
 */
@Component({
  selector: 'app-message-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="boxClass()" [attr.role]="field().role ?? (field().tone === 'critical' ? 'alert' : 'status')">
      <app-icon [name]="icon()" [class]="'mt-px text-base font-bold leading-[22px] ' + toneText()" />
      <div class="flex min-w-0 flex-1 flex-col gap-[3px]">
        <p [class]="'text-sm leading-[22px] font-semibold ' + toneText()">{{ title() }}</p>
        @if (text(); as body) {
          <p class="text-xs leading-[18px] text-muted-foreground">{{ body }}</p>
        }
      </div>
    </div>
  `,
})
export class MessageFieldComponent extends DisplayRenderer<MessageField> {
  private readonly i18n = inject(Translator);

  protected readonly toneText = computed(() => TONE_TEXT[this.field().tone]);
  protected readonly icon = computed<IconName>(() => this.field().tone);
  protected readonly title = computed(() => this.i18n.t(this.field().title, this.field().params));
  protected readonly text = computed(() => (this.field().text ? this.i18n.t(this.field().text!, this.field().params) : null));
  protected readonly boxClass = computed(() =>
    this.field().appearance === 'outlined'
      ? `flex items-start gap-3 border bg-card p-[14px] ${TONE_BORDER[this.field().tone]}`
      : 'flex items-start gap-3 border border-l-[3px] border-border bg-background p-[14px]',
  );
}

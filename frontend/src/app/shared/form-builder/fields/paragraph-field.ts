import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { DisplayRenderer } from '../field-context';
import { TONE_TEXT } from '../field-styles';
import { ParagraphField } from '../form-schema';

/** Texte explicatif ou ligne d'état (« ✓ Brouillon enregistré », code d'assistance…). */
@Component({
  selector: 'app-paragraph-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p [class]="paragraphClass()">{{ text() }}</p>`,
})
export class ParagraphFieldComponent extends DisplayRenderer<ParagraphField> {
  private readonly i18n = inject(Translator);

  protected readonly text = computed(() => this.i18n.t(this.field().text, this.field().params));
  protected readonly paragraphClass = computed(() => {
    const { tone, mono, size } = this.field();
    return [mono ? 'font-mono' : '', size === 'sm' ? 'text-sm leading-[22px]' : 'text-xs leading-[18px]', tone ? TONE_TEXT[tone] : 'text-foreground'].join(' ');
  });
}

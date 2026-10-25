import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Coque des boîtes de dialogue de sécurité (design : 576 px, filet 1 px, 32 px de marge, étiquette + titre de 28 px) posées sur
 * le contexte masqué. Piège le focus, se lit comme une alerte et ne se ferme que par l'un de ses boutons : le contenu projeté
 * porte le message et les actions.
 */
@Component({
  selector: 'app-security-dialog',
  imports: [A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fixed inset-0 z-10 flex items-center justify-center p-4' },
  template: `
    <section
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      role="alertdialog"
      aria-modal="true"
      [attr.aria-labelledby]="dialogId() + '-title'"
      [attr.aria-describedby]="lead() ? dialogId() + '-description' : null"
      class="flex max-h-full w-[576px] max-w-full flex-col gap-5 overflow-auto border border-border bg-popover p-8 text-popover-foreground"
    >
      <p class="text-xs leading-[18px] text-muted-foreground">{{ eyebrow() }}</p>
      <h2 [id]="dialogId() + '-title'" class="text-[28px] leading-9 font-semibold">{{ title() }}</h2>
      @if (lead()) {
        <p [id]="dialogId() + '-description'" class="text-sm leading-[22px] text-muted-foreground">{{ lead() }}</p>
      }
      <ng-content />
    </section>
  `,
})
export class SecurityDialog {
  readonly dialogId = input.required<string>();
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly lead = input<string>('');
}

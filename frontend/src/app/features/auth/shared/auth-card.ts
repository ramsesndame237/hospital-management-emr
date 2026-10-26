import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Carte de formulaire des écrans d'authentification (design : 552 px, filet 1 px, 32 px de marge, en-tête « ACCÈS PERSONNEL »). */
@Component({
  selector: 'app-auth-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full max-w-[552px] flex-col gap-5 border border-border bg-card p-6 sm:p-8' },
  template: `
    <header class="flex flex-col gap-2">
      <p class="eyebrow text-primary">{{ eyebrow() }}</p>
      <h2 [id]="titleId()" class="text-[28px] leading-9 font-semibold text-foreground">{{ title() }}</h2>
      @if (lead()) {
        <p class="text-sm leading-[22px] text-muted-foreground">{{ lead() }}</p>
      }
    </header>
    <ng-content />
  `,
})
export class AuthCard {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly lead = input<string>('');
  readonly titleId = input('auth-title');
}

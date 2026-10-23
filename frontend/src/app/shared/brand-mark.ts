import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Logo de l'application : une croix médicale dans un carré arrondi. Décoratif (le nom est écrit à côté). */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 40 40" class="size-10" fill="none">
      <rect width="40" height="40" rx="2" fill="currentColor" fill-opacity="0.18" />
      <path d="M17 9h6v8h8v6h-8v8h-6v-8H9v-6h8z" fill="currentColor" />
    </svg>
  `,
})
export class BrandMark {}

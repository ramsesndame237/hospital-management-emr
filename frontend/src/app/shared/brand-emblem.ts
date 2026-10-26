import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Emblème Sanjeevani (croix médicale dans un carré) : l'illustration exacte du design. `onDark` choisit la variante à filet
 * clair pour les panneaux sombres ; sur fond clair on affiche la variante teintée, et en thème sombre la variante claire
 * prend le relais (les deux images sont décoratives : le nom de l'application est toujours écrit à côté).
 */
@Component({
  selector: 'app-brand-emblem',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (onDark()) {
      <img src="brand/emblem-on-dark.svg" alt="" [attr.width]="size()" [attr.height]="size()" />
    } @else {
      <img src="brand/emblem.svg" alt="" class="dark:hidden" [attr.width]="size()" [attr.height]="size()" />
      <img src="brand/emblem-on-dark.svg" alt="" class="hidden dark:block" [attr.width]="size()" [attr.height]="size()" />
    }
  `,
})
export class BrandEmblem {
  readonly onDark = input(false);
  readonly size = input(36);
}

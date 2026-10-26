import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Registre des icônes de l'interface. Le design utilise des glyphes typographiques (✓ ! i ☼ ⌂ ▤…) : on les reprend tels quels,
 * mais UNIQUEMENT ici. Le jour où une bibliothèque d'icônes (ou des SVG) remplace ces glyphes, on modifie ce fichier et
 * tous les écrans suivent ; aucun composant n'écrit un glyphe en dur.
 */
export const ICON_GLYPHS = {
  success: '✓',
  warning: '!',
  critical: '!',
  info: 'i',
  sun: '☼',
  moon: '☾',
  bell: '♧',
  chevronDown: '▾',
  caretUp: '⌃',
  caretDown: '⌄',
  chevronLeft: '‹',
  chevronRight: '›',
  current: '▸',
  dashboard: '⌂',
  agenda: '▤',
  consultations: '▦',
  ward: '▥',
  emergency: '◇',
  organization: '▣',
  site: '◫',
  add: '+',
  user: '◉',
  shield: '◈',
} as const;

export type IconName = keyof typeof ICON_GLYPHS;

/** Icône décorative : le sens passe toujours par un texte voisin ou un `aria-label` du bouton qui la contient. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'inline-block text-center font-mono leading-none' },
  template: '{{ glyph() }}',
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly glyph = computed(() => ICON_GLYPHS[this.name()]);
}

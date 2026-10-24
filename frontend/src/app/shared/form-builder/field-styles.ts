import { hlm } from '@spartan-ng/helm/utils';
import { Appearance, ColumnSpan, Tone } from './form-schema';

/**
 * L'aspect de TOUS les champs de l'application est défini ici et nulle part ailleurs : changer une bordure, une hauteur ou une
 * couleur d'erreur dans ce fichier la change dans chaque formulaire. Valeurs issues du design (Figma) : hauteur 46 px,
 * bordure 1 px `border/default`, focus en `brand/primary`, angles de 2 px.
 */

/** Cadre d'un champ (l'élément de saisie à l'intérieur est transparent et sans bordure). */
export function fieldBoxClass(appearance: Appearance, invalid: boolean, disabled: boolean, extra?: string): string {
  return hlm(
    'w-full border bg-card transition-colors rounded-[2px]',
    appearance === 'boxed' ? 'flex min-h-16 flex-col justify-center p-3' : 'flex min-h-[46px] items-center gap-2 px-3 py-[11px]',
    invalid ? 'border-status-critical focus-within:ring-1 focus-within:ring-status-critical' : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
    disabled && 'bg-muted opacity-70',
    extra,
  );
}

/** Élément de saisie natif posé dans le cadre. */
export function fieldControlClass(appearance: Appearance, extra?: string): string {
  return hlm(
    'min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed read-only:cursor-default',
    appearance === 'boxed' ? 'text-base leading-[26px]' : 'text-sm leading-[22px]',
    extra,
  );
}

export function fieldLabelClass(appearance: Appearance): string {
  return appearance === 'boxed' ? 'block text-xs leading-[26px] text-muted-foreground' : 'block text-sm leading-[22px] font-medium text-foreground';
}

export const FIELD_HINT_CLASS = 'text-xs leading-[18px] text-muted-foreground';
export const FIELD_ERROR_CLASS = 'text-xs leading-[18px] text-status-critical';

/** Classes complètes (Tailwind ne génère que les classes écrites en toutes lettres : pas de concaténation dynamique). */
const SPAN: Readonly<Record<ColumnSpan, string>> = {
  1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 5: 'sm:col-span-5', 6: 'sm:col-span-6',
  7: 'sm:col-span-7', 8: 'sm:col-span-8', 9: 'sm:col-span-9', 10: 'sm:col-span-10', 11: 'sm:col-span-11', 12: 'sm:col-span-12',
};

/** Conteneur d'un élément du formulaire : pleine largeur sur mobile, `span` colonnes sur 12 dès l'écran « sm ». */
export function fieldWrapperClass(span: ColumnSpan | undefined, extra?: string): string {
  return hlm('col-span-12 min-w-0', span ? SPAN[span] : 'sm:col-span-12', extra);
}

/** Couleur du texte pour un ton (messages d'état). */
export const TONE_TEXT: Readonly<Record<Tone | 'muted', string>> = {
  info: 'text-status-info',
  success: 'text-status-success',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
  muted: 'text-muted-foreground',
};

export const TONE_BORDER: Readonly<Record<Tone, string>> = {
  info: 'border-status-info',
  success: 'border-status-success',
  warning: 'border-status-warning',
  critical: 'border-status-critical',
};


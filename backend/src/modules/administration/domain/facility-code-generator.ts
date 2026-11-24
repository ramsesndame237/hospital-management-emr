/**
 * Composition du code d'un établissement, `PPLL-nnn-SS`, à partir de sa localisation et de son nom :
 *
 * - `PPLL` : le pays (code ISO sur 2 lettres) puis les 2 premières lettres de la commune (à défaut, de la région) : `CMYA` pour Yaoundé (Cameroun) ;
 * - `nnn` : les initiales significatives du nom, sans les mots-outils : « Hôpital Central de Yaoundé » donne `hcy` ;
 * - `SS` : un numéro d'ordre sur 2 chiffres, le premier libre pour ce début de code : `01`, `02`…
 *
 * Fonctions pures : aucune base de données ici ; le numéro libre se calcule d'après la liste des codes déjà pris.
 */

const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'au', 'aux', 'en', 'sur', 'sous', 'of', 'the', 'and', 'a', 'an', 'at']);

/** Minuscules sans accents ni ponctuation : « Hôpital d'Étoudi » donne « hopital d etoudi ». */
export function fold(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** `PPLL` : pays + 2 premiers caractères alphanumériques de la commune (sinon de la région, sinon « XX »). */
export function codePrefix(countryCode: string, place: string | null): string {
  const letters = fold(place ?? '').replace(/ /g, '').toUpperCase();
  return `${countryCode.toUpperCase()}${(letters + 'XX').slice(0, 2)}`;
}

/** `nnn` : initiales des mots significatifs, complétées au besoin par les lettres suivantes du premier mot, puis par « x ». */
export function nameInitials(name: string): string {
  const words = fold(name).split(' ').filter((w) => w !== '');
  const significant = words.filter((w) => !STOP_WORDS.has(w));
  const base = significant.length > 0 ? significant : words;
  let initials = base.map((w) => w[0]).join('');
  if (initials.length < 3 && base.length > 0) initials += base[0].slice(1);
  return (initials + 'xxx').slice(0, 3);
}

export const formatCode = (prefix: string, initials: string, sequence: number): string => `${prefix}-${initials}-${String(sequence).padStart(2, '0')}`;

/** Le premier numéro d'ordre libre (1 à 99) pour ce début de code, ou `null` s'ils sont tous pris. */
export function nextSequence(taken: readonly string[], prefix: string, initials: string): number | null {
  const head = `${prefix}-${initials}-`;
  const used = new Set(taken.filter((c) => c.startsWith(head)).map((c) => Number(c.slice(head.length))));
  for (let n = 1; n <= 99; n += 1) if (!used.has(n)) return n;
  return null;
}

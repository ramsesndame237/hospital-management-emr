import { nameInitials } from '../facility-code-generator';

/**
 * Codes composés des éléments de structure (le code ne se saisit plus) :
 *
 * - un service prend les initiales de son nom en majuscules (`PED` pour « Pédiatrie », `MGE` pour « Médecine Générale »), suivies d'un numéro d'ordre
 *   à partir du deuxième service qui porte les mêmes initiales (`PED`, `PED-02`, `PED-03`…) ;
 * - une unité, une salle, un lit prennent une lettre selon leur niveau puis un numéro d'ordre parmi leurs frères : `U01`, `R01`, `B01`…
 *
 * Fonctions pures : l'appelant essaie les numéros dans l'ordre et garde le premier code libre.
 */

const KIND_LETTER: Readonly<Record<string, string>> = { UNIT: 'U', ROOM: 'R', BED: 'B' };

/** Le `sequence`-ième code candidat d'un service (1 : les initiales seules). */
export function serviceCodeCandidate(name: string, sequence: number): string {
  const base = nameInitials(name).toUpperCase();
  return sequence <= 1 ? base : `${base}-${String(sequence).padStart(2, '0')}`;
}

/** Le `sequence`-ième code candidat d'un élément enfant du niveau `kind` (unité, salle ou lit). */
export function childCodeCandidate(kind: string, sequence: number): string {
  return `${KIND_LETTER[kind] ?? 'X'}${String(sequence).padStart(2, '0')}`;
}

/** Nombre maximal de numéros essayés avant de renoncer. */
export const MAX_CODE_ATTEMPTS = 200;

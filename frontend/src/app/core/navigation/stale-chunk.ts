import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { NavigationError } from '@angular/router';

const CHUNK_ERROR = /dynamically imported module|Loading chunk|ChunkLoadError/i;
const RELOAD_AT = 'sanjeevani.chunk-reload-at';
/** Un deuxième rechargement dans ce délai n'aurait rien changé : on laisse l'erreur remonter plutôt que de boucler. */
const RELOAD_COOLDOWN_MS = 15_000;

/** Vrai pour l'échec de chargement d'un écran « lazy » (fichier introuvable ou déjà remplacé par une nouvelle version). */
export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'ChunkLoadError' || CHUNK_ERROR.test(error.message));
}

/**
 * Gestionnaire d'erreur de navigation. Une application restée ouverte pendant une mise à jour (ou un redémarrage du serveur de
 * développement) réclame des fichiers qui n'existent plus : sans ceci, le clic sur le menu ne fait RIEN. On recharge alors la
 * page à l'adresse demandée, une seule fois ; toute autre erreur suit son cours habituel.
 */
export function reloadOnStaleChunk(failure: NavigationError): void {
  if (!isChunkLoadError(failure.error)) throw failure.error;
  const win = inject(DOCUMENT).defaultView;
  if (!win) throw failure.error;
  let last = 0;
  try {
    last = Number(win.sessionStorage.getItem(RELOAD_AT)) || 0;
    if (Date.now() - last >= RELOAD_COOLDOWN_MS) win.sessionStorage.setItem(RELOAD_AT, String(Date.now()));
  } catch {
    // stockage indisponible : on tente quand même un rechargement (last = 0)
  }
  if (Date.now() - last < RELOAD_COOLDOWN_MS) throw failure.error;
  win.location.assign(failure.url);
}

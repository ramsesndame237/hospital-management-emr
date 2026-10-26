/**
 * Port de cache. Le métier ne connaît ni Redis ni aucune bibliothèque : seulement ce contrat.
 * Règles pour les données de santé : clé scopée par l'appelant, TTL court, invalidation par étiquette à l'écriture.
 */
export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number, tags?: readonly string[]): Promise<void>;
  delete(key: string): Promise<void>;
  /** Supprime toutes les entrées associées à l'étiquette (p. ex. `user:42`). */
  deleteByTag(tag: string): Promise<void>;
}

export const CACHE = Symbol('CACHE');

/** Lecture avec repli : sert le cache s'il répond, sinon charge puis remplit. Une panne du cache n'interrompt jamais la lecture. */
export async function readThrough<T>(
  cache: CachePort,
  key: string,
  ttlSeconds: number,
  tags: readonly string[],
  load: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await cache.get<T>(key);
    if (hit !== null) return hit;
  } catch {
    // cache indisponible : on lit la source de vérité
  }
  const value = await load();
  try {
    await cache.set(key, value, ttlSeconds, tags);
  } catch {
    // idem : l'échec d'écriture du cache ne doit pas faire échouer la requête
  }
  return value;
}

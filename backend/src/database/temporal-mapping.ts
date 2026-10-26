import { Instant, Temporal } from '../shared-kernel/temporal';

/**
 * Frontière avec le pilote `pg`, qui renvoie des `Date` pour `timestamptz`. C'est le seul endroit où `Date` apparaît :
 * on convertit tout de suite en `Temporal.Instant`, et on écrit en ISO 8601 (« 2026-10-23T10:00:00Z »), que PostgreSQL accepte.
 */
export function instantFromDb(value: Date | string | null | undefined): Instant | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Temporal.Instant.fromEpochMilliseconds(value.getTime());
  const iso = value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  return Temporal.Instant.from(/[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

export const requiredInstantFromDb = (value: Date | string): Instant => instantFromDb(value) as Instant;

export const instantToDb = (value: Instant | null): string | null => (value === null ? null : value.toString());

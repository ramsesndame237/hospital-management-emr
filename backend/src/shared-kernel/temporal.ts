import { Temporal as TemporalPolyfill } from 'temporal-polyfill';

/**
 * Point d'entrée unique de `Temporal` : l'implémentation native de Node/V8 quand elle existe, sinon le polyfill conforme
 * à la spécification. Tout le code applicatif importe d'ici et n'utilise plus `Date` (sauf aux frontières des pilotes
 * qui en renvoient : voir `database/temporal-mapping.ts`). On ne mélange jamais natif et polyfill : un seul est choisi.
 */
export const Temporal: typeof TemporalPolyfill =
  (globalThis as { Temporal?: typeof TemporalPolyfill }).Temporal ?? TemporalPolyfill;

/** Point précis sur la ligne du temps (UTC), l'équivalent correct de `Date` pour les horodatages. */
export type Instant = TemporalPolyfill.Instant;
/** Durée sans ancrage calendaire (heures, minutes, secondes…). */
export type Duration = TemporalPolyfill.Duration;
/** Date calendaire sans heure ni fuseau (« 2026-10-23 ») : date de prise de poste, de départ, de naissance… */
export type PlainDate = TemporalPolyfill.PlainDate;

import type { Temporal as TemporalApi } from 'temporal-polyfill';

/**
 * Point d'entrée unique de `Temporal` pour l'interface (le code applicatif n'utilise pas `Date`). L'implémentation est celle du
 * navigateur ; `main.ts` charge le polyfill conforme à la spécification quand elle manque, et `test-setup.ts` fait de même en test.
 * Les types viennent du polyfill (strictement identiques à ceux de la spécification) sans que son code entre dans le bundle.
 */
export const Temporal = (globalThis as unknown as { Temporal: typeof TemporalApi }).Temporal;

/** Point précis sur la ligne du temps (UTC) : l'équivalent correct de `Date` pour un horodatage. */
export type Instant = TemporalApi.Instant;

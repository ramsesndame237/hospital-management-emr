import type { ValueTransformer } from 'typeorm';

/**
 * `bigint` et `numeric` reviennent de `pg` sous forme de chaînes (pour ne pas perdre de précision). Le backend .NET
 * les sérialisait en nombres JSON et l'Angular s'y attend : on convertit à la lecture.
 */
export const NUM: ValueTransformer = {
  to: (value: unknown) => value,
  from: (value: string | number | null) => (value === null || value === undefined ? value : Number(value)),
};

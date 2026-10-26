/**
 * Résultat explicite d'une opération qui peut échouer pour une raison métier attendue.
 * Les exceptions restent réservées aux bugs et aux pannes techniques.
 */
export type Result<T, E = DomainError> = Ok<T> | Err<E>;

export class Ok<T> {
  readonly ok = true as const;
  constructor(readonly value: T) {}
}

export class Err<E> {
  readonly ok = false as const;
  constructor(readonly error: E) {}
}

export const ok = <T>(value: T): Ok<T> => new Ok(value);
export const err = <E>(error: E): Err<E> => new Err(error);

/** Erreur métier : un code stable (pour l'API et les tests) et un message lisible. */
export class DomainError {
  constructor(
    readonly code: string,
    readonly message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {}
}

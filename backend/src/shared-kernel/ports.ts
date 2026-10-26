import { Instant, Temporal } from './temporal';

/** Horloge injectable : rend le temps testable et évite d'appeler l'heure système depuis le métier. */
export interface Clock {
  now(): Instant;
}

export interface IdGenerator {
  next(): string;
}

export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');

export class SystemClock implements Clock {
  now(): Instant {
    return Temporal.Now.instant();
  }
}

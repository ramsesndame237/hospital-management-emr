/** Horloge injectable : rend le temps testable et évite `new Date()` dans le métier. */
export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

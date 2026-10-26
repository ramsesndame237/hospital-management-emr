import { Instant, PlainDate, Temporal } from './temporal';

/** Horloge injectable : rend le temps testable et évite d'appeler l'heure système depuis le métier. */
export interface Clock {
  now(): Instant;
}

export interface IdGenerator {
  next(): string;
}

export const CLOCK = Symbol('CLOCK');
export const CALENDAR = Symbol('CALENDAR');
export const ID_GENERATOR = Symbol('ID_GENERATOR');

export class SystemClock implements Clock {
  now(): Instant {
    return Temporal.Now.instant();
  }
}

/** « Quel jour sommes-nous ? » dans le fuseau de l'établissement : la date change à minuit chez lui, pas à minuit UTC. */
export interface Calendar {
  today(): PlainDate;
  /** Le jour (dans le fuseau de l'établissement) auquel appartient un instant : un rendez-vous à 23 h 30 UTC peut tomber le lendemain chez lui. */
  dateOf(instant: Instant): PlainDate;
}

export class SystemCalendar implements Calendar {
  constructor(private readonly clock: Clock, private readonly timeZone: string) {}
  today(): PlainDate {
    return this.dateOf(this.clock.now());
  }
  dateOf(instant: Instant): PlainDate {
    return instant.toZonedDateTimeISO(this.timeZone).toPlainDate();
  }
}

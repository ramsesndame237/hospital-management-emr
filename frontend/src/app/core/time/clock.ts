import { Injectable } from '@angular/core';
import { Instant, Temporal } from './temporal';

/**
 * Source de l'heure. Les services (inactivité, brouillons…) la demandent ici plutôt qu'au système : en test, on branche une
 * horloge maîtrisée et le temps devient déterministe.
 */
@Injectable({ providedIn: 'root', useFactory: () => new SystemClock() })
export abstract class Clock {
  abstract now(): Instant;

  /** Millisecondes écoulées depuis l'époque Unix : pratique pour mesurer des durées. */
  nowMs(): number {
    return this.now().epochMilliseconds;
  }
}

export class SystemClock extends Clock {
  override now(): Instant {
    return Temporal.Now.instant();
  }
}

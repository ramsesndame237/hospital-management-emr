import { Instant } from './temporal';

export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Instant;
}

/** Racine d'agrégat : collecte les événements de domaine, publiés par la couche application après persistance. */
export abstract class AggregateRoot {
  private events: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.events.push(event);
  }

  pullEvents(): DomainEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}

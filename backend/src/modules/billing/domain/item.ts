import { Amount, ItemCategory, ItemCode, ItemId, ItemName, ServiceRef } from './values';

export interface ItemState {
  readonly id: ItemId;
  readonly code: ItemCode;
  readonly name: ItemName;
  readonly category: ItemCategory;
  /** Prix unitaire courant. Une facture en garde une copie : changer le prix ne touche jamais une facture existante. */
  readonly unitPrice: Amount;
  /** Service qui réalise l'acte (facultatif). */
  readonly serviceId: ServiceRef | null;
  readonly active: boolean;
}

/**
 * Acte facturable du catalogue des tarifs (consultation, examen, médicament…). Le code ne change jamais (les factures y renvoient) ;
 * rien n'est supprimé : un acte retiré du catalogue est désactivé et ne peut plus être ajouté à une facture.
 */
export class BillableItem {
  private constructor(private current: ItemState) {}

  static restore(state: ItemState): BillableItem {
    return new BillableItem(state);
  }

  static create(state: Omit<ItemState, 'active'>): BillableItem {
    return new BillableItem({ ...state, active: true });
  }

  get state(): ItemState { return this.current; }
  get id(): ItemId { return this.current.id; }
  get active(): boolean { return this.current.active; }

  /** Champs absents : inchangés ; `serviceId: null` détache l'acte de son service. */
  update(changes: { name?: ItemName; category?: ItemCategory; unitPrice?: Amount; serviceId?: ServiceRef | null }): void {
    this.current = { ...this.current, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) };
  }

  setActive(active: boolean): void {
    this.current = { ...this.current, active };
  }
}

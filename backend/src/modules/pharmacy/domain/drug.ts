import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { DrugCode, DrugForm, DrugId, DrugName, GenericName, Money, Schedule, Storage, MAX_QUANTITY } from './values';

const ATC = /^[A-Z][0-9]{2}[A-Z]{2}[0-9]{2}$/;

export interface DrugState {
  readonly id: DrugId;
  readonly code: DrugCode;
  /** Nom d'usage ou commercial. */
  readonly name: DrugName;
  /** Dénomination commune internationale : sert aux substitutions et au contrôle des doublons. */
  readonly genericName: GenericName;
  /** Dosage tel qu'on l'écrit (« 500 mg », « 250 mg/5 mL »). */
  readonly strength: string | null;
  readonly form: DrugForm;
  readonly schedule: Schedule;
  readonly storage: Storage;
  /** Classe anatomique, thérapeutique et chimique (OMS), 7 caractères. */
  readonly atcCode: string | null;
  /** Unité de dispensation (comprimé, flacon, ampoule…) : celle du stock et du prix. */
  readonly unit: string;
  /** Prix de vente d'une unité de dispensation, en plus petite unité monétaire. */
  readonly unitPrice: Money;
  /** En dessous de ce stock disponible, le médicament est « bas » et à réapprovisionner ; 0 : pas de seuil. */
  readonly reorderLevel: number;
  readonly notes: string | null;
  readonly active: boolean;
}

function consistent(s: Omit<DrugState, 'active'>): Result<void> {
  if (s.strength !== null && (s.strength.length < 1 || s.strength.length > 40)) return err(new DomainError('PHARMACY_STRENGTH_INVALID', 'Le dosage doit comporter de 1 à 40 caractères.'));
  if (s.atcCode !== null && !ATC.test(s.atcCode)) return err(new DomainError('PHARMACY_ATC_INVALID', 'Le code ATC comporte 7 caractères (par exemple N02BE01).'));
  if (s.unit.length < 1 || s.unit.length > 20) return err(new DomainError('PHARMACY_UNIT_INVALID', "L'unité de dispensation doit comporter de 1 à 20 caractères."));
  if (!Number.isInteger(s.reorderLevel) || s.reorderLevel < 0 || s.reorderLevel > MAX_QUANTITY) return err(new DomainError('PHARMACY_REORDER_LEVEL_INVALID', `Le seuil de réapprovisionnement doit être un entier de 0 à ${MAX_QUANTITY}.`));
  if (s.notes !== null && s.notes.length > 500) return err(new DomainError('PHARMACY_NOTES_INVALID', 'Le texte ne doit pas dépasser 500 caractères.', { max: 500 }));
  return ok(undefined);
}

/**
 * Médicament du formulaire (paracétamol 500 mg comprimé…). Le code ne change jamais : les lots, les réceptions et, plus tard, les
 * ordonnances y renvoient. Rien n'est supprimé : un médicament retiré se désactive et ne peut plus être reçu.
 */
export class Drug {
  private constructor(private current: DrugState) {}

  static restore(state: DrugState): Drug {
    return new Drug(state);
  }

  static create(state: Omit<DrugState, 'active'>): Result<Drug> {
    const valid = consistent(state);
    if (!valid.ok) return err(valid.error);
    return ok(new Drug({ ...state, active: true }));
  }

  get state(): DrugState { return this.current; }
  get id(): DrugId { return this.current.id; }
  get active(): boolean { return this.current.active; }

  /** Champs absents : inchangés. `strength`, `atcCode`, `notes` à `null` : effacés. Le code ne change pas. */
  update(changes: Partial<Pick<DrugState, 'name' | 'genericName' | 'strength' | 'form' | 'schedule' | 'storage' | 'atcCode' | 'unit' | 'unitPrice' | 'reorderLevel' | 'notes'>>): Result<void> {
    const next = { ...this.current, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) } as DrugState;
    const valid = consistent(next);
    if (!valid.ok) return valid;
    this.current = next;
    return ok(undefined);
  }

  setActive(active: boolean): void {
    this.current = { ...this.current, active };
  }
}

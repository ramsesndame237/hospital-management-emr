import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { SupplierCode, SupplierId } from './values';

export interface SupplierState {
  readonly id: SupplierId;
  readonly code: SupplierCode;
  readonly name: string;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  /** Délai de paiement convenu, en jours (0 : comptant). */
  readonly paymentTermsDays: number;
  readonly notes: string | null;
  readonly active: boolean;
}

const bad = (code: string, message: string): Result<never> => err(new DomainError(code, message));
const within = (v: string | null, min: number, max: number): boolean => v === null || (v.length >= min && v.length <= max);

function consistent(s: Omit<SupplierState, 'active'>): Result<void> {
  if (s.name.length < 1 || s.name.length > 120) return bad('PHARMACY_SUPPLIER_NAME_INVALID', 'Le nom du fournisseur doit comporter de 1 à 120 caractères.');
  if (!within(s.contactName, 1, 100)) return bad('PHARMACY_SUPPLIER_CONTACT_INVALID', 'Le contact doit comporter de 1 à 100 caractères.');
  if (!within(s.phone, 3, 30)) return bad('PHARMACY_SUPPLIER_PHONE_INVALID', 'Le téléphone doit comporter de 3 à 30 caractères.');
  if (s.email !== null && (s.email.length > 120 || !/^[^@\s]+@[^@\s]+$/.test(s.email))) return bad('PHARMACY_SUPPLIER_EMAIL_INVALID', "L'adresse e-mail est invalide.");
  if (!within(s.address, 1, 200)) return bad('PHARMACY_SUPPLIER_ADDRESS_INVALID', "L'adresse doit comporter de 1 à 200 caractères.");
  if (!Number.isInteger(s.paymentTermsDays) || s.paymentTermsDays < 0 || s.paymentTermsDays > 365) return bad('PHARMACY_SUPPLIER_TERMS_INVALID', 'Le délai de paiement doit être un entier de 0 à 365 jours.');
  if (s.notes !== null && s.notes.length > 500) return err(new DomainError('PHARMACY_NOTES_INVALID', 'Le texte ne doit pas dépasser 500 caractères.', { max: 500 }));
  return ok(undefined);
}

/** Fournisseur de la pharmacie. Le code ne change jamais ; rien n'est supprimé : un fournisseur écarté se désactive et ne reçoit plus de commande. */
export class Supplier {
  private constructor(private current: SupplierState) {}

  static restore(state: SupplierState): Supplier {
    return new Supplier(state);
  }

  static create(state: Omit<SupplierState, 'active'>): Result<Supplier> {
    const valid = consistent(state);
    return valid.ok ? ok(new Supplier({ ...state, active: true })) : err(valid.error);
  }

  get state(): SupplierState { return this.current; }
  get id(): SupplierId { return this.current.id; }
  get active(): boolean { return this.current.active; }

  /** Champs absents : inchangés ; contact, téléphone, e-mail, adresse et remarques à `null` : effacés. */
  update(changes: Partial<Pick<SupplierState, 'name' | 'contactName' | 'phone' | 'email' | 'address' | 'paymentTermsDays' | 'notes'>>): Result<void> {
    const next = { ...this.current, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) } as SupplierState;
    const valid = consistent(next);
    if (!valid.ok) return valid;
    this.current = next;
    return ok(undefined);
  }

  setActive(active: boolean): void {
    this.current = { ...this.current, active };
  }
}

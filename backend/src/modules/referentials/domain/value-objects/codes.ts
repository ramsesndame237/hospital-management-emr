import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ValueObject } from '../../../../shared-kernel/value-object';

/** Code d'un catalogue (nomenclature) : MAJUSCULES_ET_TIRETS_BAS, p. ex. `MEASUREMENT_UNIT`. */
export class CatalogCode extends ValueObject<string> {
  static create(raw: string): Result<CatalogCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(normalized)) {
      return err(new DomainError('REFERENTIAL_CATALOG_CODE_INVALID', 'Code de catalogue invalide (MAJUSCULES_ET_TIRETS_BAS).', { value: String(raw) }));
    }
    return ok(new CatalogCode(normalized));
  }
}

/**
 * Code d'une entrée de catalogue : stable, jamais modifié (d'autres données y renvoient). Majuscules, chiffres, « _ », « - » et « . »
 * (p. ex. `GENERAL_MEDICINE`, `MG-KG`, `A01.1`), 1 à 32 caractères.
 */
export class EntryCode extends ValueObject<string> {
  static create(raw: string): Result<EntryCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_.-]{0,31}$/.test(normalized)) {
      return err(new DomainError('REFERENTIAL_ENTRY_CODE_INVALID', "Code d'entrée invalide (1 à 32 caractères : lettres, chiffres, « _ », « - », « . »).", { value: String(raw) }));
    }
    return ok(new EntryCode(normalized));
  }
}

export class EntryId extends ValueObject<string> {
  static create(raw: string): Result<EntryId> {
    const normalized = (raw ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
      return err(new DomainError('REFERENTIAL_ENTRY_ID_INVALID', "L'identifiant de cette entrée est invalide."));
    }
    return ok(new EntryId(normalized.toLowerCase()));
  }
}

/** Position d'affichage : entier de 0 à 100 000 (les entrées de même rang sont départagées par leur code). */
export class SortOrder extends ValueObject<number> {
  static create(raw: number): Result<SortOrder> {
    if (!Number.isInteger(raw) || raw < 0 || raw > 100_000) {
      return err(new DomainError('REFERENTIAL_SORT_ORDER_INVALID', "L'ordre d'affichage doit être un entier de 0 à 100000.", { value: String(raw) }));
    }
    return ok(new SortOrder(raw));
  }
}

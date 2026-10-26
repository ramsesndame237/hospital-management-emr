import { Catalog } from './entities/catalog';
import { CatalogEntry } from './entities/catalog-entry';
import { CatalogCode, EntryCode, EntryId } from './value-objects/codes';

export interface EntryFilter {
  /** Vrai : seulement les entrées actives (proposées à la saisie). Faux : toutes, y compris les désactivées. */
  readonly activeOnly: boolean;
  /** Recherche insensible à la casse dans le code et les libellés. */
  readonly search?: string;
}

export interface CatalogRepository {
  findByCode(code: CatalogCode): Promise<Catalog | null>;
  findAll(): Promise<Catalog[]>;
  /** Nombre d'entrées (total et actives) de chaque catalogue, indexé par code. */
  countEntries(): Promise<Record<string, { total: number; active: number }>>;
}

export interface EntryRepository {
  findById(id: EntryId): Promise<CatalogEntry | null>;
  findByCode(catalog: CatalogCode, code: EntryCode): Promise<CatalogEntry | null>;
  /** Insère ou met à jour l'entrée. */
  save(entry: CatalogEntry): Promise<void>;
  list(catalog: CatalogCode, filter: EntryFilter, offset: number, limit: number): Promise<{ items: CatalogEntry[]; total: number }>;
}

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');
export const ENTRY_REPOSITORY = Symbol('ENTRY_REPOSITORY');

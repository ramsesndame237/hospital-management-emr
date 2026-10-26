import { CatalogCode, EntryCode, EntryId, SortOrder } from '../value-objects/codes';
import { LocalizedLabels } from '../value-objects/localized-labels';

/**
 * Valeur d'un catalogue. Son code ne change jamais et elle n'est jamais supprimée : d'autres données y renvoient. Une valeur
 * devenue obsolète est désactivée — elle reste lisible pour l'existant mais n'est plus proposée à la saisie.
 */
export class CatalogEntry {
  private constructor(
    readonly id: EntryId,
    readonly catalogCode: CatalogCode,
    readonly code: EntryCode,
    private _labels: LocalizedLabels,
    private _sortOrder: SortOrder,
    private _active: boolean,
  ) {}

  /** Nouvelle entrée (active) ; sert aussi à reconstituer une entrée lue en base. */
  static create(input: { id: EntryId; catalogCode: CatalogCode; code: EntryCode; labels: LocalizedLabels; sortOrder: SortOrder; active?: boolean }): CatalogEntry {
    return new CatalogEntry(input.id, input.catalogCode, input.code, input.labels, input.sortOrder, input.active ?? true);
  }

  get labels(): LocalizedLabels { return this._labels; }
  get sortOrder(): SortOrder { return this._sortOrder; }
  get active(): boolean { return this._active; }

  relabel(labels: LocalizedLabels): void { this._labels = labels; }
  reorder(sortOrder: SortOrder): void { this._sortOrder = sortOrder; }
  activate(): void { this._active = true; }
  deactivate(): void { this._active = false; }
}

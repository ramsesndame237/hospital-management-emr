import { CatalogCode } from '../value-objects/codes';
import { LocalizedLabels } from '../value-objects/localized-labels';

/**
 * Catalogue (nomenclature) : une liste de valeurs de référence — spécialités, unités de mesure, motifs… Les catalogues sont
 * définis par l'application (migration) car le code métier y fait référence ; les administrateurs gèrent leurs entrées.
 */
export class Catalog {
  constructor(readonly code: CatalogCode, readonly labels: LocalizedLabels) {}
}

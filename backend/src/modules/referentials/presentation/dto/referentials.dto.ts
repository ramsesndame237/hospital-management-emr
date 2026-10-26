import { IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const LABELS_EXAMPLE = { fr: 'Pédiatrie', en: 'Paediatrics' };
const LABELS_HELP = 'Libellé par langue : `{ "fr": "…", "en": "…" }`. Au moins une langue, 200 caractères au plus par texte.';

export class CreateEntryDto {
  @DocProperty({ description: 'Code stable de l\'entrée (1 à 32 caractères : lettres, chiffres, « _ », « - », « . »). Normalisé en majuscules ; **ne pourra plus être modifié**.', example: 'PEDIATRICS', maxLength: 32 })
  @IsString() @MaxLength(32)
  code!: string;

  @DocProperty({ description: LABELS_HELP, example: LABELS_EXAMPLE, type: Object })
  @IsObject()
  labels!: Record<string, string>;

  @DocProperty({ description: "Position d'affichage (0 à 100000). Par défaut 0 ; à rang égal, tri par code.", example: 30, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(100_000)
  sortOrder?: number;
}

export class UpdateEntryDto {
  @DocProperty({ description: `${LABELS_HELP} Remplace les libellés actuels.`, example: LABELS_EXAMPLE, type: Object, optional: true })
  @IsOptional() @IsObject()
  labels?: Record<string, string>;

  @DocProperty({ description: "Nouvelle position d'affichage (0 à 100000).", example: 30, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(100_000)
  sortOrder?: number;
}

export class CatalogDto {
  @DocProperty({ description: 'Code du catalogue.', example: 'SPECIALTY' })
  code!: string;

  @DocProperty({ description: 'Nom du catalogue, par langue.', example: { fr: 'Spécialités médicales', en: 'Medical specialties' }, type: Object })
  labels!: Record<string, string>;

  @DocProperty({ description: "Nombre d'entrées, désactivées comprises.", example: 12 })
  entryCount!: number;

  @DocProperty({ description: "Nombre d'entrées actives (proposées à la saisie).", example: 11 })
  activeEntryCount!: number;
}

export class EntryDto {
  @DocProperty({ description: "Identifiant de l'entrée.", example: '2f6d1f6e-9a0c-4b5e-8f2e-6a1d4c9b7e10', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code du catalogue.', example: 'SPECIALTY' })
  catalog!: string;

  @DocProperty({ description: "Code stable de l'entrée.", example: 'PEDIATRICS' })
  code!: string;

  @DocProperty({ description: 'Libellé par langue.', example: LABELS_EXAMPLE, type: Object })
  labels!: Record<string, string>;

  @DocProperty({ description: "Position d'affichage.", example: 30 })
  sortOrder!: number;

  @DocProperty({ description: "Faux si l'entrée est désactivée : elle reste lisible pour l'existant mais n'est plus proposée.", example: true })
  active!: boolean;
}

export class EntryPageDto {
  @DocProperty({ description: 'Entrées de la page demandée (triées par position puis code).', type: EntryDto, itemType: EntryDto })
  items!: readonly EntryDto[];

  @DocProperty({ description: "Nombre total d'entrées correspondantes (toutes pages).", example: 12 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

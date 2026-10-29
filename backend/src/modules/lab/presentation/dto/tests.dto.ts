import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { DocProperty } from '../../../api-docs';

export const SECTIONS = ['HAEMATOLOGY', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'MICROBIOLOGY', 'HISTOLOGY', 'OTHER'];
export const SPECIMEN_TYPES = ['BLOOD', 'SERUM', 'PLASMA', 'URINE', 'STOOL', 'SWAB', 'CSF', 'TISSUE', 'OTHER'];
export const CONTAINERS = ['RED', 'YELLOW', 'PURPLE', 'LIGHT_BLUE', 'GREEN', 'GREY', 'STERILE_CUP', 'SWAB', 'OTHER'];
const RESULT_TYPES = ['NUMERIC', 'TEXT', 'CHOICE'];
const SEXES = ['ANY', 'FEMALE', 'MALE'];

export class RangeDto {
  @DocProperty({ description: 'Sexe concerné : `ANY` (les deux), `FEMALE` ou `MALE`.', example: 'FEMALE', enum: SEXES, optional: true })
  @IsOptional() @IsString() @IsIn(SEXES)
  sex?: string;

  @DocProperty({ description: 'Âge minimal inclus, en jours (18 ans ≈ 6 574 jours).', example: 6574 })
  @IsInt() @Min(0) @Max(55000)
  ageMinDays!: number;

  @DocProperty({ description: 'Âge maximal exclu, en jours ; absent : sans limite.', example: null, optional: true, nullable: true })
  @IsOptional() @IsInt() @Min(1) @Max(55000)
  ageMaxDays?: number | null;

  @DocProperty({ description: 'Limite basse normale.', example: 12, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false })
  low?: number | null;

  @DocProperty({ description: 'Limite haute normale.', example: 16, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false })
  high?: number | null;

  @DocProperty({ description: 'Seuil critique bas (au-delà, le clinicien doit être appelé).', example: 7, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false })
  criticalLow?: number | null;

  @DocProperty({ description: 'Seuil critique haut.', example: 20, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false })
  criticalHigh?: number | null;
}

export class SetRangesDto {
  @DocProperty({ description: 'Toutes les tranches de valeurs de référence (remplacent les précédentes). Au plus 20 ; deux tranches du même sexe ne se chevauchent pas.', type: RangeDto, itemType: RangeDto })
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => RangeDto)
  ranges!: RangeDto[];
}

export class CreateTestDto {
  @DocProperty({ description: "Code de l'analyse (1 à 20 caractères : lettres, chiffres, « _ », « - », « . »), normalisé en majuscules. Unique ; **ne pourra plus être modifié**.", example: 'HGB', maxLength: 20 })
  @IsString() @MaxLength(20)
  code!: string;

  @DocProperty({ description: "Libellé de l'analyse.", example: 'Hémoglobine', minLength: 1, maxLength: 120 })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @DocProperty({ description: 'Section du laboratoire.', example: 'HAEMATOLOGY', enum: SECTIONS })
  @IsString() @MaxLength(20)
  section!: string;

  @DocProperty({ description: "Type d'échantillon à prélever.", example: 'BLOOD', enum: SPECIMEN_TYPES })
  @IsString() @MaxLength(20)
  specimenType!: string;

  @DocProperty({ description: 'Contenant (couleur du bouchon pour un tube).', example: 'PURPLE', enum: CONTAINERS })
  @IsString() @MaxLength(20)
  container!: string;

  @DocProperty({ description: '`NUMERIC` (un nombre, avec unité et valeurs de référence), `TEXT` (texte libre) ou `CHOICE` (une valeur parmi une liste). **Ne pourra plus être modifié.**', example: 'NUMERIC', enum: RESULT_TYPES })
  @IsString() @MaxLength(20)
  resultType!: string;

  @DocProperty({ description: "Unité (analyse numérique seulement).", example: 'g/dL', maxLength: 20, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(20)
  unit?: string | null;

  @DocProperty({ description: 'Décimales affichées (0 à 4).', example: 1, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(4)
  decimals?: number;

  @DocProperty({ description: "Valeurs admises (analyse à choix : de 2 à 20, 40 caractères au plus chacune).", example: ['Positif', 'Négatif'], itemType: 'string', optional: true })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true })
  choices?: string[];

  @DocProperty({ description: 'Délai de rendu visé en routine, en minutes (1 à 43 200 ; 240 par défaut).', example: 120, optional: true })
  @IsOptional() @IsInt() @Min(1) @Max(43200)
  tatMinutes?: number;

  @DocProperty({ description: 'Consignes de prélèvement (500 caractères au plus).', example: 'À jeun de préférence.', maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  instructions?: string | null;

  @DocProperty({ description: 'Valeurs de référence (analyse numérique seulement).', type: RangeDto, itemType: RangeDto, optional: true })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => RangeDto)
  ranges?: RangeDto[];
}

export class UpdateTestDto {
  @DocProperty({ description: 'Nouveau libellé.', example: 'Hémoglobine totale', maxLength: 120, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @DocProperty({ description: 'Nouvelle section.', example: 'HAEMATOLOGY', enum: SECTIONS, optional: true })
  @IsOptional() @IsString() @MaxLength(20)
  section?: string;

  @DocProperty({ description: "Nouveau type d'échantillon.", example: 'BLOOD', enum: SPECIMEN_TYPES, optional: true })
  @IsOptional() @IsString() @MaxLength(20)
  specimenType?: string;

  @DocProperty({ description: 'Nouveau contenant.', example: 'PURPLE', enum: CONTAINERS, optional: true })
  @IsOptional() @IsString() @MaxLength(20)
  container?: string;

  @DocProperty({ description: 'Nouvelle unité ; `null` l\'efface.', example: 'g/dL', maxLength: 20, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(20)
  unit?: string | null;

  @DocProperty({ description: 'Décimales affichées (0 à 4).', example: 1, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(4)
  decimals?: number;

  @DocProperty({ description: 'Valeurs admises (analyse à choix).', example: ['Positif', 'Négatif'], itemType: 'string', optional: true })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true })
  choices?: string[];

  @DocProperty({ description: 'Délai de rendu visé en routine, en minutes.', example: 120, optional: true })
  @IsOptional() @IsInt() @Min(1) @Max(43200)
  tatMinutes?: number;

  @DocProperty({ description: 'Consignes de prélèvement ; `null` les efface.', example: 'À jeun.', maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  instructions?: string | null;
}

export class RangeViewDto {
  @DocProperty({ description: 'Sexe concerné.', example: 'ANY', enum: SEXES })
  sex!: string;

  @DocProperty({ description: 'Âge minimal inclus, en jours.', example: 0 })
  ageMinDays!: number;

  @DocProperty({ description: 'Âge maximal exclu, en jours.', example: null, nullable: true })
  ageMaxDays!: number | null;

  @DocProperty({ description: 'Limite basse.', example: 12, nullable: true })
  low!: number | null;

  @DocProperty({ description: 'Limite haute.', example: 16, nullable: true })
  high!: number | null;

  @DocProperty({ description: 'Seuil critique bas.', example: 7, nullable: true })
  criticalLow!: number | null;

  @DocProperty({ description: 'Seuil critique haut.', example: 20, nullable: true })
  criticalHigh!: number | null;
}

export class TestDto {
  @DocProperty({ description: "Identifiant de l'analyse.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code.', example: 'HGB' })
  code!: string;

  @DocProperty({ description: 'Libellé.', example: 'Hémoglobine' })
  name!: string;

  @DocProperty({ description: 'Section du laboratoire.', example: 'HAEMATOLOGY', enum: SECTIONS })
  section!: string;

  @DocProperty({ description: "Type d'échantillon.", example: 'BLOOD', enum: SPECIMEN_TYPES })
  specimenType!: string;

  @DocProperty({ description: 'Contenant.', example: 'PURPLE', enum: CONTAINERS })
  container!: string;

  @DocProperty({ description: 'Type de résultat.', example: 'NUMERIC', enum: RESULT_TYPES })
  resultType!: string;

  @DocProperty({ description: 'Unité.', example: 'g/dL', nullable: true })
  unit!: string | null;

  @DocProperty({ description: 'Décimales affichées.', example: 1 })
  decimals!: number;

  @DocProperty({ description: 'Valeurs admises (analyse à choix).', example: [], itemType: 'string' })
  choices!: readonly string[];

  @DocProperty({ description: 'Délai de rendu visé en routine, en minutes.', example: 120 })
  tatMinutes!: number;

  @DocProperty({ description: 'Consignes de prélèvement.', example: null, nullable: true })
  instructions!: string | null;

  @DocProperty({ description: 'Valeurs de référence.', type: RangeViewDto, itemType: RangeViewDto })
  ranges!: readonly RangeViewDto[];

  @DocProperty({ description: "`false` : retirée du catalogue, on ne peut plus la demander.", example: true })
  active!: boolean;
}

export class TestPageDto {
  @DocProperty({ description: 'Analyses de la page, triées par section puis code.', type: TestDto, itemType: TestDto })
  items!: readonly TestDto[];

  @DocProperty({ description: "Nombre total d'analyses correspondantes (toutes pages).", example: 42 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

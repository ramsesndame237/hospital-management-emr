import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

export const FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'INFUSION', 'CREAM', 'OINTMENT', 'DROPS', 'INHALER', 'SUPPOSITORY', 'POWDER', 'PATCH', 'OTHER'];
export const SCHEDULES = ['OTC', 'PRESCRIPTION', 'CONTROLLED'];
export const STORAGES = ['ROOM', 'COOL', 'COLD_CHAIN'];
const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';

export class UserSummaryDto {
  @DocProperty({ description: 'Identifiant du compte.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant de connexion.', example: 'pharmacien' })
  username!: string;
}

export class DrugSummaryDto {
  @DocProperty({ description: 'Identifiant du médicament.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code.', example: 'PARA500' })
  code!: string;

  @DocProperty({ description: "Nom d'usage ou commercial.", example: 'Doliprane 500' })
  name!: string;

  @DocProperty({ description: 'Dénomination commune.', example: 'Paracétamol' })
  genericName!: string;

  @DocProperty({ description: 'Dosage.', example: '500 mg', nullable: true })
  strength!: string | null;

  @DocProperty({ description: 'Unité de dispensation.', example: 'comprimé' })
  unit!: string;
}

export class CreateDrugDto {
  @DocProperty({ description: 'Code du médicament (1 à 30 caractères : lettres, chiffres, « _ », « - », « . »), normalisé en majuscules. Unique ; **ne pourra plus être modifié**.', example: 'PARA500', maxLength: 30 })
  @IsString() @MaxLength(30)
  code!: string;

  @DocProperty({ description: "Nom d'usage ou commercial.", example: 'Doliprane 500', minLength: 1, maxLength: 120 })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @DocProperty({ description: 'Dénomination commune internationale (sert aux substitutions).', example: 'Paracétamol', minLength: 1, maxLength: 120 })
  @IsString() @MinLength(1) @MaxLength(120)
  genericName!: string;

  @DocProperty({ description: 'Dosage tel qu’on l’écrit.', example: '500 mg', maxLength: 40, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(40)
  strength?: string | null;

  @DocProperty({ description: 'Forme galénique.', example: 'TABLET', enum: FORMS })
  @IsString() @MaxLength(20)
  form!: string;

  @DocProperty({ description: 'Classe de délivrance : `OTC` (vente libre), `PRESCRIPTION` (sur ordonnance) ou `CONTROLLED` (substance contrôlée).', example: 'PRESCRIPTION', enum: SCHEDULES })
  @IsString() @MaxLength(20)
  schedule!: string;

  @DocProperty({ description: 'Conservation : `ROOM` (ambiante), `COOL` (au frais) ou `COLD_CHAIN` (chaîne du froid). Défaut `ROOM`.', example: 'ROOM', enum: STORAGES, optional: true })
  @IsOptional() @IsString() @MaxLength(20)
  storage?: string;

  @DocProperty({ description: 'Code ATC (OMS, 7 caractères).', example: 'N02BE01', maxLength: 7, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(7)
  atcCode?: string | null;

  @DocProperty({ description: 'Unité de dispensation (celle du stock et du prix).', example: 'comprimé', minLength: 1, maxLength: 20 })
  @IsString() @MinLength(1) @MaxLength(20)
  unit!: string;

  @DocProperty({ description: 'Prix de vente d’une unité, en plus petite unité monétaire (entier, 0 par défaut).', example: 25, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000_000)
  unitPrice?: number;

  @DocProperty({ description: 'Seuil de réapprovisionnement : en dessous, le stock est « bas » (0 : pas de seuil).', example: 200, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000)
  reorderLevel?: number;

  @DocProperty({ description: 'Remarques (500 caractères au plus).', example: null, maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  notes?: string | null;
}

export class UpdateDrugDto {
  @DocProperty({ description: 'Nouveau nom.', example: 'Doliprane 500 mg', maxLength: 120, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @DocProperty({ description: 'Nouvelle dénomination commune.', example: 'Paracétamol', maxLength: 120, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  genericName?: string;

  @DocProperty({ description: 'Nouveau dosage ; `null` l’efface.', example: '500 mg', maxLength: 40, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(40)
  strength?: string | null;

  @DocProperty({ description: 'Nouvelle forme.', example: 'TABLET', enum: FORMS, optional: true })
  @IsOptional() @IsString() @MaxLength(20)
  form?: string;

  @DocProperty({ description: 'Nouvelle classe de délivrance.', example: 'PRESCRIPTION', enum: SCHEDULES, optional: true })
  @IsOptional() @IsString() @MaxLength(20)
  schedule?: string;

  @DocProperty({ description: 'Nouvelle condition de conservation.', example: 'ROOM', enum: STORAGES, optional: true })
  @IsOptional() @IsString() @MaxLength(20)
  storage?: string;

  @DocProperty({ description: 'Nouveau code ATC ; `null` l’efface.', example: 'N02BE01', maxLength: 7, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(7)
  atcCode?: string | null;

  @DocProperty({ description: 'Nouvelle unité de dispensation.', example: 'comprimé', maxLength: 20, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20)
  unit?: string;

  @DocProperty({ description: 'Nouveau prix de vente (l’ancien et le nouveau sont inscrits au journal d’audit).', example: 30, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000_000)
  unitPrice?: number;

  @DocProperty({ description: 'Nouveau seuil de réapprovisionnement.', example: 200, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000)
  reorderLevel?: number;

  @DocProperty({ description: 'Remarques ; `null` les efface.', example: null, maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  notes?: string | null;
}

export class DrugDto {
  @DocProperty({ description: 'Identifiant du médicament.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code.', example: 'PARA500' })
  code!: string;

  @DocProperty({ description: "Nom d'usage ou commercial.", example: 'Doliprane 500' })
  name!: string;

  @DocProperty({ description: 'Dénomination commune.', example: 'Paracétamol' })
  genericName!: string;

  @DocProperty({ description: 'Dosage.', example: '500 mg', nullable: true })
  strength!: string | null;

  @DocProperty({ description: 'Forme galénique.', example: 'TABLET', enum: FORMS })
  form!: string;

  @DocProperty({ description: 'Classe de délivrance.', example: 'PRESCRIPTION', enum: SCHEDULES })
  schedule!: string;

  @DocProperty({ description: 'Conservation.', example: 'ROOM', enum: STORAGES })
  storage!: string;

  @DocProperty({ description: 'Code ATC.', example: 'N02BE01', nullable: true })
  atcCode!: string | null;

  @DocProperty({ description: 'Unité de dispensation.', example: 'comprimé' })
  unit!: string;

  @DocProperty({ description: 'Prix de vente d’une unité, en plus petite unité monétaire.', example: 25 })
  unitPrice!: number;

  @DocProperty({ description: 'Seuil de réapprovisionnement.', example: 200 })
  reorderLevel!: number;

  @DocProperty({ description: 'Remarques.', example: null, nullable: true })
  notes!: string | null;

  @DocProperty({ description: '`false` : retiré du formulaire, on ne peut plus le recevoir.', example: true })
  active!: boolean;
}

export class DrugPageDto {
  @DocProperty({ description: 'Médicaments de la page, triés par dénomination commune puis nom.', type: DrugDto, itemType: DrugDto })
  items!: readonly DrugDto[];

  @DocProperty({ description: 'Nombre total de médicaments correspondants (toutes pages).', example: 120 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

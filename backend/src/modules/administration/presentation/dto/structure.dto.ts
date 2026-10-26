import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const SERVICE_TYPES = ['CLINICAL', 'MEDICO_TECHNICAL', 'ADMINISTRATIVE', 'SUPPORT'];
const KINDS = ['SERVICE', 'UNIT', 'ROOM', 'BED'];
const CODE_HELP = 'Code (1 à 32 caractères : lettres, chiffres, « _ », « - », « . »), normalisé en majuscules. Unique parmi les éléments de même parent ; **ne pourra plus être modifié**.';

/** Bornes de taille partout : pas de corps géants. Les règles précises (formats, hiérarchie) sont dans le domaine. */
export class CreateServiceDto {
  @DocProperty({ description: CODE_HELP, example: 'PED', maxLength: 32 })
  @IsString() @MaxLength(32)
  code!: string;

  @DocProperty({ description: 'Nom du service.', example: 'Pédiatrie', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @DocProperty({ description: 'Nature du service : soins (`CLINICAL`), médico-technique (`MEDICO_TECHNICAL`), administratif (`ADMINISTRATIVE`) ou support/logistique (`SUPPORT`).', example: 'CLINICAL', enum: SERVICE_TYPES })
  @IsString() @MaxLength(32)
  serviceType!: string;

  @DocProperty({ description: 'Spécialité du service : un code actif du catalogue `SPECIALTY` des référentiels (facultatif).', example: 'PEDIATRICS', maxLength: 32, optional: true })
  @IsOptional() @IsString() @MaxLength(32)
  specialtyCode?: string;
}

export class CreateChildDto {
  @DocProperty({ description: CODE_HELP, example: 'U1', maxLength: 32 })
  @IsString() @MaxLength(32)
  code!: string;

  @DocProperty({ description: "Nom de l'unité, de la salle ou du lit.", example: 'Unité de néonatologie', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @DocProperty({ description: 'Étage, **pour une salle seulement** (« RDC », « 1 », « -1 »…).', example: '1', maxLength: 32, optional: true })
  @IsOptional() @IsString() @MaxLength(32)
  floor?: string;
}

export class UpdateNodeDto {
  @DocProperty({ description: 'Nouveau nom.', example: 'Pédiatrie générale', minLength: 1, maxLength: 200, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @DocProperty({ description: 'Nouvelle nature (services seulement).', example: 'CLINICAL', enum: SERVICE_TYPES, optional: true })
  @IsOptional() @IsString() @MaxLength(32)
  serviceType?: string;

  @DocProperty({ description: 'Nouvelle spécialité (services seulement) ; `null` la retire.', example: 'PEDIATRICS', maxLength: 32, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(32)
  specialtyCode?: string | null;

  @DocProperty({ description: "Nouvel étage (salles seulement) ; `null` le retire.", example: '2', maxLength: 32, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(32)
  floor?: string | null;
}

export class NodeDto {
  @DocProperty({ description: "Identifiant de l'élément.", example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  id!: string;

  @DocProperty({ description: "Établissement auquel l'élément appartient.", example: '7c1e0c1e-6f2a-4f55-8c61-0b6f3e0d9a21', format: 'uuid' })
  facilityId!: string;

  @DocProperty({ description: 'Élément parent ; `null` pour un service (rattaché à l\'établissement).', example: null, format: 'uuid', nullable: true })
  parentId!: string | null;

  @DocProperty({ description: 'Niveau : `SERVICE` > `UNIT` (unité) > `ROOM` (salle) > `BED` (lit).', example: 'SERVICE', enum: KINDS })
  kind!: string;

  @DocProperty({ description: "Code de l'élément (stable).", example: 'PED' })
  code!: string;

  @DocProperty({ description: "Nom de l'élément.", example: 'Pédiatrie' })
  name!: string;

  @DocProperty({ description: "Faux si l'élément est désactivé (il reste lisible, mais n'accueille plus rien).", example: true })
  active!: boolean;

  @DocProperty({ description: 'Nature (services seulement).', example: 'CLINICAL', enum: SERVICE_TYPES, nullable: true })
  serviceType!: string | null;

  @DocProperty({ description: 'Code de la spécialité (services seulement).', example: 'PEDIATRICS', nullable: true })
  specialtyCode!: string | null;

  @DocProperty({ description: 'Étage (salles seulement).', example: '1', nullable: true })
  floor!: string | null;
}

export class NodeTreeDto extends NodeDto {
  @DocProperty({ description: 'Éléments du niveau suivant (même forme, avec leurs propres `children`), triés par code.', type: NodeDto, itemType: NodeDto })
  children!: readonly NodeTreeDto[];
}

export class StructureTotalsDto {
  @DocProperty({ description: 'Services actifs.', example: 6 })
  services!: number;

  @DocProperty({ description: 'Unités actives.', example: 14 })
  units!: number;

  @DocProperty({ description: 'Salles actives.', example: 52 })
  rooms!: number;

  @DocProperty({ description: "Lits actifs : la capacité d'accueil de l'établissement.", example: 120 })
  beds!: number;
}

export class StructureTreeDto {
  @DocProperty({ description: "Établissement.", example: '7c1e0c1e-6f2a-4f55-8c61-0b6f3e0d9a21', format: 'uuid' })
  facilityId!: string;

  @DocProperty({ description: 'Totaux des éléments **actifs**, par niveau.', type: StructureTotalsDto })
  totals!: StructureTotalsDto;

  @DocProperty({ description: 'Services de l\'établissement, triés par code, chacun avec ses unités, salles et lits.', type: NodeTreeDto, itemType: NodeTreeDto })
  services!: readonly NodeTreeDto[];
}

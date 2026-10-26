import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { FacilityStatusEnum } from '../../domain/value-objects/FacilityStatus';

const STATUSES: readonly string[] = Object.values(FacilityStatusEnum);
const CODE_EXAMPLE = 'A1B2-abc-01';

/** Bornes de taille partout : pas de corps géants. Le format exact du code est contrôlé par le domaine (message traduit). */
export class SetupOrganizationDto {
  @DocProperty({ description: "Nom de l'organisation (l'hôpital ou le groupe hospitalier).", example: 'Centre hospitalier de Démonstration', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;
}

export class RegisterFacilityDto {
  @DocProperty({ description: "Nom de l'établissement.", example: 'Site principal', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @DocProperty({ description: "Code unique de l'établissement : 4 caractères (chiffres ou majuscules), 3 (chiffres ou minuscules), 2 chiffres, séparés par « - ».", example: CODE_EXAMPLE, maxLength: 32 })
  @IsString() @MaxLength(32)
  code!: string;

  @DocProperty({ description: 'Statut initial. Par défaut : `OPERATIONAL_UNDER_CONSTRUCTION` (établissement non opérationnel).', example: 'OPERATIONAL_UNDER_CONSTRUCTION', enum: STATUSES, optional: true })
  @IsOptional() @IsString() @MaxLength(64)
  status?: string;
}

export class UpdateFacilityDto {
  @DocProperty({ description: 'Nouveau nom (laisser absent pour ne pas le changer).', example: 'Site nord', minLength: 1, maxLength: 200, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @DocProperty({ description: 'Nouveau code (laisser absent pour ne pas le changer). Même format qu\'à la création.', example: CODE_EXAMPLE, maxLength: 32, optional: true })
  @IsOptional() @IsString() @MaxLength(32)
  code?: string;
}

export class ChangeFacilityStatusDto {
  @DocProperty({ description: 'Nouveau statut de l\'établissement.', example: 'OPERATIONAL_OPEN', enum: STATUSES })
  @IsString() @IsIn(STATUSES)
  status!: string;
}

export class OrganizationDto {
  @DocProperty({ description: "Identifiant de l'organisation.", example: '0d5a4fd2-5a43-4a7c-9f43-bf7b3d6a2f10', format: 'uuid' })
  id!: string;

  @DocProperty({ description: "Nom de l'organisation.", example: 'Centre hospitalier de Démonstration' })
  name!: string;
}

export class FacilityDto {
  @DocProperty({ description: "Identifiant de l'établissement.", example: '7c1e0c1e-6f2a-4f55-8c61-0b6f3e0d9a21', format: 'uuid' })
  id!: string;

  @DocProperty({ description: "Identifiant de l'organisation de rattachement.", example: '0d5a4fd2-5a43-4a7c-9f43-bf7b3d6a2f10', format: 'uuid' })
  organizationId!: string;

  @DocProperty({ description: "Code unique de l'établissement.", example: CODE_EXAMPLE })
  code!: string;

  @DocProperty({ description: "Nom de l'établissement.", example: 'Site principal' })
  name!: string;

  @DocProperty({ description: "Statut de l'établissement (code stable ; l'interface le traduit).", example: 'OPERATIONAL_OPEN', enum: STATUSES })
  status!: string;

  @DocProperty({ description: "Vrai seulement si l'établissement est ouvert (`OPERATIONAL_OPEN`).", example: true })
  operational!: boolean;
}

export class FacilityPageDto {
  @DocProperty({ description: 'Établissements de la page demandée (triés par nom).', type: FacilityDto, itemType: FacilityDto })
  items!: readonly FacilityDto[];

  @DocProperty({ description: "Nombre total d'établissements (toutes pages).", example: 3 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

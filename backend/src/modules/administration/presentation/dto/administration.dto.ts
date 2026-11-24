import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
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

/** Où se trouve l'établissement : l'adresse d'un bâtiment (jamais celle d'un patient). Le pays est obligatoire ; le reste précise. */
export class FacilityLocationDto {
  @DocProperty({ description: 'Pays : code ISO 3166-1 alpha-2 (2 lettres).', example: 'CM', minLength: 2, maxLength: 2 })
  @IsString() @Matches(/^[A-Za-z]{2}$/, { message: 'Le pays doit être un code ISO de 2 lettres (ex. CM).' })
  countryCode!: string;

  @DocProperty({ description: 'Région, province ou département (selon le pays).', example: 'Centre', maxLength: 120, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(120)
  region?: string | null;

  @DocProperty({ description: 'Commune, ville ou arrondissement : ses 2 premières lettres entrent dans le code.', example: 'Yaoundé', maxLength: 120, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(120)
  commune?: string | null;

  @DocProperty({ description: 'Rue et numéro.', example: 'Avenue Kennedy', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  street?: string | null;

  @DocProperty({ description: 'Latitude (-90 à 90) ; va avec la longitude.', example: 3.848, optional: true, nullable: true })
  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  latitude?: number | null;

  @DocProperty({ description: 'Longitude (-180 à 180) ; va avec la latitude.', example: 11.502, optional: true, nullable: true })
  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  longitude?: number | null;
}

export class RegisterFacilityDto {
  @DocProperty({ description: "Nom de l'établissement.", example: 'Site principal', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @DocProperty({
    description: "Code unique de l'établissement. **Facultatif : absent, il est composé** d'après la localisation et le nom (`PPLL-nnn-SS` : pays + commune, initiales du nom, premier numéro libre ; ex. `CMYA-hcy-01`). S'il est fourni : 4 caractères (chiffres ou majuscules), 3 (chiffres ou minuscules), 2 chiffres, séparés par « - ».",
    example: CODE_EXAMPLE, maxLength: 32, optional: true, nullable: true,
  })
  @IsOptional() @IsString() @MaxLength(32)
  code?: string | null;

  @DocProperty({ description: "Localisation. **Obligatoire quand le code n'est pas fourni** (il en est déduit).", type: FacilityLocationDto, optional: true, nullable: true })
  @IsOptional() @ValidateNested() @Type(() => FacilityLocationDto)
  location?: FacilityLocationDto | null;

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

  @DocProperty({ description: 'Nouvelle localisation (elle remplace l\'ancienne) ; `null` l\'efface. Le code ne change pas tout seul.', type: FacilityLocationDto, optional: true, nullable: true })
  @IsOptional() @ValidateNested() @Type(() => FacilityLocationDto)
  location?: FacilityLocationDto | null;
}

export class PreviewFacilityCodeDto {
  @DocProperty({ description: "Nom de l'établissement.", example: 'Hôpital Central de Yaoundé', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @DocProperty({ description: 'Localisation (le pays est obligatoire).', type: FacilityLocationDto })
  @ValidateNested() @Type(() => FacilityLocationDto)
  location!: FacilityLocationDto;
}

export class FacilityCodePreviewDto {
  @DocProperty({ description: "Le code que recevrait l'établissement s'il était créé maintenant (le numéro d'ordre est le premier libre).", example: 'CMYA-hcy-01' })
  code!: string;
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

  @DocProperty({ description: 'Où se trouve l\'établissement ; `null` pour un établissement créé avant la localisation.', type: FacilityLocationDto, nullable: true })
  location!: FacilityLocationDto | null;
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

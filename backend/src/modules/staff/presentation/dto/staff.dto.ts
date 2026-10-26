import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const DATE_HELP = 'Date au format `AAAA-MM-JJ`.';
const PROFESSIONS_HELP = 'Code actif du catalogue `PROFESSION` des référentiels (voir `GET /api/v1/referentials/PROFESSION/entries`).';
const SPECIALTY_HELP = 'Code actif du catalogue `SPECIALTY` des référentiels.';

/** Bornes de taille partout : pas de corps géants. Les règles précises (formats, références, dates) sont dans le domaine. */
export class RegisterStaffDto {
  @DocProperty({ description: 'Matricule, unique et jamais modifié (1 à 32 caractères : lettres, chiffres, « _ », « - », « . », « / »).', example: 'MAT-0042', maxLength: 32 })
  @IsString() @MaxLength(32)
  staffNumber!: string;

  @DocProperty({ description: 'Prénom.', example: 'Marie', minLength: 1, maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  firstName!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Curie', minLength: 1, maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  lastName!: string;

  @DocProperty({ description: PROFESSIONS_HELP, example: 'DOCTOR', maxLength: 32 })
  @IsString() @MaxLength(32)
  professionCode!: string;

  @DocProperty({ description: SPECIALTY_HELP, example: 'PEDIATRICS', maxLength: 32, optional: true })
  @IsOptional() @IsString() @MaxLength(32)
  specialtyCode?: string;

  @DocProperty({ description: 'Adresse e-mail professionnelle.', example: 'm.curie@hopital.example', maxLength: 254, optional: true })
  @IsOptional() @IsString() @MaxLength(254)
  email?: string;

  @DocProperty({ description: 'Téléphone (chiffres, espaces, « + » initial).', example: '+237 6 55 00 00 00', maxLength: 20, optional: true })
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @DocProperty({ description: `Date d'embauche. ${DATE_HELP}`, example: '2024-09-01', maxLength: 10, optional: true })
  @IsOptional() @IsString() @MaxLength(10)
  hiredOn?: string;
}

export class UpdateStaffDto {
  @DocProperty({ description: 'Nouveau prénom.', example: 'Marie', minLength: 1, maxLength: 100, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  firstName?: string;

  @DocProperty({ description: 'Nouveau nom de famille.', example: 'Curie', minLength: 1, maxLength: 100, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  lastName?: string;

  @DocProperty({ description: PROFESSIONS_HELP, example: 'DOCTOR', maxLength: 32, optional: true })
  @IsOptional() @IsString() @MaxLength(32)
  professionCode?: string;

  @DocProperty({ description: `${SPECIALTY_HELP} \`null\` la retire.`, example: 'PEDIATRICS', maxLength: 32, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(32)
  specialtyCode?: string | null;

  @DocProperty({ description: 'Adresse e-mail ; `null` la retire.', example: 'm.curie@hopital.example', maxLength: 254, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(254)
  email?: string | null;

  @DocProperty({ description: 'Téléphone ; `null` le retire.', example: '+237 6 55 00 00 00', maxLength: 20, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string | null;

  @DocProperty({ description: `Date d'embauche ; \`null\` l'efface. ${DATE_HELP}`, example: '2024-09-01', maxLength: 10, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(10)
  hiredOn?: string | null;
}

export class DepartStaffDto {
  @DocProperty({ description: `Date de départ (aujourd'hui par défaut ; une date future programme le départ). ${DATE_HELP}`, example: '2026-12-31', maxLength: 10, optional: true })
  @IsOptional() @IsString() @MaxLength(10)
  departedOn?: string;
}

export class LinkAccountDto {
  @DocProperty({ description: 'Identifiant du compte de connexion à relier (voir `GET /api/v1/users`).', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class AssignDto {
  @DocProperty({ description: "Service ou unité d'affectation (un identifiant de `/api/v1/structure`). Pas une salle ni un lit.", example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  @IsUUID()
  nodeId!: string;

  @DocProperty({ description: `Début (aujourd'hui par défaut). ${DATE_HELP}`, example: '2026-11-01', maxLength: 10, optional: true })
  @IsOptional() @IsString() @MaxLength(10)
  startDate?: string;

  @DocProperty({ description: `Fin, si elle est déjà connue (sinon l'affectation reste ouverte). ${DATE_HELP}`, example: '2027-10-31', maxLength: 10, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(10)
  endDate?: string | null;

  @DocProperty({ description: 'Affectation principale de la personne (une seule à la fois). Faux par défaut.', example: true, optional: true })
  @IsOptional() @IsBoolean()
  primary?: boolean;
}

export class EndAssignmentDto {
  @DocProperty({ description: `Date de fin (aujourd'hui par défaut). ${DATE_HELP}`, example: '2026-12-31', maxLength: 10, optional: true })
  @IsOptional() @IsString() @MaxLength(10)
  endDate?: string;
}

export class SetPrimaryDto {
  @DocProperty({ description: 'Vrai : en faire l\'affectation principale ; faux : lui retirer ce statut.', example: true })
  @IsBoolean()
  primary!: boolean;
}

export class StaffDto {
  @DocProperty({ description: 'Identifiant de la fiche.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Matricule.', example: 'MAT-0042' })
  staffNumber!: string;

  @DocProperty({ description: 'Prénom.', example: 'Marie' })
  firstName!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Curie' })
  lastName!: string;

  @DocProperty({ description: 'Profession (code du catalogue `PROFESSION`).', example: 'DOCTOR' })
  professionCode!: string;

  @DocProperty({ description: 'Spécialité (code du catalogue `SPECIALTY`).', example: 'PEDIATRICS', nullable: true })
  specialtyCode!: string | null;

  @DocProperty({ description: 'E-mail professionnel.', example: 'm.curie@hopital.example', nullable: true })
  email!: string | null;

  @DocProperty({ description: 'Téléphone.', example: '+237 6 55 00 00 00', nullable: true })
  phone!: string | null;

  @DocProperty({ description: "Date d'embauche.", example: '2024-09-01', nullable: true })
  hiredOn!: string | null;

  @DocProperty({ description: 'Date de départ (enregistrée, éventuellement future).', example: null, nullable: true })
  departedOn!: string | null;

  @DocProperty({ description: "Situation aujourd'hui : `ACTIVE` ou `DEPARTED` (un départ futur laisse la personne `ACTIVE`).", example: 'ACTIVE', enum: ['ACTIVE', 'DEPARTED'] })
  status!: 'ACTIVE' | 'DEPARTED';

  @DocProperty({ description: 'Compte de connexion relié, s\'il y en a un.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid', nullable: true })
  userId!: string | null;
}

export class StaffPageDto {
  @DocProperty({ description: 'Fiches de la page demandée (triées par nom puis prénom).', type: StaffDto, itemType: StaffDto })
  items!: readonly StaffDto[];

  @DocProperty({ description: 'Nombre total de fiches correspondantes (toutes pages).', example: 42 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

export class AssignmentDto {
  @DocProperty({ description: "Identifiant de l'affectation.", example: 'a3d5e7f9-1b2c-4d6e-8f01-23456789abcd', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Personne affectée.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', format: 'uuid' })
  staffId!: string;

  @DocProperty({ description: "Service ou unité d'affectation.", example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  nodeId!: string;

  @DocProperty({ description: "Établissement de l'élément.", example: '7c1e0c1e-6f2a-4f55-8c61-0b6f3e0d9a21', format: 'uuid' })
  facilityId!: string;

  @DocProperty({ description: 'Début.', example: '2026-11-01' })
  startDate!: string;

  @DocProperty({ description: 'Fin ; `null` tant que l\'affectation est ouverte.', example: null, nullable: true })
  endDate!: string | null;

  @DocProperty({ description: 'Affectation principale de la personne.', example: true })
  primary!: boolean;

  @DocProperty({ description: "Vrai si l'affectation est en cours aujourd'hui (commencée et pas terminée).", example: true })
  current!: boolean;
}

export class StaffSummaryDto {
  @DocProperty({ description: 'Matricule.', example: 'MAT-0042' })
  staffNumber!: string;

  @DocProperty({ description: 'Prénom.', example: 'Marie' })
  firstName!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Curie' })
  lastName!: string;

  @DocProperty({ description: 'Profession (code).', example: 'DOCTOR' })
  professionCode!: string;
}

export class NodeAssignmentDto extends AssignmentDto {
  @DocProperty({ description: 'La personne affectée.', type: StaffSummaryDto })
  staff!: StaffSummaryDto;
}

export class MyProfileDto {
  @DocProperty({ description: 'Votre fiche.', type: StaffDto })
  staff!: StaffDto;

  @DocProperty({ description: 'Vos affectations en cours ou à venir.', type: AssignmentDto, itemType: AssignmentDto })
  assignments!: readonly AssignmentDto[];
}

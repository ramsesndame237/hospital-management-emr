import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const SEXES = ['MALE', 'FEMALE', 'UNDETERMINED'];
const IDENTITY_STATUSES = ['CONFIRMED', 'PROVISIONAL'];
const MARITAL = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED'];
const RELATIONSHIPS = ['SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'RELATIVE', 'FRIEND', 'GUARDIAN', 'OTHER'];
const DOCUMENTS = ['NATIONAL_ID', 'PASSPORT', 'BIRTH_CERTIFICATE', 'DRIVING_LICENSE', 'OTHER'];
const DATE = 'Date au format `AAAA-MM-JJ`.';

/** Bornes de taille partout : pas de corps géants. Les règles précises (formats, dates, cohérence) sont dans le domaine. */
export class AddressDto {
  @DocProperty({ description: 'Rue, repère, immeuble…', example: 'Rue de la Joie, face pharmacie du Centre', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  line?: string | null;

  @DocProperty({ description: 'Quartier.', example: 'Bastos', maxLength: 100, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(100)
  quarter?: string | null;

  @DocProperty({ description: 'Ville.', example: 'Yaoundé', maxLength: 100, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(100)
  city?: string | null;

  @DocProperty({ description: 'Région.', example: 'Centre', maxLength: 100, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(100)
  region?: string | null;

  @DocProperty({ description: 'Pays (code ISO 3166-1 à 2 lettres).', example: 'CM', maxLength: 2, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(2)
  country?: string | null;
}

export class IdentityDocumentDto {
  @DocProperty({ description: 'Type de pièce.', example: 'NATIONAL_ID', enum: DOCUMENTS })
  @IsString() @MaxLength(32)
  type!: string;

  @DocProperty({ description: 'Numéro de la pièce (3 à 40 caractères : lettres, chiffres, « - », « / » ; espaces ignorés). Une pièce ne désigne qu\'un dossier.', example: '123456789', maxLength: 60 })
  @IsString() @MaxLength(60)
  number!: string;
}

export class NextOfKinDto {
  @DocProperty({ description: 'Nom de la personne à prévenir.', example: 'Jeanne Ngo', maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @DocProperty({ description: 'Lien avec le patient.', example: 'SPOUSE', enum: RELATIONSHIPS })
  @IsString() @MaxLength(32)
  relationship!: string;

  @DocProperty({ description: 'Téléphone.', example: '+237 677 00 00 00', maxLength: 20 })
  @IsString() @MaxLength(20)
  phone!: string;
}

/** Corps commun à la création et à la modification ; à la création, nom, prénom, sexe et date de naissance sont obligatoires. */
export class PatientFieldsDto {
  @DocProperty({ description: "`CONFIRMED` (défaut) ou `PROVISIONAL` : patient non identifié (urgence, nouveau-né sans nom…), à confirmer plus tard. Un dossier confirmé ne redevient pas provisoire.", example: 'CONFIRMED', enum: IDENTITY_STATUSES, optional: true })
  @IsOptional() @IsString() @MaxLength(16)
  identityStatus?: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Mbarga', minLength: 1, maxLength: 100, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  lastName?: string;

  @DocProperty({ description: 'Prénom(s).', example: 'Élisabeth', minLength: 1, maxLength: 100, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  firstName?: string;

  @DocProperty({ description: 'Sexe administratif.', example: 'FEMALE', enum: SEXES, optional: true })
  @IsOptional() @IsString() @MaxLength(16)
  sex?: string;

  @DocProperty({ description: `Date de naissance (de 1880 à aujourd'hui). ${DATE}`, example: '1990-03-14', maxLength: 10, optional: true })
  @IsOptional() @IsString() @MaxLength(10)
  birthDate?: string;

  @DocProperty({ description: "Vrai si la date de naissance n'est qu'une estimation (âge approximatif).", example: false, optional: true })
  @IsOptional() @IsBoolean()
  birthDateEstimated?: boolean;

  @DocProperty({ description: 'Lieu de naissance ; `null` le retire.', example: 'Douala', maxLength: 100, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(100)
  birthPlace?: string | null;

  @DocProperty({ description: 'Nationalité (code pays ISO 3166-1 à 2 lettres) ; `null` la retire.', example: 'CM', maxLength: 2, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(2)
  nationality?: string | null;

  @DocProperty({ description: 'Situation matrimoniale ; `null` la retire.', example: 'MARRIED', enum: MARITAL, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(16)
  maritalStatus?: string | null;

  @DocProperty({ description: 'Profession ; `null` la retire.', example: 'Enseignante', maxLength: 100, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(100)
  occupation?: string | null;

  @DocProperty({ description: 'Téléphone ; `null` le retire.', example: '+237 655 00 00 00', maxLength: 20, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string | null;

  @DocProperty({ description: 'Adresse e-mail ; `null` la retire.', example: 'e.mbarga@example.org', maxLength: 254, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(254)
  email?: string | null;

  @DocProperty({ description: "Adresse. Sur une modification, elle **remplace** l'adresse actuelle ; `null` la retire.", type: AddressDto, optional: true, nullable: true })
  @IsOptional() @ValidateNested() @Type(() => AddressDto)
  address?: AddressDto | null;

  @DocProperty({ description: "Pièce d'identité. Sur une modification, elle **remplace** la pièce actuelle ; `null` la retire.", type: IdentityDocumentDto, optional: true, nullable: true })
  @IsOptional() @ValidateNested() @Type(() => IdentityDocumentDto)
  identityDocument?: IdentityDocumentDto | null;

  @DocProperty({ description: 'Personne à prévenir. Sur une modification, elle **remplace** la personne actuelle ; `null` la retire.', type: NextOfKinDto, optional: true, nullable: true })
  @IsOptional() @ValidateNested() @Type(() => NextOfKinDto)
  nextOfKin?: NextOfKinDto | null;
}

export class RegisterPatientDto extends PatientFieldsDto {
  @DocProperty({ description: "Enregistrer malgré les dossiers ressemblants signalés par un refus `PATIENT_POSSIBLE_DUPLICATE` : la personne est bien différente. Tracé dans le journal d'audit.", example: false, optional: true })
  @IsOptional() @IsBoolean()
  ignoreDuplicates?: boolean;
}

export class UpdatePatientDto extends PatientFieldsDto {
  @DocProperty({ description: "Motif de la correction (200 caractères au plus), archivé avec la nouvelle version du dossier.", example: "Faute de frappe sur le nom, vu sur l'acte de naissance", maxLength: 200, optional: true })
  @IsOptional() @IsString() @MaxLength(200)
  reason?: string;

  @DocProperty({ description: 'Corriger malgré les dossiers ressemblants signalés par un refus `PATIENT_POSSIBLE_DUPLICATE`.', example: false, optional: true })
  @IsOptional() @IsBoolean()
  ignoreDuplicates?: boolean;
}

export class DuplicateCheckDto {
  @DocProperty({ description: 'Nom de famille.', example: 'Mbarga', maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  lastName!: string;

  @DocProperty({ description: 'Prénom(s).', example: 'Élisabeth', maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  firstName!: string;

  @DocProperty({ description: `Date de naissance. ${DATE}`, example: '1990-03-14', maxLength: 10 })
  @IsString() @MaxLength(10)
  birthDate!: string;

  @DocProperty({ description: 'Téléphone.', example: '+237 655 00 00 00', maxLength: 20, optional: true })
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @DocProperty({ description: "Pièce d'identité.", type: IdentityDocumentDto, optional: true })
  @IsOptional() @ValidateNested() @Type(() => IdentityDocumentDto)
  identityDocument?: IdentityDocumentDto;
}

export class RecordDeathDto {
  @DocProperty({ description: `Date du décès (aujourd'hui par défaut ; entre la naissance et aujourd'hui). ${DATE}`, example: '2026-10-24', maxLength: 10, optional: true })
  @IsOptional() @IsString() @MaxLength(10)
  dateOfDeath?: string;

  @DocProperty({ description: 'Motif ou référence (200 caractères au plus), archivé avec la version du dossier.', example: 'Constat du Dr Nkoa', maxLength: 200, optional: true })
  @IsOptional() @IsString() @MaxLength(200)
  reason?: string;
}

const STATUS = ['ACTIVE', 'DECEASED'];

export class PatientSummaryDto {
  @DocProperty({ description: 'Identifiant technique du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier, permanent.', example: 'PAT-0000123' })
  number!: string;

  @DocProperty({ description: '`CONFIRMED` ou `PROVISIONAL` (patient non identifié).', example: 'CONFIRMED', enum: IDENTITY_STATUSES })
  identityStatus!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom(s).', example: 'Élisabeth' })
  firstName!: string;

  @DocProperty({ description: 'Sexe administratif.', example: 'FEMALE', enum: SEXES })
  sex!: string;

  @DocProperty({ description: 'Date de naissance.', example: '1990-03-14' })
  birthDate!: string;

  @DocProperty({ description: "La date de naissance n'est qu'une estimation.", example: false })
  birthDateEstimated!: boolean;

  @DocProperty({ description: "Âge en années aujourd'hui (ou au décès).", example: 36 })
  ageYears!: number;

  @DocProperty({ description: '`ACTIVE` ou `DECEASED`.', example: 'ACTIVE', enum: STATUS })
  status!: 'ACTIVE' | 'DECEASED';
}

export class AddressViewDto {
  @DocProperty({ description: 'Rue, repère.', example: 'Rue de la Joie', nullable: true })
  line!: string | null;

  @DocProperty({ description: 'Quartier.', example: 'Bastos', nullable: true })
  quarter!: string | null;

  @DocProperty({ description: 'Ville.', example: 'Yaoundé', nullable: true })
  city!: string | null;

  @DocProperty({ description: 'Région.', example: 'Centre', nullable: true })
  region!: string | null;

  @DocProperty({ description: 'Pays.', example: 'CM', nullable: true })
  country!: string | null;
}

export class PatientDto extends PatientSummaryDto {
  @DocProperty({ description: 'Lieu de naissance.', example: 'Douala', nullable: true })
  birthPlace!: string | null;

  @DocProperty({ description: 'Nationalité (code pays).', example: 'CM', nullable: true })
  nationality!: string | null;

  @DocProperty({ description: 'Situation matrimoniale.', example: 'MARRIED', enum: MARITAL, nullable: true })
  maritalStatus!: string | null;

  @DocProperty({ description: 'Profession.', example: 'Enseignante', nullable: true })
  occupation!: string | null;

  @DocProperty({ description: 'Téléphone.', example: '+237 655 00 00 00', nullable: true })
  phone!: string | null;

  @DocProperty({ description: 'Adresse e-mail.', example: 'e.mbarga@example.org', nullable: true })
  email!: string | null;

  @DocProperty({ description: 'Adresse.', type: AddressViewDto, nullable: true })
  address!: AddressViewDto | null;

  @DocProperty({ description: "Pièce d'identité.", type: IdentityDocumentDto, nullable: true })
  identityDocument!: IdentityDocumentDto | null;

  @DocProperty({ description: 'Personne à prévenir.', type: NextOfKinDto, nullable: true })
  nextOfKin!: NextOfKinDto | null;

  @DocProperty({ description: 'Date du décès.', example: null, nullable: true })
  dateOfDeath!: string | null;
}

export class PatientPageDto {
  @DocProperty({ description: 'Résumés des dossiers trouvés, triés par nom.', type: PatientSummaryDto, itemType: PatientSummaryDto })
  items!: readonly PatientSummaryDto[];

  @DocProperty({ description: 'Nombre total de dossiers trouvés (toutes pages).', example: 3 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 50).', example: 20 })
  limit!: number;
}

export class DuplicateCandidateDto extends PatientSummaryDto {
  @DocProperty({ description: 'Pourquoi ce dossier ressemble : `IDENTITY_DOCUMENT` (même pièce), `NAME_AND_BIRTH_DATE` (même nom et même naissance), `PHONE_AND_BIRTH_DATE` (même téléphone et même naissance).', example: ['NAME_AND_BIRTH_DATE'], itemType: 'string' })
  reasons!: readonly string[];
}

export class RevisionDto {
  @DocProperty({ description: 'Numéro de version (1 = ouverture du dossier).', example: 2 })
  revision!: number;

  @DocProperty({ description: 'Date et heure (ISO 8601, UTC).', example: '2026-10-24T09:30:00.000Z', format: 'date-time' })
  changedAt!: string;

  @DocProperty({ description: 'Compte qui a fait la modification.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73' })
  changedBy!: string;

  @DocProperty({ description: 'Motif saisi.', example: 'Faute de frappe sur le nom', nullable: true })
  reason!: string | null;

  @DocProperty({ description: "Champs modifiés (`registration` pour l'ouverture du dossier).", example: ['lastName'], itemType: 'string' })
  changedFields!: readonly string[];

  @DocProperty({ description: 'Le dossier tel qu\'il était après cette version.', type: Object })
  @IsObject()
  snapshot!: Record<string, unknown>;
}

import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { UserSummaryDto } from './allergies.dto';
import { PatientSummaryDto } from './encounters.dto';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';

export class PrescriptionLineInputDto {
  @DocProperty({ description: 'Le médicament (identifiant du formulaire de la pharmacie ; `GET .../drugs` le cherche).', example: ID_EXAMPLE, format: 'uuid' })
  @IsUUID()
  drugId!: string;

  @DocProperty({ description: 'Dose par prise, telle qu’on l’écrit (1 à 60 caractères).', example: '1 comprimé', minLength: 1, maxLength: 60 })
  @IsString() @MinLength(1) @MaxLength(60)
  dose!: string;

  @DocProperty({ description: 'Rythme, tel qu’on l’écrit (1 à 60 caractères).', example: '3 fois par jour', minLength: 1, maxLength: 60 })
  @IsString() @MinLength(1) @MaxLength(60)
  frequency!: string;

  @DocProperty({ description: 'Durée du traitement en jours (1 à 365).', example: 7, optional: true, nullable: true })
  @IsOptional() @IsInt() @Min(1) @Max(365)
  durationDays?: number | null;

  @DocProperty({ description: 'Nombre d’unités de dispensation à délivrer (1 à 10 000).', example: 21 })
  @IsInt() @Min(1) @Max(10000)
  quantity!: number;

  @DocProperty({ description: 'Consignes au patient ou au pharmacien (200 caractères au plus).', example: 'À prendre pendant les repas.', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  instructions?: string | null;

  @DocProperty({
    description: 'Motif pour prescrire malgré une allergie connue du patient à ce médicament (3 à 200 caractères). **Obligatoire** quand le médicament est visé par une allergie active ; ignoré sinon.',
    example: 'Bénéfice supérieur au risque, surveillance en service.', maxLength: 200, optional: true, nullable: true,
  })
  @IsOptional() @IsString() @MaxLength(200)
  allergyOverride?: string | null;
}

export class IssuePrescriptionDto {
  @DocProperty({ description: 'Remarque générale (300 caractères au plus).', example: 'Revoir le patient dans 7 jours.', maxLength: 300, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(300)
  notes?: string | null;

  @DocProperty({ description: 'Les lignes : de 1 à 20, un médicament une seule fois.', type: PrescriptionLineInputDto, itemType: PrescriptionLineInputDto })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PrescriptionLineInputDto)
  lines!: PrescriptionLineInputDto[];
}

export class CancelPrescriptionDto {
  @DocProperty({ description: 'Motif de l’annulation (1 à 200 caractères).', example: 'Posologie erronée, nouvelle ordonnance émise.', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class AllergyAlertDto {
  @DocProperty({ description: 'Identifiant de l’allergie du patient.', example: ID_EXAMPLE, format: 'uuid' })
  allergyId!: string;

  @DocProperty({ description: 'Substance déclarée.', example: 'Pénicilline' })
  substance!: string;

  @DocProperty({ description: 'Gravité de l’allergie.', example: 'SEVERE', enum: ['MILD', 'MODERATE', 'SEVERE'] })
  severity!: string;
}

export class DrugSummaryDto {
  @DocProperty({ description: 'Identifiant du médicament.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code du formulaire.', example: 'AMOX500' })
  code!: string;

  @DocProperty({ description: 'Nom d’usage.', example: 'Amoxicilline Biogaran' })
  name!: string;

  @DocProperty({ description: 'Dénomination commune.', example: 'Amoxicilline' })
  genericName!: string;

  @DocProperty({ description: 'Dosage.', example: '500 mg', nullable: true })
  strength!: string | null;

  @DocProperty({ description: 'Forme galénique.', example: 'CAPSULE' })
  form!: string;

  @DocProperty({ description: 'Classe de délivrance : `OTC`, `PRESCRIPTION` ou `CONTROLLED`.', example: 'PRESCRIPTION' })
  schedule!: string;

  @DocProperty({ description: 'Unité de dispensation.', example: 'gélule' })
  unit!: string;

  @DocProperty({ description: 'Le médicament est-il encore prescrit ?', example: true })
  active!: boolean;
}

export class DrugSuggestionDto extends DrugSummaryDto {
  @DocProperty({ description: 'Allergies actives du patient qui visent ce médicament : un motif est exigé pour le prescrire malgré tout.', type: AllergyAlertDto, itemType: AllergyAlertDto })
  allergyAlerts!: AllergyAlertDto[];
}

export class PrescriptionLineDto {
  @DocProperty({ description: 'Rang de la ligne (à partir de 0).', example: 0 })
  position!: number;

  @DocProperty({ description: 'Le médicament.', type: DrugSummaryDto, nullable: true })
  drug!: DrugSummaryDto | null;

  @DocProperty({ description: 'Dose par prise.', example: '1 comprimé' })
  dose!: string;

  @DocProperty({ description: 'Rythme.', example: '3 fois par jour' })
  frequency!: string;

  @DocProperty({ description: 'Durée en jours.', example: 7, nullable: true })
  durationDays!: number | null;

  @DocProperty({ description: 'Unités de dispensation à délivrer.', example: 21 })
  quantity!: number;

  @DocProperty({ description: 'Consignes.', example: 'À prendre pendant les repas.', nullable: true })
  instructions!: string | null;

  @DocProperty({ description: 'Motif de prescription malgré une allergie connue ; absent : aucune alerte à l’émission.', example: 'Bénéfice supérieur au risque.', nullable: true })
  allergyOverride!: string | null;
}

export class PrescriptionDto {
  @DocProperty({ description: 'Identifiant de l’ordonnance.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro attribué par le système.', example: 'RX-0000001' })
  number!: string;

  @DocProperty({ description: 'La consultation d’origine.', example: ID_EXAMPLE, format: 'uuid' })
  encounterId!: string;

  @DocProperty({ description: 'Le patient.', type: PatientSummaryDto, nullable: true })
  patient!: PatientSummaryDto | null;

  @DocProperty({ description: 'Le service de la consultation.', example: ID_EXAMPLE, format: 'uuid' })
  serviceId!: string;

  @DocProperty({ description: 'Le médecin prescripteur.', type: UserSummaryDto, nullable: true })
  doctor!: UserSummaryDto | null;

  @DocProperty({ description: '`ISSUED` (en cours) ou `CANCELLED`.', example: 'ISSUED', enum: ['ISSUED', 'CANCELLED'] })
  status!: string;

  @DocProperty({ description: 'Émission (ISO 8601).', example: '2026-10-24T08:20:00Z' })
  issuedAt!: string;

  @DocProperty({ description: 'Remarque générale.', example: 'Revoir le patient dans 7 jours.', nullable: true })
  notes!: string | null;

  @DocProperty({ description: 'Les lignes.', type: PrescriptionLineDto, itemType: PrescriptionLineDto })
  lines!: readonly PrescriptionLineDto[];

  @DocProperty({ description: 'Qui l’a annulée.', type: UserSummaryDto, nullable: true })
  cancelledBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Annulation (ISO 8601).', example: '2026-10-24T08:30:00Z', nullable: true })
  cancelledAt!: string | null;

  @DocProperty({ description: 'Motif de l’annulation.', example: 'Posologie erronée.', nullable: true })
  cancellationReason!: string | null;
}

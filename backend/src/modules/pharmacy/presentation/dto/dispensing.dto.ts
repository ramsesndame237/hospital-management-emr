import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { UserSummaryDto } from './drugs.dto';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';
const STATES = ['NONE', 'PARTIAL', 'COMPLETE'];

export class DispenseLineInputDto {
  @DocProperty({ description: 'Rang de la ligne de l’ordonnance (à partir de 0, comme dans `lines[].position`).', example: 0 })
  @IsInt() @Min(0) @Max(19)
  position!: number;

  @DocProperty({ description: 'Unités à délivrer maintenant (1 au plus le reste à délivrer de la ligne).', example: 21 })
  @IsInt() @Min(1) @Max(10000)
  quantity!: number;

  @DocProperty({
    description: 'Motif du pharmacien pour délivrer malgré une allergie connue que le médecin n’avait pas levée (3 à 200 caractères). **Obligatoire** dans ce cas seulement (`needsAcknowledgement`).',
    example: 'Allergie discutée avec le médecin prescripteur.', maxLength: 200, optional: true, nullable: true,
  })
  @IsOptional() @IsString() @MaxLength(200)
  allergyOverride?: string | null;
}

export class DispenseDto {
  @DocProperty({ description: 'Les lignes servies maintenant (au moins une ; une ligne n’y figure qu’une fois).', type: DispenseLineInputDto, itemType: DispenseLineInputDto })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => DispenseLineInputDto)
  lines!: DispenseLineInputDto[];

  @DocProperty({ description: 'Remarque (200 caractères au plus).', example: 'Conseils de prise donnés au patient.', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  notes?: string | null;
}

export class DispensingPatientDto {
  @DocProperty({ description: 'Identifiant du patient.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000123' })
  number!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom(s).', example: 'Élisabeth' })
  firstName!: string;

  @DocProperty({ description: 'Sexe.', example: 'FEMALE' })
  sex!: string;

  @DocProperty({ description: 'Date de naissance.', example: '1990-03-14' })
  birthDate!: string;
}

export class QueueRowDto {
  @DocProperty({ description: 'Identifiant de l’ordonnance.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de l’ordonnance.', example: 'RX-0000001' })
  number!: string;

  @DocProperty({ description: 'Émission (ISO 8601).', example: '2026-10-24T08:20:00Z' })
  issuedAt!: string;

  @DocProperty({ description: 'Le patient.', type: DispensingPatientDto, nullable: true })
  patient!: DispensingPatientDto | null;

  @DocProperty({ description: '`NONE` (rien délivré), `PARTIAL` (délivrée en partie).', example: 'NONE', enum: STATES })
  dispensing!: string;

  @DocProperty({ description: 'Nombre de lignes.', example: 2 })
  lines!: number;

  @DocProperty({ description: 'Unités restant à délivrer, toutes lignes confondues.', example: 21 })
  remainingUnits!: number;

  @DocProperty({ description: 'Au moins une ligne a une allergie connue que le médecin n’a pas levée.', example: false })
  allergyWarning!: boolean;
}

export class DispensingDrugDto {
  @DocProperty({ description: 'Identifiant du médicament.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code.', example: 'AMOX500' })
  code!: string;

  @DocProperty({ description: 'Nom.', example: 'Amoxicilline Biogaran' })
  name!: string;

  @DocProperty({ description: 'Dénomination commune.', example: 'Amoxicilline' })
  genericName!: string;

  @DocProperty({ description: 'Dosage.', example: '500 mg', nullable: true })
  strength!: string | null;

  @DocProperty({ description: 'Forme.', example: 'CAPSULE' })
  form!: string;

  @DocProperty({ description: 'Classe de délivrance.', example: 'PRESCRIPTION' })
  schedule!: string;

  @DocProperty({ description: 'Unité de dispensation.', example: 'gélule' })
  unit!: string;
}

export class AllergyAlertDto {
  @DocProperty({ description: 'Substance déclarée.', example: 'Pénicilline' })
  substance!: string;

  @DocProperty({ description: 'Gravité.', example: 'SEVERE' })
  severity!: string;
}

export class SuggestedBatchDto {
  @DocProperty({ description: 'Numéro du lot.', example: 'LOT-2026-01' })
  batchNumber!: string;

  @DocProperty({ description: 'Péremption.', example: '2027-05-31' })
  expiry!: string;

  @DocProperty({ description: 'Unités prélevées sur ce lot.', example: 21 })
  quantity!: number;
}

export class DispensingLineDto {
  @DocProperty({ description: 'Rang de la ligne (à partir de 0).', example: 0 })
  position!: number;

  @DocProperty({ description: 'Le médicament.', type: DispensingDrugDto, nullable: true })
  drug!: DispensingDrugDto | null;

  @DocProperty({ description: 'Dose par prise.', example: '1 gélule' })
  dose!: string;

  @DocProperty({ description: 'Rythme.', example: '3 fois par jour' })
  frequency!: string;

  @DocProperty({ description: 'Durée en jours.', example: 7, nullable: true })
  durationDays!: number | null;

  @DocProperty({ description: 'Consignes du médecin.', example: 'Pendant les repas.', nullable: true })
  instructions!: string | null;

  @DocProperty({ description: 'Unités prescrites.', example: 21 })
  prescribed!: number;

  @DocProperty({ description: 'Unités déjà délivrées.', example: 0 })
  dispensed!: number;

  @DocProperty({ description: 'Unités restant à délivrer.', example: 21 })
  remaining!: number;

  @DocProperty({ description: 'Motif du médecin qui a prescrit malgré une allergie connue.', example: null, nullable: true })
  allergyOverride!: string | null;

  @DocProperty({ description: 'Allergies actives du patient qui visent ce médicament.', type: AllergyAlertDto, itemType: AllergyAlertDto })
  allergyAlerts!: readonly AllergyAlertDto[];

  @DocProperty({ description: 'Une allergie vise ce médicament et le médecin ne l’a pas levée : un motif du pharmacien est exigé pour délivrer.', example: false })
  needsAcknowledgement!: boolean;

  @DocProperty({ description: 'Unités délivrables aujourd’hui (lots non périmés, hors quarantaine).', example: 120 })
  dispensable!: number;

  @DocProperty({ description: 'Prélèvement que « premier périmé, premier sorti » ferait pour le reste à délivrer.', type: SuggestedBatchDto, itemType: SuggestedBatchDto })
  suggestion!: readonly SuggestedBatchDto[];
}

export class DispensedLineDto {
  @DocProperty({ description: 'Rang de la ligne de l’ordonnance servie.', example: 0 })
  prescriptionPosition!: number;

  @DocProperty({ description: 'Médicament.', example: ID_EXAMPLE, format: 'uuid' })
  drugId!: string;

  @DocProperty({ description: 'Lot prélevé.', example: 'LOT-2026-01' })
  batchNumber!: string;

  @DocProperty({ description: 'Péremption du lot.', example: '2027-05-31' })
  expiry!: string;

  @DocProperty({ description: 'Unités prélevées sur ce lot.', example: 21 })
  quantity!: number;

  @DocProperty({ description: 'Motif du pharmacien pour délivrer malgré une allergie.', example: null, nullable: true })
  allergyOverride!: string | null;
}

export class DispensationDto {
  @DocProperty({ description: 'Identifiant.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro.', example: 'DSP-0000001' })
  number!: string;

  @DocProperty({ description: 'Le pharmacien.', type: UserSummaryDto, nullable: true })
  dispensedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Date de la délivrance (ISO 8601).', example: '2026-10-24T09:00:00Z' })
  dispensedAt!: string;

  @DocProperty({ description: 'Remarque.', example: null, nullable: true })
  notes!: string | null;

  @DocProperty({ description: 'Lots prélevés.', type: DispensedLineDto, itemType: DispensedLineDto })
  lines!: readonly DispensedLineDto[];
}

export class PrescriptionForDispensingDto {
  @DocProperty({ description: 'Identifiant.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro.', example: 'RX-0000001' })
  number!: string;

  @DocProperty({ description: '`ISSUED` ou `CANCELLED`.', example: 'ISSUED' })
  status!: string;

  @DocProperty({ description: 'Émission (ISO 8601).', example: '2026-10-24T08:20:00Z' })
  issuedAt!: string;

  @DocProperty({ description: 'Le médecin prescripteur.', type: UserSummaryDto, nullable: true })
  doctor!: UserSummaryDto | null;

  @DocProperty({ description: 'Remarque du médecin.', example: null, nullable: true })
  notes!: string | null;

  @DocProperty({ description: 'Le patient.', type: DispensingPatientDto, nullable: true })
  patient!: DispensingPatientDto | null;

  @DocProperty({ description: '`NONE`, `PARTIAL` ou `COMPLETE`.', example: 'NONE', enum: STATES })
  dispensing!: string;

  @DocProperty({ description: 'Les lignes, avec ce qui est délivré, ce qui reste et l’état du stock.', type: DispensingLineDto, itemType: DispensingLineDto })
  lines!: readonly DispensingLineDto[];

  @DocProperty({ description: 'Les délivrances déjà faites, dans l’ordre.', type: DispensationDto, itemType: DispensationDto })
  dispensations!: readonly DispensationDto[];
}

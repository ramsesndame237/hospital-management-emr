import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { AllergyDto, UserSummaryDto } from './allergies.dto';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';
const STATUSES = ['IN_PROGRESS', 'SIGNED', 'CANCELLED'];
const KINDS = ['PRIMARY', 'SECONDARY'];
const CERTAINTIES = ['PROVISIONAL', 'CONFIRMED'];

export class StartEncounterDto {
  @DocProperty({ description: 'Admission en cours (consultation externe ou urgence) du patient à voir, dans un service où le médecin exerce.', example: ID_EXAMPLE, format: 'uuid' })
  @IsUUID()
  admissionId!: string;
}

export class VitalsInputDto {
  @DocProperty({ description: 'Température en °C (30 à 45, une décimale).', example: 37.8, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(30) @Max(45)
  temperature?: number | null;

  @DocProperty({ description: 'Pouls, battements par minute (20 à 300).', example: 88, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(20) @Max(300)
  pulse?: number | null;

  @DocProperty({ description: 'Pression systolique en mmHg (40 à 300). À donner avec la diastolique.', example: 120, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(40) @Max(300)
  systolic?: number | null;

  @DocProperty({ description: 'Pression diastolique en mmHg (20 à 200), inférieure à la systolique.', example: 80, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(20) @Max(200)
  diastolic?: number | null;

  @DocProperty({ description: 'Fréquence respiratoire par minute (4 à 80).', example: 18, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(4) @Max(80)
  respiratoryRate?: number | null;

  @DocProperty({ description: 'Saturation en oxygène en % (50 à 100).', example: 97, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(50) @Max(100)
  spo2?: number | null;

  @DocProperty({ description: 'Poids en kg (0,3 à 500, une décimale).', example: 68.5, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0.3) @Max(500)
  weightKg?: number | null;

  @DocProperty({ description: 'Taille en cm (20 à 260, une décimale).', example: 172, optional: true, nullable: true })
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(20) @Max(260)
  heightCm?: number | null;
}

export class UpdateNoteDto {
  @DocProperty({ description: 'Motif de consultation (500 caractères au plus) ; vide efface.', example: 'Fièvre depuis trois jours.', maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  chiefComplaint?: string | null;

  @DocProperty({ description: 'Histoire de la maladie, antécédents utiles (2 000 caractères au plus).', example: null, maxLength: 2000, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(2000)
  history?: string | null;

  @DocProperty({ description: 'Examen clinique (2 000 caractères au plus).', example: null, maxLength: 2000, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(2000)
  examination?: string | null;

  @DocProperty({ description: 'Évaluation : synthèse et raisonnement (2 000 caractères au plus). Obligatoire pour signer.', example: null, maxLength: 2000, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(2000)
  assessment?: string | null;

  @DocProperty({ description: 'Conduite à tenir (2 000 caractères au plus).', example: null, maxLength: 2000, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(2000)
  plan?: string | null;
}

export class DiagnosisInputDto {
  @DocProperty({ description: 'Code CIM-10 (par exemple `J18.9`).', example: 'J18.9' })
  @IsString() @MaxLength(10)
  code!: string;

  @DocProperty({ description: 'Libellé du diagnostic (1 à 150 caractères).', example: 'Pneumopathie, sans précision', minLength: 1, maxLength: 150 })
  @IsString() @MinLength(1) @MaxLength(150)
  label!: string;

  @DocProperty({ description: '`PRIMARY` (un seul par consultation) ou `SECONDARY`.', example: 'PRIMARY', enum: KINDS })
  @IsString() @IsIn(KINDS)
  kind!: string;

  @DocProperty({ description: '`PROVISIONAL` (hypothèse, défaut) ou `CONFIRMED`.', example: 'CONFIRMED', enum: CERTAINTIES, optional: true })
  @IsOptional() @IsString() @IsIn(CERTAINTIES)
  certainty?: string;
}

export class SetDiagnosesDto {
  @DocProperty({ description: 'Tous les diagnostics (remplacent les précédents) : au plus 10, un seul principal, pas deux fois le même code.', type: DiagnosisInputDto, itemType: DiagnosisInputDto })
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => DiagnosisInputDto)
  diagnoses!: DiagnosisInputDto[];
}

export class AddendumDto {
  @DocProperty({ description: 'Texte de l’addendum (1 à 2 000 caractères).', example: 'Résultat de la radiographie reçu : pneumopathie confirmée.', minLength: 1, maxLength: 2000 })
  @IsString() @MinLength(1) @MaxLength(2000)
  text!: string;
}

export class CancelEncounterDto {
  @DocProperty({ description: 'Motif de l’annulation (1 à 200 caractères).', example: 'Ouverte sur le mauvais patient.', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class PatientSummaryDto {
  @DocProperty({ description: 'Identifiant du patient.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000001' })
  number!: string;

  @DocProperty({ description: 'Nom.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom.', example: 'Élisabeth' })
  firstName!: string;

  @DocProperty({ description: 'Sexe.', example: 'FEMALE' })
  sex!: string;

  @DocProperty({ description: 'Date de naissance (`AAAA-MM-JJ`).', example: '1990-03-14', format: 'date' })
  birthDate!: string;
}

export class VitalsDto {
  @DocProperty({ description: 'Température en °C.', example: 37.8, nullable: true })
  temperature!: number | null;

  @DocProperty({ description: 'Pouls.', example: 88, nullable: true })
  pulse!: number | null;

  @DocProperty({ description: 'Pression systolique.', example: 120, nullable: true })
  systolic!: number | null;

  @DocProperty({ description: 'Pression diastolique.', example: 80, nullable: true })
  diastolic!: number | null;

  @DocProperty({ description: 'Fréquence respiratoire.', example: 18, nullable: true })
  respiratoryRate!: number | null;

  @DocProperty({ description: 'Saturation en oxygène.', example: 97, nullable: true })
  spo2!: number | null;

  @DocProperty({ description: 'Poids en kg.', example: 68.5, nullable: true })
  weightKg!: number | null;

  @DocProperty({ description: 'Taille en cm.', example: 172, nullable: true })
  heightCm!: number | null;

  @DocProperty({ description: 'Indice de masse corporelle (kg/m²), calculé quand le poids et la taille sont connus.', example: 23.2, nullable: true })
  bmi!: number | null;

  @DocProperty({ description: 'Qui a relevé les constantes.', type: UserSummaryDto, nullable: true })
  recordedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Relevé le (ISO 8601, UTC).', example: '2026-11-02T08:05:00Z', format: 'date-time' })
  recordedAt!: string;
}

export class NoteDto {
  @DocProperty({ description: 'Motif de consultation.', example: 'Fièvre depuis trois jours.', nullable: true })
  chiefComplaint!: string | null;

  @DocProperty({ description: 'Histoire de la maladie.', example: null, nullable: true })
  history!: string | null;

  @DocProperty({ description: 'Examen clinique.', example: null, nullable: true })
  examination!: string | null;

  @DocProperty({ description: 'Évaluation.', example: null, nullable: true })
  assessment!: string | null;

  @DocProperty({ description: 'Conduite à tenir.', example: null, nullable: true })
  plan!: string | null;
}

export class DiagnosisDto {
  @DocProperty({ description: 'Code CIM-10.', example: 'J18.9' })
  code!: string;

  @DocProperty({ description: 'Libellé.', example: 'Pneumopathie, sans précision' })
  label!: string;

  @DocProperty({ description: '`PRIMARY` ou `SECONDARY`.', example: 'PRIMARY', enum: KINDS })
  kind!: string;

  @DocProperty({ description: '`PROVISIONAL` ou `CONFIRMED`.', example: 'CONFIRMED', enum: CERTAINTIES })
  certainty!: string;
}

export class AddendumViewDto {
  @DocProperty({ description: 'Numéro d’ordre de l’addendum.', example: 1 })
  seq!: number;

  @DocProperty({ description: 'Texte.', example: 'Résultat reçu.' })
  text!: string;

  @DocProperty({ description: 'Qui l’a ajouté.', type: UserSummaryDto, nullable: true })
  by!: UserSummaryDto | null;

  @DocProperty({ description: 'Ajouté le (ISO 8601, UTC).', example: '2026-11-02T12:00:00Z', format: 'date-time' })
  at!: string;
}

export class EncounterDto {
  @DocProperty({ description: 'Identifiant de la consultation.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro, attribué par le système.', example: 'CON-0000001' })
  number!: string;

  @DocProperty({ description: '`IN_PROGRESS` (modifiable), `SIGNED` (verrouillée : on y ajoute des addenda) ou `CANCELLED`.', example: 'IN_PROGRESS', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Le patient.', type: PatientSummaryDto, nullable: true })
  patient!: PatientSummaryDto | null;

  @DocProperty({ description: 'Service de la consultation.', example: ID_EXAMPLE, format: 'uuid' })
  serviceId!: string;

  @DocProperty({ description: 'Admission à l’occasion de laquelle elle a lieu.', example: ID_EXAMPLE, format: 'uuid', nullable: true })
  admissionId!: string | null;

  @DocProperty({ description: 'Le médecin qui conduit la consultation.', type: UserSummaryDto, nullable: true })
  doctor!: UserSummaryDto | null;

  @DocProperty({ description: 'Ouverte le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  startedAt!: string;

  @DocProperty({ description: 'Dernier relevé de constantes.', type: VitalsDto, nullable: true })
  vitals!: VitalsDto | null;

  @DocProperty({ description: 'La note SOAP.', type: NoteDto })
  note!: NoteDto;

  @DocProperty({ description: 'Diagnostics (CIM-10).', type: DiagnosisDto, itemType: DiagnosisDto })
  diagnoses!: readonly DiagnosisDto[];

  @DocProperty({ description: 'Ce qu’il manque pour signer : `PRIMARY_DIAGNOSIS`, `ASSESSMENT`. Vide : on peut signer.', example: [], itemType: 'string' })
  missingForSignature!: readonly string[];

  @DocProperty({ description: 'Qui l’a signée.', type: UserSummaryDto, nullable: true })
  signedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Signée le.', example: null, format: 'date-time', nullable: true })
  signedAt!: string | null;

  @DocProperty({ description: 'Addenda, dans l’ordre.', type: AddendumViewDto, itemType: AddendumViewDto })
  addenda!: readonly AddendumViewDto[];

  @DocProperty({ description: 'Qui l’a annulée.', type: UserSummaryDto, nullable: true })
  cancelledBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Annulée le.', example: null, format: 'date-time', nullable: true })
  cancelledAt!: string | null;

  @DocProperty({ description: 'Motif de l’annulation.', example: null, nullable: true })
  cancellationReason!: string | null;

  @DocProperty({ description: 'Allergies actives du patient (bandeau de la consultation).', type: AllergyDto, itemType: AllergyDto })
  allergies!: readonly AllergyDto[];
}

export class PrimaryDiagnosisDto {
  @DocProperty({ description: 'Code CIM-10.', example: 'J18.9' })
  code!: string;

  @DocProperty({ description: 'Libellé.', example: 'Pneumopathie, sans précision' })
  label!: string;
}

export class EncounterSummaryDto {
  @DocProperty({ description: 'Identifiant de la consultation.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro.', example: 'CON-0000001' })
  number!: string;

  @DocProperty({ description: 'Le patient.', type: PatientSummaryDto, nullable: true })
  patient!: PatientSummaryDto | null;

  @DocProperty({ description: 'Service de la consultation.', example: ID_EXAMPLE, format: 'uuid' })
  serviceId!: string;

  @DocProperty({ description: 'Le médecin.', type: UserSummaryDto, nullable: true })
  doctor!: UserSummaryDto | null;

  @DocProperty({ description: 'Statut.', example: 'SIGNED', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Ouverte le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  startedAt!: string;

  @DocProperty({ description: 'Signée le.', example: null, format: 'date-time', nullable: true })
  signedAt!: string | null;

  @DocProperty({ description: 'Diagnostic principal.', type: PrimaryDiagnosisDto, nullable: true })
  primaryDiagnosis!: PrimaryDiagnosisDto | null;
}

export class EncounterPageDto {
  @DocProperty({ description: 'Consultations de la page, les plus récentes d’abord.', type: EncounterSummaryDto, itemType: EncounterSummaryDto })
  items!: readonly EncounterSummaryDto[];

  @DocProperty({ description: 'Nombre total de consultations correspondantes.', example: 12 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

export class QueueAdmissionDto {
  @DocProperty({ description: 'Identifiant de l’admission.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro d’admission.', example: 'ADM-0000012' })
  number!: string;

  @DocProperty({ description: '`OUTPATIENT` (consultation externe) ou `EMERGENCY` (urgence).', example: 'OUTPATIENT', enum: ['OUTPATIENT', 'EMERGENCY'] })
  type!: string;

  @DocProperty({ description: 'Arrivée du patient (ISO 8601, UTC).', example: '2026-11-02T07:45:00Z', format: 'date-time' })
  admittedAt!: string;

  @DocProperty({ description: 'Service.', example: ID_EXAMPLE, format: 'uuid' })
  serviceId!: string;
}

export class QueueEncounterDto {
  @DocProperty({ description: 'Identifiant de la consultation en cours.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro.', example: 'CON-0000001' })
  number!: string;

  @DocProperty({ description: 'Le médecin qui la conduit.', type: UserSummaryDto, nullable: true })
  doctor!: UserSummaryDto | null;

  @DocProperty({ description: 'C’est la vôtre : vous pouvez la reprendre.', example: true })
  mine!: boolean;
}

export class QueueItemDto {
  @DocProperty({ description: 'L’admission du patient.', type: QueueAdmissionDto })
  admission!: QueueAdmissionDto;

  @DocProperty({ description: 'Le patient.', type: PatientSummaryDto, nullable: true })
  patient!: PatientSummaryDto | null;

  @DocProperty({ description: 'Consultation en cours pour cette admission ; absente : le patient attend.', type: QueueEncounterDto, nullable: true })
  encounter!: QueueEncounterDto | null;
}

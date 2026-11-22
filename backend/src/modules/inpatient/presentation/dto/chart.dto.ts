import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const CONSCIOUSNESS = ['ALERT', 'CONFUSION', 'VOICE', 'PAIN', 'UNRESPONSIVE'];
const STATUSES = ['GIVEN', 'REFUSED', 'HELD'];

export class RecordObservationDto {
  @DocProperty({ description: 'Température en °C (30 à 45).', example: 37.2 })
  @IsNumber() @Min(30) @Max(45)
  temperature!: number;

  @DocProperty({ description: 'Pouls, battements par minute (20 à 300).', example: 88 })
  @IsInt() @Min(20) @Max(300)
  pulse!: number;

  @DocProperty({ description: 'Pression systolique, mmHg (40 à 300).', example: 124 })
  @IsInt() @Min(40) @Max(300)
  systolic!: number;

  @DocProperty({ description: 'Pression diastolique, mmHg (20 à 200, inférieure à la systolique).', example: 78, optional: true, nullable: true })
  @IsOptional() @IsInt() @Min(20) @Max(200)
  diastolic?: number | null;

  @DocProperty({ description: 'Fréquence respiratoire par minute (4 à 80).', example: 16 })
  @IsInt() @Min(4) @Max(80)
  respiratoryRate!: number;

  @DocProperty({ description: 'Saturation en oxygène, % (50 à 100).', example: 97 })
  @IsInt() @Min(50) @Max(100)
  spo2!: number;

  @DocProperty({ description: "Le patient reçoit de l'oxygène supplémentaire.", example: false })
  @IsBoolean()
  supplementalOxygen!: boolean;

  @DocProperty({ description: 'Niveau de conscience (échelle ACVPU) : `ALERT` (alerte), `CONFUSION`, `VOICE`, `PAIN`, `UNRESPONSIVE`.', example: 'ALERT', enum: CONSCIOUSNESS })
  @IsString() @MaxLength(16)
  consciousness!: string;

  @DocProperty({ description: 'Remarque libre (300 caractères au plus).', example: 'Patient fébrile depuis ce matin.', maxLength: 300, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(300)
  note?: string | null;
}

export class RecordAdministrationDto {
  @DocProperty({ description: "Ordonnance concernée (voir `medications` du dossier de soins).", example: '8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b', format: 'uuid' })
  @IsUUID()
  prescriptionId!: string;

  @DocProperty({ description: "Position de la ligne dans l'ordonnance.", example: 0 })
  @IsInt() @Min(0) @Max(100)
  position!: number;

  @DocProperty({ description: 'Ce qui a été fait : `GIVEN` (donné), `REFUSED` (refusé par le patient), `HELD` (suspendu par le soignant).', example: 'GIVEN', enum: STATUSES })
  @IsString() @MaxLength(16)
  status!: string;

  @DocProperty({ description: 'Motif, **obligatoire** quand le médicament est refusé ou suspendu, interdit quand il est donné.', example: 'Nausées', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  reason?: string | null;
}

export class AddNoteDto {
  @DocProperty({ description: 'Note de soins (1 à 1000 caractères). Une note ne se modifie pas.', example: 'Pansement refait, plaie propre.', minLength: 1, maxLength: 1000 })
  @IsString() @MaxLength(1000)
  text!: string;
}

export class PatientCardDto {
  @DocProperty({ description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000042' })
  number!: string;

  @DocProperty({ description: 'Nom.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom.', example: 'Élisabeth' })
  firstName!: string;

  @DocProperty({ description: 'Sexe.', example: 'FEMALE' })
  sex!: string;

  @DocProperty({ description: 'Date de naissance.', example: '2019-03-14' })
  birthDate!: string;
}

export class StayDto {
  @DocProperty({ description: "Identifiant de l'admission.", example: '8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b', format: 'uuid' })
  admissionId!: string;

  @DocProperty({ description: "Numéro d'admission.", example: 'ADM-0000012' })
  number!: string;

  @DocProperty({ description: 'Lit occupé.', example: 'Lit 1', nullable: true })
  bed!: string | null;

  @DocProperty({ description: 'Service responsable.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' })
  serviceId!: string;

  @DocProperty({ description: "Arrivée (ISO 8601).", example: '2026-11-18T08:00:00Z' })
  admittedAt!: string;

  @DocProperty({ description: "Jour d'hospitalisation (le jour d'arrivée est le premier).", example: 3 })
  days!: number;

  @DocProperty({ description: 'Faux quand le patient est sorti : plus aucun soin ne peut être ajouté.', example: true })
  active!: boolean;
}

export class ObservationDto {
  @DocProperty({ description: 'Identifiant du relevé.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Date du relevé (ISO 8601).', example: '2026-11-18T09:30:00Z' })
  recordedAt!: string;

  @DocProperty({ description: 'Identifiant de connexion du soignant.', example: 'nurse', nullable: true })
  recordedBy!: string | null;

  @DocProperty({ description: 'Température °C.', example: 37.2 })
  temperature!: number;

  @DocProperty({ description: 'Pouls.', example: 88 })
  pulse!: number;

  @DocProperty({ description: 'Systolique.', example: 124 })
  systolic!: number;

  @DocProperty({ description: 'Diastolique.', example: 78, nullable: true })
  diastolic!: number | null;

  @DocProperty({ description: 'Fréquence respiratoire.', example: 16 })
  respiratoryRate!: number;

  @DocProperty({ description: 'SpO₂ %.', example: 97 })
  spo2!: number;

  @DocProperty({ description: 'Oxygène supplémentaire.', example: false })
  supplementalOxygen!: boolean;

  @DocProperty({ description: 'Conscience.', example: 'ALERT', enum: CONSCIOUSNESS })
  consciousness!: string;

  @DocProperty({ description: 'Score NEWS2 (0 à 20), calculé à la saisie et conservé tel quel.', example: 1 })
  news2!: number;

  @DocProperty({ description: 'Niveau de risque : `LOW` (0-4), `MEDIUM` (5-6, ou un paramètre à 3), `HIGH` (7 et plus : appeler le médecin sans attendre).', example: 'LOW', enum: ['LOW', 'MEDIUM', 'HIGH'] })
  risk!: string;

  @DocProperty({ description: 'Remarque.', example: null, nullable: true })
  note!: string | null;
}

export class RecordedObservationDto extends ObservationDto {
  @DocProperty({ description: 'Vrai quand le score est élevé (`HIGH`) : prévenir le médecin immédiatement.', example: false })
  escalate!: boolean;
}

export class LastActionDto {
  @DocProperty({ description: '`GIVEN`, `REFUSED` ou `HELD`.', example: 'GIVEN', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Quand (ISO 8601).', example: '2026-11-18T09:40:00Z' })
  at!: string;

  @DocProperty({ description: 'Soignant.', example: 'nurse', nullable: true })
  by!: string | null;

  @DocProperty({ description: 'Motif (refus ou suspension).', example: null, nullable: true })
  reason!: string | null;
}

export class MedicationDto {
  @DocProperty({ description: "Identifiant de l'ordonnance.", example: '8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b', format: 'uuid' })
  prescriptionId!: string;

  @DocProperty({ description: "Numéro d'ordonnance.", example: 'RX-0000007' })
  prescriptionNumber!: string;

  @DocProperty({ description: "Position de la ligne dans l'ordonnance.", example: 0 })
  position!: number;

  @DocProperty({ description: 'Médicament.', example: 'Amoxicilline 500 mg' })
  drugName!: string;

  @DocProperty({ description: 'Dose.', example: '1 gélule' })
  dose!: string;

  @DocProperty({ description: 'Fréquence.', example: '3 fois par jour' })
  frequency!: string;

  @DocProperty({ description: 'Consignes du prescripteur.', example: null, nullable: true })
  instructions!: string | null;

  @DocProperty({ description: "Date de l'ordonnance (ISO 8601).", example: '2026-11-18T08:30:00Z' })
  issuedAt!: string;

  @DocProperty({ description: "Le médecin a prescrit malgré une allergie connue (motif d'exception enregistré) : à vérifier avant d'administrer.", example: false })
  allergyWarning!: boolean;

  @DocProperty({ description: 'Dernière action sur cette ligne ; `null` : rien n\'a encore été fait.', type: LastActionDto, nullable: true })
  last!: LastActionDto | null;

  @DocProperty({ description: 'Nombre de doses données.', example: 2 })
  givenCount!: number;
}

export class AdministrationDto {
  @DocProperty({ description: "Identifiant de l'action.", example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: "Numéro d'ordonnance.", example: 'RX-0000007', nullable: true })
  prescriptionNumber!: string | null;

  @DocProperty({ description: 'Médicament.', example: 'Amoxicilline 500 mg', nullable: true })
  drugName!: string | null;

  @DocProperty({ description: '`GIVEN`, `REFUSED` ou `HELD`.', example: 'GIVEN', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Motif.', example: null, nullable: true })
  reason!: string | null;

  @DocProperty({ description: 'Quand (ISO 8601).', example: '2026-11-18T09:40:00Z' })
  at!: string;

  @DocProperty({ description: 'Soignant.', example: 'nurse', nullable: true })
  by!: string | null;
}

export class NoteDto {
  @DocProperty({ description: 'Identifiant de la note.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Texte.', example: 'Pansement refait, plaie propre.' })
  text!: string;

  @DocProperty({ description: 'Quand (ISO 8601).', example: '2026-11-18T10:00:00Z' })
  writtenAt!: string;

  @DocProperty({ description: 'Auteur.', example: 'nurse', nullable: true })
  author!: string | null;
}

export class ChartDto {
  @DocProperty({ description: 'Le séjour.', type: StayDto })
  stay!: StayDto;

  @DocProperty({ description: 'Le patient.', type: PatientCardDto, nullable: true })
  patient!: PatientCardDto | null;

  @DocProperty({ description: 'Derniers relevés, les plus récents d\'abord (50 au plus).', type: ObservationDto, itemType: ObservationDto })
  observations!: readonly ObservationDto[];

  @DocProperty({ description: "Médicaments prescrits pendant cette hospitalisation (ordonnances non annulées), avec la dernière action.", type: MedicationDto, itemType: MedicationDto })
  medications!: readonly MedicationDto[];

  @DocProperty({ description: 'Dernières administrations (donné, refusé, suspendu).', type: AdministrationDto, itemType: AdministrationDto })
  administrations!: readonly AdministrationDto[];

  @DocProperty({ description: 'Notes de soins, les plus récentes d\'abord.', type: NoteDto, itemType: NoteDto })
  notes!: readonly NoteDto[];
}

export class LatestObservationDto {
  @DocProperty({ description: 'Date du dernier relevé.', example: '2026-11-18T09:30:00Z' })
  recordedAt!: string;

  @DocProperty({ description: 'Score NEWS2.', example: 1 })
  news2!: number;

  @DocProperty({ description: 'Risque.', example: 'LOW', enum: ['LOW', 'MEDIUM', 'HIGH'] })
  risk!: string;
}

export class WardRowDto {
  @DocProperty({ description: 'Le séjour.', type: StayDto })
  stay!: StayDto;

  @DocProperty({ description: 'Le patient.', type: PatientCardDto, nullable: true })
  patient!: PatientCardDto | null;

  @DocProperty({ description: 'Dernier relevé ; `null` si aucun relevé.', type: LatestObservationDto, nullable: true })
  latest!: LatestObservationDto | null;
}

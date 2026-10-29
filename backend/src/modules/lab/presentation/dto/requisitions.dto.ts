import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { CONTAINERS, SECTIONS, SPECIMEN_TYPES } from './tests.dto';

const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'];
const SOURCES = ['OPD', 'IPD', 'ER', 'EXTERNAL'];
const STATUSES = ['ORDERED', 'PARTIALLY_COLLECTED', 'COLLECTED', 'RECEIVED', 'CANCELLED'];
const SPECIMEN_STATUSES = ['PENDING_COLLECTION', 'COLLECTED', 'RECEIVED', 'REJECTED'];
const REJECTIONS = ['HEMOLYSED', 'INSUFFICIENT_VOLUME', 'WRONG_CONTAINER', 'CLOTTED', 'MISLABELLED', 'UNLABELLED', 'LEAKING', 'CONTAMINATED', 'EXPIRED_CONTAINER', 'OTHER'];

export class OrderRequisitionDto {
  @DocProperty({ description: 'Patient concerné.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  @IsUUID()
  patientId!: string;

  @DocProperty({ description: 'Analyses demandées (1 à 30, chacune une fois). Elles doivent être actives au catalogue.', example: ['5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60'], itemType: 'string' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @IsUUID('all', { each: true })
  testIds!: string[];

  @DocProperty({ description: '`ROUTINE` (défaut), `URGENT` ou `STAT` (immédiat).', example: 'ROUTINE', enum: PRIORITIES, optional: true })
  @IsOptional() @IsString() @IsIn(PRIORITIES)
  priority?: string;

  @DocProperty({ description: "Provenance : `OPD` (consultation externe, défaut), `IPD` (hospitalisé), `ER` (urgences) ou `EXTERNAL` (prescription extérieure, patient de passage).", example: 'OPD', enum: SOURCES, optional: true })
  @IsOptional() @IsString() @IsIn(SOURCES)
  source?: string;

  @DocProperty({ description: 'Renseignements cliniques utiles à l\'analyse (500 caractères au plus).', example: 'Fièvre depuis 3 jours, retour de zone endémique.', maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  clinicalNotes?: string | null;
}

export class ReasonDto {
  @DocProperty({ description: 'Motif (obligatoire, 200 caractères au plus).', example: 'Examen prescrit par erreur', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class CollectSpecimenDto {
  @DocProperty({ description: "Numéro de dossier lu sur le bracelet du patient (premier identifiant).", example: 'PAT-0000123', maxLength: 30 })
  @IsString() @MinLength(1) @MaxLength(30)
  patientNumber!: string;

  @DocProperty({ description: 'Date de naissance confirmée par le patient, `AAAA-MM-JJ` (second identifiant).', example: '1990-03-14', maxLength: 10 })
  @IsString() @MinLength(10) @MaxLength(10)
  birthDate!: string;
}

export class RejectSpecimenDto {
  @DocProperty({ description: 'Motif du rejet.', example: 'HEMOLYSED', enum: REJECTIONS })
  @IsString() @IsIn(REJECTIONS)
  reason!: string;

  @DocProperty({ description: 'Précision (200 caractères au plus) ; **obligatoire** pour `OTHER`.', example: 'Tube fissuré à la réception', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  note?: string | null;
}

export class UserSummaryDto {
  @DocProperty({ description: 'Identifiant du compte.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant de connexion.', example: 'technicien.un' })
  username!: string;
}

export class RequisitionPatientDto {
  @DocProperty({ description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000123' })
  number!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom.', example: 'Élisabeth' })
  firstName!: string;

  @DocProperty({ description: 'Sexe.', example: 'FEMALE' })
  sex!: string;

  @DocProperty({ description: 'Date de naissance (`AAAA-MM-JJ`).', example: '1990-03-14' })
  birthDate!: string;
}

export class SpecimenEventDto {
  @DocProperty({ description: '`CREATED`, `COLLECTED`, `RECEIVED` ou `REJECTED`.', example: 'COLLECTED' })
  kind!: string;

  @DocProperty({ description: 'Quand (ISO 8601, UTC).', example: '2026-11-02T08:15:00Z', format: 'date-time' })
  at!: string;

  @DocProperty({ description: 'Qui.', type: UserSummaryDto, nullable: true })
  actor!: UserSummaryDto | null;

  @DocProperty({ description: 'Précision (motif d\'un rejet…).', example: null, nullable: true })
  note!: string | null;
}

export class SpecimenDto {
  @DocProperty({ description: "Identifiant de l'échantillon.", example: '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code-barres collé sur le tube.', example: 'SPC-0000042' })
  barcode!: string;

  @DocProperty({ description: "Type d'échantillon.", example: 'BLOOD', enum: SPECIMEN_TYPES })
  specimenType!: string;

  @DocProperty({ description: 'Contenant.', example: 'PURPLE', enum: CONTAINERS })
  container!: string;

  @DocProperty({ description: '`PENDING_COLLECTION` (à prélever), `COLLECTED`, `RECEIVED` ou `REJECTED`.', example: 'COLLECTED', enum: SPECIMEN_STATUSES })
  status!: string;

  @DocProperty({ description: 'Préleveur.', type: UserSummaryDto, nullable: true })
  collectedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Prélevé le.', example: '2026-11-02T08:15:00Z', format: 'date-time', nullable: true })
  collectedAt!: string | null;

  @DocProperty({ description: 'Réceptionnaire.', type: UserSummaryDto, nullable: true })
  receivedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Reçu au laboratoire le.', example: null, format: 'date-time', nullable: true })
  receivedAt!: string | null;

  @DocProperty({ description: 'Motif du rejet.', example: null, nullable: true })
  rejectionReason!: string | null;

  @DocProperty({ description: 'Précision du rejet.', example: null, nullable: true })
  rejectionNote!: string | null;

  @DocProperty({ description: 'Qui a rejeté.', type: UserSummaryDto, nullable: true })
  rejectedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Rejeté le.', example: null, format: 'date-time', nullable: true })
  rejectedAt!: string | null;

  @DocProperty({ description: 'Identifiant de l\'échantillon rejeté que celui-ci remplace.', example: null, nullable: true })
  recollectionOf!: string | null;

  @DocProperty({ description: 'Chaîne de traçabilité, de la plus ancienne étape à la plus récente.', type: SpecimenEventDto, itemType: SpecimenEventDto })
  events!: readonly SpecimenEventDto[];
}

export class OrderedTestDto {
  @DocProperty({ description: "Identifiant de l'analyse.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' })
  testId!: string;

  @DocProperty({ description: 'Code (copié au moment de la demande).', example: 'HGB' })
  code!: string;

  @DocProperty({ description: 'Libellé (copié au moment de la demande).', example: 'Hémoglobine' })
  name!: string;

  @DocProperty({ description: 'Section.', example: 'HAEMATOLOGY', enum: SECTIONS })
  section!: string;

  @DocProperty({ description: "Échantillon qui porte cette analyse.", example: '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d', format: 'uuid' })
  specimenId!: string;
}

export class RequisitionDto {
  @DocProperty({ description: 'Identifiant de la demande.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro, attribué par le système.', example: 'LAB-0000123' })
  number!: string;

  @DocProperty({ description: '`ORDERED`, `PARTIALLY_COLLECTED`, `COLLECTED`, `RECEIVED` ou `CANCELLED`.', example: 'ORDERED', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Patient.', type: RequisitionPatientDto, nullable: true })
  patient!: RequisitionPatientDto | null;

  @DocProperty({ description: 'Priorité.', example: 'ROUTINE', enum: PRIORITIES })
  priority!: string;

  @DocProperty({ description: 'Provenance.', example: 'OPD', enum: SOURCES })
  source!: string;

  @DocProperty({ description: 'Renseignements cliniques.', example: null, nullable: true })
  clinicalNotes!: string | null;

  @DocProperty({ description: 'Prescripteur.', type: UserSummaryDto, nullable: true })
  orderedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Demandée le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  orderedAt!: string;

  @DocProperty({ description: 'Analyses demandées.', type: OrderedTestDto, itemType: OrderedTestDto })
  tests!: readonly OrderedTestDto[];

  @DocProperty({ description: 'Échantillons, y compris les rejetés (historique) et leurs remplaçants.', type: SpecimenDto, itemType: SpecimenDto })
  specimens!: readonly SpecimenDto[];

  @DocProperty({ description: "Qui a annulé.", type: UserSummaryDto, nullable: true })
  cancelledBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Annulée le.', example: null, format: 'date-time', nullable: true })
  cancelledAt!: string | null;

  @DocProperty({ description: "Motif d'annulation.", example: null, nullable: true })
  cancellationReason!: string | null;
}

export class RequisitionBySpecimenDto extends RequisitionDto {
  @DocProperty({ description: "Identifiant de l'échantillon scanné.", example: '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d', format: 'uuid' })
  specimenId!: string;
}

export class RequisitionSummaryDto {
  @DocProperty({ description: 'Identifiant de la demande.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro.', example: 'LAB-0000123' })
  number!: string;

  @DocProperty({ description: 'Statut.', example: 'ORDERED', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Priorité.', example: 'STAT', enum: PRIORITIES })
  priority!: string;

  @DocProperty({ description: 'Provenance.', example: 'ER', enum: SOURCES })
  source!: string;

  @DocProperty({ description: 'Patient.', type: RequisitionPatientDto, nullable: true })
  patient!: RequisitionPatientDto | null;

  @DocProperty({ description: 'Prescripteur.', type: UserSummaryDto, nullable: true })
  orderedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Demandée le.', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  orderedAt!: string;

  @DocProperty({ description: 'Codes des analyses demandées.', example: ['HGB', 'GLU'], itemType: 'string' })
  testCodes!: readonly string[];

  @DocProperty({ description: 'Sections concernées.', example: ['HAEMATOLOGY'], itemType: 'string' })
  sections!: readonly string[];
}

export class RequisitionPageDto {
  @DocProperty({ description: 'Demandes de la page : les actives d\'abord (STAT, urgent, routine ; la plus ancienne en tête), puis les terminées.', type: RequisitionSummaryDto, itemType: RequisitionSummaryDto })
  items!: readonly RequisitionSummaryDto[];

  @DocProperty({ description: 'Nombre total de demandes correspondantes (toutes pages).', example: 87 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

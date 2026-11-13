import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { MODALITIES } from './exam-types.dto';

export const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'];
export const SOURCES = ['OPD', 'IPD', 'ER', 'EXTERNAL'];
export const STATUSES = ['ORDERED', 'SCHEDULED', 'PERFORMED', 'REPORTED', 'CANCELLED'];
export const METHODS = ['PHONE', 'IN_PERSON', 'SECURE_MESSAGE'];

export class OrderImagingDto {
  @DocProperty({ description: 'Le patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  @IsUUID()
  patientId!: string;

  @DocProperty({ description: "L'examen demandé (actif au catalogue).", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' })
  @IsUUID()
  examTypeId!: string;

  @DocProperty({ description: "Question clinique : obligatoire, elle justifie l'examen (500 caractères au plus).", example: 'Toux persistante depuis 3 semaines, recherche de pneumopathie.', minLength: 1, maxLength: 500 })
  @IsString() @MinLength(1) @MaxLength(500)
  clinicalQuestion!: string;

  @DocProperty({ description: 'Priorité (défaut `ROUTINE`).', example: 'ROUTINE', enum: PRIORITIES, optional: true })
  @IsOptional() @IsString() @IsIn(PRIORITIES)
  priority?: string;

  @DocProperty({ description: 'Provenance (défaut `OPD`).', example: 'OPD', enum: SOURCES, optional: true })
  @IsOptional() @IsString() @IsIn(SOURCES)
  source?: string;

  @DocProperty({ description: "La consultation qui prescrit l'examen : même patient, pas annulée.", example: null, format: 'uuid', optional: true, nullable: true })
  @IsOptional() @IsUUID()
  encounterId?: string | null;
}

export class ReasonDto {
  @DocProperty({ description: 'Motif (1 à 200 caractères).', example: 'Examen demandé en double.', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class ScheduleDto {
  @DocProperty({ description: 'Créneau de l’examen (ISO 8601). Il ne peut pas être dans le passé.', example: '2026-11-20T09:30:00Z', format: 'date-time' })
  @IsString() @MaxLength(40)
  scheduledFor!: string;
}

export class PerformDto {
  @DocProperty({ description: 'Dépistage : la patiente est-elle enceinte (ou une grossesse est-elle possible) ?', example: false })
  @IsBoolean()
  pregnant!: boolean;

  @DocProperty({ description: 'Dépistage : allergie connue au produit de contraste ?', example: false })
  @IsBoolean()
  contrastAllergy!: boolean;

  @DocProperty({ description: 'Motif de la dérogation, **obligatoire** si le dépistage révèle une contre-indication (grossesse sous rayons ionisants, allergie avec produit de contraste). 200 caractères au plus.', example: null, maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  overrideReason?: string | null;

  @DocProperty({ description: 'Note de technique (500 caractères au plus).', example: 'Inspiration profonde, incidence de face.', maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  techniqueNote?: string | null;
}

export class ReportDraftDto {
  @DocProperty({ description: 'Technique employée (2 000 caractères au plus).', example: 'Radiographie thoracique de face, debout.', maxLength: 2000, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(2000)
  technique?: string | null;

  @DocProperty({ description: 'Constatations (8 000 caractères au plus) : obligatoires pour signer.', example: 'Opacité alvéolaire du lobe inférieur droit.', maxLength: 8000, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(8000)
  findings?: string | null;

  @DocProperty({ description: 'Impression (2 000 caractères au plus) : obligatoire pour signer.', example: 'Aspect de pneumopathie du lobe inférieur droit.', maxLength: 2000, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(2000)
  impression?: string | null;

  @DocProperty({ description: 'Découverte critique : le clinicien doit être appelé (et l’appel documenté) avant la signature. Défaut `false`.', example: false, optional: true })
  @IsOptional() @IsBoolean()
  critical?: boolean;
}

export class CommunicationDto {
  @DocProperty({ description: 'Personne prévenue.', example: 'Dr Curie', minLength: 1, maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  notifiedName!: string;

  @DocProperty({ description: 'Fonction de la personne prévenue.', example: 'Médecin de garde', minLength: 1, maxLength: 60 })
  @IsString() @MinLength(1) @MaxLength(60)
  notifiedRole!: string;

  @DocProperty({ description: 'Moyen : `PHONE`, `IN_PERSON` ou `SECURE_MESSAGE`.', example: 'PHONE', enum: METHODS })
  @IsString() @IsIn(METHODS)
  method!: string;

  @DocProperty({ description: 'La personne prévenue a relu la découverte. Doit être `true` : sans relecture, l’appel n’est pas documenté (422).', example: true })
  @IsBoolean()
  readBackConfirmed!: boolean;
}

export class AddendumDto extends ReportDraftDto {
  @DocProperty({ description: "Motif de l'addendum (1 à 200 caractères).", example: 'Découverte complémentaire après relecture.', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;

  @DocProperty({ description: 'Appel du clinicien : **obligatoire** quand l’addendum signale une découverte critique.', type: CommunicationDto, optional: true, nullable: true })
  @IsOptional() @ValidateNested() @Type(() => CommunicationDto)
  communication?: CommunicationDto | null;
}

export class UserSummaryDto {
  @DocProperty({ description: 'Identifiant du compte.', example: '9d402057-f766-476b-8108-b127b9c79c0d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant de connexion.', example: 'doctor' })
  username!: string;
}

export class OrderPatientDto {
  @DocProperty({ description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000123' })
  number!: string;

  @DocProperty({ description: 'Nom.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom.', example: 'Élisabeth' })
  firstName!: string;

  @DocProperty({ description: 'Sexe.', example: 'FEMALE' })
  sex!: string;

  @DocProperty({ description: 'Date de naissance (AAAA-MM-JJ).', example: '1990-05-12' })
  birthDate!: string;
}

export class ScreeningDto {
  @DocProperty({ description: 'Grossesse déclarée ou possible.', example: false })
  pregnant!: boolean;

  @DocProperty({ description: 'Allergie connue au produit de contraste.', example: false })
  contrastAllergy!: boolean;

  @DocProperty({ description: 'Motif de la dérogation, si une contre-indication a été levée.', example: null, nullable: true })
  overrideReason!: string | null;
}

export class ReportDraftViewDto {
  @DocProperty({ description: 'Technique.', example: null, nullable: true })
  technique!: string | null;

  @DocProperty({ description: 'Constatations.', example: null, nullable: true })
  findings!: string | null;

  @DocProperty({ description: 'Impression.', example: null, nullable: true })
  impression!: string | null;

  @DocProperty({ description: 'Découverte critique.', example: false })
  critical!: boolean;

  @DocProperty({ description: 'Dernier auteur du brouillon.', type: UserSummaryDto, nullable: true })
  by!: UserSummaryDto | null;

  @DocProperty({ description: 'Dernière modification (ISO 8601, UTC).', example: '2026-11-02T10:00:00Z', format: 'date-time' })
  at!: string;
}

export class ReportVersionDto {
  @DocProperty({ description: 'Numéro de version : 1 pour le compte rendu signé, puis un par addendum.', example: 1 })
  version!: number;

  @DocProperty({ description: 'Technique.', example: null, nullable: true })
  technique!: string | null;

  @DocProperty({ description: 'Constatations.', example: 'Opacité alvéolaire du lobe inférieur droit.' })
  findings!: string;

  @DocProperty({ description: 'Impression.', example: 'Aspect de pneumopathie.' })
  impression!: string;

  @DocProperty({ description: 'Découverte critique.', example: false })
  critical!: boolean;

  @DocProperty({ description: "Motif de l'addendum (absent pour le compte rendu initial).", example: null, nullable: true })
  reason!: string | null;

  @DocProperty({ description: 'Qui a signé.', type: UserSummaryDto, nullable: true })
  signedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Signé le (ISO 8601, UTC).', example: '2026-11-02T10:30:00Z', format: 'date-time' })
  signedAt!: string;
}

export class CommunicationViewDto {
  @DocProperty({ description: 'Version du compte rendu concernée.', example: 1 })
  version!: number;

  @DocProperty({ description: 'Personne prévenue.', example: 'Dr Curie' })
  notifiedName!: string;

  @DocProperty({ description: 'Fonction.', example: 'Médecin de garde' })
  notifiedRole!: string;

  @DocProperty({ description: 'Moyen.', example: 'PHONE', enum: METHODS })
  method!: string;

  @DocProperty({ description: 'Quand (ISO 8601, UTC).', example: '2026-11-02T10:25:00Z', format: 'date-time' })
  at!: string;

  @DocProperty({ description: 'Qui a appelé.', type: UserSummaryDto, nullable: true })
  by!: UserSummaryDto | null;
}

export class ReportViewDto {
  @DocProperty({ description: 'Brouillon en cours : service d’imagerie seulement, jamais pour le prescripteur.', type: ReportDraftViewDto, nullable: true })
  draft!: ReportDraftViewDto | null;

  @DocProperty({ description: 'Versions **signées** : le compte rendu puis ses addenda.', type: ReportVersionDto, itemType: ReportVersionDto })
  versions!: readonly ReportVersionDto[];

  @DocProperty({ description: 'Appels documentés pour les versions signées.', type: CommunicationViewDto, itemType: CommunicationViewDto })
  communications!: readonly CommunicationViewDto[];

  @DocProperty({ description: 'Le brouillon signale une découverte critique : l’appel conditionne la signature (service d’imagerie seulement).', example: false })
  criticalRequired!: boolean;

  @DocProperty({ description: 'L’appel du clinicien est documenté pour le brouillon (service d’imagerie seulement).', example: false })
  criticalCommunicated!: boolean;
}

export class OrderDto {
  @DocProperty({ description: 'Identifiant de la demande.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro (sert de numéro d’accession), attribué par le système.', example: 'IMG-0000123' })
  number!: string;

  @DocProperty({ description: '`ORDERED`, `SCHEDULED`, `PERFORMED` (réalisé, compte rendu à rédiger), `REPORTED` (compte rendu signé) ou `CANCELLED`.', example: 'ORDERED', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Patient.', type: OrderPatientDto, nullable: true })
  patient!: OrderPatientDto | null;

  @DocProperty({ description: "Identifiant de l'examen.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' })
  examTypeId!: string;

  @DocProperty({ description: 'Code (copié au moment de la demande).', example: 'RX-THORAX' })
  examCode!: string;

  @DocProperty({ description: 'Libellé (copié au moment de la demande).', example: 'Radiographie du thorax de face' })
  examName!: string;

  @DocProperty({ description: 'Modalité.', example: 'XRAY', enum: MODALITIES })
  modality!: string;

  @DocProperty({ description: 'Examen avec produit de contraste (valeur actuelle du catalogue) : une allergie connue bloque la réalisation sans dérogation motivée.', example: false })
  usesContrast!: boolean;

  @DocProperty({ description: 'Préparation du patient (valeur actuelle du catalogue).', example: null, nullable: true })
  preparation!: string | null;

  @DocProperty({ description: 'Priorité.', example: 'ROUTINE', enum: PRIORITIES })
  priority!: string;

  @DocProperty({ description: 'Provenance.', example: 'OPD', enum: SOURCES })
  source!: string;

  @DocProperty({ description: 'Question clinique.', example: 'Toux persistante, recherche de pneumopathie.' })
  clinicalQuestion!: string;

  @DocProperty({ description: "La consultation qui a prescrit l'examen.", example: null, format: 'uuid', nullable: true })
  encounterId!: string | null;

  @DocProperty({ description: 'Prescripteur.', type: UserSummaryDto, nullable: true })
  orderedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Demandé le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  orderedAt!: string;

  @DocProperty({ description: 'Créneau prévu.', example: null, format: 'date-time', nullable: true })
  scheduledFor!: string | null;

  @DocProperty({ description: 'Qui a planifié.', type: UserSummaryDto, nullable: true })
  scheduledBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Réalisé le.', example: null, format: 'date-time', nullable: true })
  performedAt!: string | null;

  @DocProperty({ description: 'Qui a réalisé.', type: UserSummaryDto, nullable: true })
  performedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Note de technique.', example: null, nullable: true })
  techniqueNote!: string | null;

  @DocProperty({ description: 'Dépistage de sécurité : visible du service d’imagerie seulement (`null` pour un prescripteur).', type: ScreeningDto, nullable: true })
  screening!: ScreeningDto | null;

  @DocProperty({ description: 'Compte rendu.', type: ReportViewDto })
  report!: ReportViewDto;

  @DocProperty({ description: 'Qui a annulé.', type: UserSummaryDto, nullable: true })
  cancelledBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Annulé le.', example: null, format: 'date-time', nullable: true })
  cancelledAt!: string | null;

  @DocProperty({ description: "Motif d'annulation.", example: null, nullable: true })
  cancellationReason!: string | null;
}

export class OrderSummaryDto {
  @DocProperty({ description: 'Identifiant de la demande.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro.', example: 'IMG-0000123' })
  number!: string;

  @DocProperty({ description: 'Statut.', example: 'ORDERED', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Priorité.', example: 'STAT', enum: PRIORITIES })
  priority!: string;

  @DocProperty({ description: 'Provenance.', example: 'ER', enum: SOURCES })
  source!: string;

  @DocProperty({ description: 'Modalité.', example: 'XRAY', enum: MODALITIES })
  modality!: string;

  @DocProperty({ description: "Code de l'examen.", example: 'RX-THORAX' })
  examCode!: string;

  @DocProperty({ description: "Libellé de l'examen.", example: 'Radiographie du thorax de face' })
  examName!: string;

  @DocProperty({ description: 'Patient.', type: OrderPatientDto, nullable: true })
  patient!: OrderPatientDto | null;

  @DocProperty({ description: 'Prescripteur.', type: UserSummaryDto, nullable: true })
  orderedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Demandé le.', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  orderedAt!: string;

  @DocProperty({ description: 'Créneau prévu.', example: null, format: 'date-time', nullable: true })
  scheduledFor!: string | null;

  @DocProperty({ description: 'Le compte rendu signé signale une découverte critique.', example: false })
  critical!: boolean;
}

export class OrderPageDto {
  @DocProperty({ description: "Demandes de la page : les actives d'abord (STAT, urgent, routine ; la plus ancienne en tête), puis les terminées.", type: OrderSummaryDto, itemType: OrderSummaryDto })
  items!: readonly OrderSummaryDto[];

  @DocProperty({ description: 'Nombre total de demandes correspondantes (toutes pages).', example: 87 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

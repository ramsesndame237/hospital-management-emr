import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';

export class LinkAccountDto {
  @DocProperty({ description: 'Identifiant de connexion du compte patient à relier.', example: 'elisabeth.mbarga', minLength: 1, maxLength: 64 })
  @IsString() @MinLength(1) @MaxLength(64)
  username!: string;

  @DocProperty({ description: 'Le dossier patient (champ `id` de `/api/v1/patients`).', example: ID_EXAMPLE, format: 'uuid' })
  @IsUUID()
  patientId!: string;
}

export class PortalAccountDto {
  @DocProperty({ description: 'Identifiant de connexion du compte relié.', example: 'elisabeth.mbarga', nullable: true })
  username!: string | null;

  @DocProperty({ description: 'Date du lien (ISO 8601).', example: '2026-11-02T09:00:00Z' })
  linkedAt!: string;
}

export class PortalPatientDto {
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

export class PortalAppointmentDto {
  @DocProperty({ description: 'Numéro du rendez-vous.', example: 'RDV-0000045' })
  number!: string;

  @DocProperty({ description: '`SCHEDULED`, `ARRIVED`, `CANCELLED` ou `NO_SHOW`.', example: 'SCHEDULED' })
  status!: string;

  @DocProperty({ description: 'Début (ISO 8601).', example: '2026-11-02T08:00:00Z' })
  startsAt!: string;

  @DocProperty({ description: 'Fin (ISO 8601).', example: '2026-11-02T08:30:00Z' })
  endsAt!: string;
}

export class PortalResultItemDto {
  @DocProperty({ description: 'Analyse.', example: 'Hémoglobine' })
  testName!: string;

  @DocProperty({ description: 'Valeur publiée.', example: '12,4', nullable: true })
  value!: string | null;

  @DocProperty({ description: 'Unité.', example: 'g/dL', nullable: true })
  unit!: string | null;

  @DocProperty({ description: 'Position par rapport aux valeurs de référence (`LOW`, `HIGH`, `CRITICAL_LOW`, `CRITICAL_HIGH`) ; `NORMAL` ou absent : dans la norme.', example: null, nullable: true })
  flag!: string | null;

  @DocProperty({ description: 'Borne basse de référence.', example: 12, nullable: true })
  refLow!: number | null;

  @DocProperty({ description: 'Borne haute de référence.', example: 16, nullable: true })
  refHigh!: number | null;

  @DocProperty({ description: 'Ce résultat a été corrigé après sa publication.', example: false })
  amended!: boolean;
}

export class PortalResultDto {
  @DocProperty({ description: 'Numéro de la demande d’analyses.', example: 'LAB-0000123' })
  number!: string;

  @DocProperty({ description: 'Date de la demande (ISO 8601).', example: '2026-11-02T08:00:00Z' })
  orderedAt!: string;

  @DocProperty({ description: 'Les résultats publiés (jamais une valeur non validée).', type: PortalResultItemDto, itemType: PortalResultItemDto })
  items!: readonly PortalResultItemDto[];
}

export class PortalPrescriptionLineDto {
  @DocProperty({ description: 'Médicament.', example: 'Amoxicilline Biogaran' })
  drugName!: string;

  @DocProperty({ description: 'Dosage.', example: '500 mg', nullable: true })
  strength!: string | null;

  @DocProperty({ description: 'Dose par prise.', example: '1 gélule' })
  dose!: string;

  @DocProperty({ description: 'Rythme.', example: '3 fois par jour' })
  frequency!: string;

  @DocProperty({ description: 'Durée en jours.', example: 7, nullable: true })
  durationDays!: number | null;

  @DocProperty({ description: 'Quantité prescrite.', example: 21 })
  quantity!: number;

  @DocProperty({ description: 'Unité de dispensation.', example: 'gélule' })
  unit!: string;
}

export class PortalPrescriptionDto {
  @DocProperty({ description: 'Numéro de l’ordonnance.', example: 'RX-0000001' })
  number!: string;

  @DocProperty({ description: 'Émission (ISO 8601).', example: '2026-11-02T08:20:00Z' })
  issuedAt!: string;

  @DocProperty({ description: '`ISSUED` ou `CANCELLED`.', example: 'ISSUED' })
  status!: string;

  @DocProperty({ description: 'Ce que la pharmacie a délivré : `NONE`, `PARTIAL` ou `COMPLETE`.', example: 'NONE' })
  dispensing!: string;

  @DocProperty({ description: 'Les lignes.', type: PortalPrescriptionLineDto, itemType: PortalPrescriptionLineDto })
  lines!: readonly PortalPrescriptionLineDto[];
}

export class PortalInvoiceDto {
  @DocProperty({ description: 'Numéro de facture.', example: 'FAC-0000123' })
  number!: string;

  @DocProperty({ description: '`ISSUED`, `PARTIALLY_PAID`, `PAID`…', example: 'ISSUED' })
  status!: string;

  @DocProperty({ description: 'Devise (ISO 4217).', example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Total, en plus petite unité monétaire.', example: 12500 })
  total!: number;

  @DocProperty({ description: 'Déjà payé.', example: 5000 })
  paid!: number;

  @DocProperty({ description: 'Reste à payer.', example: 7500 })
  balance!: number;

  @DocProperty({ description: 'Émission (ISO 8601).', example: '2026-11-02T09:00:00Z', nullable: true })
  issuedAt!: string | null;
}

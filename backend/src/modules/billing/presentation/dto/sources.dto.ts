import { IsString, IsUUID, MaxLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const TYPES = ['LAB_REQUISITION', 'IMAGING_ORDER', 'DISPENSATION'];

export class BillFromSourceDto {
  @DocProperty({ description: "Ce qu'on facture : `LAB_REQUISITION` (demande d'analyses), `IMAGING_ORDER` (examen d'imagerie réalisé) ou `DISPENSATION` (délivrance de médicaments).", example: 'LAB_REQUISITION', enum: TYPES })
  @IsString() @MaxLength(32)
  sourceType!: string;

  @DocProperty({ description: "Identifiant de la demande, de l'examen ou de la délivrance (voir `GET /api/v1/billing/billable`).", example: '8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b', format: 'uuid' })
  @IsUUID()
  sourceId!: string;
}

export class BillablePatientDto {
  @DocProperty({ description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'P-0000042' })
  number!: string;

  @DocProperty({ description: 'Nom.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom.', example: 'Élisabeth' })
  firstName!: string;
}

export class BillableLineDto {
  @DocProperty({ description: "Code de l'analyse, de l'examen ou du médicament.", example: 'NFS' })
  code!: string;

  @DocProperty({ description: 'Libellé.', example: 'Numération formule sanguine' })
  label!: string;

  @DocProperty({ description: 'Quantité faite (analyses et examens : 1 ; médicaments : unités délivrées).', example: 1 })
  quantity!: number;

  @DocProperty({ description: 'Acte du catalogue qui tarifie cette ligne ; `null` si aucun.', example: 'NFS complète', nullable: true })
  itemName!: string | null;

  @DocProperty({ description: 'Prix unitaire du catalogue (entier, plus petite unité de la devise) ; `null` si aucun acte ne tarifie ce code.', example: 3500, nullable: true })
  unitPrice!: number | null;
}

export class BillableDto {
  @DocProperty({ description: 'Type de source.', example: 'LAB_REQUISITION', enum: TYPES })
  type!: string;

  @DocProperty({ description: 'Identifiant de la source.', example: '8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro lisible (LAB-…, IMG-…, DSP-…).', example: 'LAB-0000123' })
  reference!: string;

  @DocProperty({ description: 'Le patient.', type: BillablePatientDto, nullable: true })
  patient!: BillablePatientDto | null;

  @DocProperty({ description: 'Quand la demande a été faite, l\'examen réalisé ou la délivrance effectuée (ISO 8601).', example: '2026-11-18T09:30:00Z' })
  occurredAt!: string;

  @DocProperty({ description: 'Ce qui sera facturé, avec les prix du catalogue.', type: BillableLineDto, itemType: BillableLineDto })
  lines!: readonly BillableLineDto[];

  @DocProperty({ description: "Codes qu'aucun acte du catalogue ne tarifie : la facture est refusée tant que leur « code source » n'est pas renseigné dans le catalogue des actes.", example: [] })
  unpriced!: readonly string[];

  @DocProperty({ description: 'Total d\'après le catalogue ; `null` si au moins un code n\'a pas de prix.', example: 3500, nullable: true })
  total!: number | null;
}

export class BillablePageDto {
  @DocProperty({ description: 'Éléments de la page demandée (les plus anciens d\'abord).', type: BillableDto, itemType: BillableDto })
  items!: readonly BillableDto[];

  @DocProperty({ description: 'Nombre total d\'éléments à facturer de ce type.', example: 12 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 100).', example: 50 })
  limit!: number;

  @DocProperty({ description: "Devise de l'installation (ISO 4217) : les prix sont des entiers dans sa plus petite unité.", example: 'XAF' })
  currency!: string;
}

import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { UserSummaryDto } from './sessions.dto';

const KINDS = ['DISCOUNT', 'CANCEL'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];

export class RequestApprovalDto {
  @DocProperty({ description: 'Facture concernée.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  @IsUUID()
  invoiceId!: string;

  @DocProperty({ description: "`DISCOUNT` : remise au-delà du seuil, sur un brouillon. `CANCEL` : annulation d'une facture émise (sans encaissement).", example: 'DISCOUNT', enum: KINDS })
  @IsString() @IsIn(KINDS)
  kind!: string;

  @DocProperty({ description: "Montant de la remise demandée (obligatoire pour `DISCOUNT`), **entier** dans la plus petite unité de la devise : `1500` = 1 500 FCFA.", example: 1500, optional: true })
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000_000_000)
  amount?: number;

  @DocProperty({ description: 'Pourquoi (obligatoire, 200 caractères au plus) : le responsable le lit avant de décider.', example: 'Patient indigent, accord du service social', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class DecideApprovalDto {
  @DocProperty({ description: 'Commentaire du responsable : facultatif pour une acceptation, **obligatoire pour un refus** (200 caractères au plus).', example: 'Justificatif vu', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  comment?: string | null;
}

export class ApprovalSummaryDto {
  @DocProperty({ description: 'Identifiant de la demande.', example: '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e', format: 'uuid' })
  id!: string;

  @DocProperty({ description: '`DISCOUNT` (remise au-delà du seuil) ou `CANCEL` (annulation d\'une facture émise).', example: 'DISCOUNT', enum: KINDS })
  kind!: string;

  @DocProperty({ description: '`PENDING` (attend un responsable), `APPROVED`, `REJECTED` ou `WITHDRAWN` (retirée par son auteur).', example: 'PENDING', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Montant de la remise demandée ; vide pour une annulation.', example: 1500, nullable: true })
  amount!: number | null;

  @DocProperty({ description: 'Motif donné par le demandeur.', example: 'Patient indigent' })
  reason!: string;

  @DocProperty({ description: 'Le demandeur.', type: UserSummaryDto, nullable: true })
  requestedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Date de la demande (ISO 8601, UTC).', example: '2026-11-02T09:10:00Z', format: 'date-time' })
  requestedAt!: string;

  @DocProperty({ description: 'Le responsable qui a décidé (ou l\'auteur, pour un retrait).', type: UserSummaryDto, nullable: true })
  decidedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Date de la décision (ISO 8601, UTC).', example: '2026-11-02T09:25:00Z', format: 'date-time', nullable: true })
  decidedAt!: string | null;

  @DocProperty({ description: 'Commentaire de la décision.', example: 'Justificatif vu', nullable: true })
  decisionComment!: string | null;

  @DocProperty({ description: 'Vrai si la facture a changé depuis la demande : elle ne peut plus être acceptée, seulement refusée ou retirée.', example: false })
  outdated!: boolean;
}

export class ApprovalPatientDto {
  @DocProperty({ description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000123' })
  number!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom.', example: 'Élisabeth' })
  firstName!: string;
}

export class ApprovalInvoiceDto {
  @DocProperty({ description: 'Identifiant de la facture.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de facture.', example: 'FAC-0000123' })
  number!: string;

  @DocProperty({ description: 'Statut actuel de la facture.', example: 'DRAFT', enum: INVOICE_STATUSES })
  status!: string;

  @DocProperty({ description: 'Patient facturé.', type: ApprovalPatientDto, nullable: true })
  patient!: ApprovalPatientDto | null;

  @DocProperty({ description: 'Somme des lignes.', example: 15000 })
  subtotal!: number;

  @DocProperty({ description: 'Remise déjà appliquée.', example: 0 })
  discount!: number;

  @DocProperty({ description: 'À payer : sous-total moins remise.', example: 15000 })
  total!: number;
}

export class ApprovalDto extends ApprovalSummaryDto {
  @DocProperty({ description: 'Devise.', example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Décimales de la devise.', example: 0 })
  currencyDigits!: number;

  @DocProperty({ description: 'La facture concernée, telle qu\'elle est maintenant.', type: ApprovalInvoiceDto })
  invoice!: ApprovalInvoiceDto;

  @DocProperty({ description: "Remise (en % du sous-total) au-delà de laquelle un responsable doit l'approuver.", example: 10 })
  discountApprovalPercent!: number;
}

export class ApprovalPageDto {
  @DocProperty({ description: 'Demandes de la page : celles qui attendent une décision d\'abord (la plus ancienne en tête), puis les autres de la plus récente à la plus ancienne.', type: ApprovalDto, itemType: ApprovalDto })
  items!: readonly ApprovalDto[];

  @DocProperty({ description: 'Nombre total de demandes correspondantes (toutes pages).', example: 12 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

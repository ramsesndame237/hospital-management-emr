import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { DrugSummaryDto, UserSummaryDto } from './drugs.dto';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';
const DIRECTIONS = ['IN', 'OUT'];
const REASONS = ['COUNT_CORRECTION', 'DAMAGED', 'EXPIRED', 'LOST', 'FOUND', 'OTHER'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

export class RequestAdjustmentDto {
  @DocProperty({ description: 'Lot à corriger.', example: ID_EXAMPLE, format: 'uuid' })
  @IsUUID()
  batchId!: string;

  @DocProperty({ description: '`IN` (ajouter au stock) ou `OUT` (en retirer).', example: 'OUT', enum: DIRECTIONS })
  @IsString() @IsIn(DIRECTIONS)
  direction!: string;

  @DocProperty({ description: 'Quantité à ajouter ou retirer (1 à 1 000 000).', example: 4 })
  @IsInt() @Min(1) @Max(1_000_000)
  quantity!: number;

  @DocProperty({
    description: 'Motif. En entrée : `COUNT_CORRECTION`, `FOUND` ou `OTHER` ; en sortie : `COUNT_CORRECTION`, `DAMAGED`, `EXPIRED`, `LOST` ou `OTHER`.',
    example: 'DAMAGED', enum: REASONS,
  })
  @IsString() @MaxLength(20)
  reason!: string;

  @DocProperty({ description: 'Précision (200 caractères au plus) ; obligatoire pour le motif `OTHER`.', example: 'Flacons tombés lors du rangement.', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  note?: string | null;
}

export class ApproveAdjustmentDto {
  @DocProperty({ description: 'Commentaire facultatif (200 caractères au plus).', example: 'Constaté avec le demandeur.', maxLength: 200, optional: true })
  @IsOptional() @IsString() @MaxLength(200)
  comment?: string;
}

export class RejectAdjustmentDto {
  @DocProperty({ description: 'Motif du refus (1 à 200 caractères) : le demandeur doit savoir pourquoi le stock n’a pas changé.', example: 'Recomptez avant de redemander.', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  comment!: string;
}

export class AdjustmentBatchDto {
  @DocProperty({ description: 'Identifiant du lot.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de lot.', example: 'B2026-114' })
  batchNumber!: string;

  @DocProperty({ description: 'Dernier jour de validité.', example: '2027-03-31', format: 'date' })
  expiry!: string;

  @DocProperty({ description: 'Quantité actuellement en stock dans le lot.', example: 340 })
  quantity!: number;
}

export class AdjustmentDto {
  @DocProperty({ description: 'Identifiant de l’ajustement.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro, attribué par le système.', example: 'ADJ-0000001' })
  number!: string;

  @DocProperty({ description: 'Le médicament.', type: DrugSummaryDto, nullable: true })
  drug!: DrugSummaryDto | null;

  @DocProperty({ description: 'Le lot concerné.', type: AdjustmentBatchDto, nullable: true })
  batch!: AdjustmentBatchDto | null;

  @DocProperty({ description: 'Sens.', example: 'OUT', enum: DIRECTIONS })
  direction!: string;

  @DocProperty({ description: 'Quantité.', example: 4 })
  quantity!: number;

  @DocProperty({ description: 'Motif.', example: 'DAMAGED', enum: REASONS })
  reason!: string;

  @DocProperty({ description: 'Précision du demandeur.', example: null, nullable: true })
  note!: string | null;

  @DocProperty({ description: '`PENDING` (en attente), `APPROVED` (appliqué au stock) ou `REJECTED`.', example: 'PENDING', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Qui l’a demandé.', type: UserSummaryDto, nullable: true })
  requestedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Demandé le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  requestedAt!: string;

  @DocProperty({ description: 'Qui l’a décidé (toujours quelqu’un d’autre que le demandeur).', type: UserSummaryDto, nullable: true })
  decidedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Décidé le (ISO 8601, UTC).', example: null, format: 'date-time', nullable: true })
  decidedAt!: string | null;

  @DocProperty({ description: 'Commentaire de la décision (obligatoire pour un refus).', example: null, nullable: true })
  decisionComment!: string | null;
}

export class AdjustmentPageDto {
  @DocProperty({ description: 'Ajustements de la page : les plus anciens d’abord pour `PENDING`, sinon les plus récents.', type: AdjustmentDto, itemType: AdjustmentDto })
  items!: readonly AdjustmentDto[];

  @DocProperty({ description: 'Nombre total d’ajustements correspondants.', example: 5 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { DrugSummaryDto, UserSummaryDto } from './drugs.dto';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';
export const ORDER_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'];
const STATUS_DOC = '`DRAFT` (brouillon, modifiable), `PENDING_APPROVAL` (à approuver), `APPROVED` (attend ses livraisons), `PARTIALLY_RECEIVED`, `RECEIVED` (tout est arrivé), `CLOSED` (clos avant réception totale), `CANCELLED`.';

export class OrderLineInputDto {
  @DocProperty({ description: 'Médicament commandé (il doit être actif dans le formulaire).', example: ID_EXAMPLE, format: 'uuid' })
  @IsUUID()
  drugId!: string;

  @DocProperty({ description: 'Quantité commandée, en unités de dispensation (1 à 1 000 000).', example: 500 })
  @IsInt() @Min(1) @Max(1_000_000)
  quantity!: number;

  @DocProperty({ description: 'Coût d’achat convenu d’une unité, en plus petite unité monétaire. Par défaut : celui du dernier lot reçu (0 si jamais reçu).', example: 12, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000_000)
  unitCost?: number;
}

export class OrderInputDto {
  @DocProperty({ description: 'Fournisseur (il doit être actif).', example: ID_EXAMPLE, format: 'uuid' })
  @IsUUID()
  supplierId!: string;

  @DocProperty({ description: 'Date de livraison attendue (`AAAA-MM-JJ`), pas dans le passé.', example: '2026-11-20', format: 'date', optional: true, nullable: true })
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expectedOn?: string | null;

  @DocProperty({ description: 'Remarques (300 caractères au plus).', example: null, maxLength: 300, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(300)
  notes?: string | null;

  @DocProperty({ description: 'Lignes du bon (1 à 50). Un médicament ne figure qu’une fois.', type: OrderLineInputDto, itemType: OrderLineInputDto })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => OrderLineInputDto)
  lines!: OrderLineInputDto[];
}

export class OrderReasonDto {
  @DocProperty({ description: 'Motif (1 à 200 caractères).', example: 'Fournisseur en rupture, livraison annulée.', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class OrderRejectDto {
  @DocProperty({ description: 'Motif du refus (1 à 200 caractères) : l’auteur doit savoir quoi corriger.', example: 'Quantité d’amoxicilline trop élevée.', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  comment!: string;
}

export class OrderSupplierDto {
  @DocProperty({ description: 'Identifiant du fournisseur.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code.', example: 'PHARMADIS' })
  code!: string;

  @DocProperty({ description: 'Nom.', example: 'Pharma Distrib SARL' })
  name!: string;
}

export class OrderLineDto {
  @DocProperty({ description: 'Le médicament.', type: DrugSummaryDto, nullable: true })
  drug!: DrugSummaryDto | null;

  @DocProperty({ description: 'Quantité commandée.', example: 500 })
  quantity!: number;

  @DocProperty({ description: 'Coût d’achat convenu d’une unité.', example: 12 })
  unitCost!: number;

  @DocProperty({ description: 'Quantité déjà reçue.', example: 200 })
  received!: number;

  @DocProperty({ description: 'Reste à recevoir.', example: 300 })
  outstanding!: number;

  @DocProperty({ description: 'Valeur de la ligne (quantité × coût).', example: 6000 })
  value!: number;
}

export class OrderDto {
  @DocProperty({ description: 'Identifiant du bon.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro, attribué par le système.', example: 'PO-0000001' })
  number!: string;

  @DocProperty({ description: 'Le fournisseur.', type: OrderSupplierDto, nullable: true })
  supplier!: OrderSupplierDto | null;

  @DocProperty({ description: `Statut : ${STATUS_DOC}`, example: 'APPROVED', enum: ORDER_STATUSES })
  status!: string;

  @DocProperty({ description: 'Date de livraison attendue.', example: '2026-11-20', format: 'date', nullable: true })
  expectedOn!: string | null;

  @DocProperty({ description: 'Remarques.', example: null, nullable: true })
  notes!: string | null;

  @DocProperty({ description: 'Qui l’a établi.', type: UserSummaryDto, nullable: true })
  createdBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Établi le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  createdAt!: string;

  @DocProperty({ description: 'Soumis à l’approbation le.', example: '2026-11-02T08:10:00Z', format: 'date-time', nullable: true })
  submittedAt!: string | null;

  @DocProperty({ description: 'Qui l’a approuvé (toujours quelqu’un d’autre que son auteur).', type: UserSummaryDto, nullable: true })
  approvedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Approuvé le.', example: null, format: 'date-time', nullable: true })
  approvedAt!: string | null;

  @DocProperty({ description: 'Dernier refus (le bon est alors revenu en brouillon).', example: null, nullable: true })
  rejectionReason!: string | null;

  @DocProperty({ description: 'Qui l’a annulé ou clos.', type: UserSummaryDto, nullable: true })
  closedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Annulé ou clos le.', example: null, format: 'date-time', nullable: true })
  closedAt!: string | null;

  @DocProperty({ description: 'Motif de l’annulation ou de la clôture.', example: null, nullable: true })
  closedReason!: string | null;

  @DocProperty({ description: 'Total des unités commandées.', example: 500 })
  units!: number;

  @DocProperty({ description: 'Total des unités déjà reçues.', example: 200 })
  receivedUnits!: number;

  @DocProperty({ description: 'Valeur du bon au coût convenu.', example: 6000 })
  value!: number;

  @DocProperty({ description: 'Devise de l’installation (ISO 4217).', example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Lignes du bon.', type: OrderLineDto, itemType: OrderLineDto })
  lines!: readonly OrderLineDto[];
}

export class OrderSummarySupplierDto {
  @DocProperty({ description: 'Identifiant du fournisseur.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Nom.', example: 'Pharma Distrib SARL' })
  name!: string;
}

export class OrderSummaryDto {
  @DocProperty({ description: 'Identifiant du bon.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro.', example: 'PO-0000001' })
  number!: string;

  @DocProperty({ description: 'Le fournisseur.', type: OrderSummarySupplierDto })
  supplier!: OrderSummarySupplierDto;

  @DocProperty({ description: `Statut : ${STATUS_DOC}`, example: 'APPROVED', enum: ORDER_STATUSES })
  status!: string;

  @DocProperty({ description: 'Qui l’a établi.', type: UserSummaryDto, nullable: true })
  createdBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Établi le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  createdAt!: string;

  @DocProperty({ description: 'Date de livraison attendue.', example: '2026-11-20', format: 'date', nullable: true })
  expectedOn!: string | null;

  @DocProperty({ description: 'Nombre de lignes.', example: 3 })
  lines!: number;

  @DocProperty({ description: 'Unités commandées.', example: 500 })
  units!: number;

  @DocProperty({ description: 'Unités déjà reçues.', example: 200 })
  receivedUnits!: number;

  @DocProperty({ description: 'Valeur du bon au coût convenu.', example: 6000 })
  value!: number;
}

export class OrderPageDto {
  @DocProperty({ description: 'Bons de la page : les plus anciens d’abord pour `PENDING_APPROVAL`, sinon les plus récents.', type: OrderSummaryDto, itemType: OrderSummaryDto })
  items!: readonly OrderSummaryDto[];

  @DocProperty({ description: 'Nombre total de bons correspondants.', example: 12 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;

  @DocProperty({ description: 'Devise de l’installation (ISO 4217).', example: 'XAF' })
  currency!: string;
}

export class SuggestionDto {
  @DocProperty({ description: 'Le médicament à recommander.', type: DrugSummaryDto })
  drug!: DrugSummaryDto;

  @DocProperty({ description: '`OUT` (rupture) ou `LOW` (stock bas).', example: 'LOW', enum: ['OUT', 'LOW'] })
  level!: string;

  @DocProperty({ description: 'Quantité délivrable aujourd’hui.', example: 80 })
  dispensable!: number;

  @DocProperty({ description: 'Seuil de réapprovisionnement.', example: 200 })
  reorderLevel!: number;

  @DocProperty({ description: 'Déjà commandé et pas encore reçu (bons approuvés).', example: 0 })
  onOrder!: number;

  @DocProperty({ description: 'Quantité proposée pour revenir à deux fois le seuil.', example: 320 })
  suggested!: number;

  @DocProperty({ description: 'Coût d’achat du dernier lot reçu ; absent si le médicament n’a jamais été reçu.', example: 12, nullable: true })
  lastUnitCost!: number | null;
}

export class SuggestionListDto {
  @DocProperty({ description: 'Médicaments à recommander, ruptures d’abord.', type: SuggestionDto, itemType: SuggestionDto })
  items!: readonly SuggestionDto[];

  @DocProperty({ description: 'Devise de l’installation (ISO 4217).', example: 'XAF' })
  currency!: string;
}

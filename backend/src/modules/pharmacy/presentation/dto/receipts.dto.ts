import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { DrugSummaryDto, UserSummaryDto } from './drugs.dto';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';

export class ReceiptLineInputDto {
  @DocProperty({ description: 'Identifiant du médicament reçu (il doit être actif dans le formulaire).', example: ID_EXAMPLE, format: 'uuid' })
  @IsUUID()
  drugId!: string;

  @DocProperty({ description: 'Numéro de lot du fabricant (1 à 40 caractères), normalisé en majuscules. Un lot déjà en stock s’augmente (même péremption exigée).', example: 'B2026-114', maxLength: 40 })
  @IsString() @MinLength(1) @MaxLength(40)
  batchNumber!: string;

  @DocProperty({ description: 'Dernier jour de validité (`AAAA-MM-JJ`). Un lot déjà périmé est refusé.', example: '2027-03-31', format: 'date' })
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expiry!: string;

  @DocProperty({ description: 'Quantité reçue, en unités de dispensation (1 à 1 000 000).', example: 100 })
  @IsInt() @Min(1) @Max(1_000_000)
  quantity!: number;

  @DocProperty({ description: 'Coût d’achat d’une unité, en plus petite unité monétaire (0 par défaut ; le coût convenu du bon de commande si la livraison s’y impute).', example: 10, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000_000)
  unitCost?: number;
}

export class PostReceiptDto {
  @DocProperty({ description: 'Fournisseur (1 à 120 caractères). Obligatoire hors bon de commande ; avec `purchaseOrderId`, c’est le fournisseur du bon et cette valeur est ignorée.', example: 'Pharma Distrib', minLength: 1, maxLength: 120, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  supplier?: string;

  @DocProperty({ description: 'Bon de commande **approuvé** auquel la livraison s’impute : les quantités reçues y sont reportées, jamais au-delà du commandé, et le coût d’achat par défaut est le coût convenu.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid', optional: true })
  @IsOptional() @IsUUID()
  purchaseOrderId?: string;

  @DocProperty({ description: 'Référence du bon de livraison du fournisseur.', example: 'BL-2026-0412', maxLength: 60, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(60)
  deliveryNote?: string | null;

  @DocProperty({ description: 'Remarques (200 caractères au plus).', example: null, maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  notes?: string | null;

  @DocProperty({ description: 'Lignes reçues (1 à 50). Un même lot d’un même médicament ne figure qu’une fois.', type: ReceiptLineInputDto, itemType: ReceiptLineInputDto })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ReceiptLineInputDto)
  lines!: ReceiptLineInputDto[];
}

export class ReceiptLineDto {
  @DocProperty({ description: 'Le médicament (absent si sa fiche a disparu).', type: DrugSummaryDto, nullable: true })
  drug!: DrugSummaryDto | null;

  @DocProperty({ description: 'Identifiant du lot (existant ou créé par la réception).', example: ID_EXAMPLE, format: 'uuid' })
  batchId!: string;

  @DocProperty({ description: 'Numéro de lot.', example: 'B2026-114' })
  batchNumber!: string;

  @DocProperty({ description: 'Dernier jour de validité.', example: '2027-03-31', format: 'date' })
  expiry!: string;

  @DocProperty({ description: 'Quantité reçue.', example: 100 })
  quantity!: number;

  @DocProperty({ description: 'Coût d’achat d’une unité.', example: 10 })
  unitCost!: number;

  @DocProperty({ description: 'Valeur de la ligne (quantité × coût).', example: 1000 })
  value!: number;
}

export class ReceiptOrderDto {
  @DocProperty({ description: 'Identifiant du bon de commande.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro du bon de commande.', example: 'PO-0000001' })
  number!: string;
}

export class ReceiptDto {
  @DocProperty({ description: 'Identifiant de la réception.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de réception, attribué par le système.', example: 'GRN-0000001' })
  number!: string;

  @DocProperty({ description: 'Fournisseur.', example: 'Pharma Distrib' })
  supplier!: string;

  @DocProperty({ description: 'Bon de livraison du fournisseur.', example: 'BL-2026-0412', nullable: true })
  deliveryNote!: string | null;

  @DocProperty({ description: 'Remarques.', example: null, nullable: true })
  notes!: string | null;

  @DocProperty({ description: 'Qui a réceptionné.', type: UserSummaryDto, nullable: true })
  receivedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Reçu le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  receivedAt!: string;

  @DocProperty({ description: 'Bon de commande auquel la livraison s’impute.', type: ReceiptOrderDto, nullable: true })
  order!: ReceiptOrderDto | null;

  @DocProperty({ description: 'Total des unités reçues.', example: 100 })
  units!: number;

  @DocProperty({ description: 'Valeur de la livraison au coût d’achat.', example: 1000 })
  value!: number;

  @DocProperty({ description: 'Devise de l’installation (ISO 4217).', example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Lignes de la livraison.', type: ReceiptLineDto, itemType: ReceiptLineDto })
  lines!: readonly ReceiptLineDto[];
}

export class ReceiptSummaryDto {
  @DocProperty({ description: 'Identifiant de la réception.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de réception.', example: 'GRN-0000001' })
  number!: string;

  @DocProperty({ description: 'Fournisseur.', example: 'Pharma Distrib' })
  supplier!: string;

  @DocProperty({ description: 'Bon de livraison.', example: 'BL-2026-0412', nullable: true })
  deliveryNote!: string | null;

  @DocProperty({ description: 'Qui a réceptionné.', type: UserSummaryDto, nullable: true })
  receivedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Reçu le (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  receivedAt!: string;

  @DocProperty({ description: 'Numéro du bon de commande auquel la livraison s’impute.', example: 'PO-0000001', nullable: true })
  orderNumber!: string | null;

  @DocProperty({ description: 'Nombre de lignes.', example: 2 })
  lines!: number;

  @DocProperty({ description: 'Total des unités reçues.', example: 100 })
  units!: number;

  @DocProperty({ description: 'Valeur de la livraison au coût d’achat.', example: 1000 })
  value!: number;
}

export class ReceiptPageDto {
  @DocProperty({ description: 'Réceptions de la page, de la plus récente à la plus ancienne.', type: ReceiptSummaryDto, itemType: ReceiptSummaryDto })
  items!: readonly ReceiptSummaryDto[];

  @DocProperty({ description: 'Nombre total de réceptions correspondantes.', example: 12 })
  total!: number;

  @DocProperty({ description: 'Devise de l’installation (ISO 4217).', example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

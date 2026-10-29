import { IsString, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';
import { DrugDto, DrugSummaryDto, FORMS, SCHEDULES, UserSummaryDto } from './drugs.dto';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';
const LEVELS = ['OK', 'LOW', 'OUT'];

export class QuarantineDto {
  @DocProperty({ description: 'Motif de la mise en quarantaine (1 à 200 caractères).', example: 'Rappel de lot du fabricant', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class StockRowDto {
  @DocProperty({ description: 'Identifiant du médicament.', example: ID_EXAMPLE, format: 'uuid' })
  drugId!: string;

  @DocProperty({ description: 'Code.', example: 'PARA500' })
  code!: string;

  @DocProperty({ description: "Nom d'usage.", example: 'Doliprane 500' })
  name!: string;

  @DocProperty({ description: 'Dénomination commune.', example: 'Paracétamol' })
  genericName!: string;

  @DocProperty({ description: 'Dosage.', example: '500 mg', nullable: true })
  strength!: string | null;

  @DocProperty({ description: 'Forme galénique.', example: 'TABLET', enum: FORMS })
  form!: string;

  @DocProperty({ description: 'Classe de délivrance.', example: 'PRESCRIPTION', enum: SCHEDULES })
  schedule!: string;

  @DocProperty({ description: 'Unité de dispensation.', example: 'comprimé' })
  unit!: string;

  @DocProperty({ description: '`false` : médicament retiré du formulaire (son stock reste visible tant qu’il en reste).', example: true })
  active!: boolean;

  @DocProperty({ description: 'Seuil de réapprovisionnement.', example: 200 })
  reorderLevel!: number;

  @DocProperty({ description: 'Quantité délivrable : lots non périmés et hors quarantaine.', example: 340 })
  dispensable!: number;

  @DocProperty({ description: 'Quantité en quarantaine.', example: 0 })
  quarantined!: number;

  @DocProperty({ description: 'Quantité périmée encore en rayon (à retirer).', example: 0 })
  expired!: number;

  @DocProperty({ description: 'Part de la quantité délivrable qui périme dans la fenêtre d’alerte.', example: 40 })
  expiringSoon!: number;

  @DocProperty({ description: 'Prochaine péremption parmi les lots délivrables (`AAAA-MM-JJ`).', example: '2027-03-31', format: 'date', nullable: true })
  nextExpiry!: string | null;

  @DocProperty({ description: '`OUT` : rien de délivrable ; `LOW` : au seuil de réapprovisionnement ou en dessous ; `OK` sinon.', example: 'OK', enum: LEVELS })
  level!: string;

  @DocProperty({ description: 'Valeur du stock au coût d’achat (tous lots), en plus petite unité monétaire.', example: 3400 })
  value!: number;
}

export class StockPageDto {
  @DocProperty({ description: 'Médicaments de la page : ruptures, puis stocks bas, puis le reste par dénomination commune.', type: StockRowDto, itemType: StockRowDto })
  items!: readonly StockRowDto[];

  @DocProperty({ description: 'Nombre total de médicaments correspondants.', example: 120 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;

  @DocProperty({ description: 'Fenêtre d’alerte de péremption, en jours.', example: 90 })
  expiryAlertDays!: number;
}

export class StockSummaryDto {
  @DocProperty({ description: 'Médicaments actifs du formulaire.', example: 120 })
  drugs!: number;

  @DocProperty({ description: 'Actifs en rupture (rien de délivrable).', example: 4 })
  out!: number;

  @DocProperty({ description: 'Actifs dont le stock est bas.', example: 9 })
  low!: number;

  @DocProperty({ description: 'Médicaments dont du stock périme dans la fenêtre d’alerte.', example: 6 })
  expiring!: number;

  @DocProperty({ description: 'Médicaments dont du stock est périmé.', example: 1 })
  expired!: number;

  @DocProperty({ description: 'Lots en quarantaine encore en stock.', example: 2 })
  quarantinedBatches!: number;

  @DocProperty({ description: 'Ajustements en attente d’une décision.', example: 3 })
  pendingAdjustments!: number;

  @DocProperty({ description: 'Valeur totale du stock au coût d’achat.', example: 1250000 })
  value!: number;

  @DocProperty({ description: 'Fenêtre d’alerte de péremption, en jours.', example: 90 })
  expiryAlertDays!: number;
}

export class BatchDto {
  @DocProperty({ description: 'Identifiant du lot.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant du médicament.', example: ID_EXAMPLE, format: 'uuid' })
  drugId!: string;

  @DocProperty({ description: 'Numéro de lot du fabricant.', example: 'B2026-114' })
  batchNumber!: string;

  @DocProperty({ description: 'Dernier jour de validité (`AAAA-MM-JJ`).', example: '2027-03-31', format: 'date' })
  expiry!: string;

  @DocProperty({ description: 'Jours restants avant la péremption ; négatif : périmé depuis.', example: 150 })
  daysToExpiry!: number;

  @DocProperty({ description: 'Quantité en stock.', example: 340 })
  quantity!: number;

  @DocProperty({ description: 'Coût d’achat d’une unité (moyenne pondérée des livraisons du lot).', example: 10 })
  unitCost!: number;

  @DocProperty({ description: '`AVAILABLE` ou `QUARANTINED`.', example: 'AVAILABLE', enum: ['AVAILABLE', 'QUARANTINED'] })
  status!: string;

  @DocProperty({ description: 'Périmé.', example: false })
  expired!: boolean;

  @DocProperty({ description: 'Périme dans la fenêtre d’alerte (et n’est pas encore périmé).', example: false })
  expiringSoon!: boolean;

  @DocProperty({ description: 'Peut être délivré : en stock, non périmé, hors quarantaine.', example: true })
  dispensable!: boolean;

  @DocProperty({ description: 'Motif de la quarantaine.', example: null, nullable: true })
  quarantineReason!: string | null;

  @DocProperty({ description: 'Qui a mis le lot en quarantaine.', type: UserSummaryDto, nullable: true })
  quarantinedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Mis en quarantaine le (ISO 8601, UTC).', example: null, format: 'date-time', nullable: true })
  quarantinedAt!: string | null;

  @DocProperty({ description: 'Première réception du lot (ISO 8601, UTC).', example: '2026-10-01T08:00:00Z', format: 'date-time' })
  receivedAt!: string;
}

export class DrugStockDto {
  @DocProperty({ description: 'Le médicament.', type: DrugDto })
  drug!: DrugDto;

  @DocProperty({ description: 'Quantité délivrable.', example: 340 })
  dispensable!: number;

  @DocProperty({ description: 'Quantité en quarantaine.', example: 0 })
  quarantined!: number;

  @DocProperty({ description: 'Quantité périmée encore en rayon.', example: 0 })
  expired!: number;

  @DocProperty({ description: 'Part de la quantité délivrable qui périme dans la fenêtre d’alerte.', example: 40 })
  expiringSoon!: number;

  @DocProperty({ description: 'Prochaine péremption parmi les lots délivrables.', example: '2027-03-31', format: 'date', nullable: true })
  nextExpiry!: string | null;

  @DocProperty({ description: 'Niveau de stock.', example: 'OK', enum: LEVELS })
  level!: string;

  @DocProperty({ description: 'Valeur du stock au coût d’achat.', example: 3400 })
  value!: number;

  @DocProperty({ description: 'Fenêtre d’alerte de péremption, en jours.', example: 90 })
  expiryAlertDays!: number;

  @DocProperty({ description: 'Lots en stock, ceux qui périment le plus tôt d’abord.', type: BatchDto, itemType: BatchDto })
  batches!: readonly BatchDto[];
}

export class AllocationDto {
  @DocProperty({ description: 'Identifiant du lot.', example: ID_EXAMPLE, format: 'uuid' })
  batchId!: string;

  @DocProperty({ description: 'Numéro de lot.', example: 'B2026-114' })
  batchNumber!: string;

  @DocProperty({ description: 'Dernier jour de validité.', example: '2027-03-31', format: 'date' })
  expiry!: string;

  @DocProperty({ description: 'Quantité à prélever sur ce lot.', example: 30 })
  quantity!: number;
}

export class FefoDto {
  @DocProperty({ description: 'Le médicament.', type: DrugSummaryDto })
  drug!: DrugSummaryDto;

  @DocProperty({ description: 'Quantité demandée.', example: 70 })
  requested!: number;

  @DocProperty({ description: 'Lots à prélever, ceux qui périment le plus tôt d’abord.', type: AllocationDto, itemType: AllocationDto })
  allocations!: readonly AllocationDto[];

  @DocProperty({ description: 'Ce qui manque ; 0 si le stock délivrable suffit.', example: 0 })
  shortfall!: number;
}

export class ExpiryRowDto extends BatchDto {
  @DocProperty({ description: 'Le médicament du lot.', type: DrugSummaryDto })
  drug!: DrugSummaryDto;
}

export class ExpiryPageDto {
  @DocProperty({ description: 'Lots de la page, ceux qui périment le plus tôt d’abord (périmés en tête).', type: ExpiryRowDto, itemType: ExpiryRowDto })
  items!: readonly ExpiryRowDto[];

  @DocProperty({ description: 'Nombre total de lots correspondants.', example: 12 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;

  @DocProperty({ description: 'Fenêtre d’alerte de péremption, en jours.', example: 90 })
  expiryAlertDays!: number;
}

export class MovementDto {
  @DocProperty({ description: 'Identifiant du mouvement.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant du médicament.', example: ID_EXAMPLE, format: 'uuid' })
  drugId!: string;

  @DocProperty({ description: 'Identifiant du lot.', example: ID_EXAMPLE, format: 'uuid' })
  batchId!: string;

  @DocProperty({ description: 'Numéro de lot.', example: 'B2026-114' })
  batchNumber!: string;

  @DocProperty({ description: 'Nature du mouvement.', example: 'RECEIPT', enum: ['RECEIPT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] })
  type!: string;

  @DocProperty({ description: 'Variation, signée (positive : entrée, négative : sortie).', example: 100 })
  delta!: number;

  @DocProperty({ description: 'Solde du lot après le mouvement.', example: 340 })
  balance!: number;

  @DocProperty({ description: 'Motif.', example: null, nullable: true })
  reason!: string | null;

  @DocProperty({ description: 'Document à l’origine (réception, ajustement).', example: 'GRN-0000001', nullable: true })
  reference!: string | null;

  @DocProperty({ description: 'Qui a fait le mouvement.', type: UserSummaryDto, nullable: true })
  by!: UserSummaryDto | null;

  @DocProperty({ description: 'Quand (ISO 8601, UTC).', example: '2026-11-02T08:00:00Z', format: 'date-time' })
  at!: string;
}

export class MovementPageDto {
  @DocProperty({ description: 'Mouvements, du plus récent au plus ancien.', type: MovementDto, itemType: MovementDto })
  items!: readonly MovementDto[];

  @DocProperty({ description: 'Nombre total de mouvements correspondants.', example: 57 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

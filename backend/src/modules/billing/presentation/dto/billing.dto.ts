import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const CATEGORIES = ['CONSULTATION', 'LABORATORY', 'RADIOLOGY', 'PHARMACY', 'PROCEDURE', 'HOSPITALIZATION', 'OTHER'];
const STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];
const MODES = ['CASH', 'CARD', 'MOBILE_MONEY', 'CHEQUE', 'BANK_TRANSFER'];
const MONEY_HELP = "Montant **entier** dans la plus petite unité de la devise de l'installation (le franc CFA n'a pas de centimes : `15000` = 15 000 FCFA).";
const MAX_MONEY = 1_000_000_000_000;

// ---- Catalogue des actes ---------------------------------------------------------------------------------------------------

export class CreateItemDto {
  @DocProperty({ description: "Code de l'acte (1 à 32 caractères : lettres, chiffres, « _ », « - », « . »), normalisé en majuscules. Unique ; **ne pourra plus être modifié**.", example: 'CONS-GEN', maxLength: 32 })
  @IsString() @MaxLength(32)
  code!: string;

  @DocProperty({ description: "Libellé de l'acte.", example: 'Consultation de médecine générale', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @DocProperty({ description: "Catégorie : consultation, laboratoire, radiologie, pharmacie, acte, hospitalisation ou autre.", example: 'CONSULTATION', enum: CATEGORIES })
  @IsString() @MaxLength(32)
  category!: string;

  @DocProperty({ description: `Prix unitaire. ${MONEY_HELP}`, example: 5000 })
  @IsInt() @Min(0) @Max(MAX_MONEY)
  unitPrice!: number;

  @DocProperty({ description: 'Service qui réalise l\'acte (facultatif ; `/api/v1/structure`).', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid', optional: true, nullable: true })
  @IsOptional() @IsUUID()
  serviceId?: string | null;
}

export class UpdateItemDto {
  @DocProperty({ description: 'Nouveau libellé.', example: 'Consultation générale', minLength: 1, maxLength: 200, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @DocProperty({ description: 'Nouvelle catégorie.', example: 'CONSULTATION', enum: CATEGORIES, optional: true })
  @IsOptional() @IsString() @MaxLength(32)
  category?: string;

  @DocProperty({ description: `Nouveau prix unitaire (les factures déjà établies gardent l'ancien). ${MONEY_HELP}`, example: 6000, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(MAX_MONEY)
  unitPrice?: number;

  @DocProperty({ description: 'Nouveau service ; `null` détache l\'acte de son service.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid', optional: true, nullable: true })
  @IsOptional() @IsUUID()
  serviceId?: string | null;
}

export class ItemDto {
  @DocProperty({ description: "Identifiant de l'acte.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' })
  id!: string;

  @DocProperty({ description: "Code de l'acte (stable).", example: 'CONS-GEN' })
  code!: string;

  @DocProperty({ description: "Libellé de l'acte.", example: 'Consultation de médecine générale' })
  name!: string;

  @DocProperty({ description: 'Catégorie.', example: 'CONSULTATION', enum: CATEGORIES })
  category!: string;

  @DocProperty({ description: `Prix unitaire courant. ${MONEY_HELP}`, example: 5000 })
  unitPrice!: number;

  @DocProperty({ description: "Devise de l'installation (ISO 4217).", example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Service qui réalise l\'acte.', example: null, format: 'uuid', nullable: true })
  serviceId!: string | null;

  @DocProperty({ description: "Faux si l'acte est retiré du catalogue (il reste lisible, mais ne peut plus être facturé).", example: true })
  active!: boolean;
}

export class ItemPageDto {
  @DocProperty({ description: "Actes de la page demandée (triés par code).", type: ItemDto, itemType: ItemDto })
  items!: readonly ItemDto[];

  @DocProperty({ description: "Nombre total d'actes correspondants (toutes pages).", example: 42 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

// ---- Factures --------------------------------------------------------------------------------------------------------------

export class LineInputDto {
  @DocProperty({ description: "Identifiant de l'acte du catalogue (`/api/v1/billing/items`). Il doit être actif.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' })
  @IsUUID()
  itemId!: string;

  @DocProperty({ description: 'Quantité (entier de 1 à 9999).', example: 1 })
  @IsInt() @Min(1) @Max(9999)
  quantity!: number;
}

export class CreateInvoiceDto {
  @DocProperty({ description: 'Identifiant du patient facturé (`/api/v1/patients`).', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  @IsUUID()
  patientId!: string;

  @DocProperty({ description: 'Lignes initiales (facultatif : on peut les ajouter ensuite).', type: LineInputDto, itemType: LineInputDto, optional: true })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => LineInputDto)
  lines?: LineInputDto[];

  @DocProperty({ description: 'Note libre (500 caractères au plus).', example: 'Facture de la consultation du 2 novembre', maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  note?: string | null;
}

export class SetDiscountDto {
  @DocProperty({ description: `Montant de la remise sur toute la facture ; \`0\` la retire. Ne peut pas dépasser le total. ${MONEY_HELP}`, example: 1000 })
  @IsInt() @Min(0) @Max(MAX_MONEY)
  amount!: number;

  @DocProperty({ description: 'Motif de la remise (obligatoire si le montant n\'est pas nul, 200 caractères au plus).', example: 'Personnel de l\'hôpital', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  reason?: string | null;
}

export class ReasonDto {
  @DocProperty({ description: 'Motif (obligatoire, 200 caractères au plus).', example: 'Erreur de saisie', minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  reason!: string;
}

export class CollectPaymentDto {
  @DocProperty({ description: 'Mode de paiement.', example: 'CASH', enum: MODES })
  @IsString() @IsIn(MODES)
  mode!: string;

  @DocProperty({ description: `Montant encaissé (1 au moins, pas plus que le solde). ${MONEY_HELP}`, example: 5000 })
  @IsInt() @Min(1) @Max(MAX_MONEY)
  amount!: number;

  @DocProperty({ description: 'Référence du paiement : n° de transaction mobile, de chèque ou de virement (facultatif, 64 caractères au plus).', example: 'MP240131.1234.A56789', maxLength: 64, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(64)
  reference?: string | null;

  @DocProperty({ description: 'Espèces remises par le patient, pour calculer la monnaie à rendre. Seulement pour `CASH`, et au moins égal au montant encaissé.', example: 10000, optional: true })
  @IsOptional() @IsInt() @Min(1) @Max(MAX_MONEY)
  tendered?: number;
}

export class InvoiceLineDto {
  @DocProperty({ description: 'Identifiant de la ligne.', example: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', format: 'uuid' })
  id!: string;

  @DocProperty({ description: "Acte du catalogue d'où vient la ligne.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' })
  itemId!: string;

  @DocProperty({ description: "Code de l'acte au moment de la facturation (copie).", example: 'CONS-GEN' })
  itemCode!: string;

  @DocProperty({ description: "Libellé de l'acte au moment de la facturation (copie).", example: 'Consultation de médecine générale' })
  itemName!: string;

  @DocProperty({ description: `Prix unitaire au moment de la facturation (copie : ne suit pas le catalogue). ${MONEY_HELP}`, example: 5000 })
  unitPrice!: number;

  @DocProperty({ description: 'Quantité.', example: 1 })
  quantity!: number;

  @DocProperty({ description: 'Total de la ligne (prix × quantité).', example: 5000 })
  total!: number;
}

export class PaymentDto {
  @DocProperty({ description: "Identifiant de l'encaissement.", example: '7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de reçu, attribué par le système.', example: 'REC-0000042' })
  receiptNumber!: string;

  @DocProperty({ description: 'Mode de paiement.', example: 'CASH', enum: MODES })
  mode!: string;

  @DocProperty({ description: 'Montant encaissé.', example: 5000 })
  amount!: number;

  @DocProperty({ description: 'Référence du paiement.', example: null, nullable: true })
  reference!: string | null;

  @DocProperty({ description: "Date et heure de l'encaissement (ISO 8601, UTC).", example: '2026-11-02T09:15:00Z', format: 'date-time' })
  receivedAt!: string;
}

export class InvoicePatientDto {
  @DocProperty({ description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000123' })
  number!: string;

  @DocProperty({ description: 'Nom de famille.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom.', example: 'Élisabeth' })
  firstName!: string;
}

export class InvoiceDto {
  @DocProperty({ description: 'Identifiant de la facture.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de facture, attribué par le système.', example: 'FAC-0000123' })
  number!: string;

  @DocProperty({ description: '`DRAFT` (en préparation), `ISSUED` (émise), `PARTIALLY_PAID`, `PAID` ou `CANCELLED`.', example: 'ISSUED', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Devise (ISO 4217).', example: 'XAF' })
  currency!: string;

  @DocProperty({ description: "Nombre de décimales de la plus petite unité de la devise, pour l'affichage (0 pour le franc CFA).", example: 0 })
  currencyDigits!: number;

  @DocProperty({ description: 'Patient facturé.', type: InvoicePatientDto, nullable: true })
  patient!: InvoicePatientDto | null;

  @DocProperty({ description: 'Lignes de la facture.', type: InvoiceLineDto, itemType: InvoiceLineDto })
  lines!: readonly InvoiceLineDto[];

  @DocProperty({ description: 'Somme des lignes.', example: 7000 })
  subtotal!: number;

  @DocProperty({ description: 'Remise sur toute la facture.', example: 1000 })
  discount!: number;

  @DocProperty({ description: 'Motif de la remise.', example: null, nullable: true })
  discountReason!: string | null;

  @DocProperty({ description: 'À payer : sous-total moins remise.', example: 6000 })
  total!: number;

  @DocProperty({ description: 'Déjà encaissé.', example: 2000 })
  paid!: number;

  @DocProperty({ description: 'Reste à payer.', example: 4000 })
  balance!: number;

  @DocProperty({ description: 'Note libre.', example: null, nullable: true })
  note!: string | null;

  @DocProperty({ description: "Motif d'annulation (facture annulée).", example: null, nullable: true })
  cancellationReason!: string | null;

  @DocProperty({ description: "Date d'émission (ISO 8601, UTC) ; absente tant que la facture est un brouillon.", example: '2026-11-02T09:10:00Z', format: 'date-time', nullable: true })
  issuedAt!: string | null;

  @DocProperty({ description: 'Encaissements, du plus ancien au plus récent.', type: PaymentDto, itemType: PaymentDto })
  payments!: readonly PaymentDto[];
}

export class InvoiceSummaryDto {
  @DocProperty({ description: 'Identifiant de la facture.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de facture.', example: 'FAC-0000123' })
  number!: string;

  @DocProperty({ description: 'Statut.', example: 'ISSUED', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Devise.', example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Patient facturé.', type: InvoicePatientDto, nullable: true })
  patient!: InvoicePatientDto | null;

  @DocProperty({ description: 'Somme des lignes.', example: 7000 })
  subtotal!: number;

  @DocProperty({ description: 'Remise.', example: 1000 })
  discount!: number;

  @DocProperty({ description: 'À payer.', example: 6000 })
  total!: number;

  @DocProperty({ description: 'Déjà encaissé.', example: 2000 })
  paid!: number;

  @DocProperty({ description: 'Reste à payer.', example: 4000 })
  balance!: number;

  @DocProperty({ description: "Date d'émission (ISO 8601, UTC).", example: '2026-11-02T09:10:00Z', format: 'date-time', nullable: true })
  issuedAt!: string | null;

  @DocProperty({ description: 'Date de création (ISO 8601, UTC).', example: '2026-11-02T09:05:00Z', format: 'date-time' })
  createdAt!: string;
}

export class InvoicePageDto {
  @DocProperty({ description: 'Factures de la page demandée (les plus récentes en premier).', type: InvoiceSummaryDto, itemType: InvoiceSummaryDto })
  items!: readonly InvoiceSummaryDto[];

  @DocProperty({ description: 'Nombre total de factures correspondantes (toutes pages).', example: 120 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

export class CollectedPaymentDto {
  @DocProperty({ description: "L'encaissement enregistré.", type: PaymentDto })
  payment!: PaymentDto;

  @DocProperty({ description: 'Monnaie à rendre (espèces remises moins montant encaissé) ; 0 sinon.', example: 5000 })
  change!: number;

  @DocProperty({ description: 'La facture à jour (statut, encaissé, solde).', type: InvoiceDto })
  invoice!: InvoiceDto;
}

export class ReceiptDto {
  @DocProperty({ description: 'Numéro de reçu.', example: 'REC-0000042' })
  receiptNumber!: string;

  @DocProperty({ description: 'Numéro de la facture réglée.', example: 'FAC-0000123' })
  invoiceNumber!: string;

  @DocProperty({ description: 'Patient.', type: InvoicePatientDto, nullable: true })
  patient!: InvoicePatientDto | null;

  @DocProperty({ description: 'Mode de paiement.', example: 'CASH', enum: MODES })
  mode!: string;

  @DocProperty({ description: 'Montant encaissé.', example: 5000 })
  amount!: number;

  @DocProperty({ description: 'Devise.', example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Décimales de la devise.', example: 0 })
  currencyDigits!: number;

  @DocProperty({ description: 'Référence du paiement.', example: null, nullable: true })
  reference!: string | null;

  @DocProperty({ description: "Date et heure de l'encaissement d'origine.", example: '2026-11-02T09:15:00Z', format: 'date-time' })
  receivedAt!: string;

  @DocProperty({ description: 'Toujours vrai : une réimpression est une copie à marquer « DUPLICATA ».', example: true })
  duplicate!: true;

  @DocProperty({ description: 'Solde de la facture à cet instant.', example: 0 })
  invoiceBalance!: number;
}

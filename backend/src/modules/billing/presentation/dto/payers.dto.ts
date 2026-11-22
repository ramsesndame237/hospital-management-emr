import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { DocProperty } from '../../../api-docs';

export class CreatePayerDto {
  @DocProperty({ description: "Code de l'assureur (1 à 20 caractères : lettres, chiffres, « _ », « - », « . »), normalisé en majuscules. Unique ; ne pourra plus être modifié.", example: 'ASP', maxLength: 20 })
  @IsString() @MaxLength(20)
  code!: string;

  @DocProperty({ description: "Nom de l'assureur.", example: 'Assurance Santé Plus', minLength: 1, maxLength: 120 })
  @IsString() @MaxLength(120)
  name!: string;
}

export class UpdatePayerDto {
  @DocProperty({ description: 'Nouveau nom.', example: 'Assurance Santé Plus SA', minLength: 1, maxLength: 120, optional: true })
  @IsOptional() @IsString() @MaxLength(120)
  name?: string;
}

export class PayerDto {
  @DocProperty({ description: "Identifiant de l'assureur.", example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code (stable).', example: 'ASP' })
  code!: string;

  @DocProperty({ description: 'Nom.', example: 'Assurance Santé Plus' })
  name!: string;

  @DocProperty({ description: "Faux si l'assureur est retiré : il reste lisible mais n'accepte plus de nouvelle couverture.", example: true })
  active!: boolean;
}

export class PayerPageDto {
  @DocProperty({ description: 'Assureurs de la page demandée (triés par nom).', type: PayerDto, itemType: PayerDto })
  items!: readonly PayerDto[];

  @DocProperty({ description: "Nombre total d'assureurs correspondants.", example: 6 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

export class RecordCoverageDto {
  @DocProperty({ description: "Assureur (voir `GET /api/v1/billing/payers`).", example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  @IsUUID()
  payerId!: string;

  @DocProperty({ description: "Numéro d'assuré du patient chez cet assureur (1 à 40 caractères).", example: 'AS-123456', minLength: 1, maxLength: 40 })
  @IsString() @MaxLength(40)
  policyNumber!: string;

  @DocProperty({ description: 'Part prise en charge par l\'assureur, en pourcentage entier (1 à 100).', example: 80 })
  @IsInt() @Min(1) @Max(100)
  percent!: number;

  @DocProperty({ description: "Début de validité, `AAAA-MM-JJ` (aujourd'hui par défaut).", example: '2026-01-01', maxLength: 10, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(10)
  validFrom?: string | null;

  @DocProperty({ description: 'Fin de validité, `AAAA-MM-JJ` (sans fin par défaut).', example: '2026-12-31', maxLength: 10, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(10)
  validUntil?: string | null;
}

export class CoveragePayerDto {
  @DocProperty({ description: "Identifiant de l'assureur.", example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code.', example: 'ASP' })
  code!: string;

  @DocProperty({ description: 'Nom.', example: 'Assurance Santé Plus' })
  name!: string;
}

export class CoverageDto {
  @DocProperty({ description: 'Identifiant de la couverture.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Patient couvert.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  patientId!: string;

  @DocProperty({ description: "L'assureur.", type: CoveragePayerDto, nullable: true })
  payer!: CoveragePayerDto | null;

  @DocProperty({ description: "Numéro d'assuré.", example: 'AS-123456' })
  policyNumber!: string;

  @DocProperty({ description: 'Part prise en charge (%).', example: 80 })
  percent!: number;

  @DocProperty({ description: 'Début de validité.', example: '2026-01-01' })
  validFrom!: string;

  @DocProperty({ description: 'Fin de validité ; `null` : sans fin.', example: null, nullable: true })
  validUntil!: string | null;

  @DocProperty({ description: "Vrai si la couverture peut s'appliquer aujourd'hui (active, commencée, pas expirée).", example: true })
  validToday!: boolean;
}

export class ApplyCoverageDto {
  @DocProperty({ description: 'Couverture du patient à appliquer (voir `GET /api/v1/billing/patients/{patientId}/coverages`).', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  @IsUUID()
  coverageId!: string;
}

export class SettleDto {
  @DocProperty({ description: "Référence du règlement reçu de l'assureur (virement, bordereau), 1 à 60 caractères.", example: 'VIR-2026-0042', minLength: 1, maxLength: 60 })
  @IsString() @MaxLength(60)
  reference!: string;
}

export class ClaimPatientDto {
  @DocProperty({ description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de dossier.', example: 'PAT-0000042' })
  number!: string;

  @DocProperty({ description: 'Nom.', example: 'Mbarga' })
  lastName!: string;

  @DocProperty({ description: 'Prénom.', example: 'Élisabeth' })
  firstName!: string;
}

export class ClaimDto {
  @DocProperty({ description: 'Facture concernée.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' })
  invoiceId!: string;

  @DocProperty({ description: 'Numéro de facture.', example: 'FAC-0000123' })
  invoiceNumber!: string;

  @DocProperty({ description: 'Patient.', type: ClaimPatientDto, nullable: true })
  patient!: ClaimPatientDto | null;

  @DocProperty({ description: "Identifiant de l'assureur.", example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  payerId!: string;

  @DocProperty({ description: "Nom de l'assureur.", example: 'Assurance Santé Plus' })
  payerName!: string;

  @DocProperty({ description: "Numéro d'assuré.", example: 'AS-123456', nullable: true })
  policyNumber!: string | null;

  @DocProperty({ description: 'Pourcentage pris en charge.', example: 80 })
  percent!: number;

  @DocProperty({ description: "Part de l'assureur (entier, plus petite unité de la devise).", example: 4800 })
  amount!: number;

  @DocProperty({ description: "Date d'émission de la facture.", example: '2026-11-02T09:10:00Z' })
  issuedAt!: string;

  @DocProperty({ description: 'Date du règlement ; `null` : à recouvrer.', example: null, nullable: true })
  settledAt!: string | null;

  @DocProperty({ description: 'Référence du règlement.', example: null, nullable: true })
  settlementReference!: string | null;
}

export class ClaimPageDto {
  @DocProperty({ description: 'Créances de la page demandée (les plus anciennes d\'abord).', type: ClaimDto, itemType: ClaimDto })
  items!: readonly ClaimDto[];

  @DocProperty({ description: 'Nombre total de créances correspondantes.', example: 14 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

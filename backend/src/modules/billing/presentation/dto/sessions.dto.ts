import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const STATUSES = ['OPEN', 'AWAITING_REVIEW', 'CLOSED'];
const MODES = ['CASH', 'CARD', 'MOBILE_MONEY', 'CHEQUE', 'BANK_TRANSFER'];
const COUNT_HELP = 'Comptage : un objet `{ "valeur du billet ou de la pièce": quantité }` (ex. `{ "10000": 3, "500": 2 }`). Seules les valeurs de `GET /api/v1/billing/cash-sessions/denominations` sont admises ; la quantité est un entier de 0 à 100 000. Le total est calculé par le serveur.';

export class OpenSessionDto {
  @DocProperty({ description: 'Poste de caisse (1 à 40 caractères). Un poste n\'a qu\'une session ouverte à la fois.', example: 'Caisse OPD 1', minLength: 1, maxLength: 40 })
  @IsString() @MinLength(1) @MaxLength(40)
  counter!: string;

  @DocProperty({ description: `Fonds de caisse compté à l'ouverture. ${COUNT_HELP}`, example: { 5000: 2, 1000: 5 }, type: Object, optional: true })
  @IsOptional() @IsObject()
  openingCount?: Record<string, number>;
}

export class CloseSessionDto {
  @DocProperty({ description: `Espèces comptées à la clôture. ${COUNT_HELP}`, example: { 10000: 2, 5000: 3 }, type: Object })
  @IsObject()
  count!: Record<string, number>;

  @DocProperty({ description: "Explication de l'écart : obligatoire dès que la caisse n'est pas juste (200 caractères au plus).", example: 'Erreur de monnaie rendue', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  reason?: string | null;
}

export class CosignSessionDto {
  @DocProperty({ description: 'Commentaire du responsable (facultatif, 200 caractères au plus).', example: 'Écart vérifié avec le caissier', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  comment?: string | null;
}

export class UserSummaryDto {
  @DocProperty({ description: 'Identifiant du compte.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Identifiant de connexion.', example: 'caissier.un' })
  username!: string;
}

export class DenominationsDto {
  @DocProperty({ description: "Devise de l'installation.", example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Décimales de la plus petite unité de la devise.', example: 0 })
  currencyDigits!: number;

  @DocProperty({ description: 'Valeurs des billets et pièces, de la plus grande à la plus petite (dans la plus petite unité de la devise).', example: [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1], itemType: 'number' })
  denominations!: readonly number[];

  @DocProperty({ description: "Écart de caisse au-delà duquel la clôture attend la contre-signature d'un responsable.", example: 5000 })
  varianceLimit!: number;
}

export class SessionDto {
  @DocProperty({ description: 'Identifiant de la session.', example: '4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de session, attribué par le système.', example: 'CAI-0000007' })
  number!: string;

  @DocProperty({ description: '`OPEN` (caisse ouverte), `AWAITING_REVIEW` (clôturée, écart élevé : attend la contre-signature d\'un responsable) ou `CLOSED`.', example: 'OPEN', enum: STATUSES })
  status!: string;

  @DocProperty({ description: 'Devise.', example: 'XAF' })
  currency!: string;

  @DocProperty({ description: 'Décimales de la devise.', example: 0 })
  currencyDigits!: number;

  @DocProperty({ description: 'Le caissier.', type: UserSummaryDto, nullable: true })
  cashier!: UserSummaryDto | null;

  @DocProperty({ description: 'Poste de caisse.', example: 'Caisse OPD 1' })
  counter!: string;

  @DocProperty({ description: "Ouverture (ISO 8601, UTC).", example: '2026-11-02T07:30:00Z', format: 'date-time' })
  openedAt!: string;

  @DocProperty({ description: "Fonds de caisse : les espèces comptées à l'ouverture.", example: 20000 })
  openingFloat!: number;

  @DocProperty({ description: "Comptage de l'ouverture.", example: { 5000: 2, 1000: 10 }, type: Object })
  openingCount!: Record<string, number>;

  @DocProperty({ description: 'Encaissé pendant la session, par mode de paiement.', example: { CASH: 12000, CARD: 5000, MOBILE_MONEY: 0, CHEQUE: 0, BANK_TRANSFER: 0 }, type: Object })
  takings!: Record<string, number>;

  @DocProperty({ description: "Nombre d'encaissements.", example: 7 })
  paymentCount!: number;

  @DocProperty({ description: 'Total encaissé, tous modes confondus.', example: 17000 })
  totalTaken!: number;

  @DocProperty({ description: 'Espèces qui devraient être en caisse : fonds de caisse + espèces encaissées (vivant tant que la session est ouverte, figé à la clôture).', example: 32000 })
  expectedCash!: number;

  @DocProperty({ description: 'Clôture (ISO 8601, UTC).', example: null, format: 'date-time', nullable: true })
  closedAt!: string | null;

  @DocProperty({ description: 'Comptage de la clôture.', example: null, type: Object, nullable: true })
  closingCount!: Record<string, number> | null;

  @DocProperty({ description: 'Espèces comptées à la clôture.', example: null, nullable: true })
  countedCash!: number | null;

  @DocProperty({ description: "Écart : espèces comptées − espèces attendues (négatif : il manque de l'argent).", example: null, nullable: true })
  variance!: number | null;

  @DocProperty({ description: "Explication de l'écart.", example: null, nullable: true })
  varianceReason!: string | null;

  @DocProperty({ description: "Vrai si l'écart dépasse la limite : la clôture attend une contre-signature.", example: false })
  requiresCosign!: boolean;

  @DocProperty({ description: 'Le responsable qui a contre-signé.', type: UserSummaryDto, nullable: true })
  cosignedBy!: UserSummaryDto | null;

  @DocProperty({ description: 'Date de la contre-signature.', example: null, format: 'date-time', nullable: true })
  cosignedAt!: string | null;

  @DocProperty({ description: 'Commentaire du responsable.', example: null, nullable: true })
  cosignComment!: string | null;

  @DocProperty({ description: "Écart au-delà duquel la clôture attend la contre-signature d'un responsable.", example: 5000 })
  varianceLimit!: number;
}

export class SessionPaymentDto {
  @DocProperty({ description: "Identifiant de l'encaissement.", example: '7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b', format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Numéro de reçu.', example: 'REC-0000042' })
  receiptNumber!: string;

  @DocProperty({ description: 'Numéro de la facture réglée.', example: 'FAC-0000123' })
  invoiceNumber!: string;

  @DocProperty({ description: 'Mode de paiement.', example: 'CASH', enum: MODES })
  mode!: string;

  @DocProperty({ description: 'Montant encaissé.', example: 5000 })
  amount!: number;

  @DocProperty({ description: "Date et heure de l'encaissement (ISO 8601, UTC).", example: '2026-11-02T09:15:00Z', format: 'date-time' })
  receivedAt!: string;
}

export class SessionDetailDto extends SessionDto {
  @DocProperty({ description: 'Encaissements de la session, du plus ancien au plus récent.', type: SessionPaymentDto, itemType: SessionPaymentDto })
  payments!: readonly SessionPaymentDto[];
}

export class CurrentSessionDto {
  @DocProperty({ description: "La caisse ouverte du caissier, ou `null` s'il n'en a pas (il ne peut alors pas encaisser).", type: SessionDetailDto, nullable: true })
  session!: SessionDetailDto | null;
}

export class SessionPageDto {
  @DocProperty({ description: 'Sessions de la page demandée (les plus récentes en premier).', type: SessionDto, itemType: SessionDto })
  items!: readonly SessionDto[];

  @DocProperty({ description: 'Nombre total de sessions correspondantes (toutes pages).', example: 24 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}


import { PaymentMode } from './billing.models';

export const SESSION_STATUSES = ['OPEN', 'AWAITING_REVIEW', 'CLOSED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Comptage d'une caisse : quantité de billets ou de pièces par valeur (dans la plus petite unité de la devise) : `{ "10000": 3 }`. */
export type CashCount = Readonly<Record<string, number>>;

export interface CashierSummary {
  readonly id: string;
  readonly username: string;
}

/** Les valeurs à compter et la limite d'écart de l'installation. */
export interface DenominationsInfo {
  readonly currency: string;
  readonly currencyDigits: number;
  /** De la plus grande valeur à la plus petite. */
  readonly denominations: readonly number[];
  /** Écart de caisse au-delà duquel la clôture attend la contre-signature d'un responsable. */
  readonly varianceLimit: number;
}

export interface CashSession {
  readonly id: string;
  readonly number: string;
  readonly status: SessionStatus;
  readonly currency: string;
  readonly currencyDigits: number;
  readonly cashier: CashierSummary | null;
  readonly counter: string;
  readonly openedAt: string;
  readonly openingFloat: number;
  readonly openingCount: CashCount;
  /** Encaissé pendant la session, par mode de paiement. */
  readonly takings: Readonly<Record<PaymentMode, number>>;
  readonly paymentCount: number;
  readonly totalTaken: number;
  /** Espèces qui devraient être en caisse : fonds + espèces encaissées. */
  readonly expectedCash: number;
  readonly closedAt: string | null;
  readonly closingCount: CashCount | null;
  readonly countedCash: number | null;
  /** Espèces comptées − espèces attendues : négatif quand il manque de l'argent. */
  readonly variance: number | null;
  readonly varianceReason: string | null;
  readonly requiresCosign: boolean;
  readonly cosignedBy: CashierSummary | null;
  readonly cosignedAt: string | null;
  readonly cosignComment: string | null;
  readonly varianceLimit: number;
}

export interface SessionPayment {
  readonly id: string;
  readonly receiptNumber: string;
  readonly invoiceNumber: string;
  readonly mode: PaymentMode;
  readonly amount: number;
  readonly receivedAt: string;
}

export interface CashSessionDetail extends CashSession {
  readonly payments: readonly SessionPayment[];
}

export interface SessionPage {
  readonly items: readonly CashSession[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface OpenSessionInput {
  readonly counter: string;
  readonly openingCount: CashCount;
}

export interface CloseSessionInput {
  readonly count: CashCount;
  /** Obligatoire dès que la caisse n'est pas juste. */
  readonly reason?: string;
}

export interface SessionFilter {
  readonly status?: SessionStatus;
}

/** Total d'un comptage : somme valeur × quantité (aperçu à l'écran ; le serveur le recalcule toujours). */
export function countTotal(count: CashCount): number {
  return Object.entries(count).reduce((sum, [value, quantity]) => sum + Number(value) * quantity, 0);
}

/** Une caisse est ouverte tant qu'elle n'est pas clôturée : c'est elle qui permet d'encaisser. */
export const isOpen = (session: Pick<CashSession, 'status'>): boolean => session.status === 'OPEN';

/** Une clôture à écart élevé attend la contre-signature d'un responsable. */
export const awaitsReview = (session: Pick<CashSession, 'status'>): boolean => session.status === 'AWAITING_REVIEW';

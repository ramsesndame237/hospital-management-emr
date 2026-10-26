import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { ValueObject } from '../../../shared-kernel/value-object';
import { Amount, Currency, PaymentMode } from './values';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SessionId extends ValueObject<string> {
  static create(raw: string): Result<SessionId> {
    const normalized = (raw ?? '').trim();
    return UUID.test(normalized) ? ok(new SessionId(normalized.toLowerCase())) : err(new DomainError('BILLING_SESSION_ID_INVALID', "L'identifiant de cette session de caisse est invalide."));
  }
}

export class SessionNumber extends ValueObject<string> {
  static create(raw: string): Result<SessionNumber> {
    const normalized = (raw ?? '').trim().toUpperCase();
    return /^CAI-\d{7,12}$/.test(normalized) ? ok(new SessionNumber(normalized)) : err(new DomainError('BILLING_SESSION_NUMBER_INVALID', 'Numéro de session de caisse invalide.'));
  }

  static fromSequence(n: number): Result<SessionNumber> {
    return SessionNumber.create(`CAI-${String(n).padStart(7, '0')}`);
  }
}

/** Poste d'encaissement (« Caisse OPD 1 », « Pharmacie – comptoir 2 ») : 1 à 40 caractères. Un poste n'a qu'une session ouverte à la fois. */
export class CounterName extends ValueObject<string> {
  static create(raw: string): Result<CounterName> {
    const normalized = (raw ?? '').trim().replace(/\s+/g, ' ');
    return normalized.length >= 1 && normalized.length <= 40 ? ok(new CounterName(normalized)) : err(new DomainError('BILLING_COUNTER_INVALID', 'Le nom du poste de caisse doit comporter de 1 à 40 caractères.'));
  }
}

/**
 * Valeurs des billets et pièces de chaque devise, dans sa plus petite unité, de la plus grande à la plus petite. Le franc CFA n'a pas
 * de centimes (billets de 500 à 10 000, pièces de 1 à 500) ; une devise inconnue reçoit une série générique 1-2-5.
 */
export function denominationsOf(currency: Currency): readonly number[] {
  switch (currency.value) {
    case 'XAF':
    case 'XOF':
      return [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1];
    case 'EUR':
      return [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
    default:
      return [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
  }
}

export const MAX_COUNT_PER_DENOMINATION = 100_000;

/**
 * Comptage d'une caisse : combien de billets ou pièces de chaque valeur. Seules les valeurs de la devise sont admises, les quantités sont
 * des entiers de 0 à 100 000 ; les valeurs à zéro sont écartées. Le total est calculé ici, jamais saisi.
 */
export class Denominations {
  private constructor(readonly counts: Readonly<Record<string, number>>) {
    Object.freeze(this);
  }

  static readonly EMPTY = new Denominations({});

  static create(raw: unknown, currency: Currency): Result<Denominations> {
    if (raw === undefined || raw === null) return ok(Denominations.EMPTY);
    if (typeof raw !== 'object' || Array.isArray(raw)) return err(new DomainError('BILLING_COUNT_INVALID', 'Le comptage doit associer une quantité à chaque valeur de billet ou de pièce.'));
    const allowed = new Set(denominationsOf(currency).map(String));
    const counts: Record<string, number> = {};
    for (const [value, quantity] of Object.entries(raw as Record<string, unknown>)) {
      if (!allowed.has(value)) return err(new DomainError('BILLING_COUNT_INVALID', `« ${value} » n'est pas une valeur de billet ou de pièce de cette devise.`, { value }));
      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_COUNT_PER_DENOMINATION) {
        return err(new DomainError('BILLING_COUNT_INVALID', `La quantité de « ${value} » doit être un entier de 0 à ${MAX_COUNT_PER_DENOMINATION}.`, { value, max: MAX_COUNT_PER_DENOMINATION }));
      }
      if (quantity > 0) counts[value] = quantity;
    }
    return ok(new Denominations(counts));
  }

  /** Reconstitution depuis la base (déjà validé). */
  static restore(counts: Readonly<Record<string, number>>): Denominations {
    return new Denominations({ ...counts });
  }

  get total(): Amount {
    return Amount.restore(Object.entries(this.counts).reduce((sum, [value, quantity]) => sum + Number(value) * quantity, 0));
  }
}

export enum SessionStatus {
  /** La caisse est ouverte : on peut encaisser. */
  OPEN = 'OPEN',
  /** Clôturée avec un écart au-dessus de la limite : en attente de la contre-signature d'un responsable. */
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  CLOSED = 'CLOSED',
}

export function parseSessionStatus(raw: string): Result<SessionStatus> {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(SessionStatus) as string[]).find((v) => v === normalized);
  return found ? ok(found as SessionStatus) : err(new DomainError('BILLING_SESSION_STATUS_INVALID', `Statut de session invalide : « ${String(raw ?? '')} ».`, { value: String(raw ?? '') }));
}

/** Ce qui a été encaissé pendant la session, par mode de paiement (lu en base, jamais saisi). */
export type Takings = Readonly<Record<PaymentMode, Amount>>;

export const emptyTakings = (): Takings => ({
  [PaymentMode.CASH]: Amount.ZERO, [PaymentMode.CARD]: Amount.ZERO, [PaymentMode.MOBILE_MONEY]: Amount.ZERO, [PaymentMode.CHEQUE]: Amount.ZERO, [PaymentMode.BANK_TRANSFER]: Amount.ZERO,
});

export interface SessionState {
  readonly id: SessionId;
  readonly number: SessionNumber;
  /** Le caissier (compte) qui tient la caisse. */
  readonly cashierId: string;
  readonly counter: CounterName;
  readonly currency: Currency;
  readonly status: SessionStatus;
  readonly openedAt: Instant;
  readonly openingCount: Denominations;
  /** Fonds de caisse : les espèces comptées à l'ouverture. */
  readonly openingFloat: Amount;
  readonly closedAt: Instant | null;
  readonly closingCount: Denominations | null;
  readonly countedCash: Amount | null;
  /** Espèces attendues à la clôture : fonds de caisse + espèces encaissées. Figé à la clôture. */
  readonly expectedCash: Amount | null;
  /** Écart = espèces comptées − espèces attendues (négatif : il manque de l'argent). Nul si la caisse est juste. */
  readonly variance: number | null;
  readonly varianceReason: string | null;
  readonly requiresCosign: boolean;
  readonly cosignedBy: string | null;
  readonly cosignedAt: Instant | null;
  readonly cosignComment: string | null;
}

/**
 * Session de caisse : un caissier ouvre sa caisse en comptant son fonds, encaisse, puis la clôture en comptant ce qu'il a en main. L'écart
 * entre les espèces comptées et les espèces attendues est inscrit ; il exige une explication, et au-delà de la limite de l'installation la
 * clôture attend la contre-signature d'un responsable (qui n'est pas le caissier). Rien n'est supprimé ni rouvert.
 */
export class CashSession {
  private constructor(private current: SessionState) {}

  static restore(state: SessionState): CashSession {
    return new CashSession(state);
  }

  static open(state: Pick<SessionState, 'id' | 'number' | 'cashierId' | 'counter' | 'currency' | 'openedAt' | 'openingCount'>): CashSession {
    return new CashSession({
      ...state, status: SessionStatus.OPEN, openingFloat: state.openingCount.total, closedAt: null, closingCount: null, countedCash: null, expectedCash: null, variance: null,
      varianceReason: null, requiresCosign: false, cosignedBy: null, cosignedAt: null, cosignComment: null,
    });
  }

  get state(): SessionState { return this.current; }
  get id(): SessionId { return this.current.id; }
  get status(): SessionStatus { return this.current.status; }

  /** Espèces qui devraient se trouver dans la caisse maintenant : le fonds de caisse plus les espèces encaissées. */
  expectedCashWith(takings: Takings): Amount {
    return this.current.openingFloat.plus(takings[PaymentMode.CASH]);
  }

  /**
   * Clôture la caisse avec le comptage final. `takings` est ce qui a été encaissé (relu sous verrou : aucun encaissement ne peut arriver
   * après). Un écart exige un motif ; au-delà de `varianceLimit` la session attend une contre-signature au lieu d'être close.
   */
  close(input: { count: Denominations; reason: string | null; now: Instant; takings: Takings; varianceLimit: number }): Result<void> {
    if (this.current.status !== SessionStatus.OPEN) {
      return err(new DomainError('BILLING_SESSION_NOT_OPEN', 'Cette session de caisse est déjà clôturée.', { status: this.current.status }));
    }
    const counted = input.count.total;
    const expected = this.expectedCashWith(input.takings);
    const variance = counted.value - expected.value;
    const reason = (input.reason ?? '').trim();
    if (variance !== 0 && reason.length === 0) {
      return err(new DomainError('BILLING_VARIANCE_REASON_REQUIRED', "La caisse n'est pas juste : expliquez l'écart (200 caractères au plus).", { variance }));
    }
    if (reason.length > 200) return err(new DomainError('BILLING_VARIANCE_REASON_REQUIRED', "L'explication de l'écart ne doit pas dépasser 200 caractères.", { variance }));
    const needsReview = Math.abs(variance) > input.varianceLimit;
    this.current = {
      ...this.current, status: needsReview ? SessionStatus.AWAITING_REVIEW : SessionStatus.CLOSED, closedAt: input.now, closingCount: input.count, countedCash: counted, expectedCash: expected,
      variance, varianceReason: variance === 0 ? null : reason, requiresCosign: needsReview,
    };
    return ok(undefined);
  }

  /** Un responsable valide une clôture dont l'écart dépasse la limite. Il ne peut pas valider sa propre caisse. */
  cosign(by: string, comment: string | null, now: Instant): Result<void> {
    if (this.current.status !== SessionStatus.AWAITING_REVIEW) {
      return err(new DomainError('BILLING_SESSION_NOT_AWAITING_REVIEW', "Cette session n'attend pas de contre-signature.", { status: this.current.status }));
    }
    if (by === this.current.cashierId) return err(new DomainError('BILLING_COSIGN_SELF', 'Vous ne pouvez pas contre-signer votre propre caisse.'));
    const text = (comment ?? '').trim();
    if (text.length > 200) return err(new DomainError('BILLING_COSIGN_COMMENT_INVALID', 'Le commentaire ne doit pas dépasser 200 caractères.'));
    this.current = { ...this.current, status: SessionStatus.CLOSED, cosignedBy: by, cosignedAt: now, cosignComment: text === '' ? null : text };
    return ok(undefined);
  }
}

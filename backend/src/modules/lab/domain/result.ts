import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { ReferenceRange, TestState } from './test';

/** Variation (en %) par rapport au dernier résultat publié du même patient au-delà de laquelle le technicien est alerté (delta check). */
export const DELTA_ALERT_PERCENT = 30;

/**
 * `ENTERED` : saisi, attend sa validation par un autre technicien ; `RETURNED` : renvoyé à son auteur pour correction ;
 * `VERIFIED` : validé, attend sa publication ; `RELEASED` : publié (visible du prescripteur).
 */
export type ResultStatus = 'ENTERED' | 'RETURNED' | 'VERIFIED' | 'RELEASED';

/** Position du résultat par rapport aux valeurs de référence ; `null` quand aucune tranche ne s'applique au patient. */
export type ResultFlag = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH';

export const isCritical = (flag: ResultFlag | null): boolean => flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH';

/** Une saisie du résultat : chaque correction ou amendement en crée une nouvelle, aucune n'est jamais réécrite. */
export interface ResultVersion {
  readonly version: number;
  /** Valeur telle qu'affichée (nombre normalisé, texte ou choix). */
  readonly value: string;
  readonly valueNumber: number | null;
  readonly flag: ResultFlag | null;
  /** Valeurs de référence appliquées (copie : le catalogue peut évoluer sans réécrire un résultat). */
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly criticalLow: number | null;
  readonly criticalHigh: number | null;
  readonly unit: string | null;
  /** Dernier résultat publié du même patient pour cette analyse, au moment de la saisie. */
  readonly previousValue: number | null;
  readonly deltaAlert: boolean;
  readonly enteredBy: string;
  readonly enteredAt: Instant;
  readonly comment: string | null;
  /** Renseigné pour un amendement d'un résultat déjà publié. */
  readonly amendmentReason: string | null;
}

export const NOTIFICATION_METHODS = ['PHONE', 'IN_PERSON', 'SECURE_MESSAGE'] as const;
export type NotificationMethod = (typeof NOTIFICATION_METHODS)[number];

/** Appel du clinicien pour une valeur critique : qui a été prévenu, comment, et qu'il a relu la valeur. */
export interface CriticalNotification {
  readonly version: number;
  readonly notifiedName: string;
  readonly notifiedRole: string;
  readonly method: NotificationMethod;
  readonly readBackConfirmed: boolean;
  readonly at: Instant;
  readonly by: string;
}

export interface TestResult {
  readonly status: ResultStatus;
  readonly versions: readonly ResultVersion[];
  /** Dernière version publiée : c'est elle que voit le prescripteur, même pendant un amendement. */
  readonly releasedVersion: number | null;
  readonly returnReason: string | null;
  readonly verifiedBy: string | null;
  readonly verifiedAt: Instant | null;
  readonly releasedBy: string | null;
  readonly releasedAt: Instant | null;
  readonly notifications: readonly CriticalNotification[];
}

export const currentVersion = (r: TestResult): ResultVersion => r.versions[r.versions.length - 1];

/** Une valeur critique ne peut être publiée qu'après l'appel du clinicien sur cette version. */
export const criticalNotified = (r: TestResult): boolean => r.notifications.some((n) => n.version === currentVersion(r).version);

/** Valeur saisie, contrôlée selon le type de résultat de l'analyse. */
export interface ParsedValue {
  readonly value: string;
  readonly valueNumber: number | null;
}

const invalid = (code: string, message: string): Result<never> => err(new DomainError(code, message));

/** Contrôle la saisie : un nombre (virgule ou point) pour une analyse numérique, une des valeurs admises pour une analyse à choix, un texte sinon. */
export function parseValue(test: Pick<TestState, 'resultType' | 'choices'>, raw: unknown): Result<ParsedValue> {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  if (test.resultType === 'NUMERIC') {
    const normalized = text.replace(',', '.');
    if (!/^-?\d{1,9}(\.\d{1,6})?$/.test(normalized)) return invalid('LAB_RESULT_VALUE_INVALID', 'Saisissez un nombre (virgule ou point, 6 décimales au plus).');
    return ok({ value: normalized, valueNumber: Number(normalized) });
  }
  if (test.resultType === 'CHOICE') {
    const found = test.choices.find((c) => c.toLowerCase() === text.toLowerCase());
    return found ? ok({ value: found, valueNumber: null }) : invalid('LAB_RESULT_CHOICE_INVALID', 'Choisissez une des valeurs admises pour cette analyse.');
  }
  return text.length >= 1 && text.length <= 2000 ? ok({ value: text, valueNumber: null }) : invalid('LAB_RESULT_VALUE_INVALID', 'Le résultat doit comporter de 1 à 2000 caractères.');
}

/** La tranche qui s'applique : même sexe (ou « tous »), âge dans l'intervalle ; une tranche propre au sexe l'emporte sur « tous ». */
export function applicableRange(ranges: readonly ReferenceRange[], sex: string, ageDays: number): ReferenceRange | null {
  const fits = ranges.filter((r) => ageDays >= r.ageMinDays && (r.ageMaxDays === null || ageDays < r.ageMaxDays));
  return fits.find((r) => r.sex === sex) ?? fits.find((r) => r.sex === 'ANY') ?? null;
}

/** Position d'une valeur par rapport à la tranche : critique d'abord, puis bas ou haut, sinon normale. */
export function flagFor(range: ReferenceRange | null, value: number): ResultFlag | null {
  if (!range) return null;
  if (range.criticalLow !== null && value < range.criticalLow) return 'CRITICAL_LOW';
  if (range.criticalHigh !== null && value > range.criticalHigh) return 'CRITICAL_HIGH';
  if (range.low !== null && value < range.low) return 'LOW';
  if (range.high !== null && value > range.high) return 'HIGH';
  return 'NORMAL';
}

/** Variation de plus de `DELTA_ALERT_PERCENT` % par rapport au résultat précédent. Sans précédent (ou précédent nul), pas d'alerte. */
export function deltaAlertFor(previous: number | null, value: number): boolean {
  return previous !== null && previous !== 0 && (Math.abs(value - previous) / Math.abs(previous)) * 100 > DELTA_ALERT_PERCENT;
}

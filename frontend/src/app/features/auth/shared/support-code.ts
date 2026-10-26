import { Instant, Temporal } from '../../../core/time/temporal';

/** N01 : réseau · C01 : identifiants refusés · R01 : trop de tentatives · S01 : service indisponible. */
export type SupportCodeKind = 'N01' | 'C01' | 'R01' | 'S01';

/**
 * Code d'assistance à communiquer à l'administrateur : `AUTH-N01-241026` = type d'incident (N01 : réseau, C01 : identifiants, R01 : trop de tentatives, S01 : service indisponible) et date du jour
 * (jour, mois, année sur deux chiffres). Il ne contient aucune donnée personnelle ; il sert seulement à retrouver l'incident.
 */
export function supportCode(kind: SupportCodeKind, at: Instant): string {
  const day = at.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDate();
  const two = (n: number): string => String(n).padStart(2, '0');
  return `AUTH-${kind}-${two(day.day)}${two(day.month)}${two(day.year % 100)}`;
}

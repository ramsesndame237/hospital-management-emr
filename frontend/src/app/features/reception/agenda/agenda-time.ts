import { Instant, Temporal } from '../../../core/time/temporal';

/** Le fuseau de l'utilisateur : celui dans lequel il lit et saisit les jours et les heures. */
const zone = (): string => Temporal.Now.timeZoneId();

/** Jour (`AAAA-MM-JJ`) d'un instant, dans le fuseau de l'utilisateur. */
export const localDate = (instant: Instant): string => instant.toZonedDateTimeISO(zone()).toPlainDate().toString();

/** Heure (`HH:MM`) d'un instant, dans le fuseau de l'utilisateur. */
export function localTime(instant: Instant): string {
  const t = instant.toZonedDateTimeISO(zone());
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

/** L'instant (ISO 8601, UTC) d'un jour et d'une heure saisis dans le fuseau de l'utilisateur ; `null` si la date n'existe pas. */
export function toInstantIso(date: string, time: string): string | null {
  try {
    return Temporal.PlainDateTime.from(`${date}T${time}`, { overflow: 'reject' }).toZonedDateTime(zone()).toInstant().toString();
  } catch {
    return null;
  }
}

/** Début (inclus) et fin (exclue) d'un jour dans le fuseau de l'utilisateur, en ISO 8601 ; `null` si la date n'existe pas. */
export function dayRange(date: string): { readonly from: string; readonly to: string } | null {
  try {
    const start = Temporal.PlainDate.from(date, { overflow: 'reject' }).toZonedDateTime(zone());
    return { from: start.toInstant().toString(), to: start.add({ days: 1 }).toInstant().toString() };
  } catch {
    return null;
  }
}

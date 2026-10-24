import { Injectable, inject } from '@angular/core';
import { Translator } from '../i18n/translator';
import { Instant, Temporal } from './temporal';

/**
 * Affichage des dates et heures dans la langue de l'interface et le fuseau de l'utilisateur (« 24 oct. 2026 », « 10:42 »).
 * Les appels lisent le signal de langue : un gabarit qui les utilise se redessine tout seul au changement de langue.
 */
@Injectable({ providedIn: 'root' })
export class DateTimeFormatter {
  private readonly i18n = inject(Translator);

  date(instant: Instant): string {
    return this.zoned(instant).toLocaleString(this.i18n.locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  }

  time(instant: Instant): string {
    return this.zoned(instant).toLocaleString(this.i18n.locale(), { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /** « 24 oct. 2026 à 10:42 » / « 24 Oct 2026 at 10:42 » : le mot de liaison vient du catalogue, pas de l'API Intl. */
  dateTime(instant: Instant): string {
    return this.i18n.t('common.dateTimeAt', { date: this.date(instant), time: this.time(instant) });
  }

  /** `mm:ss` pour un compte à rebours (« 00:60 »). */
  countdown(totalSeconds: number): string {
    const seconds = Math.max(0, Math.ceil(totalSeconds));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  private zoned(instant: Instant) {
    return instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
  }
}

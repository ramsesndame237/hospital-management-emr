import { Translator } from '../../core/i18n/translator';
import { EncounterStatus, PatientSummary, Severity } from '../../core/clinical/clinical.models';
import { StatusTone } from '../../shared/status-tag';

type Tag = { readonly label: string; readonly tone: StatusTone };

/** Statut d'une consultation : en cours en orange (un travail reste à faire), signée en vert, annulée en rouge. Le texte est toujours affiché. */
export function encounterTag(i18n: Translator, status: EncounterStatus): Tag {
  const tone: StatusTone = status === 'SIGNED' ? 'success' : status === 'CANCELLED' ? 'critical' : 'warning';
  return { label: i18n.t(`clinical.status.${status}`), tone };
}

/** Gravité d'une allergie : sévère en rouge, modérée en orange, légère en neutre. */
export function severityTag(i18n: Translator, severity: Severity): Tag {
  const tone: StatusTone = severity === 'SEVERE' ? 'critical' : severity === 'MODERATE' ? 'warning' : 'neutral';
  return { label: i18n.t(`clinical.severity.${severity}`), tone };
}

/** « 34 ans », « 8 mois », « 12 jours » : l'âge d'un patient à une date donnée, dit comme on le dit. `birthDate` et `today` : `AAAA-MM-JJ`. */
export function ageText(i18n: Translator, birthDate: string, today: string): string {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  if (months >= 24) return i18n.t('clinical.age.years', { n: Math.floor(months / 12) });
  if (months >= 1) return i18n.t('clinical.age.months', { n: months });
  const days = Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(by, bm - 1, bd)) / 86_400_000));
  return i18n.t('clinical.age.days', { n: days });
}

export const patientName = (p: Pick<PatientSummary, 'lastName' | 'firstName'>): string => `${p.lastName} ${p.firstName}`;

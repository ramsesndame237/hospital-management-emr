import { Translator } from '../../core/i18n/translator';
import { AdmissionStatus, AdmissionType } from '../../core/reception/reception.models';
import { StatusTone } from '../../shared/status-tag';

type Tag = { readonly label: string; readonly tone: StatusTone };

/** Statut d'une admission : en cours en orange (le patient est là), terminée en vert, annulée en rouge. Le texte est toujours affiché. */
export function admissionTag(i18n: Translator, status: AdmissionStatus): Tag {
  const tone: StatusTone = status === 'DISCHARGED' ? 'success' : status === 'CANCELLED' ? 'critical' : 'warning';
  return { label: i18n.t(`reception.admission.statuses.${status}`), tone };
}

/** Nature d'une admission : l'urgence se voit (rouge), l'hospitalisation est signalée, la consultation reste neutre. */
export function typeTag(i18n: Translator, type: AdmissionType): Tag {
  const tone: StatusTone = type === 'EMERGENCY' ? 'critical' : type === 'INPATIENT' ? 'warning' : 'neutral';
  return { label: i18n.t(`reception.admission.types.${type}`), tone };
}

export const personName = (p: { readonly lastName: string; readonly firstName: string }): string => `${p.lastName} ${p.firstName}`;

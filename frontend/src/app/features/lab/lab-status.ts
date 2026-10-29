import { Priority, RequisitionStatus, SpecimenStatus } from '../../core/lab/lab.models';
import { Translator } from '../../core/i18n/translator';
import { StatusTone } from '../../shared/status-tag';

type Tag = { readonly label: string; readonly tone: StatusTone };

/**
 * Libellé et ton du statut d'une demande. Orange : un travail reste à faire (prélèvement, réception). Vert : reçue au laboratoire.
 * Rouge : annulée. La couleur ne porte jamais seule le sens : le texte est toujours affiché.
 */
export function requisitionTag(i18n: Translator, status: RequisitionStatus): Tag {
  const tone: StatusTone = status === 'RECEIVED' ? 'success' : status === 'CANCELLED' ? 'critical' : 'warning';
  return { label: i18n.t(`lab.status.${status}`), tone };
}

/** Une priorité STAT s'affiche en rouge, urgent en orange, routine en neutre. */
export function priorityTag(i18n: Translator, priority: Priority): Tag {
  const tone: StatusTone = priority === 'STAT' ? 'critical' : priority === 'URGENT' ? 'warning' : 'neutral';
  return { label: i18n.t(`lab.priority.${priority}`), tone };
}

/** Statut d'un échantillon : à prélever (orange), prélevé (orange, attend le laboratoire), reçu (vert), rejeté (rouge). */
export function specimenTag(i18n: Translator, status: SpecimenStatus): Tag {
  const tone: StatusTone = status === 'RECEIVED' ? 'success' : status === 'REJECTED' ? 'critical' : 'warning';
  return { label: i18n.t(`lab.specimenStatus.${status}`), tone };
}

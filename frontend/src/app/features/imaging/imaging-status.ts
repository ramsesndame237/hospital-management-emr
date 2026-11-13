import { OrderStatus, Priority } from '../../core/imaging/imaging.models';
import { Translator } from '../../core/i18n/translator';
import { StatusTone } from '../../shared/status-tag';

type Tag = { readonly label: string; readonly tone: StatusTone };

/**
 * Libellé et ton du statut d'une demande. Orange : un travail reste à faire (planifier, réaliser, rédiger). Vert : compte rendu signé. Rouge : annulée.
 * La couleur ne porte jamais seule le sens : le texte est toujours affiché.
 */
export function orderTag(i18n: Translator, status: OrderStatus): Tag {
  const tone: StatusTone = status === 'REPORTED' ? 'success' : status === 'CANCELLED' ? 'critical' : 'warning';
  return { label: i18n.t(`imaging.status.${status}`), tone };
}

/** Une priorité STAT s'affiche en rouge, urgent en orange, routine en neutre. */
export function priorityTag(i18n: Translator, priority: Priority): Tag {
  const tone: StatusTone = priority === 'STAT' ? 'critical' : priority === 'URGENT' ? 'warning' : 'neutral';
  return { label: i18n.t(`imaging.priority.${priority}`), tone };
}

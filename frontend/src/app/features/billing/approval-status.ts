import { ApprovalStatus } from '../../core/billing/approval.models';
import { Translator } from '../../core/i18n/translator';
import { StatusTone } from '../../shared/status-tag';

/**
 * Libellé et ton d'une demande d'approbation. Orange : elle attend un responsable. Vert : acceptée. Rouge : refusée. Neutre : retirée.
 * La couleur ne porte jamais seule le sens : le texte est toujours affiché.
 */
export function approvalTag(i18n: Translator, status: ApprovalStatus): { readonly label: string; readonly tone: StatusTone } {
  const tone: StatusTone = status === 'PENDING' ? 'warning' : status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'critical' : 'neutral';
  return { label: i18n.t(`billing.approval.status.${status}`), tone };
}

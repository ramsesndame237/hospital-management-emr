import { InvoiceStatus } from '../../core/billing/billing.models';
import { Translator } from '../../core/i18n/translator';
import { StatusTone } from '../../shared/status-tag';

/**
 * Libellé et ton d'un statut de facture. La couleur ne porte jamais seule le sens : le texte est toujours affiché.
 * Vert : réglée. Orange : un solde reste à encaisser. Rouge : annulée. Neutre : brouillon, rien n'est encore dû.
 */
export function invoiceTag(i18n: Translator, status: InvoiceStatus): { readonly label: string; readonly tone: StatusTone } {
  const tone: StatusTone = status === 'PAID' ? 'success' : status === 'CANCELLED' ? 'critical' : status === 'DRAFT' ? 'neutral' : 'warning';
  return { label: i18n.t(`billing.status.${status}`), tone };
}

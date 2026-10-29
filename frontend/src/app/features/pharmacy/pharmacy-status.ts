import { Translator } from '../../core/i18n/translator';
import { AdjustmentStatus, Batch, StockLevel } from '../../core/pharmacy/pharmacy.models';
import { StatusTone } from '../../shared/status-tag';

type Tag = { readonly label: string; readonly tone: StatusTone };

/** Niveau de stock : rupture en rouge, stock bas en orange, correct en vert. Le texte est toujours affiché. */
export function levelTag(i18n: Translator, level: StockLevel): Tag {
  const tone: StatusTone = level === 'OUT' ? 'critical' : level === 'LOW' ? 'warning' : 'success';
  return { label: i18n.t(`pharmacy.level.${level}`), tone };
}

/**
 * État d'un lot. Dans l'ordre de gravité : périmé (rouge), quarantaine (orange), bientôt périmé (orange), vide (neutre), délivrable (vert).
 * Un lot périmé qui est aussi en quarantaine se lit « quarantaine » : c'est la mesure en cours.
 */
export function batchTag(i18n: Translator, batch: Pick<Batch, 'status' | 'expired' | 'expiringSoon' | 'quantity'>): Tag {
  if (batch.status === 'QUARANTINED') return { label: i18n.t('pharmacy.batchState.QUARANTINED'), tone: 'warning' };
  if (batch.expired) return { label: i18n.t('pharmacy.batchState.EXPIRED'), tone: 'critical' };
  if (batch.quantity === 0) return { label: i18n.t('pharmacy.batchState.EMPTY'), tone: 'neutral' };
  if (batch.expiringSoon) return { label: i18n.t('pharmacy.batchState.EXPIRING'), tone: 'warning' };
  return { label: i18n.t('pharmacy.batchState.OK'), tone: 'success' };
}

export function adjustmentTag(i18n: Translator, status: AdjustmentStatus): Tag {
  const tone: StatusTone = status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'critical' : 'warning';
  return { label: i18n.t(`pharmacy.adjustmentStatus.${status}`), tone };
}

/** « 12 jours », « demain », « aujourd'hui », « périmé depuis 3 jours » — les jours restants d'un lot dits comme on les dit. */
export function daysText(i18n: Translator, days: number): string {
  if (days === 0) return i18n.t('pharmacy.days.today');
  if (days === 1) return i18n.t('pharmacy.days.tomorrow');
  if (days > 1) return i18n.t('pharmacy.days.left', { n: days });
  return i18n.t('pharmacy.days.ago', { n: -days });
}

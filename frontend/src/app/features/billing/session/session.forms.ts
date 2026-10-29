import { CashCount } from '../../../core/billing/cash-session.models';
import { FieldSchema } from '../../../shared/form-builder/form-schema';
import { failureNotice } from '../../../shared/failure-message';

const field = (value: number): string => `d_${value}`;

/**
 * Grille de comptage : une quantité par valeur de billet ou de pièce, sur deux colonnes. `label` met la valeur en forme (« 10 000 FCFA ») ;
 * `initial` pré-remplit les quantités (comptage déjà connu). Les valeurs viennent de l'API : l'écran n'en invente aucune.
 */
export function countFields(o: { readonly denominations: readonly number[]; readonly label: (value: number) => string; readonly initial?: CashCount }): FieldSchema[] {
  return o.denominations.map((value): FieldSchema => ({
    type: 'number', name: field(value), label: o.label(value), value: o.initial?.[String(value)] ?? 0, inputMode: 'numeric', span: 6, inputClass: 'font-mono text-right',
    validators: [
      { type: 'min', value: 0, message: 'billing.session.quantityInvalid' },
      { type: 'max', value: 100000, message: 'billing.session.quantityInvalid' },
      { type: 'pattern', value: '^\\d*$', message: 'billing.session.quantityInvalid' },
    ],
  }));
}

/** Le comptage saisi : seules les valeurs proposées et les quantités entières positives sont retenues. */
export function countFrom(values: Readonly<Record<string, unknown>>, denominations: readonly number[]): Record<string, number> {
  const count: Record<string, number> = {};
  for (const value of denominations) {
    const raw = values[field(value)];
    const quantity = raw === null || raw === undefined || raw === '' ? 0 : Number(raw);
    if (Number.isInteger(quantity) && quantity > 0) count[String(value)] = quantity;
  }
  return count;
}

interface CountOptions {
  readonly denominations: readonly number[];
  readonly label: (value: number) => string;
  readonly notice: string | null;
}

/** Ouverture de la caisse : le poste et le fonds de caisse compté. */
export function openSessionFields(o: CountOptions): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'counter', label: 'billing.session.counter', hint: 'billing.session.counterHint', placeholder: 'billing.session.counterPlaceholder', autofocus: true, normalize: 'trim',
      validators: [{ type: 'required', message: 'billing.session.counterRequired' }, { type: 'maxLength', value: 40 }],
    },
    { type: 'paragraph', name: 'floatLegend', text: 'billing.session.floatLegend', size: 'sm', strong: true },
    ...countFields(o),
    { type: 'submit', name: 'submit', label: 'billing.session.open', busyLabel: 'billing.saving' },
  ];
}

/** Clôture : le comptage final et l'explication de l'écart (exigée par l'écran dès que la caisse n'est pas juste, et par l'API). */
export function closeSessionFields(o: CountOptions): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'paragraph', name: 'closeLegend', text: 'billing.session.closeLegend', size: 'sm', strong: true },
    ...countFields(o),
    {
      type: 'text', name: 'reason', label: 'billing.session.reason', hint: 'billing.session.reasonHint', normalize: 'trim', validators: [{ type: 'maxLength', value: 200 }],
    },
    { type: 'submit', name: 'submit', label: 'billing.session.close', busyLabel: 'billing.saving' },
    { type: 'button', name: 'cancel', label: 'billing.cancel', variant: 'outline' },
  ];
}

/** Contre-signature d'une clôture à écart élevé : un commentaire facultatif. */
export function cosignFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'info', tone: 'warning', appearance: 'outlined', title: 'billing.cosign.title', text: 'billing.cosign.text' },
    { type: 'text', name: 'comment', label: 'billing.cosign.comment', hint: 'billing.cosign.commentHint', normalize: 'trim', autofocus: true, validators: [{ type: 'maxLength', value: 200 }] },
    { type: 'paragraph', name: 'audit', text: 'billing.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'billing.cosign.submit', busyLabel: 'billing.saving' },
    { type: 'button', name: 'cancel', label: 'billing.cancel', variant: 'outline' },
  ];
}

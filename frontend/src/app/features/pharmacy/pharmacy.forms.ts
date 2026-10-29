import { ADJUSTMENT_REASONS, AdjustmentReason, Direction, Drug, FORMS, LEVELS, REASONS_BY_DIRECTION, SCHEDULES, STORAGES } from '../../core/pharmacy/pharmacy.models';
import { failureNotice } from '../../shared/failure-message';
import { FieldSchema, OptionSpec, ValidatorSpec } from '../../shared/form-builder/form-schema';
import { amountPattern } from '../billing/billing.forms';

const options = (values: readonly string[], prefix: string): OptionSpec[] => values.map((v) => ({ value: v, label: `${prefix}.${v}` }));

/** Filtres de la vue d'ensemble du stock : texte, niveau, péremptions proches ou dépassées, médicaments retirés. */
export function stockFilterFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'pharmacy.stock.search', placeholder: 'pharmacy.stock.searchPlaceholder', normalize: 'trim', autofocus: true, span: 5, validators: [{ type: 'maxLength', value: 100 }] },
    { type: 'select', name: 'level', label: 'pharmacy.stock.level', placeholder: 'pharmacy.stock.allLevels', options: options(LEVELS, 'pharmacy.level'), span: 3 },
    { type: 'submit', name: 'submit', label: 'pharmacy.apply', span: 4, class: 'sm:self-end' },
    { type: 'checkbox', name: 'expiring', label: 'pharmacy.stock.onlyExpiring', span: 4 },
    { type: 'checkbox', name: 'hasExpired', label: 'pharmacy.stock.onlyExpired', span: 4 },
    { type: 'checkbox', name: 'inactive', label: 'pharmacy.stock.showInactive', span: 4 },
  ];
}

/** Horizons proposés pour les péremptions (en jours) ; 0 : seulement ce qui est déjà périmé. */
export const EXPIRY_HORIZONS = [0, 30, 60, 90, 180, 365] as const;

export function expiryFilterFields(): FieldSchema[] {
  return [
    {
      type: 'select', name: 'days', label: 'pharmacy.expiry.horizon', value: '90', options: EXPIRY_HORIZONS.map((d) => ({ value: String(d), label: d === 0 ? 'pharmacy.expiry.expiredOnly' : `pharmacy.expiry.within${d}` })), span: 5,
      validators: [{ type: 'required' }],
    },
    { type: 'checkbox', name: 'quarantinedOnly', label: 'pharmacy.expiry.quarantinedOnly', span: 4 },
    { type: 'submit', name: 'submit', label: 'pharmacy.apply', span: 3, class: 'sm:self-end' },
  ];
}

/** Filtres du formulaire des médicaments : texte, forme, classe de délivrance ; pour qui le tient, aussi les médicaments retirés. */
export function drugFilterFields(manage: boolean): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'pharmacy.catalog.search', placeholder: 'pharmacy.catalog.searchPlaceholder', normalize: 'trim', autofocus: true, span: 4, validators: [{ type: 'maxLength', value: 100 }] },
    { type: 'select', name: 'form', label: 'pharmacy.catalog.formLabel', placeholder: 'pharmacy.catalog.allForms', options: options(FORMS, 'pharmacy.form'), span: 3 },
    { type: 'select', name: 'schedule', label: 'pharmacy.catalog.scheduleLabel', placeholder: 'pharmacy.catalog.allSchedules', options: options(SCHEDULES, 'pharmacy.schedule'), span: 3 },
    { type: 'submit', name: 'submit', label: 'pharmacy.apply', span: 2, class: 'sm:self-end' },
    ...(manage ? ([{ type: 'checkbox', name: 'inactive', label: 'pharmacy.catalog.showInactive', span: 12 }] as const) : []),
  ];
}

/**
 * Création ou modification d'un médicament. À la création on choisit le code (il ne changera plus) ; le prix se saisit dans la devise de
 * l'installation (« 25 », « 1 250 » ou, avec décimales, « 12,50 ») et part en entier dans sa plus petite unité.
 */
export function drugFormFields(o: { readonly drug: Drug | null; readonly digits: number; readonly price: string; readonly notice: string | null }): FieldSchema[] {
  const d = o.drug;
  const required: ValidatorSpec[] = [{ type: 'required', message: 'pharmacy.catalog.required' }];
  const fields: FieldSchema[] = [...failureNotice(o.notice)];
  if (d === null) {
    fields.push({
      type: 'text', name: 'code', label: 'pharmacy.catalog.code', hint: 'pharmacy.catalog.codeHint', autofocus: true, normalize: 'uppercase', inputClass: 'font-mono',
      validators: [...required, { type: 'maxLength', value: 30 }, { type: 'pattern', value: '^[A-Za-z0-9][A-Za-z0-9_.-]*$', message: 'pharmacy.catalog.codeHint' }],
    });
  }
  fields.push({ type: 'text', name: 'name', label: 'pharmacy.catalog.name', value: d?.name ?? '', autofocus: d !== null, normalize: 'trim', validators: [...required, { type: 'maxLength', value: 120 }] });
  fields.push({ type: 'text', name: 'genericName', label: 'pharmacy.catalog.genericName', hint: 'pharmacy.catalog.genericNameHint', value: d?.genericName ?? '', normalize: 'trim', validators: [...required, { type: 'maxLength', value: 120 }] });
  fields.push({ type: 'text', name: 'strength', label: 'pharmacy.catalog.strength', hint: 'pharmacy.catalog.strengthHint', value: d?.strength ?? '', normalize: 'trim', span: 6, validators: [{ type: 'maxLength', value: 40 }] });
  fields.push({ type: 'text', name: 'unit', label: 'pharmacy.catalog.unit', hint: 'pharmacy.catalog.unitHint', value: d?.unit ?? '', normalize: 'trim', span: 6, validators: [...required, { type: 'maxLength', value: 20 }] });
  fields.push({ type: 'select', name: 'form', label: 'pharmacy.catalog.formLabel', value: d?.form ?? 'TABLET', options: options(FORMS, 'pharmacy.form'), validators: required, span: 6 });
  fields.push({ type: 'select', name: 'schedule', label: 'pharmacy.catalog.scheduleLabel', hint: 'pharmacy.catalog.scheduleHint', value: d?.schedule ?? 'PRESCRIPTION', options: options(SCHEDULES, 'pharmacy.schedule'), validators: required, span: 6 });
  fields.push({ type: 'select', name: 'storage', label: 'pharmacy.catalog.storageLabel', value: d?.storage ?? 'ROOM', options: options(STORAGES, 'pharmacy.storage'), validators: required, span: 6 });
  fields.push({
    type: 'text', name: 'atcCode', label: 'pharmacy.catalog.atc', hint: 'pharmacy.catalog.atcHint', value: d?.atcCode ?? '', normalize: 'uppercase', inputClass: 'font-mono', span: 6,
    validators: [{ type: 'pattern', value: '^([A-Za-z]\\d{2}[A-Za-z]{2}\\d{2})?$', message: 'pharmacy.catalog.atcHint' }],
  });
  fields.push({
    type: 'text', name: 'price', label: 'pharmacy.catalog.price', hint: 'pharmacy.catalog.priceHint', value: o.price, inputMode: 'decimal', inputClass: 'font-mono', span: 6,
    validators: [...required, { type: 'pattern', value: amountPattern(o.digits), message: 'pharmacy.catalog.priceInvalid' }],
  });
  fields.push({
    type: 'number', name: 'reorderLevel', label: 'pharmacy.catalog.reorder', hint: 'pharmacy.catalog.reorderHint', value: d?.reorderLevel ?? 0, inputMode: 'numeric', span: 6,
    validators: [...required, { type: 'min', value: 0 }, { type: 'max', value: 1_000_000 }],
  });
  fields.push({ type: 'textarea', name: 'notes', label: 'pharmacy.catalog.notes', value: d?.notes ?? '', rows: 3, normalize: 'trim', validators: [{ type: 'maxLength', value: 500 }] });
  fields.push({ type: 'paragraph', name: 'audit', text: 'pharmacy.auditNote', tone: 'muted' });
  fields.push({ type: 'submit', name: 'submit', label: 'pharmacy.catalog.submit', busyLabel: 'pharmacy.saving' });
  fields.push({ type: 'button', name: 'cancel', label: 'pharmacy.cancel', variant: 'outline' });
  return fields;
}

/** Mise en quarantaine d'un lot : le motif est obligatoire. */
export function quarantineFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'pharmacy.quarantine.warningTitle', text: 'pharmacy.quarantine.warningText' },
    { type: 'text', name: 'reason', label: 'pharmacy.quarantine.reason', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'pharmacy.quarantine.reasonRequired' }, { type: 'maxLength', value: 200 }] },
    { type: 'paragraph', name: 'audit', text: 'pharmacy.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'pharmacy.quarantine.submit', busyLabel: 'pharmacy.saving' },
    { type: 'button', name: 'cancel', label: 'pharmacy.cancel', variant: 'outline' },
  ];
}

/**
 * Demande d'ajustement d'un lot, dans un sens (ajouter ou retirer) : la quantité, le motif parmi ceux qui conviennent à ce sens, et une
 * précision (obligatoire pour « autre »). Elle ne change rien tant qu'un autre pharmacien ne l'a pas approuvée.
 */
export function adjustmentFields(o: { readonly direction: Direction; readonly max: number | null; readonly notice: string | null }): FieldSchema[] {
  const reasons: readonly AdjustmentReason[] = REASONS_BY_DIRECTION[o.direction];
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'info', appearance: 'outlined', title: 'pharmacy.adjust.warningTitle', text: 'pharmacy.adjust.warningText' },
    {
      type: 'number', name: 'quantity', label: o.direction === 'IN' ? 'pharmacy.adjust.quantityIn' : 'pharmacy.adjust.quantityOut', value: '', inputMode: 'numeric', autofocus: true,
      validators: [
        { type: 'required', message: 'pharmacy.adjust.quantityRequired' }, { type: 'min', value: 1, message: 'pharmacy.adjust.quantityRequired' },
        { type: 'max', value: o.max ?? 1_000_000, message: o.max === null ? 'pharmacy.adjust.quantityRequired' : 'pharmacy.adjust.quantityTooHigh' },
      ],
    },
    {
      type: 'select', name: 'reason', label: 'pharmacy.adjust.reason', placeholder: 'pharmacy.adjust.reasonPlaceholder', options: options(reasons.filter((r) => ADJUSTMENT_REASONS.includes(r)), 'pharmacy.adjustReason'),
      validators: [{ type: 'required', message: 'pharmacy.adjust.reasonRequired' }],
    },
    { type: 'text', name: 'note', label: 'pharmacy.adjust.note', hint: 'pharmacy.adjust.noteHint', normalize: 'trim', validators: [{ type: 'maxLength', value: 200 }] },
    { type: 'paragraph', name: 'audit', text: 'pharmacy.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'pharmacy.adjust.submit', busyLabel: 'pharmacy.saving' },
    { type: 'button', name: 'cancel', label: 'pharmacy.cancel', variant: 'outline' },
  ];
}

/** Décision sur un ajustement : un commentaire facultatif pour approuver, le motif obligatoire pour refuser. */
export function decisionFields(o: { readonly reject: boolean; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'comment', label: o.reject ? 'pharmacy.decision.rejectReason' : 'pharmacy.decision.comment', autofocus: true, normalize: 'trim',
      validators: [...(o.reject ? ([{ type: 'required', message: 'pharmacy.decision.reasonRequired' }] as const) : []), { type: 'maxLength', value: 200 }],
    },
    { type: 'paragraph', name: 'audit', text: 'pharmacy.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: o.reject ? 'pharmacy.decision.rejectSubmit' : 'pharmacy.decision.approveSubmit', busyLabel: 'pharmacy.saving' },
    { type: 'button', name: 'cancel', label: 'pharmacy.cancel', variant: 'outline' },
  ];
}

/** En-tête d'une réception de marchandises : fournisseur, bon de livraison, remarques. Les lignes se saisissent à côté. */
export function receiptHeaderFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'text', name: 'supplier', label: 'pharmacy.receipt.supplier', autofocus: true, normalize: 'trim', span: 6, validators: [{ type: 'required', message: 'pharmacy.receipt.supplierRequired' }, { type: 'maxLength', value: 120 }] },
    { type: 'text', name: 'deliveryNote', label: 'pharmacy.receipt.deliveryNote', hint: 'pharmacy.receipt.deliveryNoteHint', normalize: 'trim', inputClass: 'font-mono', span: 6, validators: [{ type: 'maxLength', value: 60 }] },
    { type: 'text', name: 'notes', label: 'pharmacy.receipt.notes', normalize: 'trim', validators: [{ type: 'maxLength', value: 200 }] },
    { type: 'paragraph', name: 'audit', text: 'pharmacy.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'pharmacy.receipt.submit', busyLabel: 'pharmacy.saving' },
  ];
}

/** Recherche d'un médicament à ajouter à la réception. */
export function drugSearchFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'pharmacy.receipt.searchDrug', placeholder: 'pharmacy.receipt.searchDrugPlaceholder', normalize: 'trim', validators: [{ type: 'maxLength', value: 100 }] },
    { type: 'submit', name: 'submit', label: 'pharmacy.receipt.searchSubmit', busyLabel: 'pharmacy.searching' },
  ];
}

/** Filtres de la liste des réceptions : le fournisseur. */
export function receiptFilterFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'supplier', label: 'pharmacy.receipt.supplier', placeholder: 'pharmacy.receipt.filterPlaceholder', normalize: 'trim', span: 8, validators: [{ type: 'maxLength', value: 120 }] },
    { type: 'submit', name: 'submit', label: 'pharmacy.apply', span: 4, class: 'sm:self-end' },
  ];
}

/** Filtre des ajustements : par statut. */
export function adjustmentFilterFields(): FieldSchema[] {
  return [
    {
      type: 'select', name: 'status', label: 'pharmacy.adjustments.status', value: 'PENDING', placeholder: 'pharmacy.adjustments.allStatuses', options: options(['PENDING', 'APPROVED', 'REJECTED'], 'pharmacy.adjustmentStatus'), span: 4,
    },
    { type: 'checkbox', name: 'mine', label: 'pharmacy.adjustments.mine', span: 5 },
    { type: 'submit', name: 'submit', label: 'pharmacy.apply', span: 3, class: 'sm:self-end' },
  ];
}

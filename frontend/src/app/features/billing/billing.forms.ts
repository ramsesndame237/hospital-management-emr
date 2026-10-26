import { APPROVAL_KINDS, APPROVAL_STATUSES } from '../../core/billing/approval.models';
import { INVOICE_STATUSES, PAYMENT_MODES, ITEM_CATEGORIES } from '../../core/billing/billing.models';
import { FieldSchema, OptionSpec } from '../../shared/form-builder/form-schema';
import { failureNotice } from '../../shared/failure-message';

/** Montant saisi : chiffres (espaces tolérés comme séparateurs de milliers) et, selon la devise, une partie décimale exacte. */
export function amountPattern(digits: number): string {
  return digits === 0 ? '^[\\d\\s\\u00a0\\u202f]+$' : `^[\\d\\s\\u00a0\\u202f]+([.,]\\d{1,${digits}})?$`;
}

const statusOptions = (): OptionSpec[] => INVOICE_STATUSES.map((status) => ({ value: status, label: `billing.status.${status}` }));
const modeOptions = (): OptionSpec[] => PAYMENT_MODES.map((mode) => ({ value: mode, label: `billing.mode.${mode}` }));

/** Filtres de la liste des factures : numéro et statut. */
export function invoiceFilterFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'number', label: 'billing.filter.number', placeholder: 'billing.filter.numberPlaceholder', normalize: 'uppercase', inputClass: 'font-mono', span: 5, validators: [{ type: 'maxLength', value: 20 }] },
    { type: 'select', name: 'status', label: 'billing.filter.status', placeholder: 'billing.filter.allStatuses', options: statusOptions(), span: 4 },
    { type: 'submit', name: 'submit', label: 'billing.filter.apply', span: 3, class: 'sm:self-end' },
  ];
}

/** Recherche d'un patient à facturer : un numéro de dossier ou des mots du nom (l'API exige au moins deux lettres par mot). */
export function patientSearchFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'q', label: 'billing.new.query', hint: 'billing.new.queryHint', placeholder: 'billing.new.queryPlaceholder', autofocus: true, normalize: 'trim',
      validators: [{ type: 'required', message: 'billing.new.queryRequired' }, { type: 'minLength', value: 2, message: 'billing.new.queryTooShort' }, { type: 'maxLength', value: 100 }],
    },
    { type: 'submit', name: 'submit', label: 'billing.new.search', busyLabel: 'billing.searching' },
  ];
}

/** Recherche d'un acte du catalogue, avec la quantité à ajouter. */
export function itemSearchFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'billing.lines.search', placeholder: 'billing.lines.searchPlaceholder', autofocus: true, normalize: 'trim', span: 8, validators: [{ type: 'maxLength', value: 100 }] },
    {
      type: 'number', name: 'quantity', label: 'billing.lines.quantity', value: 1, inputMode: 'numeric', span: 4,
      validators: [{ type: 'required', message: 'billing.lines.quantityInvalid' }, { type: 'min', value: 1, message: 'billing.lines.quantityInvalid' }, { type: 'max', value: 9999, message: 'billing.lines.quantityInvalid' }],
    },
    { type: 'submit', name: 'submit', label: 'billing.lines.searchSubmit', busyLabel: 'billing.searching' },
  ];
}

/** Remise sur toute la facture : montant et motif (obligatoire). Un bouton la retire quand elle existe. */
export function discountFields(o: {
  readonly digits: number; readonly amount: string; readonly reason: string; readonly hasDiscount: boolean; readonly notice: string | null;
  /** La remise saisie dépasse le seuil : elle part en demande d'approbation au lieu de s'appliquer. */
  readonly approval?: boolean;
}): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'amount', label: 'billing.discount.amount', hint: 'billing.discount.amountHint', value: o.amount, autofocus: true, inputMode: 'decimal', inputClass: 'font-mono',
      validators: [{ type: 'required', message: 'billing.amount.required' }, { type: 'pattern', value: amountPattern(o.digits), message: 'billing.amount.invalid' }],
    },
    {
      type: 'text', name: 'reason', label: 'billing.discount.reason', hint: 'billing.discount.reasonHint', value: o.reason, normalize: 'trim',
      validators: [{ type: 'required', message: 'billing.reason.required' }, { type: 'maxLength', value: 200 }],
    },
    { type: 'submit', name: 'submit', label: o.approval ? 'billing.discount.sendRequest' : 'billing.discount.apply', busyLabel: 'billing.saving' },
    ...(o.hasDiscount ? ([{ type: 'button', name: 'removeDiscount', label: 'billing.discount.remove', variant: 'outline' }] as const) : []),
    { type: 'button', name: 'cancel', label: 'billing.cancel', variant: 'outline' },
  ];
}

/** Confirmation d'une action qui verrouille ou annule (émission, annulation) ; un motif est demandé quand `reasonLabel` est donné. */
export function confirmFields(o: {
  readonly tone: 'warning' | 'critical';
  readonly title: string;
  readonly text: string;
  readonly submit: string;
  readonly reasonLabel?: string;
  readonly keep: string;
  readonly notice: string | null;
}): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: o.tone, appearance: 'outlined', title: o.title, text: o.text },
    ...(o.reasonLabel
      ? ([{
          type: 'text', name: 'reason', label: o.reasonLabel, autofocus: true, normalize: 'trim',
          validators: [{ type: 'required', message: 'billing.reason.required' }, { type: 'maxLength', value: 200 }],
        }] as const)
      : []),
    { type: 'paragraph', name: 'audit', text: 'billing.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: o.submit, busyLabel: 'billing.saving' },
    { type: 'button', name: 'cancel', label: o.keep, variant: 'outline' },
  ];
}

/** Encaissement : mode, montant (le solde par défaut), référence (hors espèces) ou montant remis (espèces). */
export function collectFields(o: { readonly digits: number; readonly balance: string; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'select', name: 'mode', label: 'billing.collect.mode', value: 'CASH', options: modeOptions(), validators: [{ type: 'required' }] },
    {
      type: 'text', name: 'amount', label: 'billing.collect.amount', hint: 'billing.collect.amountHint', value: o.balance, autofocus: true, inputMode: 'decimal', inputClass: 'font-mono',
      validators: [{ type: 'required', message: 'billing.amount.required' }, { type: 'pattern', value: amountPattern(o.digits), message: 'billing.amount.invalid' }],
    },
    {
      type: 'text', name: 'tendered', label: 'billing.collect.tendered', hint: 'billing.collect.tenderedHint', inputMode: 'decimal', inputClass: 'font-mono', showIf: { field: 'mode', equals: 'CASH' },
      validators: [{ type: 'pattern', value: amountPattern(o.digits), message: 'billing.amount.invalid' }],
    },
    {
      type: 'text', name: 'reference', label: 'billing.collect.reference', hint: 'billing.collect.referenceHint', normalize: 'trim', showIf: { field: 'mode', notEquals: 'CASH' },
      validators: [{ type: 'maxLength', value: 64 }, { type: 'pattern', value: '^[\\w .\\/-]*$', message: 'billing.collect.referenceInvalid' }],
    },
    { type: 'submit', name: 'submit', label: 'billing.collect.submit', busyLabel: 'billing.saving' },
    { type: 'button', name: 'cancel', label: 'billing.cancel', variant: 'outline' },
  ];
}

/** Réimpression d'un reçu : le motif est obligatoire et la réimpression est tracée. */
export function reprintFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'info', tone: 'info', appearance: 'outlined', title: 'billing.reprint.title', text: 'billing.reprint.text' },
    {
      type: 'text', name: 'reason', label: 'billing.reprint.reason', autofocus: true, normalize: 'trim',
      validators: [{ type: 'required', message: 'billing.reason.required' }, { type: 'maxLength', value: 200 }],
    },
    { type: 'submit', name: 'submit', label: 'billing.reprint.submit', busyLabel: 'billing.saving' },
    { type: 'button', name: 'cancel', label: 'billing.cancel', variant: 'outline' },
  ];
}

/** Filtres du catalogue des tarifs : texte et catégorie. */
export function catalogFilterFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'billing.catalog.search', placeholder: 'billing.catalog.searchPlaceholder', normalize: 'trim', autofocus: true, span: 6, validators: [{ type: 'maxLength', value: 100 }] },
    { type: 'select', name: 'category', label: 'billing.catalog.category', placeholder: 'billing.catalog.allCategories', options: ITEM_CATEGORIES.map((c) => ({ value: c, label: `billing.category.${c}` })), span: 4 },
    { type: 'submit', name: 'submit', label: 'billing.filter.apply', span: 2, class: 'sm:self-end' },
  ];
}

/** Filtres de la file des approbations : statut (« En attente » d'abord pour un responsable) et type. */
export function approvalFilterFields(o: { readonly status: string }): FieldSchema[] {
  return [
    { type: 'select', name: 'status', label: 'billing.approval.filterStatus', placeholder: 'billing.approval.allStatuses', value: o.status, options: APPROVAL_STATUSES.map((v) => ({ value: v, label: `billing.approval.status.${v}` })), span: 4 },
    { type: 'select', name: 'kind', label: 'billing.approval.filterKind', placeholder: 'billing.approval.allKinds', options: APPROVAL_KINDS.map((v) => ({ value: v, label: `billing.approval.kind.${v}` })), span: 4 },
    { type: 'submit', name: 'submit', label: 'billing.filter.apply', span: 3, class: 'sm:self-end' },
  ];
}

/**
 * Décision d'un responsable sur une demande : accepter (commentaire facultatif) ou refuser (explication obligatoire, le demandeur la lira).
 */
export function decisionFields(o: { readonly approve: boolean; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'message', name: 'info', tone: o.approve ? 'warning' : 'info', appearance: 'outlined',
      title: o.approve ? 'billing.approval.approveTitle' : 'billing.approval.rejectTitle', text: o.approve ? 'billing.approval.approveText' : 'billing.approval.rejectText',
    },
    {
      type: 'text', name: 'comment', label: o.approve ? 'billing.approval.approveComment' : 'billing.approval.rejectComment', autofocus: true, normalize: 'trim',
      validators: o.approve ? [{ type: 'maxLength', value: 200 }] : [{ type: 'required', message: 'billing.reason.required' }, { type: 'maxLength', value: 200 }],
    },
    { type: 'paragraph', name: 'audit', text: 'billing.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: o.approve ? 'billing.approval.approveSubmit' : 'billing.approval.rejectSubmit', busyLabel: 'billing.saving' },
    { type: 'button', name: 'cancel', label: 'billing.approval.keep', variant: 'outline' },
  ];
}

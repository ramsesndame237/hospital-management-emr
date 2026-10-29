import { PRIORITIES, REJECTION_REASONS, REQUISITION_STATUSES, SECTIONS, SOURCES } from '../../core/lab/lab.models';
import { failureNotice } from '../../shared/failure-message';
import { FieldSchema, OptionSpec } from '../../shared/form-builder/form-schema';

const options = (values: readonly string[], prefix: string): OptionSpec[] => values.map((v) => ({ value: v, label: `${prefix}.${v}` }));

/** Filtres de la liste de travail : statut, priorité, section et numéro de demande. */
export function worklistFilterFields(): FieldSchema[] {
  return [
    { type: 'select', name: 'status', label: 'lab.worklist.status', placeholder: 'lab.worklist.allStatuses', options: options(REQUISITION_STATUSES, 'lab.status'), span: 3 },
    { type: 'select', name: 'priority', label: 'lab.worklist.priority', placeholder: 'lab.worklist.allPriorities', options: options(PRIORITIES, 'lab.priority'), span: 3 },
    { type: 'select', name: 'section', label: 'lab.catalog.section', placeholder: 'lab.worklist.allSections', options: options(SECTIONS, 'lab.section'), span: 3 },
    { type: 'text', name: 'number', label: 'lab.worklist.filterNumber', placeholder: 'lab.worklist.filterNumberPlaceholder', normalize: 'uppercase', inputClass: 'font-mono', span: 3, validators: [{ type: 'maxLength', value: 20 }] },
    { type: 'submit', name: 'submit', label: 'lab.catalog.apply', span: 3, class: 'sm:self-end' },
  ];
}

/** Scan d'un code-barres d'échantillon (réception) : la demande qui le porte s'ouvre. */
export function scanFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'barcode', label: 'lab.worklist.scanBarcode', placeholder: 'lab.worklist.scanPlaceholder', normalize: 'uppercase', inputClass: 'font-mono', autofocus: true,
      validators: [{ type: 'required', message: 'lab.collect.required' }, { type: 'maxLength', value: 20 }],
    },
    { type: 'submit', name: 'submit', label: 'lab.worklist.scanSubmit', busyLabel: 'lab.searching' },
  ];
}

/** Prélèvement : le préleveur confirme deux identifiants, le numéro de dossier lu sur le bracelet et la date de naissance donnée par le patient. */
export function collectFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'lab.collect.warningTitle', text: 'lab.collect.warningText' },
    {
      type: 'text', name: 'patientNumber', label: 'lab.collect.patientNumber', hint: 'lab.collect.patientNumberHint', autofocus: true, normalize: 'uppercase', inputClass: 'font-mono',
      validators: [{ type: 'required', message: 'lab.collect.required' }, { type: 'maxLength', value: 30 }],
    },
    {
      type: 'text', name: 'birthDate', label: 'lab.collect.birthDate', hint: 'lab.collect.birthDateHint', normalize: 'trim', inputClass: 'font-mono', inputMode: 'numeric',
      validators: [{ type: 'required', message: 'lab.collect.required' }, { type: 'pattern', value: '^\\d{4}-\\d{2}-\\d{2}$', message: 'lab.collect.birthDateInvalid' }],
    },
    { type: 'paragraph', name: 'audit', text: 'lab.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'lab.collect.submit', busyLabel: 'lab.saving' },
    { type: 'button', name: 'cancel', label: 'lab.cancel', variant: 'outline' },
  ];
}

/** Rejet d'un échantillon : un motif de la liste, et une précision (obligatoire pour « Autre »). */
export function rejectFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'lab.reject.warningTitle', text: 'lab.reject.warningText' },
    {
      type: 'select', name: 'reason', label: 'lab.reject.reason', placeholder: 'lab.reject.reason', autofocus: true, options: options(REJECTION_REASONS, 'lab.rejection'),
      validators: [{ type: 'required', message: 'lab.reject.reasonRequired' }],
    },
    {
      type: 'text', name: 'note', label: 'lab.reject.note', hint: 'lab.reject.noteHint', normalize: 'trim',
      validators: [{ type: 'maxLength', value: 200 }],
    },
    { type: 'paragraph', name: 'audit', text: 'lab.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'lab.reject.submit', busyLabel: 'lab.saving' },
    { type: 'button', name: 'cancel', label: 'lab.cancel', variant: 'outline' },
  ];
}

/** Annulation d'une demande : le motif est obligatoire. */
export function cancelFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'critical', appearance: 'outlined', title: 'lab.cancelRequest.warningTitle', text: 'lab.cancelRequest.warningText' },
    {
      type: 'text', name: 'reason', label: 'lab.cancelRequest.reason', autofocus: true, normalize: 'trim',
      validators: [{ type: 'required', message: 'lab.cancelRequest.reasonRequired' }, { type: 'maxLength', value: 200 }],
    },
    { type: 'paragraph', name: 'audit', text: 'lab.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'lab.cancelRequest.submit', busyLabel: 'lab.saving' },
    { type: 'button', name: 'cancel', label: 'lab.cancelRequest.keep', variant: 'outline' },
  ];
}

/** Recherche d'une analyse à ajouter à la demande. */
export function testSearchFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'lab.new.searchTests', placeholder: 'lab.new.searchTestsPlaceholder', normalize: 'trim', autofocus: true, validators: [{ type: 'maxLength', value: 100 }] },
    { type: 'submit', name: 'submit', label: 'lab.new.searchTestsSubmit', busyLabel: 'lab.searching' },
  ];
}

/** Priorité, provenance et renseignements cliniques de la demande. */
export function orderFields(o: { readonly notice: string | null; readonly source: string }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'select', name: 'priority', label: 'lab.new.priority', value: 'ROUTINE', options: options(PRIORITIES, 'lab.priority'), validators: [{ type: 'required' }], span: 6 },
    { type: 'select', name: 'source', label: 'lab.new.source', value: o.source, options: options(SOURCES, 'lab.source'), validators: [{ type: 'required' }], span: 6 },
    { type: 'textarea', name: 'notes', label: 'lab.new.notes', hint: 'lab.new.notesHint', rows: 3, normalize: 'trim', validators: [{ type: 'maxLength', value: 500 }] },
    { type: 'submit', name: 'submit', label: 'lab.new.submit', busyLabel: 'lab.saving' },
  ];
}

/** Filtres du catalogue : texte et section. */
export function catalogFilterFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'lab.catalog.search', placeholder: 'lab.catalog.searchPlaceholder', normalize: 'trim', autofocus: true, span: 6, validators: [{ type: 'maxLength', value: 100 }] },
    { type: 'select', name: 'section', label: 'lab.catalog.section', placeholder: 'lab.catalog.allSections', options: options(SECTIONS, 'lab.section'), span: 4 },
    { type: 'submit', name: 'submit', label: 'lab.catalog.apply', span: 2, class: 'sm:self-end' },
  ];
}

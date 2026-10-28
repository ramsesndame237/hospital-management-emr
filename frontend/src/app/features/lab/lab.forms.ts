import { CONTAINERS, LabTest, NOTIFICATION_METHODS, PRIORITIES, REJECTION_REASONS, REQUISITION_STATUSES, RESULT_TYPES, ResultType, SECTIONS, SOURCES, SPECIMEN_TYPES } from '../../core/lab/lab.models';
import { failureNotice } from '../../shared/failure-message';
import { FieldSchema, OptionSpec, ValidatorSpec } from '../../shared/form-builder/form-schema';

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

/** Filtres du catalogue pour qui le gère : en plus, l'affichage des analyses retirées. */
export function catalogManageFilterFields(): FieldSchema[] {
  return [
    ...catalogFilterFields().filter((f) => f.type !== 'submit'),
    { type: 'checkbox', name: 'inactive', label: 'lab.manage.showInactive', span: 6 },
    { type: 'submit', name: 'submit', label: 'lab.catalog.apply', span: 2, class: 'sm:self-end' },
  ];
}

/**
 * Saisie (ou amendement) d'un résultat : un champ numérique, une liste de valeurs admises, ou un texte libre selon l'analyse. Un amendement
 * demande en plus son motif. Le serveur calcule le drapeau (bas, haut, critique) et l'alerte de variation.
 */
export function resultFields(o: { readonly resultType: ResultType; readonly choices: readonly string[]; readonly value: string; readonly amend: boolean; readonly notice: string | null }): FieldSchema[] {
  const value: FieldSchema =
    o.resultType === 'CHOICE'
      ? { type: 'select', name: 'value', label: 'lab.result.valueLabel', hint: 'lab.result.valueHintChoice', value: o.value, autofocus: true, options: o.choices.map((c) => ({ value: c, label: c })), validators: [{ type: 'required', message: 'lab.result.valueRequired' }] }
      : o.resultType === 'NUMERIC'
        ? {
            type: 'text', name: 'value', label: 'lab.result.valueLabel', hint: 'lab.result.valueHintNumeric', value: o.value, autofocus: true, inputMode: 'decimal', inputClass: 'font-mono', normalize: 'trim',
            validators: [{ type: 'required', message: 'lab.result.valueRequired' }, { type: 'pattern', value: '^\\s*-?\\d{1,9}([.,]\\d{1,6})?\\s*$', message: 'lab.result.valueInvalid' }],
          }
        : { type: 'textarea', name: 'value', label: 'lab.result.valueLabel', hint: 'lab.result.valueHintText', value: o.value, autofocus: true, rows: 3, normalize: 'trim', validators: [{ type: 'required', message: 'lab.result.valueRequired' }, { type: 'maxLength', value: 2000 }] };
  return [
    ...failureNotice(o.notice),
    ...(o.amend ? ([{ type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'lab.result.amendWarningTitle', text: 'lab.result.amendWarningText' }] as const) : []),
    value,
    { type: 'text', name: 'comment', label: 'lab.result.comment', hint: 'lab.result.commentHint', normalize: 'trim', validators: [{ type: 'maxLength', value: 300 }] },
    ...(o.amend ? ([{ type: 'text', name: 'reason', label: 'lab.result.amendReason', normalize: 'trim', validators: [{ type: 'required', message: 'lab.result.returnReasonRequired' }, { type: 'maxLength', value: 200 }] }] as const) : []),
    { type: 'paragraph', name: 'audit', text: 'lab.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: o.amend ? 'lab.result.amendSubmit' : 'lab.result.submit', busyLabel: 'lab.saving' },
    { type: 'button', name: 'cancel', label: 'lab.cancel', variant: 'outline' },
  ];
}

/** Renvoi d'un résultat à son auteur : le motif est obligatoire. */
export function returnFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'lab.result.returnWarningTitle', text: 'lab.result.returnWarningText' },
    { type: 'text', name: 'reason', label: 'lab.result.returnReason', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'lab.result.returnReasonRequired' }, { type: 'maxLength', value: 200 }] },
    { type: 'paragraph', name: 'audit', text: 'lab.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'lab.result.returnSubmit', busyLabel: 'lab.saving' },
    { type: 'button', name: 'cancel', label: 'lab.cancel', variant: 'outline' },
  ];
}

/** Appel du clinicien pour une valeur critique : à qui, sa fonction, le moyen, et la relecture de la valeur (obligatoire). */
export function notifyFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'critical', appearance: 'outlined', title: 'lab.result.notifyWarningTitle', text: 'lab.result.notifyWarningText' },
    { type: 'text', name: 'notifiedName', label: 'lab.result.notifiedName', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'lab.collect.required' }, { type: 'maxLength', value: 100 }] },
    { type: 'text', name: 'notifiedRole', label: 'lab.result.notifiedRole', hint: 'lab.result.notifiedRoleHint', normalize: 'trim', validators: [{ type: 'required', message: 'lab.collect.required' }, { type: 'maxLength', value: 60 }] },
    {
      type: 'select', name: 'method', label: 'lab.result.method_label', value: 'PHONE', options: NOTIFICATION_METHODS.map((m) => ({ value: m, label: `lab.result.method.${m}` })), validators: [{ type: 'required', message: 'lab.collect.required' }],
    },
    { type: 'checkbox', name: 'readBack', label: 'lab.result.readBack', validators: [{ type: 'required', message: 'lab.result.readBackRequired' }] },
    { type: 'paragraph', name: 'audit', text: 'lab.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'lab.result.notifySubmit', busyLabel: 'lab.saving' },
    { type: 'button', name: 'cancel', label: 'lab.cancel', variant: 'outline' },
  ];
}

/**
 * Création ou modification d'une analyse. À la création on choisit le code et le type de résultat (ils ne changeront plus) ; ensuite, l'unité et les
 * décimales ne concernent qu'une analyse numérique, les valeurs admises qu'une analyse à choix.
 */
export function testFormFields(o: { readonly test: LabTest | null; readonly notice: string | null }): FieldSchema[] {
  const t = o.test;
  const create = t === null;
  const required: ValidatorSpec[] = [{ type: 'required', message: 'lab.manage.required' }];
  // À la création le type se choisit dans le formulaire (les champs qui en dépendent se montrent selon lui) ; ensuite il est connu.
  const only = (type: ResultType): Partial<FieldSchema> => (create ? { showIf: { field: 'resultType', equals: type } } : {});
  const fields: FieldSchema[] = [...failureNotice(o.notice)];
  if (create) {
    fields.push({
      type: 'text', name: 'code', label: 'lab.manage.code', hint: 'lab.manage.codeHint', autofocus: true, normalize: 'uppercase', inputClass: 'font-mono',
      validators: [...required, { type: 'maxLength', value: 20 }, { type: 'pattern', value: '^[A-Za-z0-9][A-Za-z0-9_.-]*$', message: 'lab.manage.codeHint' }],
    });
  }
  fields.push({ type: 'text', name: 'name', label: 'lab.manage.name', value: t?.name ?? '', autofocus: !create, normalize: 'trim', validators: [...required, { type: 'maxLength', value: 120 }] });
  fields.push({ type: 'select', name: 'section', label: 'lab.manage.section', value: t?.section ?? 'HAEMATOLOGY', options: options(SECTIONS, 'lab.section'), validators: required, span: 6 });
  if (create) {
    fields.push({ type: 'select', name: 'resultType', label: 'lab.manage.resultType', hint: 'lab.manage.resultTypeHint', value: 'NUMERIC', options: RESULT_TYPES.map((r) => ({ value: r, label: `lab.manage.resultTypes.${r}` })), validators: required, span: 6 });
  }
  fields.push({ type: 'select', name: 'specimenType', label: 'lab.manage.specimenType', value: t?.specimenType ?? 'BLOOD', options: options(SPECIMEN_TYPES, 'lab.specimenType'), validators: required, span: 6 });
  fields.push({ type: 'select', name: 'container', label: 'lab.manage.container', value: t?.container ?? 'PURPLE', options: options(CONTAINERS, 'lab.container'), validators: required, span: 6 });
  if (create || t?.resultType === 'NUMERIC') {
    fields.push({ type: 'text', name: 'unit', label: 'lab.manage.unit', value: t?.unit ?? '', normalize: 'trim', span: 6, validators: [{ type: 'maxLength', value: 20 }], ...only('NUMERIC') } as FieldSchema);
    fields.push({
      type: 'number', name: 'decimals', label: 'lab.manage.decimals', value: t?.decimals ?? 1, inputMode: 'numeric', span: 6, validators: [...required, { type: 'min', value: 0 }, { type: 'max', value: 4 }], ...only('NUMERIC'),
    } as FieldSchema);
  }
  if (create || t?.resultType === 'CHOICE') {
    fields.push({ type: 'textarea', name: 'choices', label: 'lab.manage.choices', hint: 'lab.manage.choicesHint', value: (t?.choices ?? []).join('\n'), rows: 4, ...only('CHOICE') } as FieldSchema);
  }
  fields.push({ type: 'number', name: 'tatMinutes', label: 'lab.manage.tat', value: t?.tatMinutes ?? 240, inputMode: 'numeric', validators: [...required, { type: 'min', value: 1 }, { type: 'max', value: 43200 }] });
  fields.push({ type: 'textarea', name: 'instructions', label: 'lab.manage.instructions', value: t?.instructions ?? '', rows: 3, normalize: 'trim', validators: [{ type: 'maxLength', value: 500 }] });
  fields.push({ type: 'paragraph', name: 'audit', text: 'lab.auditNote', tone: 'muted' });
  fields.push({ type: 'submit', name: 'submit', label: 'lab.manage.submit', busyLabel: 'lab.saving' });
  fields.push({ type: 'button', name: 'cancel', label: 'lab.cancel', variant: 'outline' });
  return fields;
}

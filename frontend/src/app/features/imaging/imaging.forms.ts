import { COMMUNICATION_METHODS, ExamType, MODALITIES, ORDER_STATUSES, PRIORITIES, Report, SOURCES } from '../../core/imaging/imaging.models';
import { failureNotice } from '../../shared/failure-message';
import { FieldSchema, OptionSpec, ValidatorSpec } from '../../shared/form-builder/form-schema';

const options = (values: readonly string[], prefix: string): OptionSpec[] => values.map((v) => ({ value: v, label: `${prefix}.${v}` }));
const required: ValidatorSpec[] = [{ type: 'required', message: 'imaging.required' }];

/** Filtres de la liste de travail : statut, priorité, modalité et numéro de demande. */
export function worklistFilterFields(): FieldSchema[] {
  return [
    { type: 'select', name: 'status', label: 'imaging.worklist.status', placeholder: 'imaging.worklist.allStatuses', options: options(ORDER_STATUSES, 'imaging.status'), span: 3 },
    { type: 'select', name: 'priority', label: 'imaging.worklist.priority', placeholder: 'imaging.worklist.allPriorities', options: options(PRIORITIES, 'imaging.priority'), span: 3 },
    { type: 'select', name: 'modality', label: 'imaging.catalog.modality', placeholder: 'imaging.worklist.allModalities', options: options(MODALITIES, 'imaging.modality'), span: 3 },
    { type: 'text', name: 'number', label: 'imaging.worklist.filterNumber', placeholder: 'imaging.worklist.filterNumberPlaceholder', normalize: 'uppercase', inputClass: 'font-mono', span: 3, validators: [{ type: 'maxLength', value: 20 }] },
    { type: 'submit', name: 'submit', label: 'imaging.catalog.apply', span: 3, class: 'sm:self-end' },
  ];
}

/** Recherche d'un examen à demander. */
export function examSearchFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'imaging.new.searchExams', placeholder: 'imaging.new.searchExamsPlaceholder', normalize: 'trim', autofocus: true, validators: [{ type: 'maxLength', value: 100 }] },
    { type: 'submit', name: 'submit', label: 'imaging.new.searchExamsSubmit', busyLabel: 'imaging.searching' },
  ];
}

/** Priorité, provenance et question clinique de la demande (obligatoire : elle justifie l'examen). */
export function orderFields(o: { readonly notice: string | null; readonly source: string }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'select', name: 'priority', label: 'imaging.new.priority', value: 'ROUTINE', options: options(PRIORITIES, 'imaging.priority'), validators: [{ type: 'required' }], span: 6 },
    { type: 'select', name: 'source', label: 'imaging.new.source', value: o.source, options: options(SOURCES, 'imaging.source'), validators: [{ type: 'required' }], span: 6 },
    {
      type: 'textarea', name: 'question', label: 'imaging.new.question', hint: 'imaging.new.questionHint', rows: 4, normalize: 'trim',
      validators: [{ type: 'required', message: 'imaging.new.questionRequired' }, { type: 'maxLength', value: 500 }],
    },
    { type: 'submit', name: 'submit', label: 'imaging.new.submit', busyLabel: 'imaging.saving' },
  ];
}

/** Annulation d'une demande : le motif est obligatoire. */
export function cancelFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'critical', appearance: 'outlined', title: 'imaging.cancelRequest.warningTitle', text: 'imaging.cancelRequest.warningText' },
    {
      type: 'text', name: 'reason', label: 'imaging.cancelRequest.reason', autofocus: true, normalize: 'trim',
      validators: [{ type: 'required', message: 'imaging.cancelRequest.reasonRequired' }, { type: 'maxLength', value: 200 }],
    },
    { type: 'paragraph', name: 'audit', text: 'imaging.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'imaging.cancelRequest.submit', busyLabel: 'imaging.saving' },
    { type: 'button', name: 'cancel', label: 'imaging.cancelRequest.keep', variant: 'outline' },
  ];
}

/** Planification : jour et heure du créneau (dans le fuseau de l'utilisateur). */
export function scheduleFields(o: { readonly notice: string | null; readonly date: string; readonly time: string }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'date', label: 'imaging.schedule.date', hint: 'imaging.schedule.dateHint', value: o.date, normalize: 'trim', inputClass: 'font-mono', inputMode: 'numeric', span: 6,
      validators: [...required, { type: 'pattern', value: '^\\d{4}-\\d{2}-\\d{2}$', message: 'imaging.schedule.dateInvalid' }],
    },
    {
      type: 'text', name: 'time', label: 'imaging.schedule.time', hint: 'imaging.schedule.timeHint', value: o.time, normalize: 'trim', inputClass: 'font-mono', inputMode: 'numeric', span: 6,
      validators: [...required, { type: 'pattern', value: '^([01]\\d|2[0-3]):[0-5]\\d$', message: 'imaging.schedule.timeInvalid' }],
    },
    { type: 'submit', name: 'submit', label: 'imaging.schedule.submit', busyLabel: 'imaging.saving' },
  ];
}

/**
 * Réalisation : le dépistage de sécurité (grossesse, allergie au produit de contraste) est obligatoire. Une contre-indication bloque l'examen tant qu'un motif
 * de dérogation n'est pas écrit : le serveur décide, l'écran montre son refus et laisse le motif se saisir.
 */
export function performFields(o: { readonly notice: string | null; readonly ionizing: boolean; readonly usesContrast: boolean }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'screening', tone: 'warning', appearance: 'outlined', title: 'imaging.perform.screeningTitle', text: 'imaging.perform.screeningText' },
    { type: 'checkbox', name: 'pregnant', label: o.ionizing ? 'imaging.perform.pregnantIonizing' : 'imaging.perform.pregnant' },
    { type: 'checkbox', name: 'contrastAllergy', label: o.usesContrast ? 'imaging.perform.allergyContrast' : 'imaging.perform.allergy' },
    { type: 'text', name: 'overrideReason', label: 'imaging.perform.override', hint: 'imaging.perform.overrideHint', normalize: 'trim', validators: [{ type: 'maxLength', value: 200 }] },
    { type: 'textarea', name: 'techniqueNote', label: 'imaging.perform.technique', hint: 'imaging.perform.techniqueHint', rows: 2, normalize: 'trim', validators: [{ type: 'maxLength', value: 500 }] },
    { type: 'paragraph', name: 'audit', text: 'imaging.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'imaging.perform.submit', busyLabel: 'imaging.saving' },
  ];
}

/** Brouillon du compte rendu : technique, constatations, impression, et l'indication d'une découverte critique. */
export function draftFields(o: { readonly notice: string | null; readonly report: Report }): FieldSchema[] {
  const d = o.report.draft;
  return [
    ...failureNotice(o.notice),
    { type: 'textarea', name: 'technique', label: 'imaging.report.technique', value: d?.technique ?? '', rows: 2, normalize: 'trim', validators: [{ type: 'maxLength', value: 2000 }] },
    { type: 'textarea', name: 'findings', label: 'imaging.report.findings', hint: 'imaging.report.findingsHint', value: d?.findings ?? '', rows: 8, normalize: 'trim', validators: [{ type: 'maxLength', value: 8000 }] },
    { type: 'textarea', name: 'impression', label: 'imaging.report.impression', hint: 'imaging.report.impressionHint', value: d?.impression ?? '', rows: 3, normalize: 'trim', validators: [{ type: 'maxLength', value: 2000 }] },
    { type: 'checkbox', name: 'critical', label: 'imaging.report.critical', hint: 'imaging.report.criticalHint', value: d?.critical ?? false },
    { type: 'paragraph', name: 'audit', text: 'imaging.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'imaging.report.saveDraft', busyLabel: 'imaging.saving', variant: 'outline' },
  ];
}

const communicationFields = (showIf?: { readonly field: string; readonly truthy: true }): FieldSchema[] => [
  { type: 'text', name: 'notifiedName', label: 'imaging.report.notifiedName', normalize: 'trim', validators: [...required, { type: 'maxLength', value: 100 }], ...(showIf ? { showIf } : {}) },
  { type: 'text', name: 'notifiedRole', label: 'imaging.report.notifiedRole', hint: 'imaging.report.notifiedRoleHint', normalize: 'trim', validators: [...required, { type: 'maxLength', value: 60 }], ...(showIf ? { showIf } : {}) },
  { type: 'select', name: 'method', label: 'imaging.report.methodLabel', value: 'PHONE', options: COMMUNICATION_METHODS.map((m) => ({ value: m, label: `imaging.report.method.${m}` })), validators: required, ...(showIf ? { showIf } : {}) },
  { type: 'checkbox', name: 'readBack', label: 'imaging.report.readBack', validators: [{ type: 'required', message: 'imaging.report.readBackRequired' }], ...(showIf ? { showIf } : {}) },
] as FieldSchema[];

/** Appel du clinicien pour une découverte critique : à qui, sa fonction, le moyen, et la relecture de la découverte (obligatoire). */
export function communicationFormFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'critical', appearance: 'outlined', title: 'imaging.report.communicateWarningTitle', text: 'imaging.report.communicateWarningText' },
    ...communicationFields(),
    { type: 'paragraph', name: 'audit', text: 'imaging.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'imaging.report.communicateSubmit', busyLabel: 'imaging.saving' },
  ];
}

/** Addendum à un compte rendu signé : motif, nouveau texte, et — si la découverte est critique — l'appel du clinicien. */
export function addendumFields(o: { readonly notice: string | null; readonly report: Report }): FieldSchema[] {
  const last = o.report.versions[o.report.versions.length - 1];
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'imaging.report.addendumWarningTitle', text: 'imaging.report.addendumWarningText' },
    { type: 'text', name: 'reason', label: 'imaging.report.addendumReason', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'imaging.report.addendumReasonRequired' }, { type: 'maxLength', value: 200 }] },
    { type: 'textarea', name: 'technique', label: 'imaging.report.technique', value: last?.technique ?? '', rows: 2, normalize: 'trim', validators: [{ type: 'maxLength', value: 2000 }] },
    { type: 'textarea', name: 'findings', label: 'imaging.report.findings', value: last?.findings ?? '', rows: 8, normalize: 'trim', validators: [...required, { type: 'maxLength', value: 8000 }] },
    { type: 'textarea', name: 'impression', label: 'imaging.report.impression', value: last?.impression ?? '', rows: 3, normalize: 'trim', validators: [...required, { type: 'maxLength', value: 2000 }] },
    { type: 'checkbox', name: 'critical', label: 'imaging.report.critical', hint: 'imaging.report.criticalHint', value: last?.critical ?? false },
    ...communicationFields({ field: 'critical', truthy: true }),
    { type: 'paragraph', name: 'audit', text: 'imaging.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'imaging.report.addendumSubmit', busyLabel: 'imaging.saving' },
    { type: 'button', name: 'cancel', label: 'imaging.cancel', variant: 'outline' },
  ];
}

/** Filtres du catalogue : texte et modalité. */
export function catalogFilterFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'imaging.catalog.search', placeholder: 'imaging.catalog.searchPlaceholder', normalize: 'trim', autofocus: true, span: 6, validators: [{ type: 'maxLength', value: 100 }] },
    { type: 'select', name: 'modality', label: 'imaging.catalog.modality', placeholder: 'imaging.worklist.allModalities', options: options(MODALITIES, 'imaging.modality'), span: 4 },
    { type: 'submit', name: 'submit', label: 'imaging.catalog.apply', span: 2, class: 'sm:self-end' },
  ];
}

/** Filtres du catalogue pour qui le gère : en plus, l'affichage des examens retirés. */
export function catalogManageFilterFields(): FieldSchema[] {
  return [
    ...catalogFilterFields().filter((f) => f.type !== 'submit'),
    { type: 'checkbox', name: 'inactive', label: 'imaging.manage.showInactive', span: 6 },
    { type: 'submit', name: 'submit', label: 'imaging.catalog.apply', span: 2, class: 'sm:self-end' },
  ];
}

/** Création ou modification d'un examen. À la création on choisit le code et la modalité (ils ne changeront plus). */
export function examFormFields(o: { readonly exam: ExamType | null; readonly notice: string | null }): FieldSchema[] {
  const e = o.exam;
  const create = e === null;
  const fields: FieldSchema[] = [...failureNotice(o.notice)];
  if (create) {
    fields.push({
      type: 'text', name: 'code', label: 'imaging.manage.code', hint: 'imaging.manage.codeHint', autofocus: true, normalize: 'uppercase', inputClass: 'font-mono',
      validators: [{ type: 'required', message: 'imaging.manage.required' }, { type: 'maxLength', value: 20 }, { type: 'pattern', value: '^[A-Za-z0-9][A-Za-z0-9_.-]*$', message: 'imaging.manage.codeHint' }],
    });
  }
  fields.push({ type: 'text', name: 'name', label: 'imaging.manage.name', value: e?.name ?? '', autofocus: !create, normalize: 'trim', validators: [{ type: 'required', message: 'imaging.manage.required' }, { type: 'maxLength', value: 120 }] });
  if (create) {
    fields.push({ type: 'select', name: 'modality', label: 'imaging.manage.modality', hint: 'imaging.manage.modalityHint', value: 'XRAY', options: options(MODALITIES, 'imaging.modality'), validators: [{ type: 'required', message: 'imaging.manage.required' }] });
  }
  fields.push({ type: 'text', name: 'bodyPart', label: 'imaging.manage.bodyPart', value: e?.bodyPart ?? '', normalize: 'trim', span: 6, validators: [{ type: 'maxLength', value: 60 }] });
  fields.push({
    type: 'number', name: 'durationMinutes', label: 'imaging.manage.duration', value: e?.durationMinutes ?? 30, inputMode: 'numeric', span: 6,
    validators: [{ type: 'required', message: 'imaging.manage.required' }, { type: 'min', value: 5 }, { type: 'max', value: 480 }],
  });
  fields.push({ type: 'checkbox', name: 'usesContrast', label: 'imaging.manage.usesContrast', hint: 'imaging.manage.usesContrastHint', value: e?.usesContrast ?? false });
  fields.push({ type: 'textarea', name: 'preparation', label: 'imaging.manage.preparation', hint: 'imaging.manage.preparationHint', value: e?.preparation ?? '', rows: 3, normalize: 'trim', validators: [{ type: 'maxLength', value: 500 }] });
  fields.push({ type: 'paragraph', name: 'audit', text: 'imaging.auditNote', tone: 'muted' });
  fields.push({ type: 'submit', name: 'submit', label: 'imaging.manage.submit', busyLabel: 'imaging.saving' });
  fields.push({ type: 'button', name: 'cancel', label: 'imaging.cancel', variant: 'outline' });
  return fields;
}

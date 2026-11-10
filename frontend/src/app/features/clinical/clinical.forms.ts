import { Note, SEVERITIES, Vitals } from '../../core/clinical/clinical.models';
import { failureNotice } from '../../shared/failure-message';
import { FieldSchema, OptionSpec } from '../../shared/form-builder/form-schema';

const options = (values: readonly string[], prefix: string): OptionSpec[] => values.map((v) => ({ value: v, label: `${prefix}.${v}` }));

/** Les constantes que le formulaire propose et le format admis (entier ou une décimale) ; l'unité est dans le libellé. */
export const VITAL_FIELDS = [
  { name: 'temperature', decimal: true },
  { name: 'pulse', decimal: false },
  { name: 'systolic', decimal: false },
  { name: 'diastolic', decimal: false },
  { name: 'respiratoryRate', decimal: false },
  { name: 'spo2', decimal: false },
  { name: 'weightKg', decimal: true },
  { name: 'heightCm', decimal: true },
] as const;

const show = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(n).replace('.', ','));

/** Relevé des constantes : tout est facultatif (au moins une), la pression artérielle se donne en entier. Le serveur contrôle les plages. */
export function vitalsFields(o: { readonly vitals: Vitals | null; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    ...VITAL_FIELDS.map((f): FieldSchema => ({
      type: 'text', name: f.name, label: `clinical.vitals.${f.name}`, value: show(o.vitals?.[f.name]), inputMode: 'decimal', inputClass: 'font-mono', span: 3, normalize: 'trim',
      validators: [{ type: 'pattern', value: f.decimal ? '^(\\d{1,3}([.,]\\d)?)?$' : '^(\\d{1,3})?$', message: f.decimal ? 'clinical.vitals.decimalInvalid' : 'clinical.vitals.integerInvalid' }],
    })),
    { type: 'submit', name: 'submit', label: 'clinical.vitals.submit', busyLabel: 'clinical.saving' },
  ];
}

/** La note SOAP : motif, histoire, examen, évaluation (obligatoire pour signer), conduite à tenir. */
export function noteFields(o: { readonly note: Note; readonly notice: string | null }): FieldSchema[] {
  const area = (name: keyof Note, max: number, rows: number, extra: Partial<FieldSchema> = {}): FieldSchema =>
    ({ type: 'textarea', name, label: `clinical.note.${name}`, value: o.note[name] ?? '', rows, normalize: 'trim', validators: [{ type: 'maxLength', value: max }], ...extra }) as FieldSchema;
  return [
    ...failureNotice(o.notice),
    area('chiefComplaint', 500, 2),
    area('history', 2000, 4),
    area('examination', 2000, 4),
    area('assessment', 2000, 4, { hint: 'clinical.note.assessmentHint' }),
    area('plan', 2000, 3),
    { type: 'submit', name: 'submit', label: 'clinical.note.submit', busyLabel: 'clinical.saving' },
  ];
}

/** Addendum : complète ou corrige une consultation signée sans la modifier ; daté et signé. */
export function addendumFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'textarea', name: 'text', label: 'clinical.addendum.text', hint: 'clinical.addendum.hint', rows: 3, normalize: 'trim', validators: [{ type: 'required', message: 'clinical.addendum.required' }, { type: 'maxLength', value: 2000 }] },
    { type: 'submit', name: 'submit', label: 'clinical.addendum.submit', busyLabel: 'clinical.saving' },
  ];
}

/** Annulation d'une consultation ouverte par erreur : le motif est obligatoire. */
export function cancelFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'critical', appearance: 'outlined', title: 'clinical.cancel.warningTitle', text: 'clinical.cancel.warningText' },
    { type: 'text', name: 'reason', label: 'clinical.cancel.reason', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'clinical.reasonRequired' }, { type: 'maxLength', value: 200 }] },
    { type: 'paragraph', name: 'audit', text: 'clinical.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'clinical.cancel.submit', busyLabel: 'clinical.saving' },
    { type: 'button', name: 'cancel', label: 'clinical.cancel.keep', variant: 'outline' },
  ];
}

/** Nouvelle allergie du patient : substance, gravité, réaction facultative. */
export function allergyFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'text', name: 'substance', label: 'clinical.allergy.substance', hint: 'clinical.allergy.substanceHint', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'clinical.allergy.substanceRequired' }, { type: 'maxLength', value: 100 }] },
    { type: 'select', name: 'severity', label: 'clinical.allergy.severity', placeholder: 'clinical.allergy.severityPlaceholder', options: options(SEVERITIES, 'clinical.severity'), validators: [{ type: 'required', message: 'clinical.allergy.severityRequired' }] },
    { type: 'text', name: 'reaction', label: 'clinical.allergy.reaction', normalize: 'trim', validators: [{ type: 'maxLength', value: 200 }] },
    { type: 'paragraph', name: 'audit', text: 'clinical.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'clinical.allergy.submit', busyLabel: 'clinical.saving' },
    { type: 'button', name: 'cancel', label: 'clinical.cancelAction', variant: 'outline' },
  ];
}

/** Déclaration d'une saisie erronée : l'allergie sort de la liste active mais reste au dossier. Le motif est obligatoire. */
export function voidAllergyFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'clinical.allergy.voidWarningTitle', text: 'clinical.allergy.voidWarningText' },
    { type: 'text', name: 'reason', label: 'clinical.allergy.voidReason', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'clinical.reasonRequired' }, { type: 'maxLength', value: 200 }] },
    { type: 'paragraph', name: 'audit', text: 'clinical.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'clinical.allergy.voidSubmit', busyLabel: 'clinical.saving' },
    { type: 'button', name: 'cancel', label: 'clinical.cancelAction', variant: 'outline' },
  ];
}

/** Annulation d'une ordonnance : elle reste au dossier, le motif est obligatoire. */
export function cancelPrescriptionFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'clinical.rx.cancelWarningTitle', text: 'clinical.rx.cancelWarningText' },
    { type: 'text', name: 'reason', label: 'clinical.rx.cancelReason', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'clinical.reasonRequired' }, { type: 'maxLength', value: 200 }] },
    { type: 'paragraph', name: 'audit', text: 'clinical.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'clinical.rx.cancelSubmit', busyLabel: 'clinical.saving' },
    { type: 'button', name: 'cancel', label: 'clinical.rx.cancelKeep', variant: 'outline' },
  ];
}

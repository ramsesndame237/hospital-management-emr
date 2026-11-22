import { CONSCIOUSNESS_LEVELS, Risk } from '../../core/inpatient/inpatient.models';
import { failureNotice } from '../../shared/failure-message';
import { FieldSchema } from '../../shared/form-builder/form-schema';
import { StatusTone } from '../../shared/status-tag';

/** Ton du niveau de risque NEWS2 : vert faible, orange moyen, rouge élevé (le texte est toujours affiché, la couleur ne porte jamais seule le sens). */
export const riskTone = (risk: Risk): StatusTone => (risk === 'HIGH' ? 'critical' : risk === 'MEDIUM' ? 'warning' : 'success');

const INTEGER = (max: number) => `^\\s*\\d{1,${max}}\\s*$`;

/** Relevé de constantes : les sept paramètres du score NEWS2 sont obligatoires (la diastolique et la remarque sont facultatives). */
export function observationFields(o: { readonly notice: string | null }): FieldSchema[] {
  const integer = (name: string, max: number, required: boolean): FieldSchema => ({
    type: 'text', name, label: `inpatient.obs.${name}`, inputMode: 'numeric', inputClass: 'font-mono', span: 3, normalize: 'trim',
    validators: [
      ...(required ? [{ type: 'required', message: 'inpatient.obs.required' }] : []),
      { type: 'pattern', value: required ? INTEGER(max) : `^\\s*(\\d{1,${max}})?\\s*$`, message: 'inpatient.obs.integerInvalid' },
    ],
  });
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'temperature', label: 'inpatient.obs.temperature', inputMode: 'decimal', inputClass: 'font-mono', span: 3, normalize: 'trim',
      validators: [{ type: 'required', message: 'inpatient.obs.required' }, { type: 'pattern', value: '^\\s*\\d{2}([.,]\\d)?\\s*$', message: 'inpatient.obs.decimalInvalid' }],
    },
    integer('pulse', 3, true),
    integer('systolic', 3, true),
    integer('diastolic', 3, false),
    integer('respiratoryRate', 2, true),
    integer('spo2', 3, true),
    {
      type: 'select', name: 'consciousness', label: 'inpatient.obs.consciousness', value: 'ALERT', span: 6,
      options: CONSCIOUSNESS_LEVELS.map((c) => ({ value: c, label: `inpatient.consciousness.${c}` })), validators: [{ type: 'required' }],
    },
    { type: 'checkbox', name: 'supplementalOxygen', label: 'inpatient.obs.supplementalOxygen', span: 6 },
    { type: 'text', name: 'note', label: 'inpatient.obs.note', normalize: 'trim', validators: [{ type: 'maxLength', value: 300 }] },
    { type: 'submit', name: 'submit', label: 'inpatient.obs.submit', busyLabel: 'inpatient.saving' },
  ];
}

/** Motif d'un médicament refusé par le patient ou suspendu par le soignant : obligatoire, il est conservé au dossier. */
export function reasonFields(o: { readonly held: boolean; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'reason', label: o.held ? 'inpatient.mar.holdReason' : 'inpatient.mar.refuseReason', autofocus: true, normalize: 'trim',
      validators: [{ type: 'required', message: 'inpatient.mar.reasonRequired' }, { type: 'maxLength', value: 200 }],
    },
    { type: 'submit', name: 'submit', label: o.held ? 'inpatient.mar.hold' : 'inpatient.mar.refuse', busyLabel: 'inpatient.saving' },
    { type: 'button', name: 'cancel', label: 'inpatient.cancel', variant: 'outline' },
  ];
}

/** Note de soins : une note ne se modifie pas, elle est datée et signée par son auteur. */
export function noteFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'textarea', name: 'text', label: 'inpatient.notes.text', hint: 'inpatient.notes.hint', rows: 3, normalize: 'trim',
      validators: [{ type: 'required', message: 'inpatient.notes.required' }, { type: 'maxLength', value: 1000 }],
    },
    { type: 'submit', name: 'submit', label: 'inpatient.notes.submit', busyLabel: 'inpatient.saving' },
  ];
}

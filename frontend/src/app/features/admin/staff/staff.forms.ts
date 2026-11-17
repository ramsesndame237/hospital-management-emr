import { ManagedUser } from '../../../core/iam/identity-admin.models';
import { Assignment, ReferenceChoice, StaffMember } from '../../../core/staff/staff.models';
import { FieldSchema } from '../../../shared/form-builder/form-schema';
import { failureNotice } from '../admin.forms';

/** Date `AAAA-MM-JJ` (même règle que l'API, qui vérifie aussi que le jour existe). */
const DATE = '^\\s*\\d{4}-\\d{2}-\\d{2}\\s*$';
const DATE_RULE = { type: 'pattern', value: DATE, message: 'admin.staff.dateFormat' } as const;
const STAFF_NUMBER = '^\\s*[A-Za-z0-9_./-]{1,32}\\s*$';
const PHONE = '^\\s*\\+?[0-9 ]{3,19}\\s*$';

const options = (choices: readonly ReferenceChoice[]) => choices.map((c) => ({ value: c.code, label: c.label }));

/** Texte facultatif d'un formulaire : vide = absent. */
export const optional = (value: unknown): string | undefined => {
  const text = String(value ?? '').trim();
  return text === '' ? undefined : text;
};

/** Création (matricule compris) ou modification d'une fiche ; le matricule ne change jamais. */
export function staffFields(o: {
  readonly member: StaffMember | null;
  readonly professions: readonly ReferenceChoice[];
  readonly specialties: readonly ReferenceChoice[];
  readonly notice: string | null;
}): FieldSchema[] {
  const m = o.member;
  const creating = m === null;
  return [
    ...failureNotice(o.notice),
    ...(creating
      ? ([{
          type: 'text', name: 'staffNumber', label: 'admin.staff.staffNumber', hint: 'admin.staff.staffNumberHint', value: '', autofocus: true, normalize: 'trim', inputClass: 'font-mono',
          validators: [{ type: 'required', message: 'admin.staff.staffNumberRequired' }, { type: 'pattern', value: STAFF_NUMBER, message: 'admin.staff.staffNumberFormat' }],
        }] as const)
      : []),
    { type: 'text', name: 'lastName', label: 'admin.staff.lastName', value: m?.lastName ?? '', autofocus: !creating, normalize: 'trim', validators: [{ type: 'required', message: 'admin.staff.lastNameRequired' }, { type: 'maxLength', value: 100 }] },
    { type: 'text', name: 'firstName', label: 'admin.staff.firstName', value: m?.firstName ?? '', normalize: 'trim', validators: [{ type: 'required', message: 'admin.staff.firstNameRequired' }, { type: 'maxLength', value: 100 }] },
    { type: 'select', name: 'professionCode', label: 'admin.staff.profession', value: m?.professionCode ?? '', placeholder: 'admin.staff.chooseProfession', options: options(o.professions), validators: [{ type: 'required', message: 'admin.staff.professionRequired' }] },
    { type: 'select', name: 'specialtyCode', label: 'admin.staff.specialty', value: m?.specialtyCode ?? '', placeholder: 'admin.staff.noSpecialty', options: options(o.specialties) },
    { type: 'email', name: 'email', label: 'admin.staff.email', value: m?.email ?? '', normalize: 'trim', autocomplete: 'off', validators: [{ type: 'email' }, { type: 'maxLength', value: 254 }] },
    { type: 'tel', name: 'phone', label: 'admin.staff.phone', value: m?.phone ?? '', normalize: 'trim', autocomplete: 'off', validators: [{ type: 'pattern', value: PHONE, message: 'admin.staff.phoneFormat' }] },
    { type: 'text', name: 'hiredOn', label: 'admin.staff.hiredOn', hint: 'admin.staff.dateHint', value: m?.hiredOn ?? '', normalize: 'trim', inputClass: 'font-mono', validators: [DATE_RULE] },
    { type: 'submit', name: 'submit', label: creating ? 'admin.staff.create' : 'admin.save', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Relier un compte de connexion à la fiche : sans lui, le soignant ne voit aucun patient. */
export function linkAccountFields(o: { readonly users: readonly ManagedUser[]; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'why', tone: 'info', appearance: 'outlined', title: 'admin.staff.linkWhyTitle', text: 'admin.staff.linkWhyText' },
    {
      type: 'select', name: 'userId', label: 'admin.staff.account', placeholder: 'admin.staff.chooseAccount', value: '', autofocus: true,
      options: o.users.map((u) => ({ value: u.id, label: `${u.username} (${u.email})` })), validators: [{ type: 'required', message: 'admin.staff.accountRequired' }],
    },
    { type: 'paragraph', name: 'audit', text: 'admin.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'admin.staff.link', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Détacher le compte : la fiche et ses affectations restent, mais le titulaire ne voit plus aucun patient. */
export function unlinkAccountFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'admin.staff.unlinkTitle', text: 'admin.staff.unlinkText' },
    { type: 'paragraph', name: 'audit', text: 'admin.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'admin.staff.unlink', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Départ : daté (aujourd'hui par défaut), il termine les affectations qui se poursuivaient. */
export function departFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'admin.staff.departTitle', text: 'admin.staff.departText' },
    { type: 'text', name: 'departedOn', label: 'admin.staff.departedOn', hint: 'admin.staff.departedOnHint', value: '', autofocus: true, normalize: 'trim', inputClass: 'font-mono', validators: [DATE_RULE] },
    { type: 'paragraph', name: 'audit', text: 'admin.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'admin.staff.depart', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Nouvelle affectation à un service. */
export function assignFields(o: { readonly services: readonly { readonly id: string; readonly name: string }[]; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'select', name: 'nodeId', label: 'admin.staff.service', placeholder: 'admin.staff.chooseService', value: '',
      options: o.services.map((s) => ({ value: s.id, label: s.name })), validators: [{ type: 'required', message: 'admin.staff.serviceRequired' }],
    },
    { type: 'text', name: 'startDate', label: 'admin.staff.startDate', hint: 'admin.staff.startDateHint', value: '', normalize: 'trim', inputClass: 'font-mono', validators: [DATE_RULE] },
    { type: 'checkbox', name: 'primary', label: 'admin.staff.primary' },
    { type: 'submit', name: 'submit', label: 'admin.staff.assign', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.close', variant: 'outline' },
  ];
}

export const assignmentLabel = (a: Assignment, services: readonly { readonly id: string; readonly name: string }[]): string => services.find((s) => s.id === a.nodeId)?.name ?? a.nodeId;

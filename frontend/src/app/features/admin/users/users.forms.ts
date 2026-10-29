import { Translator } from '../../../core/i18n/translator';
import { RoleInfo } from '../../../core/iam/identity-admin.models';
import { FieldSchema } from '../../../shared/form-builder/form-schema';
import { failureNotice } from '../admin.forms';

/** Un rôle proposé à l'attribution : son code et son libellé complet (nom, et mention de la double authentification). */
export interface RoleChoice {
  readonly code: string;
  readonly label: string;
}

/** Nom d'un rôle : le catalogue de l'interface pour les rôles fournis, sinon le nom enregistré (rôle ajouté par l'établissement). */
export function roleName(i18n: Translator, role: { readonly code: string; readonly name: string }): string {
  const key = `roles.${role.code}`;
  return i18n.has(key) ? i18n.t(key) : role.name;
}

export function roleChoices(i18n: Translator, roles: readonly RoleInfo[]): RoleChoice[] {
  return roles.map((role) => ({ code: role.code, label: roleName(i18n, role) + (role.requiresMfa ? ` · ${i18n.t('admin.users.mfaRequiredShort')}` : '') }));
}

const fieldOf = (code: string): string => `role_${code}`;

/** Codes des rôles cochés dans les valeurs d'un formulaire d'attribution. */
export function selectedRoles(value: Readonly<Record<string, unknown>>, choices: readonly RoleChoice[]): string[] {
  return choices.filter((choice) => value[fieldOf(choice.code)] === true).map((choice) => choice.code);
}

function roleCheckboxes(choices: readonly RoleChoice[], selected: readonly string[]): FieldSchema[] {
  return [
    { type: 'paragraph', name: 'rolesLegend', text: 'admin.users.rolesLegend', size: 'sm', strong: true },
    ...choices.map((choice): FieldSchema => ({ type: 'checkbox', name: fieldOf(choice.code), label: choice.label, value: selected.includes(choice.code) })),
  ];
}

/** Création d'un compte : identifiant, e-mail et au moins un rôle (vérifié à l'envoi). Le mot de passe provisoire est généré par l'API. */
export function createUserFields(o: { readonly roles: readonly RoleChoice[]; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'username', label: 'admin.users.username', hint: 'admin.users.usernameHint', autofocus: true, normalize: 'trim', autocomplete: 'off', inputClass: 'font-mono',
      validators: [{ type: 'required', message: 'admin.users.usernameRequired' }, { type: 'pattern', value: '^\\s*[A-Za-z0-9._-]{3,64}\\s*$', message: 'admin.users.usernameFormat' }],
    },
    {
      type: 'email', name: 'email', label: 'admin.users.email', normalize: 'trim', autocomplete: 'off',
      validators: [{ type: 'required', message: 'admin.users.emailRequired' }, { type: 'email' }, { type: 'maxLength', value: 254 }],
    },
    ...roleCheckboxes(o.roles, []),
    { type: 'submit', name: 'submit', label: 'admin.users.create', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Remplacement de la liste des rôles d'un compte. */
export function editRolesFields(o: { readonly roles: readonly RoleChoice[]; readonly selected: readonly string[]; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'effect', tone: 'info', appearance: 'outlined', title: 'admin.users.rolesEffectTitle', text: 'admin.users.rolesEffectText' },
    ...roleCheckboxes(o.roles, o.selected),
    { type: 'paragraph', name: 'audit', text: 'admin.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'admin.users.saveRoles', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Confirmation d'une action sensible sur un compte (désactivation, réinitialisation de la double authentification). */
export function confirmFields(o: { readonly title: string; readonly text: string; readonly submit: string; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: o.title, text: o.text },
    { type: 'paragraph', name: 'audit', text: 'admin.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: o.submit, busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Après la création : le mot de passe provisoire, affiché une seule fois. */
export function createdUserFields(o: { readonly username: string; readonly password: string }): FieldSchema[] {
  return [
    { type: 'message', name: 'created', tone: 'success', appearance: 'outlined', title: 'admin.users.createdTitle', text: 'admin.users.createdText', params: { username: o.username } },
    { type: 'secret', name: 'password', label: 'admin.users.temporaryPassword', value: o.password, grouped: false, copyLabel: 'common.copy', copiedLabel: 'common.copied' },
    { type: 'message', name: 'once', tone: 'warning', appearance: 'outlined', title: 'admin.users.onceTitle', text: 'admin.users.onceText' },
    { type: 'button', name: 'done', label: 'admin.users.done', variant: 'primary' },
  ];
}

import { FieldSchema } from '../../../shared/form-builder/form-schema';

/** Étape 1 : identifiant et mot de passe. Les règles, les messages et les classes sont de la donnée, pas du code. */
export function credentialsFields(options: { readonly submitLabel: string; readonly notice: FieldSchema[]; readonly footer: FieldSchema[] }): FieldSchema[] {
  return [
    ...options.notice,
    {
      type: 'text',
      name: 'username',
      label: 'login.username',
      placeholder: 'login.usernamePlaceholder',
      autocomplete: 'username',
      autofocus: true,
      normalize: 'trim',
      validators: [
        { type: 'required', message: 'login.errors.usernameRequired' },
        { type: 'maxLength', value: 64 },
      ],
    },
    {
      type: 'password',
      name: 'password',
      label: 'login.password',
      placeholder: 'login.passwordPlaceholder',
      autocomplete: 'current-password',
      validators: [
        { type: 'required', message: 'login.errors.passwordRequired' },
        { type: 'maxLength', value: 1024 },
      ],
    },
    { type: 'submit', name: 'submit', label: options.submitLabel, busyLabel: 'login.submitting' },
    ...options.footer,
  ];
}

/** Étape 2 : code de vérification (application d'authentification) ou code de secours. */
export function secondFactorFields(recovery: boolean): FieldSchema[] {
  return [
    {
      type: 'code',
      name: 'code',
      label: recovery ? 'mfa.recoveryCode' : 'mfa.code',
      placeholder: recovery ? 'ABCDE-FGHJK' : '000 000',
      autocomplete: recovery ? 'off' : 'one-time-code',
      inputMode: recovery ? 'text' : 'numeric',
      autofocus: true,
      normalize: 'trim',
      inputClass: recovery ? 'h-8 text-center text-xl uppercase tracking-[0.2em]' : 'h-8 text-center text-xl tracking-[0.35em]',
      validators: [
        { type: 'required', message: 'mfa.errors.codeRequired' },
        { type: 'maxLength', value: recovery ? 16 : 7 },
      ],
    },
    { type: 'submit', name: 'submit', label: 'mfa.verify', busyLabel: 'login.submitting' },
    { type: 'link', name: 'toggleRecovery', label: recovery ? 'mfa.useApp' : 'mfa.useRecovery' },
    { type: 'link', name: 'back', label: 'common.back' },
  ];
}

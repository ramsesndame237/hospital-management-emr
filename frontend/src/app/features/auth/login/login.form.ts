import { FieldSchema } from '../../../shared/form-builder/form-schema';
import { SupportCodeKind } from '../shared/support-code';

/**
 * Ce que la page affiche au-dessus du formulaire après un échec. Chaque type d'incident a son ton, son message et son code
 * d'assistance (N01 réseau, C01 identifiants, R01 trop de tentatives, S01 service indisponible).
 */
export type Notice =
  | { readonly kind: 'network' }
  | { readonly kind: 'invalid'; readonly text: string }
  | { readonly kind: 'rate'; readonly wait: string }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'code' }
  | { readonly kind: 'error'; readonly title: string };

const SUPPORT_KIND: Readonly<Partial<Record<Notice['kind'], SupportCodeKind>>> = { network: 'N01', invalid: 'C01', rate: 'R01', unavailable: 'S01' };

export function supportKindOf(notice: Notice | null): SupportCodeKind | null {
  return (notice && SUPPORT_KIND[notice.kind]) || null;
}

export function noticeFields(notice: Notice | null): FieldSchema[] {
  switch (notice?.kind) {
    case 'network':
      return [{ type: 'message', name: 'notice', tone: 'critical', title: 'login.network.title', text: 'login.network.text' }];
    case 'invalid':
      return [{ type: 'message', name: 'notice', tone: 'critical', title: 'login.invalid.title', text: notice.text }];
    case 'rate':
      return [{ type: 'message', name: 'notice', tone: 'warning', title: 'login.rate.title', text: 'login.rate.text', params: { time: notice.wait } }];
    case 'unavailable':
      return [{ type: 'message', name: 'notice', tone: 'critical', title: 'login.unavailable.title', text: 'login.unavailable.text' }];
    case 'code':
      return [{ type: 'message', name: 'notice', tone: 'warning', title: 'mfa.invalid.title', text: 'mfa.invalid.text' }];
    case 'error':
      return [{ type: 'message', name: 'notice', tone: 'critical', title: notice.title }];
    default:
      return [];
  }
}

export interface CredentialsOptions {
  readonly notice: Notice | null;
  /** Libellé du bouton (« Se connecter », « Réessayer », « Réessayer dans 00:59 »…). */
  readonly submitLabel: string;
  /** Bouton inactif (suspension temporaire après trop de tentatives). */
  readonly locked: boolean;
  readonly supportCode: string | null;
  readonly supportPhone: string;
  readonly statusUrl: string;
}

/** Étape 1 : identifiant et mot de passe, puis aides adaptées à l'incident. Les règles, les messages et les classes sont de la donnée. */
export function credentialsFields(o: CredentialsOptions): FieldSchema[] {
  const incident = o.supportCode !== null;
  return [
    ...noticeFields(o.notice),
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
    { type: 'submit', name: 'submit', label: o.submitLabel, busyLabel: 'login.submitting', disabled: o.locked },
    { type: 'link', name: 'forgot', label: 'login.forgot', routerLink: '/forgot-password' },
    ...(incident ? ([{ type: 'paragraph', name: 'supportCode', text: 'login.supportCode', params: { code: o.supportCode }, tone: 'muted', mono: true }] as const) : []),
    ...(o.notice?.kind === 'unavailable' ? ([{ type: 'link', name: 'status', label: 'login.status', href: o.statusUrl }] as const) : []),
    ...(incident ? ([{ type: 'paragraph', name: 'help', text: 'login.help', params: { phone: o.supportPhone }, tone: 'muted' }] as const) : []),
  ];
}

export interface SecondFactorOptions {
  readonly notice: Notice | null;
  readonly username: string;
  readonly submitLabel: string;
  readonly locked: boolean;
}

/** Étape 2 : code à 6 chiffres de l'application d'authentification, en cases séparées. */
export function totpFields(o: SecondFactorOptions): FieldSchema[] {
  return [
    { type: 'paragraph', name: 'account', text: 'mfa.account', params: { username: o.username }, tone: 'muted' },
    ...noticeFields(o.notice),
    {
      type: 'otp',
      name: 'code',
      label: 'mfa.code',
      hint: 'mfa.hint',
      autofocus: true,
      validators: [
        { type: 'required', message: 'mfa.errors.codeRequired' },
        { type: 'pattern', value: '^\\d{6}$', message: 'mfa.errors.codeFormat' },
      ],
    },
    { type: 'submit', name: 'submit', label: o.submitLabel, busyLabel: 'mfa.verifying', disabled: o.locked },
    { type: 'link', name: 'toRecovery', label: 'mfa.useRecovery' },
    { type: 'link', name: 'back', label: 'mfa.backToLogin' },
    { type: 'paragraph', name: 'clockNote', text: 'mfa.clockNote', tone: 'muted' },
  ];
}

/** Variante : un code de récupération (5 caractères, tiret, 5 caractères) à la place du code de l'application. */
export function recoveryFields(o: SecondFactorOptions): FieldSchema[] {
  return [
    { type: 'message', name: 'once', tone: 'warning', title: 'recovery.noticeTitle', text: 'recovery.noticeText' },
    ...noticeFields(o.notice),
    {
      // Nom distinct de celui du code à 6 chiffres : une saisie faite à l'étape précédente ne doit jamais se retrouver ici.
      type: 'text',
      name: 'recoveryCode',
      label: 'recovery.code',
      placeholder: 'ABCDE-FGHJK',
      hint: 'recovery.format',
      autocomplete: 'off',
      autofocus: true,
      normalize: 'uppercase',
      validators: [
        { type: 'required', message: 'recovery.errors.required' },
        { type: 'pattern', value: '^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$', message: 'recovery.errors.format' },
      ],
    },
    { type: 'submit', name: 'submit', label: o.submitLabel, busyLabel: 'mfa.verifying', disabled: o.locked },
    { type: 'link', name: 'backToApp', label: 'recovery.backToApp' },
    { type: 'paragraph', name: 'noCode', text: 'recovery.noCode', tone: 'muted' },
  ];
}

/** Après un code de récupération accepté : on le dit, on rappelle que ce code est consommé, puis on poursuit. */
export function verifiedFields(remaining: number | undefined): FieldSchema[] {
  return [
    remaining === undefined
      ? { type: 'message', name: 'ok', tone: 'success', title: 'recovery.accepted.title', text: 'recovery.accepted.text' }
      : { type: 'message', name: 'ok', tone: 'success', title: 'recovery.remaining.title', text: 'recovery.accepted.text', params: { count: remaining } },
    { type: 'button', name: 'continue', label: 'recovery.continue', variant: 'primary' },
    { type: 'paragraph', name: 'noCode', text: 'recovery.noCode', tone: 'muted' },
  ];
}

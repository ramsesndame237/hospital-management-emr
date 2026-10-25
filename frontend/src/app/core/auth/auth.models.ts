/** `full` : accès complet. `setup` : session restreinte (mot de passe provisoire ou double authentification à finaliser). */
export type Scope = 'full' | 'setup';

export interface LoginCredentials {
  readonly username: string;
  readonly password: string;
  readonly totpCode?: string;
  readonly recoveryCode?: string;
}

export interface TokenResponse {
  readonly accessToken: string;
  /** ISO 8601, UTC. */
  readonly accessExpiresAt: string;
  readonly scope: Scope;
}

export type LoginResponse =
  | { readonly status: 'mfa_required' }
  | ({
      readonly status: 'authenticated';
      readonly mustChangePassword: boolean;
      readonly mfaEnrollmentRequired: boolean;
      /** Codes de secours encore valables après une connexion par code de secours ; absent tant que l'API ne le renvoie pas. */
      readonly recoveryCodesRemaining?: number;
    } & TokenResponse);

/** Secret TOTP en attente de confirmation : `keyUri` (format `otpauth://`) se transforme en QR code, `secret` se saisit à la main. */
export interface MfaEnrollment {
  readonly keyUri: string;
  readonly secret: string;
}

export interface CurrentUser {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly roles: readonly string[];
  /** `ressource:action:portée`. Sert à afficher ou masquer l'interface ; l'API revérifie toujours côté serveur. */
  readonly permissions: readonly string[];
  readonly mfaEnabled: boolean;
  readonly mfaRequired: boolean;
  readonly mustChangePassword: boolean;
  readonly scope: Scope;
}

/** Résultat d'une tentative de connexion, vu par l'interface. */
export type LoginOutcome =
  | { readonly kind: 'mfa_required' }
  | { readonly kind: 'signed_in'; readonly setupRequired: boolean; readonly recoveryCodesRemaining?: number };

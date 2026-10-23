/**
 * Vocabulaire neutre pour documenter l'API. Aucun type d'une bibliothèque de documentation (Swagger, Redoc, Scalar…)
 * n'apparaît ici : les contrôleurs et les DTO ne connaissent que ces types et les décorateurs de la façade
 * (`modules/api-docs/index.ts`). Changer de bibliothèque = réécrire le dossier `infrastructure/`, rien d'autre.
 */

export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;

export interface DocResponse {
  readonly status: number;
  readonly description: string;
  /** Classe décrivant le corps de la réponse (un DTO annoté avec `@DocProperty`). */
  readonly type?: new (...args: never[]) => object;
  readonly isArray?: boolean;
}

export interface DocParam {
  readonly name: string;
  readonly description: string;
  readonly example?: string | number;
  readonly format?: 'uuid';
  readonly required?: boolean;
}

export interface DocOperationSpec {
  /** Une ligne, à l'impératif ou au groupe nominal : « Ouvrir une session ». */
  readonly summary: string;
  /** Explications utiles à qui teste l'endpoint (pré-requis, effets de bord, particularités). Markdown accepté. */
  readonly description?: string;
  /** `bearer` : jeton d'accès requis (cadenas dans l'interface). `none` : point d'entrée public. */
  readonly auth: 'bearer' | 'none';
  readonly responses?: readonly DocResponse[];
  /** Statuts d'erreur possibles ; leur description et leur forme (`ErrorBodyDto`) sont standardisées. */
  readonly errors?: readonly HttpErrorStatus[];
  readonly params?: readonly DocParam[];
  readonly query?: readonly DocParam[];
}

export interface DocPropertySpec {
  readonly description: string;
  readonly example?: unknown;
  readonly optional?: boolean;
  readonly nullable?: boolean;
  readonly enum?: readonly string[];
  /** Type des éléments quand la propriété est une liste de classes ou de primitives. */
  readonly itemType?: (new (...args: never[]) => object) | 'string' | 'number';
  /** Type explicite (nécessaire pour une propriété de type classe ou union). */
  readonly type?: new (...args: never[]) => object;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly format?: string;
}

export interface ApiDocsOptions {
  readonly enabled: boolean;
  /**
   * Exige une connexion pour voir la documentation (par défaut : oui). Le document OpenAPI décrit tout l'inventaire de
   * l'API : le laisser public aide un attaquant. `false` réservé à un poste de développement isolé.
   */
  readonly requireLogin?: boolean;
  /** Chemin de l'interface ; le document brut est servi sur `<chemin>/json` et `<chemin>/yaml`. */
  readonly path?: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
}

/** Décision d'accès à la documentation pour un jeton d'accès donné. */
export type DocsAccessDecision =
  | { readonly allowed: true; readonly displayName: string; readonly expiresInSeconds: number }
  | { readonly allowed: false; readonly reason: 'invalid' | 'setup-required' | 'forbidden' };

/**
 * Port : « ce porteur de jeton peut-il lire la documentation ? ». Le module de documentation ne connaît ni l'IAM ni
 * les jetons ; c'est la racine de composition (`src/integration/`) qui l'implémente avec le système d'identité.
 */
export interface ApiDocsAccess {
  authorize(accessToken: string): Promise<DocsAccessDecision>;
}
export const API_DOCS_ACCESS = Symbol('API_DOCS_ACCESS');

/** Textes de la page d'accueil. Une clé de plus ici = une entrée de plus dans chaque catalogue de langue. */
export const PORTAL_TEXT_KEYS = [
  'pageTitle', 'heroTitle', 'heroLead',
  'feature1Title', 'feature1Text', 'feature2Title', 'feature2Text', 'feature3Title', 'feature3Text', 'feature4Title', 'feature4Text',
  'loginTitle', 'loginLead', 'username', 'usernamePlaceholder', 'password', 'passwordPlaceholder', 'showPassword', 'hidePassword',
  'signIn', 'signingIn', 'mfaTitle', 'mfaLead', 'mfaCode', 'mfaVerify', 'mfaUseRecovery', 'mfaUseApp', 'recoveryCode', 'back',
  'checking', 'welcome', 'redirecting', 'setupRequired', 'forbidden', 'networkError', 'genericError', 'footerNote', 'signOut', 'accessRestricted',
] as const;
export type PortalTextKey = (typeof PORTAL_TEXT_KEYS)[number];
export type PortalTexts = Readonly<Record<PortalTextKey, string>>;

export interface PortalLocalization {
  readonly locale: string;
  readonly locales: readonly string[];
  readonly texts: PortalTexts;
}

/** Port : les textes de la page, dans la langue de la requête. Sans fournisseur, le module utilise son français intégré. */
export interface PortalTextsProvider {
  forRequest(request: { query(name: string): string | undefined; header(name: string): string | undefined }): PortalLocalization;
}
export const PORTAL_TEXTS_PROVIDER = Symbol('PORTAL_TEXTS_PROVIDER');

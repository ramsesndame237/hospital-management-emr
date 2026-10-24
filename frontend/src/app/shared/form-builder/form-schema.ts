/**
 * Contrat JSON du constructeur de formulaires. Un formulaire = un TABLEAU de champs, chacun décrit par un objet JSON
 * sérialisable (jamais de fonction, jamais de classe) : il peut donc venir d'un fichier, d'un back-office ou de l'API.
 *
 * Conventions :
 *  - tout texte (`label`, `placeholder`, `hint`, `message`, `title`, `text`…) est une CLÉ de catalogue (`login.username`) ;
 *    une chaîne qui n'est pas une clé s'affiche telle quelle (message déjà traduit par l'API, par exemple) ;
 *  - `class` ajoute des classes au conteneur du champ ; `inputClass` à son champ de saisie ; `span` règle sa largeur
 *    dans la grille de 12 colonnes ; `appearance` choisit l'un des deux habillages du design ;
 *  - les règles de validation sont des objets `{ type, …paramètres, message? }` ; `message` (clé) remplace le texte par défaut.
 */

export type InputType = 'text' | 'email' | 'tel' | 'number' | 'code' | 'password' | 'textarea' | 'select' | 'checkbox' | 'radio';
export type DisplayType = 'message' | 'paragraph';
export type ActionType = 'submit' | 'button' | 'link';
export type FieldType = InputType | DisplayType | ActionType;

/** Règle de validation. Les types intégrés sont listés ; tout autre type doit être enregistré (`ValidatorRegistry.register`). */
export interface ValidatorSpec {
  readonly type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'email' | 'equalsField' | 'passwordPolicy' | (string & {});
  /** Clé de catalogue du message d'erreur ; à défaut, le message standard du type (partagé avec l'API quand il existe). */
  readonly message?: string;
  /** Paramètre numérique ou texte de la règle (`minLength: 12`, `pattern: '^\\d{6}$'`). */
  readonly value?: number | string;
  readonly flags?: string;
  /** `equalsField` : nom du champ à égaler. */
  readonly field?: string;
  /** `passwordPolicy` : règles à appliquer et champs dont la valeur est interdite dans le mot de passe. */
  readonly rules?: readonly ('notCommon' | 'noIdentity')[];
  readonly identityFields?: readonly string[];
  /** `passwordPolicy` : valeurs interdites connues d'avance (identifiant et e-mail de la session, par exemple). */
  readonly identityValues?: readonly string[];
  readonly [param: string]: unknown;
}

/** Condition d'affichage ou d'activation, évaluée sur la valeur courante d'un autre champ. */
export interface Condition {
  readonly field: string;
  readonly equals?: unknown;
  readonly notEquals?: unknown;
  readonly in?: readonly unknown[];
  readonly truthy?: boolean;
}

export type Normalizer = 'trim' | 'lowercase' | 'uppercase' | 'digits';
export type Appearance = 'default' | 'boxed';
export type Tone = 'info' | 'success' | 'warning' | 'critical';
export type ColumnSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface FieldBase {
  readonly type: FieldType;
  /** Identifiant unique dans le formulaire : clé de la valeur pour une saisie, identifiant d'action pour un bouton. */
  readonly name: string;
  readonly class?: string;
  readonly span?: ColumnSpan;
  readonly showIf?: Condition;
}

interface InputBase extends FieldBase {
  readonly type: InputType;
  readonly label?: string;
  readonly placeholder?: string;
  readonly hint?: string;
  /** Valeur initiale. */
  readonly value?: unknown;
  readonly validators?: readonly ValidatorSpec[];
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly disabledIf?: Condition;
  readonly autocomplete?: string;
  readonly autofocus?: boolean;
  readonly inputClass?: string;
  readonly appearance?: Appearance;
  /** Transformation appliquée à la valeur au moment de l'envoi (jamais pendant la frappe). */
  readonly normalize?: Normalizer;
}

export interface TextField extends InputBase {
  readonly type: 'text' | 'email' | 'tel' | 'number' | 'code';
  readonly inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal';
}

export interface PasswordField extends InputBase {
  readonly type: 'password';
  /** Bouton « Afficher / Masquer » (activé par défaut). */
  readonly revealable?: boolean;
  /** Jauge de force et liste des règles quand une règle `passwordPolicy` est présente (activé par défaut). */
  readonly showPolicy?: boolean;
}

export interface TextareaField extends InputBase {
  readonly type: 'textarea';
  readonly rows?: number;
}

export interface OptionSpec {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface ChoiceField extends InputBase {
  readonly type: 'select' | 'radio';
  readonly options: readonly OptionSpec[];
}

export interface CheckboxField extends InputBase {
  readonly type: 'checkbox';
}

export interface MessageField extends FieldBase {
  readonly type: 'message';
  readonly tone: Tone;
  readonly title: string;
  readonly text?: string;
  readonly params?: Readonly<Record<string, string | number>>;
  /** `inset` : fond de page, filet épais à gauche (écrans d'authentification). `outlined` : fond de carte, cadre de la couleur du ton. */
  readonly appearance?: 'inset' | 'outlined';
  /** `alert` annonce le message immédiatement aux lecteurs d'écran ; `status` poliment. */
  readonly role?: 'alert' | 'status';
}

export interface ParagraphField extends FieldBase {
  readonly type: 'paragraph';
  readonly text: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly tone?: Tone | 'muted';
  readonly mono?: boolean;
  /** `sm` : texte courant de 14 px ; `xs` (défaut) : note de 12 px. */
  readonly size?: 'sm' | 'xs';
}

export interface SubmitField extends FieldBase {
  readonly type: 'submit';
  readonly label: string;
  /** Texte affiché pendant l'envoi. */
  readonly busyLabel?: string;
  readonly variant?: ButtonVariant;
  /** Identifiant d'un AUTRE formulaire à envoyer (attribut HTML `form`) : permet de placer le bouton hors du formulaire, dans un autre bloc de l'écran. */
  readonly form?: string;
}

export interface ButtonField extends FieldBase {
  readonly type: 'button' | 'link';
  readonly label: string;
  readonly variant?: ButtonVariant;
  /** Identifiant renvoyé par l'événement `action` du formulaire. Par défaut : `name`. */
  readonly action?: string;
  /** Pour `link` : adresse interne (routage Angular). */
  readonly routerLink?: string;
}

export type ButtonVariant = 'primary' | 'outline' | 'link';

export type FieldSchema =
  | TextField
  | PasswordField
  | TextareaField
  | ChoiceField
  | CheckboxField
  | MessageField
  | ParagraphField
  | SubmitField
  | ButtonField;

export type InputFieldSchema = TextField | PasswordField | TextareaField | ChoiceField | CheckboxField;

const INPUT_TYPES: readonly FieldType[] = ['text', 'email', 'tel', 'number', 'code', 'password', 'textarea', 'select', 'checkbox', 'radio'];

/** Vrai pour un champ qui porte une valeur (par opposition à un message, un paragraphe ou un bouton). */
export function isInputField(field: FieldSchema): field is InputFieldSchema {
  return INPUT_TYPES.includes(field.type);
}

/** Présentation globale du formulaire. */
export interface FormLayout {
  /** Classes ajoutées à l'élément `<form>`. */
  readonly class?: string;
  /** Espacement entre champs (classe Tailwind `gap-*`) ; `gap-5` (20 px) par défaut, comme dans le design. */
  readonly gap?: string;
}

/** Événement émis par un bouton ou un lien du formulaire. */
export interface FormAction {
  readonly action: string;
  readonly value: Readonly<Record<string, unknown>>;
}

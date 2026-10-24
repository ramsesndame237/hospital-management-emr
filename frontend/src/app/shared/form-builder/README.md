# Constructeur de formulaires (JSON)

Tous les formulaires de l'application se décrivent par **un tableau JSON** : un objet par champ. Le composant
`<app-form-builder>` en déduit l'affichage, la validation, les messages d'erreur (dans la langue courante), l'accessibilité
et l'envoi. L'aspect d'un champ est défini **à un seul endroit** (`field-styles.ts`) : le modifier le change dans tous les formulaires.

```html
<app-form-builder [fields]="fields" [busy]="submitting()" formId="login" (submitted)="onSubmit($event)" (action)="onAction($event)" />
```

```ts
const fields: FieldSchema[] = [
  { type: 'text', name: 'username', label: 'login.username', autofocus: true, normalize: 'trim',
    validators: [{ type: 'required', message: 'login.errors.usernameRequired' }, { type: 'maxLength', value: 64 }] },
  { type: 'password', name: 'password', label: 'login.password', autocomplete: 'current-password',
    validators: [{ type: 'required' }] },
  { type: 'submit', name: 'submit', label: 'login.submit', busyLabel: 'login.submitting' },
];
```

## Contrat (`form-schema.ts`)

| Propriété | Rôle |
|---|---|
| `type` | `text` `email` `tel` `number` `code` `password` `textarea` `select` `radio` `checkbox` · `message` `paragraph` · `submit` `button` `link` |
| `name` | Identifiant unique : clé de la valeur (saisie) ou de l'action (bouton) |
| `label` `placeholder` `hint` | **Clés de catalogue** (`login.username`). Un texte qui n'est pas une clé s'affiche tel quel (message déjà traduit par l'API) |
| `validators` | `[{ type, value?, message? }]` : `required` `minLength` `maxLength` `min` `max` `pattern` `email` `equalsField` `passwordPolicy` |
| `class` / `inputClass` | Classes ajoutées au conteneur du champ / à son élément de saisie (fusionnées avec Tailwind : les vôtres gagnent) |
| `span` | Largeur sur 12 colonnes dès l'écran « sm » (`span: 6` = moitié) |
| `appearance` | `default` (étiquette au-dessus) ou `boxed` (étiquette dans le cadre, fiches) |
| `showIf` / `disabledIf` | Condition sur un autre champ : `{ field, equals \| notEquals \| in \| truthy }`. Un champ masqué n'est ni validé ni envoyé |
| `normalize` | `trim` `lowercase` `uppercase` `digits`, appliqué **à l'envoi** (jamais pendant la frappe) |
| `value` | Valeur initiale |

Particularités : `password` affiche « Afficher/Masquer » et, avec une règle `passwordPolicy`, la jauge de force et la liste des règles
(`{ type: 'passwordPolicy', value: 12, rules: ['notCommon', 'noIdentity'], identityFields: ['username'], identityValues: [email] }`).
`submit` accepte `form: 'autre-formulaire'` pour envoyer un AUTRE formulaire (bouton placé ailleurs dans la page).

Le composant : entrées `fields` (obligatoire), `layout` (`{ class, gap }`), `data` (valeurs à appliquer), `busy`, `formId` ;
sorties `submitted` (valeurs normalisées, formulaire valide), `invalidSubmit`, `action` (bouton/lien), `valueChange` ;
méthodes `reset(values?)`, `focus(name)`, `applyServerErrors(errors)`, `value()`, `submit()`.

## Messages d'erreur et synchronisation avec le backend

- Sans `message` explicite, la phrase vient du catalogue **`server.validation.*`**, généré depuis les catalogues du backend
  (`npm run i18n:sync`) : le même contrôle s'énonce de la même façon qu'il soit détecté dans le navigateur ou par l'API.
  Le nom du champ vient de `server.fields.<name>`, sinon de son libellé.
- Une erreur `VALIDATION_FAILED` de l'API s'affiche sur le champ concerné : `form.applyServerErrors(apiError.fieldErrors)`.
  Elle disparaît dès que l'utilisateur modifie le champ.
- La langue de l'interface est envoyée à l'API (`X-Locale`) : les messages du serveur arrivent déjà traduits.
- `npm run i18n:check` (CI) échoue si les catalogues partagés ne sont plus à jour par rapport au backend.

## Étendre sans modifier le constructeur

```ts
// Nouvelle règle de validation → utilisable dans tout JSON : { "type": "iban" }
inject(ValidatorRegistry).register('iban', { create: () => (control) => (isIban(control.value) ? null : { iban: true }) });

// Nouveau type de champ → { "type": "patient", "name": "patientId" }
@Component({ selector: 'app-patient-field', template: '…' })
class PatientField extends InputRenderer {}
inject(FieldRegistry).register('patient', PatientField);
```

Un type de champ ou une règle inconnus lèvent une erreur explicite à l'affichage (pas d'échec silencieux).

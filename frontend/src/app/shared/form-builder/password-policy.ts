import { ValidatorSpec } from './form-schema';

/**
 * Règles de mot de passe vérifiables dans le navigateur, pour guider la saisie en direct. Elles reflètent la politique du
 * backend (12 caractères minimum, ni courant, ni dérivé de l'identifiant) mais ne la remplacent pas : le serveur reste
 * l'autorité (et contrôle en plus les fuites connues, ce que le navigateur ne fait volontairement pas).
 */
export type PolicyRule = 'minLength' | 'notCommon' | 'noIdentity';

export const DEFAULT_MIN_LENGTH = 12;

/** Échantillon de mots de passe très répandus ; la liste complète vit côté serveur. Comparaison sans casse ni chiffres finaux. */
const COMMON = new Set([
  'password', 'motdepasse', 'azerty', 'azertyuiop', 'qwerty', 'qwertyuiop', 'abcdef', 'abcdefgh', 'letmein', 'welcome',
  'bienvenue', 'admin', 'administrator', 'sanjeevani', 'hopital', 'hospital', 'medecin', 'doctor', 'infirmier', 'changeme',
  'iloveyou', 'monkey', 'dragon', 'soleil', 'camerounais', 'douala', 'yaounde', 'football', 'master', 'login',
]);

/** Suites de touches ou de chiffres (le chiffre 0 boucle sur 1, d'où la répétition de la suite numérique). */
const SEQUENCES = ['01234567890123456789', 'abcdefghijklmnopqrstuvwxyz', 'azertyuiopqsdfghjklmwxcvbn', 'qwertyuiopasdfghjklzxcvbnm'];

function isCommon(password: string): boolean {
  const lower = password.toLowerCase();
  const stem = lower.replace(/[\d!@#$%^&*._-]+$/, '');
  if (COMMON.has(lower) || COMMON.has(stem)) return true;
  if (/^(.)\1+$/.test(lower)) return true; // « aaaaaaaaaaaa »
  return SEQUENCES.some((s) => s.includes(lower) || [...s].reverse().join('').includes(lower)); // « 123456789012 », « azertyuiop »
}

/** Fragments d'identité à interdire : l'identifiant, l'adresse complète et la partie avant `@`. */
function identityFragments(values: readonly string[]): string[] {
  return values
    .flatMap((v) => [v, v.split('@')[0]])
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length >= 3);
}

/** Valeurs d'identité à interdire dans le mot de passe : celles déclarées en JSON et celles lues dans les champs voisins. */
export function identityValuesOf(spec: ValidatorSpec, read: (fieldName: string) => string): string[] {
  return [...(spec.identityValues ?? []), ...(spec.identityFields ?? []).map(read)];
}

export interface PolicyContext {
  readonly identityValues: readonly string[];
}

export function evaluateRule(rule: PolicyRule, password: string, spec: ValidatorSpec, context: PolicyContext): boolean {
  switch (rule) {
    case 'minLength':
      return password.length >= policyMinLength(spec);
    case 'notCommon':
      return !isCommon(password);
    case 'noIdentity': {
      const lower = password.toLowerCase();
      return !identityFragments(context.identityValues).some((fragment) => lower.includes(fragment));
    }
  }
}

export function policyMinLength(spec: ValidatorSpec): number {
  return typeof spec.value === 'number' ? spec.value : DEFAULT_MIN_LENGTH;
}

/** Règles actives d'une spécification : la longueur est toujours contrôlée, les autres sont à la carte. */
export function activeRules(spec: ValidatorSpec): readonly PolicyRule[] {
  return ['minLength', ...(spec.rules ?? [])];
}

/** Règles non respectées, dans l'ordre d'affichage. Vide si le champ est vide (le « requis » s'en charge). */
export function unmetRules(password: string, spec: ValidatorSpec, context: PolicyContext): readonly PolicyRule[] {
  if (password === '') return [];
  return activeRules(spec).filter((rule) => !evaluateRule(rule, password, spec, context));
}

export type Strength = 0 | 1 | 2 | 3 | 4;

/**
 * Force de 0 (vide) à 4. Récompense la longueur et la variété ; un mot de passe qui enfreint la politique ne dépasse jamais
 * « faible » : la jauge ne doit pas féliciter ce que le serveur refusera.
 */
export function strengthOf(password: string, unmet: readonly PolicyRule[]): Strength {
  if (password === '') return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (unmet.length > 0) return 1;
  const points = Number(password.length >= 12) + Number(password.length >= 16) + Number(classes >= 3);
  return Math.min(1 + points, 4) as Strength;
}

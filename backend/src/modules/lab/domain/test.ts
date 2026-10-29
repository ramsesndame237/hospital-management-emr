import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Container, RangeSex, ResultType, Section, SpecimenType, TestCode, TestId, TestName } from './values';

const MAX_AGE_DAYS = 55_000; // ~150 ans
export const MAX_RANGES = 20;

/**
 * Valeurs de référence d'une analyse numérique pour une tranche d'âge (en jours) et un sexe. Un résultat hors de `low`–`high` est
 * signalé L ou H ; hors de `criticalLow`–`criticalHigh` il est critique (et ne peut être publié qu'après appel du clinicien).
 */
export interface ReferenceRange {
  readonly sex: RangeSex;
  /** Âge minimal inclus, en jours. */
  readonly ageMinDays: number;
  /** Âge maximal exclu, en jours ; `null` : sans limite. */
  readonly ageMaxDays: number | null;
  readonly low: number | null;
  readonly high: number | null;
  readonly criticalLow: number | null;
  readonly criticalHigh: number | null;
}

const invalid = (message: string, params: Record<string, string | number> = {}): Result<never> => err(new DomainError('LAB_RANGE_INVALID', message, params));
const finite = (n: number | null): boolean => n === null || (typeof n === 'number' && Number.isFinite(n));

/** Contrôle un jeu de valeurs de référence : tranches cohérentes, seuils ordonnés, aucune tranche qui en chevauche une autre pour le même sexe. */
export function validateRanges(ranges: readonly ReferenceRange[]): Result<readonly ReferenceRange[]> {
  if (ranges.length > MAX_RANGES) return invalid(`Au plus ${MAX_RANGES} tranches de valeurs de référence.`, { max: MAX_RANGES });
  for (const r of ranges) {
    if (!Number.isInteger(r.ageMinDays) || r.ageMinDays < 0 || r.ageMinDays > MAX_AGE_DAYS) return invalid("L'âge minimal doit être un nombre entier de jours, de 0 à 55 000.");
    if (r.ageMaxDays !== null && (!Number.isInteger(r.ageMaxDays) || r.ageMaxDays <= r.ageMinDays || r.ageMaxDays > MAX_AGE_DAYS)) {
      return invalid("L'âge maximal doit être supérieur à l'âge minimal (en jours entiers).");
    }
    if (![r.low, r.high, r.criticalLow, r.criticalHigh].every(finite)) return invalid('Les valeurs de référence doivent être des nombres.');
    if (r.low === null && r.high === null) return invalid('Une tranche donne au moins une limite basse ou une limite haute.');
    if (r.low !== null && r.high !== null && r.low > r.high) return invalid('La limite basse ne peut pas dépasser la limite haute.');
    if (r.criticalLow !== null && r.low !== null && r.criticalLow > r.low) return invalid('Le seuil critique bas ne peut pas dépasser la limite basse.');
    if (r.criticalHigh !== null && r.high !== null && r.criticalHigh < r.high) return invalid('Le seuil critique haut ne peut pas être inférieur à la limite haute.');
  }
  const sorted = [...ranges].sort((a, b) => a.sex.localeCompare(b.sex) || a.ageMinDays - b.ageMinDays);
  for (let i = 1; i < sorted.length; i++) {
    const before = sorted[i - 1];
    const now = sorted[i];
    if (before.sex === now.sex && (before.ageMaxDays === null || before.ageMaxDays > now.ageMinDays)) return invalid('Deux tranches du même sexe ne peuvent pas se chevaucher.');
  }
  return ok(sorted);
}

export interface TestState {
  readonly id: TestId;
  readonly code: TestCode;
  readonly name: TestName;
  readonly section: Section;
  readonly specimenType: SpecimenType;
  readonly container: Container;
  readonly resultType: ResultType;
  /** Unité d'une analyse numérique (g/dL, mmol/L…). */
  readonly unit: string | null;
  /** Décimales affichées d'un résultat numérique. */
  readonly decimals: number;
  /** Valeurs admises d'une analyse à choix (positif, négatif…). */
  readonly choices: readonly string[];
  /** Délai de rendu visé en routine, en minutes. */
  readonly tatMinutes: number;
  readonly instructions: string | null;
  readonly ranges: readonly ReferenceRange[];
  readonly active: boolean;
}

/** Les règles qui lient le type de résultat à ses compléments (unité, choix, valeurs de référence). */
function consistent(s: Omit<TestState, 'active'>): Result<void> {
  if (!Number.isInteger(s.decimals) || s.decimals < 0 || s.decimals > 4) return err(new DomainError('LAB_TEST_DECIMALS_INVALID', 'Le nombre de décimales doit être un entier de 0 à 4.'));
  if (!Number.isInteger(s.tatMinutes) || s.tatMinutes < 1 || s.tatMinutes > 43_200) return err(new DomainError('LAB_TEST_TAT_INVALID', 'Le délai de rendu doit être de 1 à 43 200 minutes.'));
  if (s.unit !== null && (s.unit.length < 1 || s.unit.length > 20)) return err(new DomainError('LAB_TEST_UNIT_INVALID', "L'unité doit comporter de 1 à 20 caractères."));
  if (s.instructions !== null && s.instructions.length > 500) return err(new DomainError('LAB_NOTES_INVALID', 'Le texte ne doit pas dépasser 500 caractères.'));
  if (s.resultType === 'NUMERIC') {
    if (s.choices.length > 0) return err(new DomainError('LAB_TEST_CHOICES_INVALID', "Une analyse numérique n'a pas de liste de choix."));
  } else {
    if (s.unit !== null) return err(new DomainError('LAB_TEST_UNIT_INVALID', "Seule une analyse numérique a une unité."));
    if (s.ranges.length > 0) return err(new DomainError('LAB_RANGE_INVALID', "Seule une analyse numérique a des valeurs de référence."));
  }
  if (s.resultType === 'CHOICE') {
    const unique = new Set(s.choices.map((c) => c.toLowerCase()));
    if (s.choices.length < 2 || s.choices.length > 20 || unique.size !== s.choices.length || s.choices.some((c) => c.length < 1 || c.length > 40)) {
      return err(new DomainError('LAB_TEST_CHOICES_INVALID', 'Une analyse à choix propose de 2 à 20 valeurs distinctes de 40 caractères au plus.'));
    }
  } else if (s.choices.length > 0) {
    return err(new DomainError('LAB_TEST_CHOICES_INVALID', "Seule une analyse à choix a une liste de valeurs."));
  }
  return ok(undefined);
}

/**
 * Analyse du catalogue (numération, glycémie, culture d'urine…). Le code et le type de résultat ne changent jamais : les demandes et,
 * plus tard, les résultats y renvoient. Rien n'est supprimé : une analyse retirée se désactive et ne peut plus être demandée.
 */
export class LabTest {
  private constructor(private current: TestState) {}

  static restore(state: TestState): LabTest {
    return new LabTest(state);
  }

  static create(state: Omit<TestState, 'active'>): Result<LabTest> {
    const ok1 = consistent(state);
    if (!ok1.ok) return err(ok1.error);
    if (state.ranges.length > 0) {
      const valid = validateRanges(state.ranges);
      if (!valid.ok) return err(valid.error);
      return ok(new LabTest({ ...state, ranges: valid.value, active: true }));
    }
    return ok(new LabTest({ ...state, active: true }));
  }

  get state(): TestState { return this.current; }
  get id(): TestId { return this.current.id; }
  get active(): boolean { return this.current.active; }

  /** Champs absents : inchangés. `unit`, `instructions` à `null` : effacés. Le code et le type de résultat ne changent pas. */
  update(changes: Partial<Pick<TestState, 'name' | 'section' | 'specimenType' | 'container' | 'unit' | 'decimals' | 'choices' | 'tatMinutes' | 'instructions'>>): Result<void> {
    const next = { ...this.current, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) } as TestState;
    const valid = consistent(next);
    if (!valid.ok) return valid;
    this.current = next;
    return ok(undefined);
  }

  /** Remplace les valeurs de référence (analyse numérique seulement). */
  setRanges(ranges: readonly ReferenceRange[]): Result<void> {
    if (this.current.resultType !== 'NUMERIC') return err(new DomainError('LAB_RANGE_INVALID', 'Seule une analyse numérique a des valeurs de référence.'));
    const valid = validateRanges(ranges);
    if (!valid.ok) return err(valid.error);
    this.current = { ...this.current, ranges: valid.value };
    return ok(undefined);
  }

  setActive(active: boolean): void {
    this.current = { ...this.current, active };
  }
}

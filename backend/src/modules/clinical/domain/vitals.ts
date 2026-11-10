import { DomainError, err, ok, Result } from '../../../shared-kernel/result';

/** Constantes relevées lors d'une consultation. Chaque mesure est facultative, mais il faut en donner au moins une. */
export interface Vitals {
  /** °C, une décimale. */
  readonly temperature: number | null;
  /** Battements par minute. */
  readonly pulse: number | null;
  /** Pression artérielle, mmHg. */
  readonly systolic: number | null;
  readonly diastolic: number | null;
  /** Mouvements respiratoires par minute. */
  readonly respiratoryRate: number | null;
  /** Saturation en oxygène, %. */
  readonly spo2: number | null;
  /** kg, une décimale. */
  readonly weightKg: number | null;
  /** cm, une décimale. */
  readonly heightCm: number | null;
}

export type VitalsInput = { readonly [K in keyof Vitals]?: number | null };

interface Rule {
  readonly key: keyof Vitals;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly decimals: 0 | 1;
}

const RULES: readonly Rule[] = [
  { key: 'temperature', label: 'La température', min: 30, max: 45, decimals: 1 },
  { key: 'pulse', label: 'Le pouls', min: 20, max: 300, decimals: 0 },
  { key: 'systolic', label: 'La pression systolique', min: 40, max: 300, decimals: 0 },
  { key: 'diastolic', label: 'La pression diastolique', min: 20, max: 200, decimals: 0 },
  { key: 'respiratoryRate', label: 'La fréquence respiratoire', min: 4, max: 80, decimals: 0 },
  { key: 'spo2', label: 'La saturation en oxygène', min: 50, max: 100, decimals: 0 },
  { key: 'weightKg', label: 'Le poids', min: 0.3, max: 500, decimals: 1 },
  { key: 'heightCm', label: 'La taille', min: 20, max: 260, decimals: 1 },
];

/** Valide un relevé : bornes plausibles, décimales permises, diastolique inférieure à la systolique, au moins une mesure. */
export function createVitals(input: VitalsInput): Result<Vitals> {
  const out: Record<string, number | null> = {};
  for (const rule of RULES) {
    const raw = input[rule.key];
    if (raw === undefined || raw === null) {
      out[rule.key] = null;
      continue;
    }
    const scaled = raw * 10 ** rule.decimals;
    if (!Number.isFinite(raw) || Math.abs(scaled - Math.round(scaled)) > 1e-9 || raw < rule.min || raw > rule.max) {
      return err(new DomainError('CLINICAL_VITAL_INVALID', `${rule.label} doit être un nombre de ${rule.min} à ${rule.max}${rule.decimals === 0 ? ' (entier)' : ' (une décimale au plus)'}.`, { field: rule.key, min: rule.min, max: rule.max }));
    }
    out[rule.key] = raw;
  }
  const vitals = out as unknown as Vitals;
  if (RULES.every((r) => vitals[r.key] === null)) return err(new DomainError('CLINICAL_VITALS_EMPTY', 'Renseignez au moins une constante.'));
  if ((vitals.systolic === null) !== (vitals.diastolic === null)) return err(new DomainError('CLINICAL_BLOOD_PRESSURE_INCOMPLETE', 'La pression artérielle se donne en entier : systolique et diastolique.'));
  if (vitals.systolic !== null && vitals.diastolic !== null && vitals.diastolic >= vitals.systolic) {
    return err(new DomainError('CLINICAL_BLOOD_PRESSURE_INVALID', 'La pression diastolique doit être inférieure à la systolique.'));
  }
  return ok(vitals);
}

/** Indice de masse corporelle (kg/m²), une décimale ; `null` s'il manque le poids ou la taille. */
export function bodyMassIndex(v: Pick<Vitals, 'weightKg' | 'heightCm'>): number | null {
  if (v.weightKg === null || v.heightCm === null) return null;
  const meters = v.heightCm / 100;
  return Math.round((v.weightKg / (meters * meters)) * 10) / 10;
}

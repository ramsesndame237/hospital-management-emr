/**
 * NEWS2 (National Early Warning Score 2, Royal College of Physicians, 2017), échelle 1 de saturation. Un score agrège sept paramètres ; il sert à repérer
 * un patient qui se dégrade et à décider qui appeler. Fonction pure : le même relevé donne toujours le même score.
 */
export const CONSCIOUSNESS_LEVELS = ['ALERT', 'CONFUSION', 'VOICE', 'PAIN', 'UNRESPONSIVE'] as const;
export type Consciousness = (typeof CONSCIOUSNESS_LEVELS)[number];

export interface Vitals {
  readonly temperature: number;
  readonly pulse: number;
  readonly systolic: number;
  readonly respiratoryRate: number;
  readonly spo2: number;
  readonly supplementalOxygen: boolean;
  readonly consciousness: Consciousness;
}

export type Risk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface News2Result {
  readonly score: number;
  readonly risk: Risk;
  /** Un seul paramètre à 3 suffit à justifier une réponse rapide même si le total reste bas. */
  readonly extremeParameter: boolean;
}

export function news2(v: Vitals): News2Result {
  const parts = [
    // fréquence respiratoire
    v.respiratoryRate <= 8 ? 3 : v.respiratoryRate <= 11 ? 1 : v.respiratoryRate <= 20 ? 0 : v.respiratoryRate <= 24 ? 2 : 3,
    // saturation (échelle 1)
    v.spo2 <= 91 ? 3 : v.spo2 <= 93 ? 2 : v.spo2 <= 95 ? 1 : 0,
    // oxygène supplémentaire
    v.supplementalOxygen ? 2 : 0,
    // pression systolique
    v.systolic <= 90 ? 3 : v.systolic <= 100 ? 2 : v.systolic <= 110 ? 1 : v.systolic <= 219 ? 0 : 3,
    // pouls
    v.pulse <= 40 ? 3 : v.pulse <= 50 ? 1 : v.pulse <= 90 ? 0 : v.pulse <= 110 ? 1 : v.pulse <= 130 ? 2 : 3,
    // conscience
    v.consciousness === 'ALERT' ? 0 : 3,
    // température
    v.temperature <= 35.0 ? 3 : v.temperature <= 36.0 ? 1 : v.temperature <= 38.0 ? 0 : v.temperature <= 39.0 ? 1 : 2,
  ];
  const score = parts.reduce((a, b) => a + b, 0);
  const extremeParameter = parts.some((p) => p === 3);
  const risk: Risk = score >= 7 ? 'HIGH' : score >= 5 || extremeParameter ? 'MEDIUM' : 'LOW';
  return { score, risk, extremeParameter };
}

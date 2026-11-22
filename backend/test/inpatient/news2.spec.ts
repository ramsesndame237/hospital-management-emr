import { news2, Vitals } from '../../src/modules/inpatient/domain/news2';

const NORMAL: Vitals = { temperature: 37, pulse: 70, systolic: 120, respiratoryRate: 16, spo2: 98, supplementalOxygen: false, consciousness: 'ALERT' };
const score = (over: Partial<Vitals>) => news2({ ...NORMAL, ...over });

describe('NEWS2 (score d\'alerte précoce)', () => {
  it('un patient dont tout est normal a 0 : risque faible', () => {
    expect(score({})).toEqual({ score: 0, risk: 'LOW', extremeParameter: false });
  });

  it('additionne les sept paramètres : le pire cas fait 20', () => {
    const worst = score({ respiratoryRate: 28, spo2: 88, supplementalOxygen: true, systolic: 80, pulse: 140, consciousness: 'VOICE', temperature: 34 });
    // 3 + 3 + 2 + 3 + 3 + 3 + 3
    expect(worst).toEqual({ score: 20, risk: 'HIGH', extremeParameter: true });
  });

  it.each([
    // fréquence respiratoire : ≤8 → 3 ; 9-11 → 1 ; 12-20 → 0 ; 21-24 → 2 ; ≥25 → 3
    [{ respiratoryRate: 8 }, 3], [{ respiratoryRate: 9 }, 1], [{ respiratoryRate: 11 }, 1], [{ respiratoryRate: 12 }, 0], [{ respiratoryRate: 20 }, 0], [{ respiratoryRate: 21 }, 2], [{ respiratoryRate: 24 }, 2], [{ respiratoryRate: 25 }, 3],
    // saturation (échelle 1) : ≤91 → 3 ; 92-93 → 2 ; 94-95 → 1 ; ≥96 → 0
    [{ spo2: 91 }, 3], [{ spo2: 92 }, 2], [{ spo2: 93 }, 2], [{ spo2: 94 }, 1], [{ spo2: 95 }, 1], [{ spo2: 96 }, 0],
    // oxygène supplémentaire
    [{ supplementalOxygen: true }, 2],
    // pression systolique : ≤90 → 3 ; 91-100 → 2 ; 101-110 → 1 ; 111-219 → 0 ; ≥220 → 3
    [{ systolic: 90 }, 3], [{ systolic: 91 }, 2], [{ systolic: 100 }, 2], [{ systolic: 101 }, 1], [{ systolic: 110 }, 1], [{ systolic: 111 }, 0], [{ systolic: 219 }, 0], [{ systolic: 220 }, 3],
    // pouls : ≤40 → 3 ; 41-50 → 1 ; 51-90 → 0 ; 91-110 → 1 ; 111-130 → 2 ; ≥131 → 3
    [{ pulse: 40 }, 3], [{ pulse: 41 }, 1], [{ pulse: 50 }, 1], [{ pulse: 51 }, 0], [{ pulse: 90 }, 0], [{ pulse: 91 }, 1], [{ pulse: 110 }, 1], [{ pulse: 111 }, 2], [{ pulse: 130 }, 2], [{ pulse: 131 }, 3],
    // conscience : seule « alerte » vaut 0
    [{ consciousness: 'CONFUSION' }, 3], [{ consciousness: 'VOICE' }, 3], [{ consciousness: 'PAIN' }, 3], [{ consciousness: 'UNRESPONSIVE' }, 3],
    // température : ≤35,0 → 3 ; 35,1-36,0 → 1 ; 36,1-38,0 → 0 ; 38,1-39,0 → 1 ; ≥39,1 → 2
    [{ temperature: 35.0 }, 3], [{ temperature: 35.1 }, 1], [{ temperature: 36.0 }, 1], [{ temperature: 36.1 }, 0], [{ temperature: 38.0 }, 0], [{ temperature: 38.1 }, 1], [{ temperature: 39.0 }, 1], [{ temperature: 39.1 }, 2],
  ] as [Partial<Vitals>, number][])('un seul paramètre %j vaut %i point(s)', (over, expected) => {
    expect(score(over).score).toBe(expected);
  });

  it('un seul paramètre à 3 suffit à un risque moyen, même si le total reste bas', () => {
    expect(score({ systolic: 85 })).toEqual({ score: 3, risk: 'MEDIUM', extremeParameter: true });
  });

  it('5 ou 6 : risque moyen ; 7 et plus : risque élevé (appeler le médecin sans attendre)', () => {
    expect(score({ respiratoryRate: 22, spo2: 94, supplementalOxygen: true }).risk).toBe('MEDIUM'); // 2 + 1 + 2 = 5
    expect(score({ respiratoryRate: 22, spo2: 94, supplementalOxygen: true, pulse: 95, temperature: 38.5 })).toMatchObject({ score: 7, risk: 'HIGH' });
  });

  it('4 ou moins sans paramètre extrême : risque faible', () => {
    expect(score({ respiratoryRate: 22, spo2: 94, pulse: 95 })).toEqual({ score: 4, risk: 'LOW', extremeParameter: false });
  });
});

import { LabTest, ReferenceRange, validateRanges } from '../../src/modules/lab/domain/test';
import { checkTests, Requisition, specimenCount, TestToOrder } from '../../src/modules/lab/domain/requisition';
import {
  parseContainer, parsePriority, parseRejectionReason, parseSection, parseSource, parseSpecimenType, PatientRef, Reason, RequisitionId, RequisitionNumber, SpecimenBarcode, SpecimenId, TestCode, TestId, TestName,
} from '../../src/modules/lab/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';

const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const TECH = uuid(20);
const range = (over: Partial<ReferenceRange> = {}): ReferenceRange => ({ sex: 'ANY', ageMinDays: 0, ageMaxDays: null, low: 12, high: 16, criticalLow: 7, criticalHigh: 20, ...over });

describe('laboratoire : valeurs et énumérations', () => {
  it('normalise les codes et refuse les codes invalides', () => {
    expect(must(TestCode.create(' hgb ')).value).toBe('HGB');
    for (const bad of ['', 'a b', '-X', 'x'.repeat(21), 'é']) expect(codeOf(TestCode.create(bad))).toBe('LAB_TEST_CODE_INVALID');
  });

  it('valide les libellés (1 à 120 caractères, espaces écrasés)', () => {
    expect(must(TestName.create('  Numération   formule ')).value).toBe('Numération formule');
    expect(codeOf(TestName.create(' '))).toBe('LAB_TEST_NAME_INVALID');
    expect(codeOf(TestName.create('x'.repeat(121)))).toBe('LAB_TEST_NAME_INVALID');
  });

  it('numéros de demande et codes-barres : format fixe, construits depuis une séquence', () => {
    expect(must(RequisitionNumber.fromSequence(42)).value).toBe('LAB-0000042');
    expect(must(SpecimenBarcode.fromSequence(7)).value).toBe('SPC-0000007');
    expect(codeOf(RequisitionNumber.create('FAC-0000001'))).toBe('LAB_REQUISITION_NUMBER_INVALID');
    expect(codeOf(SpecimenBarcode.create('123'))).toBe('LAB_BARCODE_INVALID');
    expect(must(SpecimenBarcode.create(' spc-0000007 ')).value).toBe('SPC-0000007');
  });

  it('énumérations : insensibles à la casse, refus des valeurs inconnues', () => {
    expect(must(parseSection(' haematology '))).toBe('HAEMATOLOGY');
    expect(must(parseSpecimenType('urine'))).toBe('URINE');
    expect(must(parseContainer('light_blue'))).toBe('LIGHT_BLUE');
    expect(must(parsePriority('stat'))).toBe('STAT');
    expect(must(parseSource('er'))).toBe('ER');
    expect(must(parseRejectionReason('hemolysed'))).toBe('HEMOLYSED');
    expect(codeOf(parseSection('X'))).toBe('LAB_SECTION_INVALID');
    expect(codeOf(parsePriority('NOW'))).toBe('LAB_PRIORITY_INVALID');
    expect(codeOf(parseRejectionReason('LOST'))).toBe('LAB_REJECTION_REASON_INVALID');
  });

  it('un motif fait de 1 à 200 caractères', () => {
    expect(codeOf(Reason.create('  '))).toBe('LAB_REASON_REQUIRED');
    expect(codeOf(Reason.create('x'.repeat(201)))).toBe('LAB_REASON_REQUIRED');
    expect(codeOf(Reason.create('Erreur'))).toBe('OK');
  });
});

describe('laboratoire : valeurs de référence', () => {
  it('accepte des tranches cohérentes, triées par sexe puis âge', () => {
    const ranges = must(validateRanges([range({ sex: 'MALE', ageMinDays: 6574 }), range({ sex: 'FEMALE', ageMinDays: 6574, low: 11.5 }), range({ sex: 'MALE', ageMinDays: 0, ageMaxDays: 6574 })]));
    expect(ranges.map((r) => `${r.sex}:${r.ageMinDays}`)).toEqual(['FEMALE:6574', 'MALE:0', 'MALE:6574']);
  });

  it.each([
    ['âge minimal négatif', range({ ageMinDays: -1 })],
    ['âge minimal décimal', range({ ageMinDays: 1.5 })],
    ['âge maximal ≤ minimal', range({ ageMinDays: 10, ageMaxDays: 10 })],
    ['aucune limite', range({ low: null, high: null })],
    ['limite basse > haute', range({ low: 20, high: 10 })],
    ['critique bas > limite basse', range({ criticalLow: 13 })],
    ['critique haut < limite haute', range({ criticalHigh: 15 })],
    ['valeur non numérique', range({ low: Number.NaN })],
    ['valeur infinie', range({ high: Number.POSITIVE_INFINITY })],
  ])('refuse une tranche incohérente : %s', (_name, bad) => {
    expect(codeOf(validateRanges([bad]))).toBe('LAB_RANGE_INVALID');
  });

  it('refuse deux tranches du même sexe qui se chevauchent, mais admet des tranches contiguës et des sexes différents', () => {
    expect(codeOf(validateRanges([range({ ageMaxDays: 100 }), range({ ageMinDays: 99 })]))).toBe('LAB_RANGE_INVALID');
    expect(codeOf(validateRanges([range({ ageMaxDays: null }), range({ ageMinDays: 5 })]))).toBe('LAB_RANGE_INVALID');
    expect(codeOf(validateRanges([range({ ageMaxDays: 100 }), range({ ageMinDays: 100 })]))).toBe('OK');
    expect(codeOf(validateRanges([range({ sex: 'MALE' }), range({ sex: 'FEMALE' })]))).toBe('OK');
  });

  it('limite le nombre de tranches à 20', () => {
    const many = Array.from({ length: 21 }, (_, i) => range({ ageMinDays: i * 10, ageMaxDays: i * 10 + 10 }));
    expect(codeOf(validateRanges(many))).toBe('LAB_RANGE_INVALID');
    expect(codeOf(validateRanges(many.slice(0, 20)))).toBe('OK');
  });
});

describe('laboratoire : analyse du catalogue', () => {
  const base = (over: Partial<Parameters<typeof LabTest.create>[0]> = {}) => ({
    id: must(TestId.create(uuid(1))), code: must(TestCode.create('HGB')), name: must(TestName.create('Hémoglobine')), section: 'HAEMATOLOGY' as const, specimenType: 'BLOOD' as const, container: 'PURPLE' as const,
    resultType: 'NUMERIC' as const, unit: 'g/dL', decimals: 1, choices: [] as string[], tatMinutes: 120, instructions: null, ranges: [range()], ...over,
  });

  it('crée une analyse numérique active avec ses valeurs de référence', () => {
    const test = must(LabTest.create(base()));
    expect(test.active).toBe(true);
    expect(test.state.ranges).toHaveLength(1);
  });

  it('une analyse numérique n\'a pas de choix ; une analyse à choix a de 2 à 20 valeurs distinctes et ni unité ni valeurs de référence', () => {
    expect(codeOf(LabTest.create(base({ choices: ['A', 'B'] })))).toBe('LAB_TEST_CHOICES_INVALID');
    const choice = { resultType: 'CHOICE' as const, unit: null, ranges: [], decimals: 0 };
    expect(codeOf(LabTest.create(base({ ...choice, choices: ['Positif', 'Négatif'] })))).toBe('OK');
    expect(codeOf(LabTest.create(base({ ...choice, choices: ['Positif'] })))).toBe('LAB_TEST_CHOICES_INVALID');
    expect(codeOf(LabTest.create(base({ ...choice, choices: ['Positif', 'positif'] })))).toBe('LAB_TEST_CHOICES_INVALID');
    expect(codeOf(LabTest.create(base({ ...choice, choices: ['x'.repeat(41), 'B'] })))).toBe('LAB_TEST_CHOICES_INVALID');
    expect(codeOf(LabTest.create(base({ ...choice, choices: Array.from({ length: 21 }, (_, i) => `v${i}`) })))).toBe('LAB_TEST_CHOICES_INVALID');
    expect(codeOf(LabTest.create(base({ ...choice, choices: ['A', 'B'], unit: 'mg' })))).toBe('LAB_TEST_UNIT_INVALID');
    expect(codeOf(LabTest.create(base({ ...choice, choices: ['A', 'B'], ranges: [range()] })))).toBe('LAB_RANGE_INVALID');
  });

  it('une analyse textuelle n\'a ni unité, ni choix, ni valeurs de référence', () => {
    const text = { resultType: 'TEXT' as const, unit: null, ranges: [], choices: [] };
    expect(codeOf(LabTest.create(base(text)))).toBe('OK');
    expect(codeOf(LabTest.create(base({ ...text, unit: 'g' })))).toBe('LAB_TEST_UNIT_INVALID');
    expect(codeOf(LabTest.create(base({ ...text, choices: ['A', 'B'] })))).toBe('LAB_TEST_CHOICES_INVALID');
  });

  it('contrôle les décimales, le délai de rendu, l\'unité et les consignes', () => {
    expect(codeOf(LabTest.create(base({ decimals: 5 })))).toBe('LAB_TEST_DECIMALS_INVALID');
    expect(codeOf(LabTest.create(base({ decimals: 1.5 })))).toBe('LAB_TEST_DECIMALS_INVALID');
    expect(codeOf(LabTest.create(base({ tatMinutes: 0 })))).toBe('LAB_TEST_TAT_INVALID');
    expect(codeOf(LabTest.create(base({ tatMinutes: 43201 })))).toBe('LAB_TEST_TAT_INVALID');
    expect(codeOf(LabTest.create(base({ unit: 'x'.repeat(21) })))).toBe('LAB_TEST_UNIT_INVALID');
    expect(codeOf(LabTest.create(base({ instructions: 'x'.repeat(501) })))).toBe('LAB_NOTES_INVALID');
  });

  it('refuse des valeurs de référence incohérentes dès la création', () => {
    expect(codeOf(LabTest.create(base({ ranges: [range({ low: 20, high: 10 })] })))).toBe('LAB_RANGE_INVALID');
  });

  it('se modifie sans toucher au code ni au type de résultat, en gardant la cohérence', () => {
    const test = must(LabTest.create(base()));
    expect(codeOf(test.update({ name: must(TestName.create('Hb')), tatMinutes: 60, unit: 'g/L' }))).toBe('OK');
    expect(test.state).toMatchObject({ unit: 'g/L', tatMinutes: 60, code: { value: 'HGB' }, resultType: 'NUMERIC' });
    expect(codeOf(test.update({ choices: ['A', 'B'] }))).toBe('LAB_TEST_CHOICES_INVALID');
    expect(codeOf(test.update({ decimals: 9 }))).toBe('LAB_TEST_DECIMALS_INVALID');
    expect(test.state.tatMinutes).toBe(60); // un refus ne change rien
  });

  it('remplace les valeurs de référence (numérique seulement) et se désactive', () => {
    const test = must(LabTest.create(base()));
    expect(codeOf(test.setRanges([range({ sex: 'FEMALE' }), range({ sex: 'MALE', low: 13 })]))).toBe('OK');
    expect(test.state.ranges).toHaveLength(2);
    expect(codeOf(test.setRanges([range({ low: 5, high: 1 })]))).toBe('LAB_RANGE_INVALID');
    expect(test.state.ranges).toHaveLength(2);
    test.setActive(false);
    expect(test.active).toBe(false);
    const text = must(LabTest.create(base({ resultType: 'TEXT', unit: null, ranges: [], choices: [] })));
    expect(codeOf(text.setRanges([range()]))).toBe('LAB_RANGE_INVALID');
  });
});

describe('laboratoire : demande d\'analyses et échantillons', () => {
  const testToOrder = (n: number, specimenType: TestToOrder['specimenType'] = 'BLOOD', container: TestToOrder['container'] = 'PURPLE', section: TestToOrder['section'] = 'HAEMATOLOGY'): TestToOrder => ({
    testId: must(TestId.create(uuid(100 + n))), code: must(TestCode.create(`T${n}`)), name: must(TestName.create(`Analyse ${n}`)), section, specimenType, container,
  });

  const order = (tests: TestToOrder[]): Requisition => {
    const n = specimenCount(tests);
    return must(Requisition.order({
      id: must(RequisitionId.create(uuid(1))), number: must(RequisitionNumber.fromSequence(1)), patientId: must(PatientRef.create(uuid(2))), priority: 'ROUTINE', source: 'OPD', clinicalNotes: null, orderedBy: uuid(3), orderedAt: NOW,
      tests, specimenIds: Array.from({ length: n }, (_, i) => must(SpecimenId.create(uuid(200 + i)))), barcodes: Array.from({ length: n }, (_, i) => must(SpecimenBarcode.fromSequence(i + 1))),
    }));
  };
  const spare = { id: must(SpecimenId.create(uuid(900))), barcode: must(SpecimenBarcode.fromSequence(900)) };

  it('regroupe les analyses par couple (type d\'échantillon, contenant) : un tube pour deux analyses sanguines sur tube violet', () => {
    const r = order([testToOrder(1), testToOrder(2), testToOrder(3, 'SERUM', 'YELLOW', 'BIOCHEMISTRY'), testToOrder(4, 'URINE', 'STERILE_CUP', 'BIOCHEMISTRY')]);
    expect(r.state.specimens).toHaveLength(3);
    expect(r.state.tests[0].specimenId.equals(r.state.tests[1].specimenId)).toBe(true);
    expect(r.state.tests[0].specimenId.equals(r.state.tests[2].specimenId)).toBe(false);
    expect(r.state.specimens.every((s) => s.status === 'PENDING_COLLECTION' && s.events.length === 1 && s.events[0].kind === 'CREATED')).toBe(true);
    expect(r.status).toBe('ORDERED');
    expect(r.state.version).toBe(0);
  });

  it('contrôle la forme de la demande : 1 à 30 analyses, chacune une fois', () => {
    expect(codeOf(checkTests([]))).toBe('LAB_REQUISITION_EMPTY');
    expect(codeOf(checkTests([testToOrder(1), testToOrder(1)]))).toBe('LAB_TEST_DUPLICATED');
    expect(codeOf(checkTests(Array.from({ length: 31 }, (_, i) => testToOrder(i))))).toBe('LAB_TOO_MANY_TESTS');
    expect(codeOf(checkTests(Array.from({ length: 30 }, (_, i) => testToOrder(i))))).toBe('OK');
  });

  it('refuse de bâtir une demande invalide', () => {
    const base = { id: must(RequisitionId.create(uuid(1))), number: must(RequisitionNumber.fromSequence(1)), patientId: must(PatientRef.create(uuid(2))), priority: 'ROUTINE' as const, source: 'OPD' as const, clinicalNotes: null, orderedBy: uuid(3), orderedAt: NOW, specimenIds: [], barcodes: [] };
    expect(codeOf(Requisition.order({ ...base, tests: [] }))).toBe('LAB_REQUISITION_EMPTY');
    expect(() => Requisition.order({ ...base, tests: [testToOrder(1)] })).toThrow(/incohérent/);
  });

  it('suit le prélèvement : ORDERED → PARTIALLY_COLLECTED → COLLECTED → RECEIVED, chaque étape tracée', () => {
    const r = order([testToOrder(1), testToOrder(3, 'SERUM', 'YELLOW', 'BIOCHEMISTRY')]);
    const [a, b] = r.state.specimens.map((s) => s.id);
    expect(codeOf(r.collect(a, TECH, NOW))).toBe('OK');
    expect(r.status).toBe('PARTIALLY_COLLECTED');
    expect(codeOf(r.collect(b, TECH, NOW))).toBe('OK');
    expect(r.status).toBe('COLLECTED');
    expect(codeOf(r.receive(a, TECH, LATER))).toBe('OK');
    expect(r.status).toBe('COLLECTED');
    expect(codeOf(r.receive(b, TECH, LATER))).toBe('OK');
    expect(r.status).toBe('RECEIVED');
    const first = r.findSpecimen(a)!;
    expect(first).toMatchObject({ status: 'RECEIVED', collectedBy: TECH, receivedBy: TECH });
    expect(first.events.map((e) => e.kind)).toEqual(['CREATED', 'COLLECTED', 'RECEIVED']);
  });

  it('ne prélève un échantillon qu\'une fois, et ne reçoit que ce qui est prélevé', () => {
    const r = order([testToOrder(1)]);
    const [a] = r.state.specimens.map((s) => s.id);
    expect(codeOf(r.receive(a, TECH, NOW))).toBe('LAB_SPECIMEN_NOT_COLLECTED');
    r.collect(a, TECH, NOW);
    expect(codeOf(r.collect(a, TECH, NOW))).toBe('LAB_SPECIMEN_NOT_PENDING');
    r.receive(a, TECH, LATER);
    expect(codeOf(r.receive(a, TECH, LATER))).toBe('LAB_SPECIMEN_NOT_COLLECTED');
    expect(codeOf(r.collect(must(SpecimenId.create(uuid(999))), TECH, NOW))).toBe('LAB_SPECIMEN_NOT_FOUND');
  });

  it('rejette un échantillon : un nouveau prélèvement le remplace, les analyses lui sont rattachées, l\'historique reste', () => {
    const r = order([testToOrder(1), testToOrder(2)]);
    const [a] = r.state.specimens.map((s) => s.id);
    r.collect(a, TECH, NOW);
    expect(codeOf(r.reject(a, TECH, LATER, 'HEMOLYSED', null, spare))).toBe('OK');
    expect(r.state.specimens).toHaveLength(2);
    const old = r.findSpecimen(a)!;
    const fresh = r.findSpecimen(spare.id)!;
    expect(old).toMatchObject({ status: 'REJECTED', rejectionReason: 'HEMOLYSED', rejectedBy: TECH });
    expect(old.events.map((e) => e.kind)).toEqual(['CREATED', 'COLLECTED', 'REJECTED']);
    expect(fresh).toMatchObject({ status: 'PENDING_COLLECTION', recollectionOf: a, specimenType: 'BLOOD', container: 'PURPLE' });
    expect(fresh.events[0].note).toContain('SPC-0000001');
    expect(r.state.tests.every((t) => t.specimenId.equals(spare.id))).toBe(true);
    expect(r.status).toBe('ORDERED'); // le rejeté ne compte plus : il reste un prélèvement à faire
  });

  it('« autre » exige une précision ; un échantillon rejeté ne se rejette pas deux fois ; la précision est bornée', () => {
    const r = order([testToOrder(1)]);
    const [a] = r.state.specimens.map((s) => s.id);
    expect(codeOf(r.reject(a, TECH, NOW, 'OTHER', '  ', spare))).toBe('LAB_REJECTION_NOTE_REQUIRED');
    expect(codeOf(r.reject(a, TECH, NOW, 'OTHER', 'x'.repeat(201), spare))).toBe('LAB_REASON_REQUIRED');
    expect(r.state.specimens).toHaveLength(1);
    expect(codeOf(r.reject(a, TECH, NOW, 'OTHER', 'Tube fissuré', spare))).toBe('OK');
    expect(r.findSpecimen(a)!.rejectionNote).toBe('Tube fissuré');
    expect(codeOf(r.reject(a, TECH, NOW, 'CLOTTED', null, { id: must(SpecimenId.create(uuid(901))), barcode: must(SpecimenBarcode.fromSequence(901)) }))).toBe('LAB_SPECIMEN_ALREADY_REJECTED');
  });

  it('peut rejeter un échantillon à prélever ou déjà reçu, puis le remplacement suit le même cycle', () => {
    const r = order([testToOrder(1)]);
    const [a] = r.state.specimens.map((s) => s.id);
    r.collect(a, TECH, NOW);
    r.receive(a, TECH, NOW);
    expect(codeOf(r.reject(a, TECH, LATER, 'INSUFFICIENT_VOLUME', null, spare))).toBe('OK');
    expect(codeOf(r.collect(spare.id, TECH, LATER))).toBe('OK');
    expect(codeOf(r.receive(spare.id, TECH, LATER))).toBe('OK');
    expect(r.status).toBe('RECEIVED');
  });

  it('s\'annule avec un motif tant qu\'aucun échantillon n\'est arrivé au laboratoire', () => {
    const r = order([testToOrder(1)]);
    const [a] = r.state.specimens.map((s) => s.id);
    r.collect(a, TECH, NOW);
    expect(codeOf(r.cancel(must(Reason.create('Prescrit par erreur')), uuid(3), LATER))).toBe('OK');
    expect(r.status).toBe('CANCELLED');
    expect(r.state).toMatchObject({ cancelledBy: uuid(3), cancellationReason: { value: 'Prescrit par erreur' } });
    expect(codeOf(r.cancel(must(Reason.create('Encore')), uuid(3), LATER))).toBe('LAB_REQUISITION_ALREADY_CANCELLED');
    expect(codeOf(r.collect(a, TECH, LATER))).toBe('LAB_REQUISITION_CANCELLED');
    expect(codeOf(r.receive(a, TECH, LATER))).toBe('LAB_REQUISITION_CANCELLED');
    expect(codeOf(r.reject(a, TECH, LATER, 'CLOTTED', null, spare))).toBe('LAB_REQUISITION_CANCELLED');
  });

  it('ne s\'annule plus une fois un échantillon reçu', () => {
    const r = order([testToOrder(1)]);
    const [a] = r.state.specimens.map((s) => s.id);
    r.collect(a, TECH, NOW);
    r.receive(a, TECH, LATER);
    expect(codeOf(r.cancel(must(Reason.create('Trop tard')), uuid(3), LATER))).toBe('LAB_REQUISITION_IN_PROGRESS');
    expect(r.status).toBe('RECEIVED');
  });
});

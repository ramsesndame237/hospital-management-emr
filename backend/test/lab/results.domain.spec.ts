import { Requisition, ResultEntry, TestToOrder, specimenCount } from '../../src/modules/lab/domain/requisition';
import { applicableRange, criticalNotified, currentVersion, deltaAlertFor, flagFor, parseValue } from '../../src/modules/lab/domain/result';
import { ReferenceRange } from '../../src/modules/lab/domain/test';
import { PatientRef, Reason, RequisitionId, RequisitionNumber, SpecimenBarcode, SpecimenId, TestCode, TestId, TestName } from '../../src/modules/lab/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';

const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const T1 = Temporal.Instant.from('2026-11-02T09:00:00Z');
const T2 = Temporal.Instant.from('2026-11-02T10:00:00Z');
const ENTERER = uuid(20);
const VERIFIER = uuid(21);
const range = (over: Partial<ReferenceRange> = {}): ReferenceRange => ({ sex: 'ANY', ageMinDays: 0, ageMaxDays: null, low: 12, high: 16, criticalLow: 7, criticalHigh: 20, ...over });

describe('résultats : saisie contrôlée selon le type', () => {
  const numeric = { resultType: 'NUMERIC' as const, choices: [] as string[] };
  it('accepte un nombre avec virgule ou point, négatif, et le normalise', () => {
    expect(must(parseValue(numeric, '9,4'))).toEqual({ value: '9.4', valueNumber: 9.4 });
    expect(must(parseValue(numeric, ' -3.25 '))).toEqual({ value: '-3.25', valueNumber: -3.25 });
    expect(must(parseValue(numeric, 12))).toEqual({ value: '12', valueNumber: 12 });
    expect(must(parseValue(numeric, '0')).valueNumber).toBe(0);
  });

  it.each(['', '  ', 'abc', '1e5', '1,2,3', '12.1234567', '1234567890', '--1', '9.', '.5', null, undefined, {}])('refuse une valeur numérique invalide : %j', (bad) => {
    expect(codeOf(parseValue(numeric, bad))).toBe('LAB_RESULT_VALUE_INVALID');
  });

  it('une analyse à choix n\'accepte qu\'une valeur de sa liste, rendue sous sa forme canonique', () => {
    const choice = { resultType: 'CHOICE' as const, choices: ['Positif', 'Négatif'] };
    expect(must(parseValue(choice, ' positif ')).value).toBe('Positif');
    expect(codeOf(parseValue(choice, 'Douteux'))).toBe('LAB_RESULT_CHOICE_INVALID');
    expect(codeOf(parseValue(choice, ''))).toBe('LAB_RESULT_CHOICE_INVALID');
  });

  it('une analyse textuelle prend de 1 à 2000 caractères', () => {
    const text = { resultType: 'TEXT' as const, choices: [] as string[] };
    expect(must(parseValue(text, '  Culture stérile  ')).value).toBe('Culture stérile');
    expect(codeOf(parseValue(text, ''))).toBe('LAB_RESULT_VALUE_INVALID');
    expect(codeOf(parseValue(text, 'x'.repeat(2001)))).toBe('LAB_RESULT_VALUE_INVALID');
    expect(codeOf(parseValue(text, 'x'.repeat(2000)))).toBe('OK');
  });
});

describe('résultats : valeurs de référence, drapeaux et variation', () => {
  it('choisit la tranche du sexe du patient avant la tranche « tous », et respecte les bornes d\'âge (min inclus, max exclu)', () => {
    const all = range({ sex: 'ANY', low: 1, high: 2 });
    const female = range({ sex: 'FEMALE', low: 11, high: 15 });
    expect(applicableRange([all, female], 'FEMALE', 100)).toBe(female);
    expect(applicableRange([all, female], 'MALE', 100)).toBe(all);
    expect(applicableRange([female], 'MALE', 100)).toBeNull();
    const child = range({ ageMinDays: 0, ageMaxDays: 365 });
    const adult = range({ ageMinDays: 365 });
    expect(applicableRange([child, adult], 'ANY', 364)).toBe(child);
    expect(applicableRange([child, adult], 'ANY', 365)).toBe(adult);
    expect(applicableRange([child], 'ANY', 365)).toBeNull();
    expect(applicableRange([], 'MALE', 10)).toBeNull();
  });

  it('un sexe indéterminé n\'obtient que la tranche « tous »', () => {
    const all = range();
    expect(applicableRange([range({ sex: 'FEMALE' }), all], 'UNDETERMINED', 9000)).toBe(all);
  });

  it.each([
    [6.9, 'CRITICAL_LOW'], [7, 'LOW'], [11.9, 'LOW'], [12, 'NORMAL'], [14, 'NORMAL'], [16, 'NORMAL'], [16.1, 'HIGH'], [20, 'HIGH'], [20.1, 'CRITICAL_HIGH'],
  ])('position de %s par rapport à 12–16 (critique < 7 ou > 20) : %s', (value, expected) => {
    expect(flagFor(range(), value)).toBe(expected);
  });

  it('sans tranche, pas de drapeau ; une tranche à une seule limite ne compare que celle-là', () => {
    expect(flagFor(null, 10)).toBeNull();
    const upperOnly = range({ low: null, criticalLow: null });
    expect(flagFor(upperOnly, -50)).toBe('NORMAL');
    expect(flagFor(upperOnly, 17)).toBe('HIGH');
  });

  it('alerte au-delà de 30 % de variation, dans les deux sens, jamais sans précédent ni sur un précédent nul', () => {
    expect(deltaAlertFor(10, 13)).toBe(false); // exactement 30 %
    expect(deltaAlertFor(10, 13.1)).toBe(true);
    expect(deltaAlertFor(10, 6.9)).toBe(true);
    expect(deltaAlertFor(10, 7)).toBe(false);
    expect(deltaAlertFor(-10, -14)).toBe(true);
    expect(deltaAlertFor(null, 99)).toBe(false);
    expect(deltaAlertFor(0, 5)).toBe(false);
  });
});

describe('résultats : cycle de vie dans la demande', () => {
  const testToOrder = (n: number, container: TestToOrder['container'] = 'PURPLE'): TestToOrder => ({
    testId: must(TestId.create(uuid(100 + n))), code: must(TestCode.create(`T${n}`)), name: must(TestName.create(`Analyse ${n}`)), section: 'HAEMATOLOGY', specimenType: 'BLOOD', container,
  });
  const T_A = must(TestId.create(uuid(101)));
  const T_B = must(TestId.create(uuid(102)));

  /** Demande de deux analyses sur deux tubes, tubes reçus au laboratoire. */
  function received(receive: 'all' | 'first' | 'none' = 'all'): Requisition {
    const tests = [testToOrder(1), testToOrder(2, 'RED')];
    const n = specimenCount(tests);
    const r = must(Requisition.order({
      id: must(RequisitionId.create(uuid(1))), number: must(RequisitionNumber.fromSequence(1)), patientId: must(PatientRef.create(uuid(2))), priority: 'ROUTINE', source: 'OPD', clinicalNotes: null, orderedBy: uuid(3),
      orderedAt: NOW, tests, specimenIds: Array.from({ length: n }, (_, i) => must(SpecimenId.create(uuid(200 + i)))), barcodes: Array.from({ length: n }, (_, i) => must(SpecimenBarcode.fromSequence(i + 1))),
    }));
    for (const [i, s] of r.state.specimens.entries()) {
      must(r.collect(s.id, ENTERER, NOW));
      if (receive === 'all' || (receive === 'first' && i === 0)) must(r.receive(s.id, ENTERER, NOW));
    }
    return r;
  }

  const entry = (value: string, flag: ResultEntry['flag'] = 'NORMAL', over: Partial<ResultEntry> = {}): ResultEntry => ({
    parsed: { value, valueNumber: Number(value) }, flag, refLow: 12, refHigh: 16, criticalLow: 7, criticalHigh: 20, unit: 'g/dL', previousValue: null, deltaAlert: false, comment: null, ...over,
  });
  const resultOf = (r: Requisition, id = T_A) => r.state.tests.find((t) => t.testId.equals(id))!.result!;
  const reason = (text = 'Motif') => must(Reason.create(text));
  const notification = { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE' as const, readBackConfirmed: true };

  it('saisit un résultat (version 1) sur un échantillon reçu, avec ses valeurs de référence copiées', () => {
    const r = received();
    expect(codeOf(r.enterResult(T_A, ENTERER, T1, entry('13.5')))).toBe('OK');
    const res = resultOf(r);
    expect(res).toMatchObject({ status: 'ENTERED', releasedVersion: null, verifiedBy: null });
    expect(currentVersion(res)).toMatchObject({ version: 1, value: '13.5', valueNumber: 13.5, flag: 'NORMAL', refLow: 12, refHigh: 16, enteredBy: ENTERER, unit: 'g/dL' });
    expect(r.state.tests[1].result).toBeNull();
  });

  it('refuse un résultat avant la réception, sur une analyse inconnue, ou sur une demande annulée', () => {
    const r = received('first');
    expect(codeOf(r.enterResult(T_B, ENTERER, T1, entry('1')))).toBe('LAB_SPECIMEN_NOT_RECEIVED');
    expect(codeOf(r.enterResult(must(TestId.create(uuid(999))), ENTERER, T1, entry('1')))).toBe('LAB_TEST_NOT_IN_REQUISITION');
    const open = received('none');
    must(open.cancel(reason('Erreur'), uuid(3), T1));
    expect(codeOf(open.enterResult(T_A, ENTERER, T1, entry('1')))).toBe('LAB_REQUISITION_CANCELLED');
  });

  it('une nouvelle saisie avant validation crée une version, sans toucher aux précédentes', () => {
    const r = received();
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    expect(codeOf(r.enterResult(T_A, ENTERER, T2, entry('14.1', 'NORMAL', { comment: 'Second passage' })))).toBe('OK');
    const res = resultOf(r);
    expect(res.versions.map((v) => [v.version, v.value])).toEqual([[1, '13.5'], [2, '14.1']]);
    expect(currentVersion(res).comment).toBe('Second passage');
  });

  it('la validation exige un autre technicien que l\'auteur, et un résultat saisi', () => {
    const r = received();
    expect(codeOf(r.verifyResult(T_A, VERIFIER, T1))).toBe('LAB_RESULT_NOT_ENTERED');
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    expect(codeOf(r.verifyResult(T_A, ENTERER, T2))).toBe('LAB_VERIFY_SELF');
    expect(resultOf(r).status).toBe('ENTERED');
    expect(codeOf(r.verifyResult(T_A, VERIFIER, T2))).toBe('OK');
    expect(resultOf(r)).toMatchObject({ status: 'VERIFIED', verifiedBy: VERIFIER });
    expect(codeOf(r.verifyResult(T_A, VERIFIER, T2))).toBe('LAB_RESULT_NOT_PENDING_VERIFICATION');
  });

  it('un résultat validé ne se ressaisit pas : on le renvoie avec un motif, puis on le ressaisit', () => {
    const r = received();
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    r.verifyResult(T_A, VERIFIER, T1);
    expect(codeOf(r.enterResult(T_A, ENTERER, T2, entry('14')))).toBe('LAB_RESULT_LOCKED');
    expect(codeOf(r.returnResult(T_A, reason('Incohérent avec le précédent')))).toBe('OK');
    expect(resultOf(r)).toMatchObject({ status: 'RETURNED', returnReason: 'Incohérent avec le précédent', verifiedBy: null, verifiedAt: null });
    expect(codeOf(r.verifyResult(T_A, VERIFIER, T2))).toBe('LAB_RESULT_NOT_PENDING_VERIFICATION');
    expect(codeOf(r.enterResult(T_A, ENTERER, T2, entry('12.9')))).toBe('OK');
    expect(resultOf(r)).toMatchObject({ status: 'ENTERED', returnReason: null });
    expect(resultOf(r).versions).toHaveLength(2);
  });

  it('on peut renvoyer un résultat saisi, mais pas un résultat publié ni un résultat absent', () => {
    const r = received();
    expect(codeOf(r.returnResult(T_A, reason()))).toBe('LAB_RESULT_NOT_ENTERED');
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    expect(codeOf(r.returnResult(T_A, reason()))).toBe('OK');
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    r.verifyResult(T_A, VERIFIER, T1);
    r.releaseResult(T_A, VERIFIER, T2);
    expect(codeOf(r.returnResult(T_A, reason()))).toBe('LAB_RESULT_NOT_PENDING_VERIFICATION');
  });

  it('publie un résultat validé, jamais par son auteur ; un résultat non validé ne se publie pas', () => {
    const r = received();
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('LAB_RESULT_NOT_VERIFIED');
    r.verifyResult(T_A, VERIFIER, T1);
    expect(codeOf(r.releaseResult(T_A, ENTERER, T2))).toBe('LAB_VERIFY_SELF');
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('OK');
    expect(resultOf(r)).toMatchObject({ status: 'RELEASED', releasedVersion: 1, releasedBy: VERIFIER });
    expect(resultOf(r).releasedAt?.toString()).toBe(T2.toString());
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('LAB_RESULT_NOT_VERIFIED');
    expect(codeOf(r.enterResult(T_A, ENTERER, T2, entry('1')))).toBe('LAB_RESULT_LOCKED');
  });

  it('une valeur critique ne se publie qu\'après l\'appel du clinicien, relecture confirmée, sur la version courante', () => {
    const r = received();
    r.enterResult(T_A, ENTERER, T1, entry('5.1', 'CRITICAL_LOW'));
    r.verifyResult(T_A, VERIFIER, T1);
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('LAB_CRITICAL_NOT_NOTIFIED');
    expect(codeOf(r.documentCritical(T_A, VERIFIER, T2, { ...notification, readBackConfirmed: false }))).toBe('LAB_READBACK_REQUIRED');
    expect(codeOf(r.documentCritical(T_A, VERIFIER, T2, notification))).toBe('OK');
    expect(criticalNotified(resultOf(r))).toBe(true);
    expect(resultOf(r).notifications[0]).toMatchObject({ version: 1, notifiedName: 'Dr Curie', method: 'PHONE', readBackConfirmed: true, by: VERIFIER });
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('OK');
    expect(codeOf(r.documentCritical(T_A, VERIFIER, T2, notification))).toBe('LAB_RESULT_LOCKED');
  });

  it('l\'appel ne vaut que pour la version qu\'il documente : une ressaisie critique exige un nouvel appel', () => {
    const r = received();
    r.enterResult(T_A, ENTERER, T1, entry('5.1', 'CRITICAL_LOW'));
    r.documentCritical(T_A, VERIFIER, T1, notification);
    r.enterResult(T_A, ENTERER, T2, entry('5.4', 'CRITICAL_LOW'));
    expect(criticalNotified(resultOf(r))).toBe(false);
    r.verifyResult(T_A, VERIFIER, T2);
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('LAB_CRITICAL_NOT_NOTIFIED');
    r.documentCritical(T_A, VERIFIER, T2, notification);
    expect(resultOf(r).notifications).toHaveLength(2);
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('OK');
  });

  it('refuse l\'appel pour un résultat qui n\'est pas critique, ou absent', () => {
    const r = received();
    expect(codeOf(r.documentCritical(T_A, VERIFIER, T1, notification))).toBe('LAB_RESULT_NOT_ENTERED');
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    expect(codeOf(r.documentCritical(T_A, VERIFIER, T1, notification))).toBe('LAB_RESULT_NOT_CRITICAL');
    r.enterResult(T_A, ENTERER, T1, entry('99', null as never));
    expect(codeOf(r.documentCritical(T_A, VERIFIER, T1, notification))).toBe('LAB_RESULT_NOT_CRITICAL');
  });

  it('amende un résultat publié : nouvelle version avec motif, version publiée conservée jusqu\'à la nouvelle publication', () => {
    const r = received();
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    r.verifyResult(T_A, VERIFIER, T1);
    r.releaseResult(T_A, VERIFIER, T1);
    expect(codeOf(r.amendResult(T_A, ENTERER, T2, entry('31.5', 'CRITICAL_HIGH'), reason('Erreur de transcription')))).toBe('OK');
    let res = resultOf(r);
    expect(res).toMatchObject({ status: 'ENTERED', releasedVersion: 1, verifiedBy: null });
    expect(currentVersion(res)).toMatchObject({ version: 2, value: '31.5', amendmentReason: 'Erreur de transcription' });
    expect(res.versions[0]).toMatchObject({ version: 1, value: '13.5', amendmentReason: null });
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('LAB_RESULT_NOT_VERIFIED');
    r.verifyResult(T_A, VERIFIER, T2);
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('LAB_CRITICAL_NOT_NOTIFIED');
    r.documentCritical(T_A, VERIFIER, T2, notification);
    expect(codeOf(r.releaseResult(T_A, VERIFIER, T2))).toBe('OK');
    res = resultOf(r);
    expect(res).toMatchObject({ status: 'RELEASED', releasedVersion: 2 });
    expect(res.versions).toHaveLength(2);
  });

  it('n\'amende que ce qui est publié', () => {
    const r = received();
    expect(codeOf(r.amendResult(T_A, ENTERER, T1, entry('1'), reason()))).toBe('LAB_RESULT_NOT_ENTERED');
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    expect(codeOf(r.amendResult(T_A, ENTERER, T1, entry('1'), reason()))).toBe('LAB_RESULT_NOT_RELEASED');
  });

  it('déduit le statut de la demande de ses résultats : reçue, en analyse, saisie, validée, publiée', () => {
    const r = received();
    expect(r.status).toBe('RECEIVED');
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    expect(r.status).toBe('IN_ANALYSIS');
    r.enterResult(T_B, ENTERER, T1, entry('4'));
    expect(r.status).toBe('RESULTED');
    r.verifyResult(T_A, VERIFIER, T1);
    expect(r.status).toBe('RESULTED');
    r.verifyResult(T_B, VERIFIER, T1);
    expect(r.status).toBe('VERIFIED');
    r.releaseResult(T_A, VERIFIER, T2);
    expect(r.status).toBe('VERIFIED');
    r.releaseResult(T_B, VERIFIER, T2);
    expect(r.status).toBe('RELEASED');
    r.amendResult(T_A, ENTERER, T2, entry('14'), reason());
    expect(r.status).toBe('RESULTED');
  });

  it('un résultat renvoyé ramène la demande « en analyse »', () => {
    const r = received();
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    r.enterResult(T_B, ENTERER, T1, entry('4'));
    r.returnResult(T_B, reason());
    expect(r.status).toBe('IN_ANALYSIS');
  });

  it('un échantillon qui porte des résultats ne se rejette plus', () => {
    const r = received();
    const specimenId = r.state.tests[0].specimenId;
    r.enterResult(T_A, ENTERER, T1, entry('13.5'));
    const spare = { id: must(SpecimenId.create(uuid(900))), barcode: must(SpecimenBarcode.fromSequence(900)) };
    expect(codeOf(r.reject(specimenId, ENTERER, T2, 'CLOTTED', null, spare))).toBe('LAB_SPECIMEN_HAS_RESULTS');
    expect(r.state.specimens).toHaveLength(2);
    const other = r.state.tests[1].specimenId;
    expect(codeOf(r.reject(other, ENTERER, T2, 'CLOTTED', null, spare))).toBe('OK');
  });
});

import { PGlite } from '@electric-sql/pglite';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { LabTest } from '../../src/modules/lab/domain/test';
import { Requisition, ResultEntry, TestToOrder, specimenCount } from '../../src/modules/lab/domain/requisition';
import { currentVersion } from '../../src/modules/lab/domain/result';
import { PgRequisitionRepository } from '../../src/modules/lab/infrastructure/persistence/pg-requisition.repository';
import { PgTestRepository } from '../../src/modules/lab/infrastructure/persistence/pg-test.repository';
import { PatientRef, Reason, RequisitionId, SpecimenId, TestCode, TestId, TestName } from '../../src/modules/lab/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, MIGRATIONS, seedFixture, uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const T1 = Temporal.Instant.from('2026-11-02T09:00:00Z');
const T2 = Temporal.Instant.from('2026-11-02T10:00:00Z');
const DOC = uuid(11);
const A = uuid(12); // technicien qui saisit
const B = uuid(13); // technicien qui valide et publie
const reason = (t = 'Motif') => must(Reason.create(t));

describe('schéma des résultats du laboratoire sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let tests: PgTestRepository;
  let reqs: PgRequisitionRepository;
  let seq = 0;

  const newTest = async (over: Partial<Parameters<typeof LabTest.create>[0]> = {}): Promise<LabTest> => {
    seq += 1;
    const t = must(LabTest.create({
      id: must(TestId.create(uuid(1000 + seq))), code: must(TestCode.create(`T${seq}`)), name: must(TestName.create(`Analyse ${seq}`)), section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC',
      unit: 'g/dL', decimals: 1, choices: [], tatMinutes: 120, instructions: null, ranges: [], ...over,
    }));
    expect(await tests.insert(t)).toBe(true);
    return t;
  };
  const toOrder = (t: LabTest): TestToOrder => ({ testId: t.state.id, code: t.state.code, name: t.state.name, section: t.state.section, specimenType: t.state.specimenType, container: t.state.container });

  /** Demande dont tous les échantillons sont reçus au laboratoire. */
  const receivedRequisition = async (list: LabTest[], patient = f.patient1): Promise<Requisition> => {
    seq += 1;
    const order = list.map(toOrder);
    const n = specimenCount(order);
    const r = must(Requisition.order({
      id: must(RequisitionId.create(uuid(2000 + seq))), number: await reqs.nextNumber(), patientId: must(PatientRef.create(patient)), priority: 'ROUTINE', source: 'OPD', clinicalNotes: null, orderedBy: DOC, orderedAt: NOW, tests: order,
      specimenIds: Array.from({ length: n }, (_, i) => must(SpecimenId.create(uuid(3000 + seq * 10 + i)))), barcodes: await reqs.nextBarcodes(n),
    }));
    await reqs.insert(r);
    for (const s of r.state.specimens) {
      must(await reqs.mutate(r.id, (x) => x.collect(s.id, A, NOW)));
      must(await reqs.mutate(r.id, (x) => x.receive(s.id, A, NOW)));
    }
    return (await reqs.findById(r.id))!;
  };

  const entry = (value: string, flag: ResultEntry['flag'] = 'NORMAL', over: Partial<ResultEntry> = {}): ResultEntry => ({
    parsed: { value, valueNumber: Number.isFinite(Number(value)) ? Number(value) : null }, flag, refLow: 12.5, refHigh: 16.25, criticalLow: 7, criticalHigh: 20, unit: 'g/dL', previousValue: null, deltaAlert: false, comment: null, ...over,
  });
  const act = (r: Requisition, change: (x: Requisition) => ReturnType<Requisition['verifyResult']>) => reqs.mutate(r.id, change);
  const enter = (r: Requisition, t: LabTest, value: string, flag: ResultEntry['flag'] = 'NORMAL', by = A, at = T1, over: Partial<ResultEntry> = {}) => act(r, (x) => x.enterResult(t.id, by, at, entry(value, flag, over)));
  const verify = (r: Requisition, t: LabTest, by = B) => act(r, (x) => x.verifyResult(t.id, by, T1));
  const release = (r: Requisition, t: LabTest, by = B, at = T2) => act(r, (x) => x.releaseResult(t.id, by, at));
  const full = async (r: Requisition, t: LabTest, value: string, at = T2) => {
    must(await enter(r, t, value));
    must(await verify(r, t));
    return must(await release(r, t, B, at));
  };
  const resultOf = async (r: Requisition, t: LabTest) => (await reqs.findById(r.id))!.state.tests.find((x) => x.testId.equals(t.id))!.result!;

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    tests = new PgTestRepository(sql);
    reqs = new PgRequisitionRepository(sql);
    seq = 0;
  });
  afterEach(() => db.close());

  it('répartit les droits de résultats : seul le laboratoire saisit, valide, publie, amende et documente les valeurs critiques ; idempotent', async () => {
    for (const ddl of MIGRATIONS) await db.exec(ddl);
    const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, new Set(r.permissions.map((p) => p.value))]));
    const holders = (p: string) => [...roles].filter(([, s]) => s.has(p)).map(([c]) => c).sort();
    for (const p of ['enter', 'verify', 'release', 'amend', 'notify']) expect(holders(`lab.results:${p}:all`)).toEqual(['LAB_TECHNICIAN']);
  });

  it('relit un résultat saisi, validé et publié avec toutes ses informations, y compris les valeurs de référence copiées', async () => {
    const t = await newTest();
    const r = await receivedRequisition([t]);
    must(await enter(r, t, '13.5', 'NORMAL', A, T1, { comment: 'Contrôlé', previousValue: 12.8, deltaAlert: false }));
    must(await verify(r, t));
    must(await release(r, t));
    const res = await resultOf(r, t);
    expect(res).toMatchObject({ status: 'RELEASED', releasedVersion: 1, verifiedBy: B, releasedBy: B, returnReason: null });
    expect(res.releasedAt?.toString()).toBe(T2.toString());
    expect(res.verifiedAt?.toString()).toBe(T1.toString());
    expect(currentVersion(res)).toMatchObject({
      version: 1, value: '13.5', valueNumber: 13.5, flag: 'NORMAL', refLow: 12.5, refHigh: 16.25, criticalLow: 7, criticalHigh: 20, unit: 'g/dL', previousValue: 12.8, deltaAlert: false, enteredBy: A, comment: 'Contrôlé', amendmentReason: null,
    });
    expect((await reqs.findById(r.id))!.status).toBe('RELEASED');
    expect((await reqs.list({ status: 'RELEASED' }, 0, 10)).total).toBe(1);
  });

  it('conserve les valeurs non numériques (texte, choix) sans valeur chiffrée', async () => {
    const t = await newTest({ resultType: 'CHOICE', unit: null, choices: ['Positif', 'Négatif'], decimals: 0 });
    const r = await receivedRequisition([t]);
    must(await act(r, (x) => x.enterResult(t.id, A, T1, { ...entry('Positif', null), parsed: { value: 'Positif', valueNumber: null }, unit: null, refLow: null, refHigh: null, criticalLow: null, criticalHigh: null })));
    expect(currentVersion(await resultOf(r, t))).toMatchObject({ value: 'Positif', valueNumber: null, flag: null, unit: null });
  });

  it('n\'écrit que les nouvelles versions : les précédentes ne sont jamais réécrites', async () => {
    const t = await newTest();
    const r = await receivedRequisition([t]);
    must(await enter(r, t, '13.5'));
    must(await enter(r, t, '14.1', 'NORMAL', A, T2, { comment: 'Second passage' }));
    must(await verify(r, t));
    must(await act(r, (x) => x.returnResult(t.id, reason('Incohérent'))));
    must(await enter(r, t, '12.9'));
    const rows = await sql.query<{ version: number; value: string }>('SELECT version, value FROM lab_result_versions WHERE requisition_id = $1 ORDER BY version', [r.id.value]);
    expect(rows).toEqual([{ version: 1, value: '13.5' }, { version: 2, value: '14.1' }, { version: 3, value: '12.9' }]);
    expect(await resultOf(r, t)).toMatchObject({ status: 'ENTERED', returnReason: null, verifiedBy: null });
  });

  it('un amendement ajoute une version et laisse la version publiée en place jusqu\'à la nouvelle publication', async () => {
    const t = await newTest();
    const r = await receivedRequisition([t]);
    await full(r, t, '13.5');
    must(await act(r, (x) => x.amendResult(t.id, A, T2, entry('31.5', 'CRITICAL_HIGH'), reason('Erreur de transcription'))));
    let res = await resultOf(r, t);
    expect(res).toMatchObject({ status: 'ENTERED', releasedVersion: 1, releasedBy: B });
    expect(res.versions.map((v) => [v.version, v.value, v.amendmentReason])).toEqual([[1, '13.5', null], [2, '31.5', 'Erreur de transcription']]);
    expect((await reqs.findById(r.id))!.status).toBe('RESULTED');
    must(await verify(r, t));
    must(await act(r, (x) => x.documentCritical(t.id, B, T2, { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', readBackConfirmed: true })));
    must(await release(r, t));
    res = await resultOf(r, t);
    expect(res).toMatchObject({ status: 'RELEASED', releasedVersion: 2 });
  });

  it('enregistre les appels aux cliniciens en ajout seul, par version', async () => {
    const t = await newTest();
    const r = await receivedRequisition([t]);
    must(await enter(r, t, '5.1', 'CRITICAL_LOW'));
    must(await act(r, (x) => x.documentCritical(t.id, B, T1, { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', readBackConfirmed: true })));
    must(await enter(r, t, '5.4', 'CRITICAL_LOW'));
    must(await act(r, (x) => x.documentCritical(t.id, B, T2, { notifiedName: 'Dr Pasteur', notifiedRole: 'Chef de service', method: 'IN_PERSON', readBackConfirmed: true })));
    const res = await resultOf(r, t);
    expect(res.notifications.map((n) => [n.version, n.notifiedName, n.method, n.readBackConfirmed])).toEqual([[1, 'Dr Curie', 'PHONE', true], [2, 'Dr Pasteur', 'IN_PERSON', true]]);
    expect(res.notifications[1].at.toString()).toBe(T2.toString());
    expect((await sql.query('SELECT 1 FROM lab_critical_notifications')).length).toBe(2);
  });

  it('retrouve le dernier résultat publié du même patient dans une autre demande (delta check)', async () => {
    const t = await newTest();
    const old = await receivedRequisition([t]);
    await full(old, t, '10.5', T1);
    const recent = await receivedRequisition([t]);
    await full(recent, t, '12', T2);
    const current = await receivedRequisition([t]);
    const prev = (await reqs.previousReleased(must(PatientRef.create(f.patient1)), t.id, current.id))!;
    expect(prev).toMatchObject({ value: 12, requisitionNumber: recent.state.number.value });
    expect(prev.releasedAt.toString()).toBe(T2.toString());
    expect((await reqs.previousReleased(must(PatientRef.create(f.patient1)), t.id, recent.id))!.value).toBe(10.5);
  });

  it('ignore, pour le delta check : la même demande, un autre patient, un résultat non publié, non numérique, ou une autre analyse', async () => {
    const t = await newTest();
    const other = await newTest();
    const mine = await receivedRequisition([t]);
    await full(mine, t, '10');
    const patient1 = must(PatientRef.create(f.patient1));
    expect(await reqs.previousReleased(patient1, t.id, mine.id)).toBeNull();
    expect(await reqs.previousReleased(must(PatientRef.create(f.patient2)), t.id, must(RequisitionId.create(uuid(99999))))).toBeNull();
    const next = await receivedRequisition([t, other]);
    expect(await reqs.previousReleased(patient1, other.id, next.id)).toBeNull();
    const unreleased = await receivedRequisition([t], f.patient2);
    must(await enter(unreleased, t, '99'));
    expect(await reqs.previousReleased(must(PatientRef.create(f.patient2)), t.id, next.id)).toBeNull();
    const text = await newTest({ resultType: 'TEXT', unit: null });
    const textual = await receivedRequisition([text]);
    must(await act(textual, (x) => x.enterResult(text.id, A, T1, { ...entry('Stérile', null), parsed: { value: 'Stérile', valueNumber: null } })));
    must(await verify(textual, text));
    must(await release(textual, text));
    expect(await reqs.previousReleased(patient1, text.id, next.id)).toBeNull();
  });

  it('liste les demandes par avancement des résultats', async () => {
    const t = await newTest();
    const received = await receivedRequisition([t]);
    const analysing = await receivedRequisition([t]);
    must(await enter(analysing, t, '13'));
    const verified = await receivedRequisition([t]);
    must(await enter(verified, t, '13'));
    must(await verify(verified, t));
    const ids = async (status: 'RECEIVED' | 'RESULTED' | 'VERIFIED') => (await reqs.list({ status }, 0, 10)).items.map((i) => i.id);
    expect(await ids('RECEIVED')).toEqual([received.id.value]);
    expect(await ids('RESULTED')).toEqual([analysing.id.value]);
    expect(await ids('VERIFIED')).toEqual([verified.id.value]);
  });

  it('refuse, en base, des résultats incohérents : publié sans publicateur, validé sans validateur, renvoyé sans motif, statut inconnu', async () => {
    const t = await newTest();
    const r = await receivedRequisition([t]);
    must(await enter(r, t, '13'));
    const set = (cols: string) => sql.query(`UPDATE lab_results SET ${cols} WHERE requisition_id = $1`, [r.id.value]);
    await expect(set("status = 'RELEASED'")).rejects.toThrow();
    await expect(set("status = 'VERIFIED'")).rejects.toThrow();
    await expect(set("status = 'RETURNED'")).rejects.toThrow();
    await expect(set("status = 'DONE'")).rejects.toThrow();
    await expect(set('released_version = 1')).rejects.toThrow(); // une version publiée sans date
    await expect(sql.query("UPDATE lab_requisitions SET status = 'DONE' WHERE id = $1", [r.id.value])).rejects.toThrow();
  });

  it('les saisies et les appels sont en ajout seul : ni modification, ni suppression, ni vidage', async () => {
    const t = await newTest();
    const r = await receivedRequisition([t]);
    must(await enter(r, t, '5.1', 'CRITICAL_LOW'));
    must(await act(r, (x) => x.documentCritical(t.id, B, T1, { notifiedName: 'Dr Curie', notifiedRole: 'Médecin', method: 'PHONE', readBackConfirmed: true })));
    for (const table of ['lab_result_versions', 'lab_critical_notifications']) {
      await expect(sql.query(`DELETE FROM ${table}`)).rejects.toThrow(/ajout seul/);
      await expect(sql.query(`TRUNCATE ${table}`)).rejects.toThrow(/ajout seul/);
    }
    await expect(sql.query("UPDATE lab_result_versions SET value = '1'")).rejects.toThrow(/ajout seul/);
    await expect(sql.query("UPDATE lab_critical_notifications SET notified_name = 'x'")).rejects.toThrow(/ajout seul/);
  });

  it('refuse un appel sans relecture, un moyen inconnu, et un résultat sur une analyse hors demande', async () => {
    const t = await newTest();
    const r = await receivedRequisition([t]);
    must(await enter(r, t, '5.1', 'CRITICAL_LOW'));
    const insert = (over: { read_back?: boolean; method?: string }) =>
      sql.query(
        `INSERT INTO lab_critical_notifications (requisition_id, test_id, seq, version, notified_name, notified_role, method, read_back, at, by) VALUES ($1, $2, 9, 1, 'x', 'y', $3, $4, now(), $5)`,
        [r.id.value, t.id.value, over.method ?? 'PHONE', over.read_back ?? true, B],
      );
    await expect(insert({ read_back: false })).rejects.toThrow();
    await expect(insert({ method: 'PIGEON' })).rejects.toThrow();
    const stranger = await newTest();
    await expect(sql.query("INSERT INTO lab_results (requisition_id, test_id, status) VALUES ($1, $2, 'ENTERED')", [r.id.value, stranger.id.value])).rejects.toThrow();
  });

  it('deux validations simultanées du même résultat : une seule réussit', async () => {
    const t = await newTest();
    const r = await receivedRequisition([t]);
    must(await enter(r, t, '13'));
    const [x, y] = await Promise.all([verify(r, t, B), verify(r, t, uuid(14))]);
    const codes = [x, y].map((o) => (o && o.ok ? 'OK' : o && !o.ok ? o.error.code : 'NULL')).sort();
    expect(codes).toEqual(['LAB_RESULT_NOT_PENDING_VERIFICATION', 'OK']);
  });

  it('validation et renvoi simultanés : jamais un résultat à la fois validé et renvoyé', async () => {
    const t = await newTest();
    const r = await receivedRequisition([t]);
    must(await enter(r, t, '13'));
    await Promise.all([verify(r, t), act(r, (x) => x.returnResult(t.id, reason('Doute')))]);
    const res = await resultOf(r, t);
    expect(['VERIFIED', 'RETURNED']).toContain(res.status);
    if (res.status === 'RETURNED') expect(res.verifiedBy).toBeNull();
    else expect(res.returnReason).toBeNull();
  });
});

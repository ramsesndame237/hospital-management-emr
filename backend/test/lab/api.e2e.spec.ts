import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const NO_PII = /Mbarga|Élisabeth|Ndongo|Nkoa|Curie|Pasteur|Abel/;
const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const BIRTH = '1990-03-14';

describe('API laboratoire /api/v1/lab (HTTP réel, PostgreSQL réel)', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const put = (who: string, url: string, body: object = {}) => c.http().put(api(url)).set(c.bearer(who)).send(body);
  const patch = (who: string, url: string, body: object = {}) => c.http().patch(api(url)).set(c.bearer(who)).send(body);

  let seq = 0;
  const NUMERIC = { section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, tatMinutes: 120 };
  /** Une analyse du catalogue (créée par l'administrateur système). */
  const test = async (over: Record<string, unknown> = {}): Promise<{ id: string; code: string }> => {
    seq += 1;
    const r = await post('admin', '/lab/tests', { code: `T-${seq}`, name: `Analyse ${seq}`, ...NUMERIC, ...over }).expect(201);
    return { id: r.body.id as string, code: r.body.code as string };
  };
  const serum = (over: Record<string, unknown> = {}) => test({ section: 'BIOCHEMISTRY', specimenType: 'SERUM', container: 'YELLOW', unit: 'mmol/L', ...over });
  const order = async (who: string, testIds: string[], over: Record<string, unknown> = {}) =>
    (await post(who, '/lab/requisitions', { patientId: ids.patients[0], testIds, ...over }).expect(201)).body;
  const collectBody = (r: { patient: { number: string } }, over: Record<string, unknown> = {}) => ({ patientNumber: r.patient.number, birthDate: BIRTH, ...over });
  const auditRows = (action: string, resourceId: string) =>
    c.w.sql.query<{ outcome: string; reason: string | null; metadata: Record<string, unknown> }>('SELECT outcome, reason, metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    const NO_LAB = ['patient', 'accueil', 'caisse', 'comptable', 'infirmier'];
    const catalogRead = NO_LAB;
    const catalogWrite = [...NO_LAB, 'medecin', 'labo'];
    const orderers = NO_LAB;
    const benchOnly = [...NO_LAB, 'medecin'];
    it.each([
      ['GET', '/lab/tests', catalogRead], ['GET', `/lab/tests/${ID}`, catalogRead],
      ['POST', '/lab/tests', catalogWrite], ['PATCH', `/lab/tests/${ID}`, catalogWrite], ['PUT', `/lab/tests/${ID}/ranges`, catalogWrite],
      ['POST', `/lab/tests/${ID}/deactivate`, catalogWrite], ['POST', `/lab/tests/${ID}/activate`, catalogWrite],
      ['GET', '/lab/requisitions', orderers], ['POST', '/lab/requisitions', orderers], ['GET', `/lab/requisitions/${ID}`, orderers], ['POST', `/lab/requisitions/${ID}/cancel`, orderers],
      ['GET', '/lab/specimens/by-barcode/SPC-0000001', orderers],
      ['POST', `/lab/specimens/${ID}/collect`, benchOnly], ['POST', `/lab/specimens/${ID}/receive`, benchOnly], ['POST', `/lab/specimens/${ID}/reject`, benchOnly],
    ] as const)('%s %s : sans jeton → 401, profils sans le droit → 403', async (method, url, forbidden) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(url));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of forbidden) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });
  });

  describe('catalogue des analyses', () => {
    it("crée une analyse numérique active avec ses valeurs de référence, normalise le code, l'inscrit au journal", async () => {
      const r = await post('admin', '/lab/tests', {
        code: ' hgb ', name: 'Hémoglobine', ...NUMERIC, instructions: 'Tube violet',
        ranges: [{ sex: 'FEMALE', ageMinDays: 6574, low: 11.5, high: 15.5, criticalLow: 7, criticalHigh: 20 }, { sex: 'MALE', ageMinDays: 6574, low: 13, high: 17 }],
      });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ code: 'HGB', name: 'Hémoglobine', section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, tatMinutes: 120, active: true, instructions: 'Tube violet' });
      expect(r.body.ranges).toEqual([
        { sex: 'FEMALE', ageMinDays: 6574, ageMaxDays: null, low: 11.5, high: 15.5, criticalLow: 7, criticalHigh: 20 },
        { sex: 'MALE', ageMinDays: 6574, ageMaxDays: null, low: 13, high: 17, criticalLow: null, criticalHigh: null },
      ]);
      const [entry] = await auditRows('lab.test.create', r.body.id);
      expect(entry.metadata).toMatchObject({ code: 'HGB', section: 'HAEMATOLOGY', resultType: 'NUMERIC', ranges: 2 });
    });

    it('crée une analyse à choix et une analyse textuelle', async () => {
      const choice = await post('admin', '/lab/tests', { code: 'MALARIA', name: 'Test rapide paludisme', section: 'IMMUNOLOGY', specimenType: 'BLOOD', container: 'RED', resultType: 'CHOICE', choices: [' Positif ', 'Négatif'] });
      expect(choice.status).toBe(201);
      expect(choice.body).toMatchObject({ resultType: 'CHOICE', choices: ['Positif', 'Négatif'], unit: null, ranges: [] });
      const text = await post('admin', '/lab/tests', { code: 'CULT', name: "Culture d'urine", section: 'MICROBIOLOGY', specimenType: 'URINE', container: 'STERILE_CUP', resultType: 'TEXT' });
      expect(text.status).toBe(201);
      expect(text.body).toMatchObject({ resultType: 'TEXT', tatMinutes: 240, decimals: 0 });
    });

    it('refuse un code déjà pris (409), des données invalides (400/422) et des valeurs de référence incohérentes', async () => {
      const dup = await post('admin', '/lab/tests', { code: 'hgb', name: 'Autre', ...NUMERIC });
      expect([dup.status, dup.body.code]).toEqual([409, 'LAB_TEST_CODE_ALREADY_EXISTS']);
      expect((await post('admin', '/lab/tests', {})).status).toBe(400);
      expect((await post('admin', '/lab/tests', { code: 'F1', name: 'x', ...NUMERIC, decimals: 9 })).status).toBe(400);
      expect((await post('admin', '/lab/tests', { code: 'F2', name: 'x', ...NUMERIC, tatMinutes: 0 })).status).toBe(400);
      expect((await post('admin', '/lab/tests', { code: 'bad code', name: 'x', ...NUMERIC })).body.code).toBe('LAB_TEST_CODE_INVALID');
      expect((await post('admin', '/lab/tests', { code: 'F3', name: 'x', ...NUMERIC, section: 'MAGIE' })).body.code).toBe('LAB_SECTION_INVALID');
      expect((await post('admin', '/lab/tests', { code: 'F4', name: 'x', ...NUMERIC, resultType: 'IMAGE' })).body.code).toBe('LAB_RESULT_TYPE_INVALID');
      expect((await post('admin', '/lab/tests', { code: 'F5', name: 'x', ...NUMERIC, resultType: 'CHOICE', unit: null, choices: ['Seul'] })).body.code).toBe('LAB_TEST_CHOICES_INVALID');
      expect((await post('admin', '/lab/tests', { code: 'F6', name: 'x', ...NUMERIC, resultType: 'TEXT' })).body.code).toBe('LAB_TEST_UNIT_INVALID');
      expect((await post('admin', '/lab/tests', { code: 'F7', name: 'x', ...NUMERIC, ranges: [{ ageMinDays: 0, low: 20, high: 10 }] })).body.code).toBe('LAB_RANGE_INVALID');
      expect((await post('admin', '/lab/tests', { code: 'F8', name: 'x', ...NUMERIC, ranges: [{ ageMinDays: 0, low: 1, high: 2 }, { ageMinDays: 5, low: 1, high: 2 }] })).body.code).toBe('LAB_RANGE_INVALID');
    });

    it('lit une analyse, la modifie (champs modifiés tracés), ignore le code et le type de résultat', async () => {
      const t = await test();
      expect((await get('medecin', `/lab/tests/${t.id}`)).body).toMatchObject({ id: t.id, code: t.code });
      const r = await patch('admin', `/lab/tests/${t.id}`, { name: 'Renommée', tatMinutes: 30, instructions: 'À jeun', code: 'AUTRE', resultType: 'TEXT' });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ code: t.code, name: 'Renommée', tatMinutes: 30, instructions: 'À jeun', resultType: 'NUMERIC' });
      const [entry] = await auditRows('lab.test.update', t.id);
      expect(entry.metadata).toMatchObject({ changed: expect.stringContaining('name') });
      await patch('admin', `/lab/tests/${t.id}`, { name: 'Renommée', tatMinutes: 30 }).expect(200);
      expect(await auditRows('lab.test.update', t.id)).toHaveLength(1);
      expect((await patch('admin', `/lab/tests/${t.id}`, { instructions: null })).body.instructions).toBeNull();
      expect((await patch('admin', `/lab/tests/${t.id}`, { choices: ['A', 'B'] })).body.code).toBe('LAB_TEST_CHOICES_INVALID');
      expect((await patch('admin', `/lab/tests/${t.id}`, { decimals: 7 })).status).toBe(400);
      expect((await patch('admin', `/lab/tests/${UNKNOWN}`, { name: 'x' })).status).toBe(404);
      expect((await get('admin', `/lab/tests/${UNKNOWN}`)).status).toBe(404);
      expect((await get('admin', '/lab/tests/pas-un-uuid')).status).toBe(400);
    });

    it('remplace les valeurs de référence d\'un bloc, refuse les incohérentes, et les interdit hors analyse numérique', async () => {
      const t = await test({ ranges: [{ ageMinDays: 0, low: 1, high: 2 }] });
      const r = await put('admin', `/lab/tests/${t.id}/ranges`, { ranges: [{ sex: 'FEMALE', ageMinDays: 0, low: 11, high: 15 }, { sex: 'MALE', ageMinDays: 0, low: 13, high: 17, criticalLow: 8 }] });
      expect(r.status).toBe(200);
      expect(r.body.ranges).toHaveLength(2);
      expect((await put('admin', `/lab/tests/${t.id}/ranges`, { ranges: [{ ageMinDays: 0, low: 5, high: 1 }] })).body.code).toBe('LAB_RANGE_INVALID');
      expect((await get('admin', `/lab/tests/${t.id}`)).body.ranges).toHaveLength(2);
      expect((await put('admin', `/lab/tests/${t.id}/ranges`, { ranges: [] })).body.ranges).toEqual([]);
      expect((await put('admin', `/lab/tests/${t.id}/ranges`, {})).status).toBe(400);
      const text = await test({ resultType: 'TEXT', unit: null });
      expect((await put('admin', `/lab/tests/${text.id}/ranges`, { ranges: [{ ageMinDays: 0, low: 1, high: 2 }] })).body.code).toBe('LAB_RANGE_INVALID');
      expect((await put('admin', `/lab/tests/${UNKNOWN}/ranges`, { ranges: [] })).status).toBe(404);
      expect((await auditRows('lab.test.set-ranges', t.id)).length).toBeGreaterThanOrEqual(2);
    });

    it('retire et remet une analyse au catalogue ; une analyse retirée disparaît de la liste', async () => {
      const t = await test();
      expect((await post('admin', `/lab/tests/${t.id}/deactivate`)).body.active).toBe(false);
      await post('admin', `/lab/tests/${t.id}/deactivate`).expect(200);
      expect(await auditRows('lab.test.deactivate', t.id)).toHaveLength(1);
      const hidden = (await get('labo', `/lab/tests?search=${t.code}`)).body;
      expect(hidden.items).toHaveLength(0);
      expect((await get('labo', `/lab/tests?search=${t.code}&includeInactive=true`)).body.items).toHaveLength(1);
      expect((await post('admin', `/lab/tests/${t.id}/activate`)).body.active).toBe(true);
      expect((await get('labo', `/lab/tests?search=${t.code}`)).body.items).toHaveLength(1);
      expect((await post('admin', `/lab/tests/${UNKNOWN}/deactivate`)).status).toBe(404);
    });

    it('liste par section avec recherche et pagination, pour les médecins comme pour le laboratoire', async () => {
      const g = await serum({ code: 'LISTGLU', name: 'Glycémie de liste' });
      for (const who of ['medecin', 'labo', 'admin']) {
        const r = await get(who, '/lab/tests?section=BIOCHEMISTRY&search=liste');
        expect(r.status).toBe(200);
        expect(r.body.items.map((i: { id: string }) => i.id)).toEqual([g.id]);
        expect(r.body).toMatchObject({ total: 1, offset: 0, limit: 50 });
      }
      expect((await get('labo', '/lab/tests?limit=2&offset=1')).body.items).toHaveLength(2);
      expect((await get('labo', '/lab/tests?section=MAGIE')).body.code).toBe('LAB_SECTION_INVALID');
    });
  });

  describe("demandes d'analyses", () => {
    it('prescrit, prévoit un échantillon par couple (type, contenant) avec un code-barres, et trace sans donnée personnelle', async () => {
      const a = await test();
      const b = await test();
      const s = await serum();
      const r = await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [a.id, b.id, s.id], priority: 'URGENT', source: 'IPD', clinicalNotes: 'Fièvre depuis 3 jours' });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
        status: 'ORDERED', priority: 'URGENT', source: 'IPD', clinicalNotes: 'Fièvre depuis 3 jours', number: expect.stringMatching(/^LAB-\d{7}$/), orderedBy: { username: 'medecin' },
        patient: { lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: BIRTH }, cancelledAt: null,
      });
      expect(r.body.tests).toHaveLength(3);
      expect(r.body.specimens).toHaveLength(2);
      expect(r.body.specimens.map((x: { barcode: string }) => x.barcode).every((x: string) => /^SPC-\d{7}$/.test(x))).toBe(true);
      expect(r.body.specimens.every((x: { status: string; events: { kind: string }[] }) => x.status === 'PENDING_COLLECTION' && x.events[0].kind === 'CREATED')).toBe(true);
      const bySpecimen = (code: string) => r.body.tests.find((t: { code: string }) => t.code === code).specimenId;
      expect(bySpecimen(a.code)).toBe(bySpecimen(b.code));
      expect(bySpecimen(a.code)).not.toBe(bySpecimen(s.code));
      const [entry] = await auditRows('lab.requisition.order', r.body.id);
      expect(entry.metadata).toMatchObject({ priority: 'URGENT', source: 'IPD', tests: 3, specimens: 2 });
      expect(JSON.stringify(entry)).not.toMatch(NO_PII);
    });

    it('prend la routine et la consultation externe par défaut, et accepte une demande du laboratoire (patient de passage)', async () => {
      const t = await test();
      const r = await order('labo', [t.id], { source: 'EXTERNAL' });
      expect(r).toMatchObject({ priority: 'ROUTINE', source: 'EXTERNAL', orderedBy: { username: 'labo' } });
      expect((await order('medecin', [t.id])).source).toBe('OPD');
    });

    it('refuse une demande invalide : vide, doublon, trop longue, analyse inconnue ou retirée, patient inconnu, valeurs inconnues', async () => {
      const t = await test();
      expect((await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [] })).status).toBe(400);
      expect((await post('medecin', '/lab/requisitions', { patientId: 'x', testIds: [t.id] })).status).toBe(400);
      expect((await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: Array.from({ length: 31 }, () => t.id) })).status).toBe(400);
      const dup = await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [t.id, t.id] });
      expect([dup.status, dup.body.code]).toEqual([422, 'LAB_TEST_DUPLICATED']);
      expect((await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [UNKNOWN] })).body.code).toBe('LAB_TEST_NOT_FOUND');
      expect((await post('medecin', '/lab/requisitions', { patientId: UNKNOWN, testIds: [t.id] })).body.code).toBe('LAB_PATIENT_NOT_FOUND');
      expect((await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [t.id], priority: 'NOW' })).status).toBe(400);
      expect((await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [t.id], clinicalNotes: 'x'.repeat(501) })).status).toBe(400);
      await post('admin', `/lab/tests/${t.id}/deactivate`).expect(200);
      const inactive = await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [t.id] });
      expect([inactive.status, inactive.body.code]).toEqual([409, 'LAB_TEST_INACTIVE']);
      // Aucun numéro n'est consommé par une demande refusée : la suivante prend le numéro attendu.
      const ok = await test();
      const first = await order('medecin', [ok.id]);
      const second = await order('medecin', [ok.id]);
      expect(Number(second.number.slice(4)) - Number(first.number.slice(4))).toBe(1);
    });

    it('un prescripteur ne voit que ses demandes ; le laboratoire et l\'administrateur système les voient toutes', async () => {
      const t = await test();
      const mine = await order('medecin', [t.id]);
      const theirs = await order('labo', [t.id]);
      expect((await get('medecin', `/lab/requisitions/${mine.id}`)).status).toBe(200);
      expect((await get('medecin', `/lab/requisitions/${theirs.id}`)).status).toBe(404);
      const doctorList = (await get('medecin', '/lab/requisitions?limit=200')).body.items.map((i: { id: string }) => i.id);
      expect(doctorList).toContain(mine.id);
      expect(doctorList).not.toContain(theirs.id);
      for (const who of ['labo', 'admin']) {
        const all = (await get(who, '/lab/requisitions?limit=200')).body.items.map((i: { id: string }) => i.id);
        expect(all).toEqual(expect.arrayContaining([mine.id, theirs.id]));
        expect((await get(who, `/lab/requisitions/${mine.id}`)).status).toBe(200);
      }
      const bc = theirs.specimens[0].barcode;
      expect((await get('medecin', `/lab/specimens/by-barcode/${bc}`)).status).toBe(404);
      expect((await get('labo', `/lab/specimens/by-barcode/${bc}`)).body).toMatchObject({ id: theirs.id, specimenId: theirs.specimens[0].id });
      expect((await get('labo', '/lab/specimens/by-barcode/SPC-9999999')).status).toBe(404);
      expect((await get('labo', '/lab/specimens/by-barcode/nimporte')).status).toBe(404);
    });

    it('lit une demande (consultation tracée), liste avec filtres et ordre de priorité, et refuse les filtres invalides', async () => {
      const t = await test();
      const routine = await order('labo', [t.id]);
      const stat = await order('labo', [t.id], { priority: 'STAT', source: 'ER', patientId: ids.patients[1] });
      const read = await get('labo', `/lab/requisitions/${stat.id}`);
      expect(read.body).toMatchObject({ id: stat.id, priority: 'STAT', patient: { lastName: 'Ndongo' } });
      expect(await auditRows('lab.requisition.read', stat.id)).toHaveLength(1);

      const list = (await get('labo', '/lab/requisitions?status=ORDERED&limit=200')).body;
      const order_ = list.items.map((i: { id: string }) => i.id);
      expect(order_.indexOf(stat.id)).toBeLessThan(order_.indexOf(routine.id));
      expect(list.items.find((i: { id: string }) => i.id === stat.id)).toMatchObject({ priority: 'STAT', source: 'ER', testCodes: [t.code], sections: ['HAEMATOLOGY'], patient: { lastName: 'Ndongo' }, orderedBy: { username: 'labo' } });
      expect((await get('labo', `/lab/requisitions?patientId=${ids.patients[1]}&priority=STAT&source=ER&section=HAEMATOLOGY`)).body.items.map((i: { id: string }) => i.id)).toContain(stat.id);
      expect((await get('labo', `/lab/requisitions?number=${routine.number}`)).body.items.map((i: { id: string }) => i.id)).toEqual([routine.id]);
      expect((await get('labo', `/lab/requisitions?barcode=${stat.specimens[0].barcode}`)).body.items.map((i: { id: string }) => i.id)).toEqual([stat.id]);
      expect((await get('labo', '/lab/requisitions?status=DONE')).body.code).toBe('LAB_STATUS_FILTER_INVALID');
      expect((await get('labo', '/lab/requisitions?priority=NOW')).body.code).toBe('LAB_PRIORITY_INVALID');
      expect((await get('labo', '/lab/requisitions?number=X')).body.code).toBe('LAB_REQUISITION_NUMBER_INVALID');
      expect((await get('labo', '/lab/requisitions?barcode=X')).body.code).toBe('LAB_BARCODE_INVALID');
      expect((await get('labo', `/lab/requisitions/${UNKNOWN}`)).status).toBe(404);
      expect(await c.w.sql.query("SELECT 1 FROM audit_log WHERE action = 'lab.requisition.list'")).not.toHaveLength(0);
    });
  });

  describe('prélèvement, réception et rejet', () => {
    it('prélève après contrôle de deux identifiants, avec le préleveur et l\'heure, puis reçoit au laboratoire', async () => {
      const t = await test();
      const r = await order('medecin', [t.id]);
      const sp = r.specimens[0];
      const collected = await post('labo', `/lab/specimens/${sp.id}/collect`, collectBody(r, { patientNumber: ` ${r.patient.number.toLowerCase()} ` }));
      expect(collected.status).toBe(200);
      expect(collected.body.status).toBe('COLLECTED');
      expect(collected.body.specimens[0]).toMatchObject({ status: 'COLLECTED', collectedBy: { username: 'labo' }, collectedAt: expect.stringMatching(/Z$/) });
      const [entry] = await auditRows('lab.specimen.collect', r.id);
      expect(entry).toMatchObject({ outcome: 'SUCCESS', metadata: { barcode: sp.barcode } });
      expect(JSON.stringify(entry)).not.toMatch(NO_PII);

      const received = await post('labo', `/lab/specimens/${sp.id}/receive`);
      expect(received.status).toBe(200);
      expect(received.body.status).toBe('RECEIVED');
      expect(received.body.specimens[0]).toMatchObject({ status: 'RECEIVED', receivedBy: { username: 'labo' } });
      expect(received.body.specimens[0].events.map((e: { kind: string }) => e.kind)).toEqual(['CREATED', 'COLLECTED', 'RECEIVED']);
      expect(received.body.specimens[0].events.map((e: { actor: { username: string } | null }) => e.actor?.username)).toEqual(['medecin', 'labo', 'labo']);
      expect((await get('medecin', `/lab/requisitions/${r.id}`)).body.status).toBe('RECEIVED');
    });

    it('bloque le prélèvement si l\'identité ne correspond pas, et trace l\'échec', async () => {
      const t = await test();
      const r = await order('medecin', [t.id]);
      const sp = r.specimens[0];
      for (const wrong of [collectBody(r, { patientNumber: 'PAT-9999999' }), collectBody(r, { birthDate: '1990-03-15' }), collectBody(r, { patientNumber: 'PAT-0000002' })]) {
        const res = await post('labo', `/lab/specimens/${sp.id}/collect`, wrong);
        expect([res.status, res.body.code]).toEqual([409, 'LAB_IDENTITY_MISMATCH']);
      }
      expect((await get('labo', `/lab/requisitions/${r.id}`)).body.specimens[0].status).toBe('PENDING_COLLECTION');
      const failures = (await auditRows('lab.specimen.collect', r.id)).filter((e) => e.outcome === 'FAILURE');
      expect(failures).toHaveLength(3);
      expect(failures[0].reason).toBe('Identité du patient non confirmée');
      expect(JSON.stringify(failures)).not.toMatch(NO_PII);
      expect((await post('labo', `/lab/specimens/${sp.id}/collect`, {})).status).toBe(400);
      expect((await post('labo', `/lab/specimens/${sp.id}/collect`, { patientNumber: r.patient.number, birthDate: 'demain' })).status).toBe(400);
    });

    it('ne prélève qu\'une fois, ne reçoit que du prélevé, et ignore les échantillons inconnus', async () => {
      const t = await test();
      const r = await order('medecin', [t.id]);
      const sp = r.specimens[0];
      const early = await post('labo', `/lab/specimens/${sp.id}/receive`);
      expect([early.status, early.body.code]).toEqual([409, 'LAB_SPECIMEN_NOT_COLLECTED']);
      await post('labo', `/lab/specimens/${sp.id}/collect`, collectBody(r)).expect(200);
      const again = await post('labo', `/lab/specimens/${sp.id}/collect`, collectBody(r));
      expect([again.status, again.body.code]).toEqual([409, 'LAB_SPECIMEN_NOT_PENDING']);
      await post('labo', `/lab/specimens/${sp.id}/receive`).expect(200);
      expect((await post('labo', `/lab/specimens/${sp.id}/receive`)).body.code).toBe('LAB_SPECIMEN_NOT_COLLECTED');
      for (const url of ['collect', 'receive', 'reject']) expect((await post('labo', `/lab/specimens/${UNKNOWN}/${url}`, { ...collectBody(r), reason: 'CLOTTED' })).status).toBe(404);
    });

    it('suit l\'avancement d\'une demande à deux échantillons : partiellement prélevée, prélevée, reçue', async () => {
      const a = await test();
      const s = await serum();
      const r = await order('medecin', [a.id, s.id]);
      const [one, two] = r.specimens;
      expect((await post('labo', `/lab/specimens/${one.id}/collect`, collectBody(r))).body.status).toBe('PARTIALLY_COLLECTED');
      expect((await post('labo', `/lab/specimens/${two.id}/collect`, collectBody(r))).body.status).toBe('COLLECTED');
      expect((await post('labo', `/lab/specimens/${one.id}/receive`)).body.status).toBe('COLLECTED');
      expect((await post('labo', `/lab/specimens/${two.id}/receive`)).body.status).toBe('RECEIVED');
    });

    it('rejette un échantillon : motif, nouveau prélèvement rattaché aux analyses, historique conservé, trace', async () => {
      const t = await test();
      const r = await order('medecin', [t.id]);
      const sp = r.specimens[0];
      await post('labo', `/lab/specimens/${sp.id}/collect`, collectBody(r)).expect(200);
      const rejected = await post('labo', `/lab/specimens/${sp.id}/reject`, { reason: 'HEMOLYSED', note: 'Plasma rosé' });
      expect(rejected.status).toBe(200);
      expect(rejected.body.status).toBe('ORDERED');
      expect(rejected.body.specimens).toHaveLength(2);
      const [old, fresh] = rejected.body.specimens;
      expect(old).toMatchObject({ status: 'REJECTED', rejectionReason: 'HEMOLYSED', rejectionNote: 'Plasma rosé', rejectedBy: { username: 'labo' } });
      expect(old.events.map((e: { kind: string }) => e.kind)).toEqual(['CREATED', 'COLLECTED', 'REJECTED']);
      expect(fresh).toMatchObject({ status: 'PENDING_COLLECTION', recollectionOf: sp.id, specimenType: 'BLOOD', container: 'PURPLE' });
      expect(fresh.barcode).not.toBe(sp.barcode);
      expect(rejected.body.tests[0].specimenId).toBe(fresh.id);
      const [entry] = await auditRows('lab.specimen.reject', r.id);
      expect(entry).toMatchObject({ reason: 'Plasma rosé', metadata: { barcode: sp.barcode, rejection: 'HEMOLYSED', recollection: fresh.barcode } });
      expect((await post('labo', `/lab/specimens/${sp.id}/reject`, { reason: 'CLOTTED' })).body.code).toBe('LAB_SPECIMEN_ALREADY_REJECTED');
      // Le remplaçant suit le cycle normal.
      await post('labo', `/lab/specimens/${fresh.id}/collect`, collectBody(r)).expect(200);
      expect((await post('labo', `/lab/specimens/${fresh.id}/receive`)).body.status).toBe('RECEIVED');
    });

    it('« autre » exige une précision ; motif inconnu ou précision trop longue refusés', async () => {
      const t = await test();
      const r = await order('medecin', [t.id]);
      const sp = r.specimens[0];
      const noNote = await post('labo', `/lab/specimens/${sp.id}/reject`, { reason: 'OTHER' });
      expect([noNote.status, noNote.body.code]).toEqual([422, 'LAB_REJECTION_NOTE_REQUIRED']);
      expect((await post('labo', `/lab/specimens/${sp.id}/reject`, { reason: 'LOST' })).status).toBe(400);
      expect((await post('labo', `/lab/specimens/${sp.id}/reject`, { reason: 'CLOTTED', note: 'x'.repeat(201) })).status).toBe(400);
      expect((await get('labo', `/lab/requisitions/${r.id}`)).body.specimens).toHaveLength(1);
      expect((await post('labo', `/lab/specimens/${sp.id}/reject`, { reason: 'OTHER', note: 'Tube fissuré' })).body.specimens[0].rejectionNote).toBe('Tube fissuré');
    });

    it('annule avec un motif : le prescripteur la sienne, le laboratoire n\'importe laquelle ; plus après réception', async () => {
      const t = await test();
      const mine = await order('medecin', [t.id]);
      const theirs = await order('labo', [t.id]);
      expect((await post('medecin', `/lab/requisitions/${theirs.id}/cancel`, { reason: 'Pas à moi' })).status).toBe(404);
      expect((await post('medecin', `/lab/requisitions/${mine.id}/cancel`, {})).status).toBe(400);
      expect((await post('medecin', `/lab/requisitions/${mine.id}/cancel`, { reason: '  ' })).body.code).toBe('LAB_REASON_REQUIRED');
      const done = await post('medecin', `/lab/requisitions/${mine.id}/cancel`, { reason: 'Prescrit par erreur' });
      expect(done.status).toBe(200);
      expect(done.body).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Prescrit par erreur', cancelledBy: { username: 'medecin' } });
      expect((await auditRows('lab.requisition.cancel', mine.id))[0].reason).toBe('Prescrit par erreur');
      expect((await post('medecin', `/lab/requisitions/${mine.id}/cancel`, { reason: 'Encore' })).body.code).toBe('LAB_REQUISITION_ALREADY_CANCELLED');
      const blocked = await post('labo', `/lab/specimens/${mine.specimens[0].id}/collect`, collectBody(mine));
      expect([blocked.status, blocked.body.code]).toEqual([409, 'LAB_REQUISITION_CANCELLED']);
      expect((await post('labo', `/lab/requisitions/${theirs.id}/cancel`, { reason: 'Doublon' })).body.status).toBe('CANCELLED');

      const received = await order('medecin', [t.id]);
      await post('labo', `/lab/specimens/${received.specimens[0].id}/collect`, collectBody(received)).expect(200);
      await post('labo', `/lab/specimens/${received.specimens[0].id}/receive`).expect(200);
      const late = await post('medecin', `/lab/requisitions/${received.id}/cancel`, { reason: 'Trop tard' });
      expect([late.status, late.body.code]).toEqual([409, 'LAB_REQUISITION_IN_PROGRESS']);
    });

    it('deux techniciens qui prélèvent le même échantillon en même temps : un seul réussit', async () => {
      const t = await test();
      const r = await order('medecin', [t.id]);
      const results = await Promise.all([post('labo', `/lab/specimens/${r.specimens[0].id}/collect`, collectBody(r)), post('labo', `/lab/specimens/${r.specimens[0].id}/collect`, collectBody(r))]);
      expect(results.map((x) => x.status).sort()).toEqual([200, 409]);
      expect((await get('labo', `/lab/requisitions/${r.id}`)).body.specimens[0].events.filter((e: { kind: string }) => e.kind === 'COLLECTED')).toHaveLength(1);
    });
  });
});

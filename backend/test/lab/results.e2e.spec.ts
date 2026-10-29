import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const BIRTH = '1990-03-14';
const CALL = { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', readBackConfirmed: true };

describe('API résultats du laboratoire /api/v1/lab (HTTP réel, PostgreSQL réel)', () => {
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

  let seq = 0;
  const RANGES = [
    { sex: 'FEMALE', ageMinDays: 6574, low: 11.5, high: 15.5, criticalLow: 7, criticalHigh: 20 },
    { sex: 'MALE', ageMinDays: 6574, low: 13, high: 17, criticalLow: 7, criticalHigh: 20 },
  ];
  const test = async (over: Record<string, unknown> = {}): Promise<{ id: string; code: string }> => {
    seq += 1;
    const r = await post('admin', '/lab/tests', { code: `R-${seq}`, name: `Résultat ${seq}`, section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, ranges: RANGES, ...over }).expect(201);
    return { id: r.body.id as string, code: r.body.code as string };
  };
  /** Une demande de `tests`, dont tous les échantillons sont prélevés puis reçus au laboratoire. */
  const received = async (tests: { id: string }[], patient = ids.patients[0]) => {
    const order = (await post('medecin', '/lab/requisitions', { patientId: patient, testIds: tests.map((t) => t.id) }).expect(201)).body;
    let last = order;
    for (const s of order.specimens) {
      await post('labo', `/lab/specimens/${s.id}/collect`, { patientNumber: order.patient.number, birthDate: BIRTH }).expect(200);
      last = (await post('labo', `/lab/specimens/${s.id}/receive`).expect(200)).body;
    }
    return last;
  };
  const url = (r: { id: string }, t: { id: string }, tail = '') => `/lab/requisitions/${r.id}/results/${t.id}${tail}`;
  const enter = (who: string, r: { id: string }, t: { id: string }, value: string, extra: object = {}) => put(who, url(r, t), { value, ...extra });
  const resultOf = (body: { tests: { testId: string; result: any }[] }, t: { id: string }) => body.tests.find((x) => x.testId === t.id)!.result;
  const audit = (action: string, resourceId: string) => c.w.sql.query<{ reason: string | null; metadata: Record<string, unknown> }>('SELECT reason, metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);
  /** Saisie par `labo`, validation puis publication par `labo2`. */
  const published = async (r: { id: string }, t: { id: string }, value: string) => {
    await enter('labo', r, t, value).expect(200);
    await post('labo2', url(r, t, '/verify')).expect(200);
    return (await post('labo2', url(r, t, '/release')).expect(200)).body;
  };

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    const NOT_BENCH = ['patient', 'accueil', 'caisse', 'comptable', 'infirmier', 'medecin', 'admin'];
    it.each([
      ['PUT', `/lab/requisitions/${ID}/results/${ID}`], ['POST', `/lab/requisitions/${ID}/results/${ID}/verify`], ['POST', `/lab/requisitions/${ID}/results/${ID}/return`],
      ['POST', `/lab/requisitions/${ID}/results/${ID}/critical-notification`], ['POST', `/lab/requisitions/${ID}/results/${ID}/release`], ['POST', `/lab/requisitions/${ID}/results/${ID}/amend`],
    ])('%s %s : sans jeton → 401 ; hors laboratoire (médecin et administrateur système compris) → 403', async (method, path) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(path));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of NOT_BENCH) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });
  });

  describe('saisie', () => {
    it('refuse tant que l\'échantillon n\'est pas arrivé au laboratoire, puis accepte', async () => {
      const t = await test();
      const order = (await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [t.id] }).expect(201)).body;
      const early = await enter('labo', order, t, '13');
      expect([early.status, early.body.code]).toEqual([409, 'LAB_SPECIMEN_NOT_RECEIVED']);
      await post('labo', `/lab/specimens/${order.specimens[0].id}/collect`, { patientNumber: order.patient.number, birthDate: BIRTH }).expect(200);
      expect((await enter('labo', order, t, '13')).body.code).toBe('LAB_SPECIMEN_NOT_RECEIVED');
      await post('labo', `/lab/specimens/${order.specimens[0].id}/receive`).expect(200);
      const ok = await enter('labo', order, t, '13.5', { comment: ' Contrôlé ' });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe('RESULTED');
      expect(resultOf(ok.body, t)).toMatchObject({
        status: 'ENTERED', currentVersion: 1, releasedVersion: null, criticalRequired: false, criticalNotified: false,
        versions: [{ version: 1, value: '13.5', flag: 'NORMAL', unit: 'g/dL', refLow: 11.5, refHigh: 15.5, criticalLow: 7, criticalHigh: 20, previousValue: null, deltaAlert: false, enteredBy: { username: 'labo' }, comment: 'Contrôlé' }],
      });
    });

    it.each([
      ['13', 'NORMAL'], ['11.4', 'LOW'], ['6.9', 'CRITICAL_LOW'], ['15.6', 'HIGH'], ['20.1', 'CRITICAL_HIGH'], ['12', 'NORMAL'],
    ])('position de %s : %s (la tranche des femmes, pas celle des hommes qui aurait signalé 12 bas)', async (value, flag) => {
      const t = await test();
      const r = await received([t]);
      const res = resultOf((await enter('labo', r, t, value)).body, t);
      expect(res.versions[0].flag).toBe(flag);
      expect(res.criticalRequired).toBe(flag.startsWith('CRITICAL'));
    });

    it('normalise la virgule, refuse les valeurs invalides, et ne pose pas de drapeau sans valeurs de référence', async () => {
      const t = await test();
      const bare = await test({ ranges: [] });
      const r = await received([t, bare]);
      expect(resultOf((await enter('labo', r, t, '9,4')).body, t).versions[0].value).toBe('9.4');
      for (const bad of ['abc', '1e5', '12.1234567', '']) {
        const res = await enter('labo', r, t, bad);
        expect([bad, res.status, res.body.code ?? 'VALIDATION']).toEqual([bad, bad === '' ? 400 : 422, bad === '' ? 'VALIDATION_FAILED' : 'LAB_RESULT_VALUE_INVALID']);
      }
      expect((await enter('labo', r, t, '5', { comment: 'x'.repeat(301) })).status).toBe(400);
      expect(resultOf((await enter('labo', r, bare, '77')).body, bare).versions[0]).toMatchObject({ flag: null, refLow: null, refHigh: null });
    });

    it('les analyses à choix et textuelles contrôlent leur valeur', async () => {
      const choice = await test({ code: `CH-${++seq}`, resultType: 'CHOICE', unit: null, ranges: [], choices: ['Positif', 'Négatif'] });
      const text = await test({ code: `TX-${++seq}`, resultType: 'TEXT', unit: null, ranges: [] });
      const r = await received([choice, text]);
      expect((await enter('labo', r, choice, 'Douteux')).body.code).toBe('LAB_RESULT_CHOICE_INVALID');
      expect(resultOf((await enter('labo', r, choice, 'positif')).body, choice).versions[0]).toMatchObject({ value: 'Positif', flag: null });
      expect(resultOf((await enter('labo', r, text, ' Culture stérile à 48 h ')).body, text).versions[0].value).toBe('Culture stérile à 48 h');
    });

    it('chaque ressaisie avant validation est une nouvelle version, sans réécrire les précédentes', async () => {
      const t = await test();
      const r = await received([t]);
      await enter('labo', r, t, '13').expect(200);
      const second = await enter('labo', r, t, '14.2', { comment: 'Second passage' });
      expect(resultOf(second.body, t).versions.map((v: { version: number; value: string }) => [v.version, v.value])).toEqual([[1, '13'], [2, '14.2']]);
      expect(resultOf(second.body, t).currentVersion).toBe(2);
    });

    it('signale une variation de plus de 30 % par rapport au dernier résultat publié du patient (delta check)', async () => {
      const t = await test();
      await published(await received([t]), t, '12');
      const next = await received([t]);
      const big = resultOf((await enter('labo', next, t, '16.5')).body, t).versions[0];
      expect(big).toMatchObject({ previousValue: 12, deltaAlert: true });
      const small = resultOf((await enter('labo', next, t, '13')).body, t).versions[1];
      expect(small).toMatchObject({ previousValue: 12, deltaAlert: false });
      const other = await received([t], ids.patients[1]);
      expect(resultOf((await enter('labo', other, t, '16.5')).body, t).versions[0]).toMatchObject({ previousValue: null, deltaAlert: false });
    });

    it('refuse une analyse qui n\'est pas dans la demande, une demande inconnue, et un identifiant invalide', async () => {
      const t = await test();
      const stranger = await test();
      const r = await received([t]);
      expect((await enter('labo', r, stranger, '13')).body.code).toBe('LAB_TEST_NOT_IN_REQUISITION');
      expect((await enter('labo', { id: UNKNOWN }, t, '13')).status).toBe(404);
      expect((await put('labo', `/lab/requisitions/${r.id}/results/pas-un-uuid`, { value: '1' })).status).toBe(400);
      expect((await put('labo', url(r, t), {})).status).toBe(400);
    });
  });

  describe('validation, renvoi et publication', () => {
    it('quatre yeux : ni la validation ni la publication par l\'auteur de la saisie', async () => {
      const t = await test();
      const r = await received([t]);
      await enter('labo', r, t, '13').expect(200);
      expect((await post('labo2', url(r, t, '/release'))).body.code).toBe('LAB_RESULT_NOT_VERIFIED');
      const self = await post('labo', url(r, t, '/verify'));
      expect([self.status, self.body.code]).toEqual([409, 'LAB_VERIFY_SELF']);
      const verified = await post('labo2', url(r, t, '/verify'));
      expect(verified.status).toBe(200);
      expect(verified.body.status).toBe('VERIFIED');
      expect(resultOf(verified.body, t)).toMatchObject({ status: 'VERIFIED', verifiedBy: { username: 'labo2' } });
      expect((await post('labo2', url(r, t, '/verify'))).body.code).toBe('LAB_RESULT_NOT_PENDING_VERIFICATION');
      expect((await post('labo', url(r, t, '/release'))).body.code).toBe('LAB_VERIFY_SELF');
      const released = await post('labo2', url(r, t, '/release'));
      expect(released.status).toBe(200);
      expect(released.body.status).toBe('RELEASED');
      expect(resultOf(released.body, t)).toMatchObject({ status: 'RELEASED', releasedVersion: 1, releasedBy: { username: 'labo2' }, releasedAt: expect.stringMatching(/Z$/) });
      expect((await post('labo2', url(r, t, '/release'))).body.code).toBe('LAB_RESULT_NOT_VERIFIED');
    });

    it('un résultat validé ou publié est verrouillé ; renvoyé avec un motif, il se ressaisit', async () => {
      const t = await test();
      const r = await received([t]);
      await enter('labo', r, t, '13').expect(200);
      await post('labo2', url(r, t, '/verify')).expect(200);
      const locked = await enter('labo', r, t, '14');
      expect([locked.status, locked.body.code]).toEqual([409, 'LAB_RESULT_LOCKED']);
      expect((await post('labo2', url(r, t, '/return'), {})).status).toBe(400);
      expect((await post('labo2', url(r, t, '/return'), { reason: '  ' })).body.code).toBe('LAB_REASON_REQUIRED');
      const returned = await post('labo2', url(r, t, '/return'), { reason: 'Valeur incohérente avec le précédent' });
      expect(returned.status).toBe(200);
      expect(resultOf(returned.body, t)).toMatchObject({ status: 'RETURNED', returnReason: 'Valeur incohérente avec le précédent', verifiedBy: null });
      expect(returned.body.status).toBe('IN_ANALYSIS');
      expect((await post('labo2', url(r, t, '/verify'))).body.code).toBe('LAB_RESULT_NOT_PENDING_VERIFICATION');
      const again = await enter('labo', r, t, '12.9');
      expect(resultOf(again.body, t)).toMatchObject({ status: 'ENTERED', returnReason: null, currentVersion: 2 });
      await post('labo2', url(r, t, '/verify')).expect(200);
      await post('labo2', url(r, t, '/release')).expect(200);
      expect((await enter('labo', r, t, '1')).body.code).toBe('LAB_RESULT_LOCKED');
      expect((await post('labo2', url(r, t, '/return'), { reason: 'Trop tard' })).body.code).toBe('LAB_RESULT_NOT_PENDING_VERIFICATION');
    });

    it('une valeur critique ne se publie qu\'après l\'appel du clinicien, relecture confirmée', async () => {
      const t = await test();
      const r = await received([t]);
      const entered = await enter('labo', r, t, '5.1');
      expect(resultOf(entered.body, t)).toMatchObject({ criticalRequired: true, criticalNotified: false });
      await post('labo2', url(r, t, '/verify')).expect(200);
      const blocked = await post('labo2', url(r, t, '/release'));
      expect([blocked.status, blocked.body.code]).toEqual([409, 'LAB_CRITICAL_NOT_NOTIFIED']);
      const noReadBack = await post('labo2', url(r, t, '/critical-notification'), { ...CALL, readBackConfirmed: false });
      expect([noReadBack.status, noReadBack.body.code]).toEqual([422, 'LAB_READBACK_REQUIRED']);
      expect((await post('labo2', url(r, t, '/critical-notification'), { ...CALL, method: 'PIGEON' })).status).toBe(400);
      expect((await post('labo2', url(r, t, '/critical-notification'), { ...CALL, notifiedName: '' })).status).toBe(400);
      expect((await post('labo2', url(r, t, '/critical-notification'), { ...CALL, notifiedName: '   ' })).body.code).toBe('LAB_NOTIFY_FIELD_INVALID');
      const noted = await post('labo2', url(r, t, '/critical-notification'), CALL);
      expect(noted.status).toBe(200);
      expect(resultOf(noted.body, t)).toMatchObject({ criticalNotified: true, notifications: [{ version: 1, notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', by: { username: 'labo2' } }] });
      expect((await post('labo2', url(r, t, '/release'))).status).toBe(200);
      expect((await post('labo2', url(r, t, '/critical-notification'), CALL)).body.code).toBe('LAB_RESULT_LOCKED');
      const [entry] = await audit('lab.result.critical-notified', r.id);
      expect(entry.metadata).toMatchObject({ testCode: t.code, version: 1, critical: true, method: 'PHONE' });
      expect(JSON.stringify(entry)).not.toMatch(/Curie|garde/);
    });

    it('refuse l\'appel pour un résultat normal ou absent', async () => {
      const t = await test();
      const r = await received([t]);
      expect((await post('labo', url(r, t, '/critical-notification'), CALL)).body.code).toBe('LAB_RESULT_NOT_ENTERED');
      await enter('labo', r, t, '13').expect(200);
      const normal = await post('labo', url(r, t, '/critical-notification'), CALL);
      expect([normal.status, normal.body.code]).toEqual([409, 'LAB_RESULT_NOT_CRITICAL']);
    });

    it('déduit l\'avancement de la demande : reçue, en analyse, saisie, validée, publiée', async () => {
      const a = await test();
      const b = await test();
      const r = await received([a, b]);
      const status = async () => (await get('labo', `/lab/requisitions/${r.id}`)).body.status;
      expect(await status()).toBe('RECEIVED');
      await enter('labo', r, a, '13').expect(200);
      expect(await status()).toBe('IN_ANALYSIS');
      await enter('labo', r, b, '13').expect(200);
      expect(await status()).toBe('RESULTED');
      expect((await get('labo', '/lab/requisitions?status=RESULTED&limit=200')).body.items.map((i: { id: string }) => i.id)).toContain(r.id);
      await post('labo2', url(r, a, '/verify')).expect(200);
      await post('labo2', url(r, b, '/verify')).expect(200);
      expect(await status()).toBe('VERIFIED');
      await post('labo2', url(r, a, '/release')).expect(200);
      expect(await status()).toBe('VERIFIED');
      await post('labo2', url(r, b, '/release')).expect(200);
      expect(await status()).toBe('RELEASED');
    });
  });

  describe('amendement', () => {
    it('amende un résultat publié avec un motif : nouvelle version à valider et publier, toutes les versions conservées', async () => {
      const t = await test();
      const r = await received([t]);
      await published(r, t, '13.5');
      const early = await post('labo', url(r, t, '/amend'), { value: '14' });
      expect(early.status).toBe(400);
      const amended = await post('labo', url(r, t, '/amend'), { value: '31.5', reason: 'Erreur de transcription' });
      expect(amended.status).toBe(200);
      expect(amended.body.status).toBe('RESULTED');
      expect(resultOf(amended.body, t)).toMatchObject({ status: 'ENTERED', releasedVersion: 1, currentVersion: 2, amendmentPending: true, criticalRequired: true });
      expect(resultOf(amended.body, t).versions.map((v: { version: number; value: string; amendmentReason: string | null }) => [v.version, v.value, v.amendmentReason])).toEqual([[1, '13.5', null], [2, '31.5', 'Erreur de transcription']]);
      await post('labo2', url(r, t, '/verify')).expect(200);
      expect((await post('labo2', url(r, t, '/release'))).body.code).toBe('LAB_CRITICAL_NOT_NOTIFIED');
      await post('labo2', url(r, t, '/critical-notification'), CALL).expect(200);
      const done = await post('labo2', url(r, t, '/release'));
      expect(resultOf(done.body, t)).toMatchObject({ status: 'RELEASED', releasedVersion: 2, amendmentPending: false });
      const [entry] = await audit('lab.result.amend', r.id);
      expect(entry.reason).toBe('Erreur de transcription');
    });

    it('n\'amende que ce qui est publié, et valide la valeur', async () => {
      const t = await test();
      const r = await received([t]);
      expect((await post('labo', url(r, t, '/amend'), { value: '1', reason: 'x' })).body.code).toBe('LAB_RESULT_NOT_ENTERED');
      await enter('labo', r, t, '13').expect(200);
      expect((await post('labo', url(r, t, '/amend'), { value: '1', reason: 'x' })).body.code).toBe('LAB_RESULT_NOT_RELEASED');
      await post('labo2', url(r, t, '/verify')).expect(200);
      await post('labo2', url(r, t, '/release')).expect(200);
      expect((await post('labo', url(r, t, '/amend'), { value: 'abc', reason: 'x' })).body.code).toBe('LAB_RESULT_VALUE_INVALID');
      expect((await post('labo', url(r, t, '/amend'), { value: '1', reason: '   ' })).body.code).toBe('LAB_REASON_REQUIRED');
    });
  });

  describe('confidentialité', () => {
    it('le prescripteur ne lit que ce qui est publié ; le laboratoire et l\'administrateur système lisent tout', async () => {
      const t = await test();
      const r = await received([t]);
      const doctor = async () => resultOf((await get('medecin', `/lab/requisitions/${r.id}`)).body, t);
      expect(await doctor()).toBeNull();
      await enter('labo', r, t, '13.37').expect(200);
      expect(await doctor()).toMatchObject({ status: 'IN_PROGRESS', versions: [], currentVersion: null, releasedVersion: null, notifications: [] });
      await post('labo2', url(r, t, '/verify')).expect(200);
      expect(JSON.stringify(await doctor())).not.toContain('13.37');
      const lab = resultOf((await get('labo', `/lab/requisitions/${r.id}`)).body, t);
      expect(lab.versions[0].value).toBe('13.37');
      expect(resultOf((await get('admin', `/lab/requisitions/${r.id}`)).body, t).versions[0].value).toBe('13.37');

      await post('labo2', url(r, t, '/release')).expect(200);
      const released = await doctor();
      expect(released).toMatchObject({ status: 'RELEASED', releasedVersion: 1, versions: [{ version: 1, value: '13.37', flag: 'NORMAL', unit: 'g/dL' }], amendmentPending: false });
      expect(released.notifications).toEqual([]);
      expect(released.verifiedBy).toBeNull();
    });

    it('pendant un amendement, le prescripteur continue de lire la version publiée et sait qu\'un amendement est en cours', async () => {
      const t = await test();
      const r = await received([t]);
      await published(r, t, '13.5');
      await post('labo', url(r, t, '/amend'), { value: '14.9', reason: 'Correction' }).expect(200);
      const doctor = resultOf((await get('medecin', `/lab/requisitions/${r.id}`)).body, t);
      expect(doctor).toMatchObject({ status: 'RELEASED', releasedVersion: 1, amendmentPending: true, versions: [{ version: 1, value: '13.5' }] });
      expect(JSON.stringify(doctor)).not.toContain('14.9');
    });

    it('le journal d\'audit ne contient jamais la valeur d\'un résultat ni de donnée personnelle', async () => {
      const t = await test();
      const r = await received([t]);
      await enter('labo', r, t, '17.77').expect(200);
      await post('labo2', url(r, t, '/verify')).expect(200);
      await post('labo2', url(r, t, '/release')).expect(200);
      await post('labo', url(r, t, '/amend'), { value: '18.88', reason: 'Correction' }).expect(200);
      const rows = await c.w.sql.query("SELECT action, reason, metadata FROM audit_log WHERE action LIKE 'lab.result.%' AND resource_id = $1", [r.id]);
      expect(rows.map((x: { action: string }) => x.action).sort()).toEqual(['lab.result.amend', 'lab.result.enter', 'lab.result.release', 'lab.result.verify']);
      expect(JSON.stringify(rows)).not.toMatch(/17\.77|18\.88|Mbarga|Élisabeth/);
      expect(rows.find((x: { action: string }) => x.action === 'lab.result.enter')).toMatchObject({ metadata: { testCode: t.code, version: 1, critical: false, deltaAlert: false } });
    });
  });

  describe('échantillons et résultats', () => {
    it('un échantillon qui porte des résultats ne se rejette plus', async () => {
      const t = await test();
      const r = await received([t]);
      await enter('labo', r, t, '13').expect(200);
      const res = await post('labo', `/lab/specimens/${r.specimens[0].id}/reject`, { reason: 'CLOTTED' });
      expect([res.status, res.body.code]).toEqual([409, 'LAB_SPECIMEN_HAS_RESULTS']);
    });

    it('les demandes dont les résultats sont publiés se filtrent par statut, et le médecin les retrouve', async () => {
      const t = await test();
      const r = await received([t]);
      await published(r, t, '13');
      expect((await get('labo', '/lab/requisitions?status=RELEASED&limit=200')).body.items.map((i: { id: string }) => i.id)).toContain(r.id);
      expect((await get('medecin', '/lab/requisitions?status=RELEASED&limit=200')).body.items.map((i: { id: string }) => i.id)).toContain(r.id);
      expect((await get('labo', '/lab/requisitions?status=DONE')).body.code).toBe('LAB_STATUS_FILTER_INVALID');
    });

    it('deux techniciens qui valident le même résultat en même temps : un seul réussit', async () => {
      const t = await test();
      const r = await received([t]);
      await enter('labo', r, t, '13').expect(200);
      const results = await Promise.all([post('labo2', url(r, t, '/verify')), post('labo2', url(r, t, '/verify'))]);
      expect(results.map((x) => x.status).sort()).toEqual([200, 409]);
    });
  });
});

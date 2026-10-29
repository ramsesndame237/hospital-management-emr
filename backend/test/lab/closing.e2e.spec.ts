import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const BIRTH = '1990-03-14';
const CALL = { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', readBackConfirmed: true };

describe('API laboratoire : validation et publication en lot, rapport', () => {
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
  const RANGES = [{ sex: 'FEMALE', ageMinDays: 6574, low: 11.5, high: 15.5, criticalLow: 7, criticalHigh: 20 }];
  const test = async (): Promise<{ id: string; code: string }> => {
    seq += 1;
    const r = await post('admin', '/lab/tests', { code: `B-${seq}`, name: `Lot ${seq}`, section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, ranges: RANGES }).expect(201);
    return { id: r.body.id as string, code: r.body.code as string };
  };
  const received = async (tests: { id: string }[], orderer = 'medecin') => {
    const order = (await post(orderer, '/lab/requisitions', { patientId: ids.patients[0], testIds: tests.map((t) => t.id) }).expect(201)).body;
    for (const s of order.specimens) {
      await post('labo', `/lab/specimens/${s.id}/collect`, { patientNumber: order.patient.number, birthDate: BIRTH }).expect(200);
      await post('labo', `/lab/specimens/${s.id}/receive`).expect(200);
    }
    return order;
  };
  const result = (r: { id: string }, t: { id: string }, tail = '') => `/lab/requisitions/${r.id}/results/${t.id}${tail}`;
  const statusesOf = (body: { tests: { code: string; result: { status: string } | null }[] }) => Object.fromEntries(body.tests.map((t) => [t.code, t.result?.status ?? null]));
  const audit = (action: string, resourceId: string) => c.w.sql.query<{ metadata: Record<string, unknown> }>('SELECT metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['POST', `/lab/requisitions/${ID}/results/verify`, ['patient', 'accueil', 'caisse', 'comptable', 'infirmier', 'medecin', 'admin']],
      ['POST', `/lab/requisitions/${ID}/results/release`, ['patient', 'accueil', 'caisse', 'comptable', 'infirmier', 'medecin', 'admin']],
      ['GET', `/lab/requisitions/${ID}/report`, ['patient', 'accueil', 'caisse', 'comptable', 'infirmier']],
    ])('%s %s : sans jeton → 401, profils sans le droit → 403', async (method, path, forbidden) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(path));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of forbidden) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });
  });

  describe('lots', () => {
    it('valide tout ce que l\'appelant peut valider et écarte ses propres saisies, avec la raison', async () => {
      const [a, b, d] = [await test(), await test(), await test()];
      const r = await received([a, b, d]);
      await put('labo', result(r, a), { value: '13' }).expect(200);
      await put('labo', result(r, b), { value: '12.5' }).expect(200);
      await put('labo2', result(r, d), { value: '14' }).expect(200);

      const first = await post('labo2', `/lab/requisitions/${r.id}/results/verify`);
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ processed: 2, skipped: [{ code: d.code, reason: 'LAB_VERIFY_SELF' }] });
      expect(statusesOf(first.body.requisition)).toEqual({ [a.code]: 'VERIFIED', [b.code]: 'VERIFIED', [d.code]: 'ENTERED' });

      const second = await post('labo', `/lab/requisitions/${r.id}/results/verify`);
      expect(second.body).toMatchObject({ processed: 1, skipped: [] });
      expect(statusesOf(second.body.requisition)).toEqual({ [a.code]: 'VERIFIED', [b.code]: 'VERIFIED', [d.code]: 'VERIFIED' });
      expect(second.body.requisition.status).toBe('VERIFIED');

      const audited = await audit('lab.result.verify', r.id);
      expect(audited).toHaveLength(3);
      expect(audited.every((e) => e.metadata.batch === true)).toBe(true);
    });

    it('écarte les résultats saisis par l\'appelant, sans bloquer les autres', async () => {
      const [a, b] = [await test(), await test()];
      const r = await received([a, b]);
      await put('labo', result(r, a), { value: '13' }).expect(200);
      await put('labo2', result(r, b), { value: '14' }).expect(200);
      const batch = await post('labo', `/lab/requisitions/${r.id}/results/verify`);
      expect(batch.body.processed).toBe(1);
      expect(batch.body.skipped).toEqual([{ code: a.code, reason: 'LAB_VERIFY_SELF' }]);
      expect(statusesOf(batch.body.requisition)).toEqual({ [a.code]: 'ENTERED', [b.code]: 'VERIFIED' });
    });

    it('publie les résultats validés, en écartant ceux de l\'appelant et les valeurs critiques sans appel du clinicien', async () => {
      const [normal, critical, own] = [await test(), await test(), await test()];
      const r = await received([normal, critical, own]);
      await put('labo', result(r, normal), { value: '13' }).expect(200);
      await put('labo', result(r, critical), { value: '5.1' }).expect(200);
      await put('labo2', result(r, own), { value: '14' }).expect(200);
      await post('labo2', `/lab/requisitions/${r.id}/results/verify`).expect(200);
      await post('labo', `/lab/requisitions/${r.id}/results/verify`).expect(200);

      const batch = await post('labo2', `/lab/requisitions/${r.id}/results/release`);
      expect(batch.status).toBe(200);
      expect(batch.body.processed).toBe(1);
      expect(batch.body.skipped).toEqual(expect.arrayContaining([{ code: critical.code, reason: 'LAB_CRITICAL_NOT_NOTIFIED' }, { code: own.code, reason: 'LAB_VERIFY_SELF' }]));
      expect(batch.body.skipped).toHaveLength(2);
      expect(statusesOf(batch.body.requisition)).toEqual({ [normal.code]: 'RELEASED', [critical.code]: 'VERIFIED', [own.code]: 'VERIFIED' });

      await post('labo2', result(r, critical, '/critical-notification'), CALL).expect(200);
      const second = await post('labo2', `/lab/requisitions/${r.id}/results/release`);
      expect(second.body.processed).toBe(1);
      expect(second.body.skipped).toEqual([{ code: own.code, reason: 'LAB_VERIFY_SELF' }]);
      const third = await post('labo', `/lab/requisitions/${r.id}/results/release`);
      expect(third.body.processed).toBe(1);
      expect(third.body.requisition.status).toBe('RELEASED');
      expect((await audit('lab.result.release', r.id)).length).toBe(3);
    });

    it('ne fait rien (200, zéro traité) quand rien n\'est à traiter, et refuse une demande inconnue', async () => {
      const t = await test();
      const r = await received([t]);
      const none = await post('labo2', `/lab/requisitions/${r.id}/results/verify`);
      expect(none.status).toBe(200);
      expect(none.body).toMatchObject({ processed: 0, skipped: [] });
      expect((await post('labo2', `/lab/requisitions/${r.id}/results/release`)).body.processed).toBe(0);
      expect((await post('labo2', `/lab/requisitions/${UNKNOWN}/results/verify`)).status).toBe(404);
      expect((await post('labo2', '/lab/requisitions/pas-un-uuid/results/release')).status).toBe(400);
    });
  });

  describe('rapport', () => {
    const publish = async (r: { id: string }, t: { id: string }, value: string) => {
      await put('labo', result(r, t), { value }).expect(200);
      await post('labo2', result(r, t, '/verify')).expect(200);
      await post('labo2', result(r, t, '/release')).expect(200);
    };

    it('ne montre aucune valeur tant que rien n\'est publié, puis les résultats publiés avec leurs signatures', async () => {
      const [a, b] = [await test(), await test()];
      const r = await received([a, b]);
      await put('labo', result(r, a), { value: '13.37' }).expect(200);
      for (const who of ['labo', 'medecin']) {
        const early = (await get(who, `/lab/requisitions/${r.id}/report`)).body;
        expect(early).toMatchObject({ number: r.number, complete: false, patient: { lastName: 'Mbarga' }, orderedBy: { username: 'medecin' } });
        expect(early.items.map((i: { status: string }) => i.status)).toEqual(['PENDING', 'PENDING']);
        expect(JSON.stringify(early)).not.toContain('13.37');
      }
      await post('labo2', result(r, a, '/verify')).expect(200);
      await post('labo2', result(r, a, '/release')).expect(200);
      const partial = (await get('medecin', `/lab/requisitions/${r.id}/report`)).body;
      expect(partial.complete).toBe(false);
      expect(partial.items[0]).toMatchObject({
        testCode: a.code, status: 'RELEASED', value: '13.37', unit: 'g/dL', flag: 'NORMAL', refLow: 11.5, refHigh: 15.5, criticalLow: 7, criticalHigh: 20, version: 1, amended: false,
        verifiedBy: { username: 'labo2' }, releasedBy: { username: 'labo2' }, releasedAt: expect.stringMatching(/Z$/),
      });
      expect(partial.items[1]).toMatchObject({ testCode: b.code, status: 'PENDING', value: null, releasedBy: null });
      await publish(r, b, '12');
      expect((await get('medecin', `/lab/requisitions/${r.id}/report`)).body.complete).toBe(true);
    });

    it('garde la version publiée pendant un amendement, puis marque la version amendée avec son motif', async () => {
      const t = await test();
      const r = await received([t]);
      await publish(r, t, '13.5');
      await post('labo', result(r, t, '/amend'), { value: '14.9', reason: 'Erreur de transcription' }).expect(200);
      const during = (await get('medecin', `/lab/requisitions/${r.id}/report`)).body.items[0];
      expect(during).toMatchObject({ value: '13.5', version: 1, amended: false });
      await post('labo2', result(r, t, '/verify')).expect(200);
      await post('labo2', result(r, t, '/release')).expect(200);
      const after = (await get('medecin', `/lab/requisitions/${r.id}/report`)).body.items[0];
      expect(after).toMatchObject({ value: '14.9', version: 2, amended: true, amendmentReason: 'Erreur de transcription' });
    });

    it('un prescripteur n\'obtient que le rapport de ses demandes ; le laboratoire et l\'administrateur système tous', async () => {
      const t = await test();
      const theirs = await received([t], 'labo');
      expect((await get('medecin', `/lab/requisitions/${theirs.id}/report`)).status).toBe(404);
      expect((await get('admin', `/lab/requisitions/${theirs.id}/report`)).status).toBe(200);
      expect((await get('labo2', `/lab/requisitions/${theirs.id}/report`)).status).toBe(200);
      expect((await get('labo', `/lab/requisitions/${UNKNOWN}/report`)).status).toBe(404);
      expect((await get('labo', '/lab/requisitions/pas-un-uuid/report')).status).toBe(400);
    });

    it('inscrit chaque édition au journal, sans valeur ni donnée personnelle', async () => {
      const t = await test();
      const r = await received([t]);
      await publish(r, t, '17.77');
      await get('medecin', `/lab/requisitions/${r.id}/report`).expect(200);
      const rows = await audit('lab.report.read', r.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].metadata).toMatchObject({ requisitionNumber: r.number, released: 1, total: 1 });
      expect(JSON.stringify(rows)).not.toMatch(/17\.77|Mbarga|Élisabeth/);
    });
  });
});

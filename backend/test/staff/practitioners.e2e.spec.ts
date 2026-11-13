import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';

describe('API personnel : professionnels d\'un service', () => {
  let c: ClinicalWorld;
  beforeAll(async () => {
    c = await buildClinicalWorld();
  });
  afterAll(() => c.close());

  const get = (who: string | null, url: string) => {
    const req = c.http().get(api(url));
    return who ? req.set(c.bearer(who)) : req;
  };

  it('sans jeton → 401 ; sans le droit (caisse, laboratoire, pharmacie, patient) → 403', async () => {
    expect((await get(null, `/structure/${c.ids.ped}/practitioners`)).status).toBe(401);
    for (const who of ['caisse', 'comptable', 'labo', 'pharmacien', 'patient']) expect([who, (await get(who, `/structure/${c.ids.ped}/practitioners`)).status]).toEqual([who, 403]);
  });

  it.each(['accueil', 'medecin', 'infirmier', 'admin'])('%s lit les professionnels d\'un service', async (who) => {
    await get(who, `/structure/${c.ids.ped}/practitioners`).expect(200);
  });

  it('ne donne que l\'identité professionnelle des personnes actuellement affectées au service', async () => {
    const ped = (await get('accueil', `/structure/${c.ids.ped}/practitioners`).expect(200)).body as Record<string, unknown>[];
    expect(ped).toEqual([{ id: c.ids.docPed, staffNumber: 'D-PED', firstName: 'Doc', lastName: 'Curie', professionCode: 'DOCTOR' }]);
    const chi = (await get('accueil', `/structure/${c.ids.chi}/practitioners`).expect(200)).body as { id: string }[];
    expect(chi.map((p) => p.id).sort()).toEqual([c.ids.nurseChi, c.ids.docChi].sort());
  });

  it('ne liste pas une personne sans affectation, ni une affectation terminée', async () => {
    const all = [...(await get('accueil', `/structure/${c.ids.ped}/practitioners`).expect(200)).body, ...(await get('accueil', `/structure/${c.ids.chi}/practitioners`).expect(200)).body] as { id: string }[];
    expect(all.some((p) => p.id === c.ids.docNowhere)).toBe(false);
    const assignments = (await get('admin', `/staff/${c.ids.docPed}/assignments`).expect(200)).body as { id: string }[];
    await c.http().post(api(`/assignments/${assignments[0].id}/end`)).set(c.bearer('admin')).send({ endDate: '2020-06-01' }).expect(200);
    expect((await get('accueil', `/structure/${c.ids.ped}/practitioners`).expect(200)).body).toEqual([]);
  });

  it('service introuvable → 404', async () => {
    await get('accueil', `/structure/${UNKNOWN}/practitioners`).expect(404);
  });
});

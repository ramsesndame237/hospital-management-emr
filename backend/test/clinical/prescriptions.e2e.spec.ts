import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

describe('API clinique : ordonnances', () => {
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
  const audit = (action: string, resourceId: string) => c.w.sql.query<{ metadata: Record<string, unknown> }>('SELECT metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  let seq = 0;
  const drug = async (over: Record<string, unknown> = {}): Promise<{ id: string; name: string }> => {
    seq += 1;
    const body = { code: `RX${seq}`, name: `Médicament ${seq}`, genericName: `Molécule ${seq}`, strength: '500 mg', form: 'TABLET', schedule: 'PRESCRIPTION', unit: 'comprimé', unitPrice: 25, reorderLevel: 0, ...over };
    const r = await post('pharmacien', '/pharmacy/drugs', body).expect(201);
    return { id: r.body.id as string, name: body.name as string };
  };
  const arrive = async (patient = 0, service = ids.ped): Promise<string> =>
    (await post('accueil', '/admissions', { patientId: ids.patients[patient], type: 'OUTPATIENT', serviceId: service }).expect(201)).body.id as string;
  const open = async (patient = 0, who = 'medecin', service = ids.ped): Promise<{ id: string }> => (await post(who, '/clinical/encounters', { admissionId: await arrive(patient, service) }).expect(201)).body;
  const line = (d: { id: string }, over: Record<string, unknown> = {}) => ({ drugId: d.id, dose: '1 comprimé', frequency: '3 fois par jour', durationDays: 7, quantity: 21, ...over });
  const prescribe = (encounter: { id: string }, lines: object[], who = 'medecin', body: object = {}) => post(who, `/clinical/encounters/${encounter.id}/prescriptions`, { lines, ...body });
  const sign = async (id: string) => {
    await put('medecin', `/clinical/encounters/${id}/note`, { assessment: 'Pneumopathie franche lobaire.' }).expect(200);
    await put('medecin', `/clinical/encounters/${id}/diagnoses`, { diagnoses: [{ code: 'J18.9', label: 'Pneumopathie', kind: 'PRIMARY', certainty: 'CONFIRMED' }] }).expect(200);
    await post('medecin', `/clinical/encounters/${id}/sign`).expect(200);
  };

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', `/clinical/encounters/${ID}/drugs?search=am`, ['patient', 'accueil', 'caisse', 'infirmier', 'labo', 'admin', 'pharmacien']],
      ['GET', `/clinical/encounters/${ID}/prescriptions`, ['patient', 'accueil', 'caisse', 'labo', 'admin', 'pharmacien']],
      ['POST', `/clinical/encounters/${ID}/prescriptions`, ['patient', 'accueil', 'infirmier', 'labo', 'admin', 'pharmacien']],
      ['GET', `/clinical/prescriptions/${ID}`, ['patient', 'accueil', 'caisse', 'labo', 'admin', 'pharmacien']],
      ['POST', `/clinical/prescriptions/${ID}/cancel`, ['patient', 'accueil', 'infirmier', 'labo', 'admin', 'pharmacien']],
    ])('%s %s : sans jeton → 401, profils sans le droit → 403', async (method, path, forbidden) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(path));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of forbidden) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });
  });

  describe('recherche de médicaments', () => {
    it('cherche par nom, code ou dénomination commune, sans les médicaments désactivés, avec les alertes du patient', async () => {
      const amox = await drug({ name: 'Amoxicilline Biogaran', genericName: 'Amoxicilline', code: 'AMOX500' });
      await drug({ name: 'Ancien sirop', genericName: 'Amoxicilline pédiatrique', code: 'AMOXOLD' });
      const old = (await get('pharmacien', '/pharmacy/drugs?search=AMOXOLD').expect(200)).body.items[0] as { id: string };
      await post('pharmacien', `/pharmacy/drugs/${old.id}/deactivate`).expect(200);
      const e = await open(0);
      await post('medecin', `/clinical/patients/${ids.patients[0]}/allergies`, { substance: 'Amoxicilline', severity: 'SEVERE', reaction: 'Œdème' }).expect(201);

      const found = (await get('medecin', `/clinical/encounters/${e.id}/drugs?search=amox`).expect(200)).body as { id: string; code: string; allergyAlerts: { substance: string; severity: string }[] }[];
      expect(found.map((d) => d.code)).toEqual(['AMOX500']);
      expect(found[0]).toMatchObject({ id: amox.id, name: 'Amoxicilline Biogaran', genericName: 'Amoxicilline', strength: '500 mg', unit: 'comprimé', active: true });
      expect(found[0].allergyAlerts).toMatchObject([{ substance: 'Amoxicilline', severity: 'SEVERE' }]);
    });

    it('ne donne rien sous deux caractères, aucune alerte à un patient sans allergie, et ignore les consultations hors de ses services', async () => {
      await drug({ name: 'Zinc', genericName: 'Zinc', code: 'ZINC' });
      const e = await open(1);
      expect((await get('medecin', `/clinical/encounters/${e.id}/drugs?search=z`).expect(200)).body).toEqual([]);
      expect((await get('medecin', `/clinical/encounters/${e.id}/drugs`).expect(200)).body).toEqual([]);
      const found = (await get('medecin', `/clinical/encounters/${e.id}/drugs?search=zinc`).expect(200)).body as { allergyAlerts: unknown[] }[];
      expect(found).toHaveLength(1);
      expect(found[0].allergyAlerts).toEqual([]);
      await get('medecin2', `/clinical/encounters/${e.id}/drugs?search=zinc`).expect(404);
    });
  });

  describe('émission', () => {
    it('émet une ordonnance au nom du médecin, avec le médicament de chaque ligne ; le journal ne contient aucun médicament', async () => {
      const a = await drug();
      const b = await drug({ strength: null });
      const e = await open(0);
      const r = await prescribe(e, [line(a, { instructions: 'Pendant les repas' }), line(b, { durationDays: null, quantity: 1 })], 'medecin', { notes: 'Revoir à 7 jours' }).expect(201);
      expect(r.body.number).toMatch(/^RX-\d{7}$/);
      expect(r.body).toMatchObject({ status: 'ISSUED', encounterId: e.id, serviceId: ids.ped, doctor: { username: 'medecin' }, notes: 'Revoir à 7 jours', patient: { id: ids.patients[0] }, cancelledAt: null });
      expect(r.body.lines).toMatchObject([
        { position: 0, drug: { id: a.id, name: a.name, unit: 'comprimé' }, dose: '1 comprimé', frequency: '3 fois par jour', durationDays: 7, quantity: 21, instructions: 'Pendant les repas', allergyOverride: null },
        { position: 1, drug: { id: b.id }, durationDays: null, quantity: 1 },
      ]);
      const metadata = (await audit('clinical.prescription.issue', r.body.id))[0].metadata;
      expect(metadata).toMatchObject({ number: r.body.number, encounterId: e.id, serviceId: ids.ped, lines: 2, allergyOverrides: 0 });
      expect(JSON.stringify(metadata)).not.toContain(a.name);
    });

    it('relit l\'ordonnance, la liste dans l\'ordre d\'émission, et la montre à l\'infirmier du service mais pas à un autre', async () => {
      const d = await drug();
      const e = await open(0);
      const first = (await prescribe(e, [line(d)]).expect(201)).body;
      const second = (await prescribe(e, [line(d, { quantity: 5 })]).expect(201)).body;
      const list = (await get('medecin', `/clinical/encounters/${e.id}/prescriptions`).expect(200)).body as { id: string }[];
      expect(list.map((p) => p.id)).toEqual([first.id, second.id]);
      expect((await get('medecin', `/clinical/prescriptions/${first.id}`).expect(200)).body).toMatchObject({ id: first.id, number: first.number });
      expect((await audit('clinical.prescription.read', first.id))[0].metadata).toMatchObject({ number: first.number });
      await get('medecin2', `/clinical/prescriptions/${first.id}`).expect(404);
      await get('medecin2', `/clinical/encounters/${e.id}/prescriptions`).expect(404);
      await get('infirmier', `/clinical/prescriptions/${first.id}`).expect(404);
    });

    it('refuse en 400 une ordonnance vide, trop longue ou mal formée', async () => {
      const d = await drug();
      const e = await open(0);
      await prescribe(e, []).expect(400);
      await prescribe(e, [line(d, { quantity: 0 })]).expect(400);
      await prescribe(e, [line(d, { quantity: 10001 })]).expect(400);
      await prescribe(e, [line(d, { durationDays: 400 })]).expect(400);
      await prescribe(e, [line(d, { drugId: 'pas-un-uuid' })]).expect(400);
      await prescribe(e, [line(d, { dose: '' })]).expect(400);
      await prescribe(e, Array.from({ length: 21 }, () => line(d))).expect(400);
    });

    it('refuse un médicament dupliqué, introuvable ou désactivé en nommant la ligne', async () => {
      const a = await drug();
      const b = await drug();
      const e = await open(0);
      expect((await prescribe(e, [line(a), line(a)]).expect(422)).body.code).toBe('CLINICAL_PRESCRIPTION_DUPLICATE_DRUG');
      const missing = await prescribe(e, [line(a), line({ id: '99999999-9999-4999-8999-999999999999' })]).expect(404);
      expect(missing.body).toMatchObject({ code: 'CLINICAL_DRUG_NOT_FOUND', message: expect.stringContaining('Ligne 2') });
      await post('pharmacien', `/pharmacy/drugs/${b.id}/deactivate`).expect(200);
      const inactive = await prescribe(e, [line(b)]).expect(409);
      expect(inactive.body).toMatchObject({ code: 'CLINICAL_DRUG_INACTIVE' });
      expect((await get('medecin', `/clinical/encounters/${e.id}/prescriptions`).expect(200)).body).toEqual([]);
    });

    it('nomme la ligne fautive pour une dose ou une quantité refusée par le domaine', async () => {
      const d = await drug();
      const e = await open(0);
      const r = await prescribe(e, [line(d, { dose: '   ' })]).expect(422);
      expect(r.body).toMatchObject({ code: 'CLINICAL_LINE_DOSE_INVALID', message: expect.stringContaining('Ligne 1') });
    });

    it('ne prescrit ni sur la consultation d\'un autre service (404), ni sur une consultation signée ou annulée (409)', async () => {
      const d = await drug();
      const other = await open(2, 'medecin2', ids.chi);
      await prescribe(other, [line(d)], 'medecin').expect(404);
      const signed = await open(0);
      await sign(signed.id);
      expect((await prescribe(signed, [line(d)]).expect(409)).body.code).toBe('CLINICAL_ENCOUNTER_LOCKED');
      const cancelled = await open(1);
      await post('medecin', `/clinical/encounters/${cancelled.id}/cancel`, { reason: 'Erreur' }).expect(200);
      expect((await prescribe(cancelled, [line(d)]).expect(409)).body.code).toBe('CLINICAL_ENCOUNTER_LOCKED');
      await prescribe({ id: '99999999-9999-4999-8999-999999999999' }, [line(d)]).expect(404);
    });
  });

  describe('alerte d\'allergie', () => {
    it('refuse de prescrire un médicament visé par une allergie active sans motif, nomme la ligne et la substance', async () => {
      const ok = await drug();
      const peni = await drug({ name: 'Pénicilline V', genericName: 'Phénoxyméthylpénicilline' });
      const e = await open(0);
      await post('medecin', `/clinical/patients/${ids.patients[0]}/allergies`, { substance: 'penicilline', severity: 'MODERATE' }).expect(201);
      const r = await prescribe(e, [line(ok), line(peni)]).expect(409);
      expect(r.body).toMatchObject({ code: 'CLINICAL_ALLERGY_CONFLICT', message: expect.stringContaining('penicilline') });
      expect(r.body.message).toContain('Ligne 2');
      await prescribe(e, [line(ok), line(peni, { allergyOverride: 'ab' })]).expect(409);
      expect((await get('medecin', `/clinical/encounters/${e.id}/prescriptions`).expect(200)).body).toEqual([]);
    });

    it('prescrit malgré l\'allergie avec un motif, qui reste sur la ligne et est compté au journal sans être recopié', async () => {
      const ok = await drug();
      const peni = await drug({ name: 'Pénicilline G', genericName: 'Benzylpénicilline' });
      const e = await open(1);
      await post('medecin', `/clinical/patients/${ids.patients[1]}/allergies`, { substance: 'Pénicilline', severity: 'SEVERE' }).expect(201);
      const reason = 'Bénéfice supérieur au risque, surveillance en service.';
      const r = await prescribe(e, [line(ok, { allergyOverride: 'ignoré : aucune alerte' }), line(peni, { allergyOverride: `  ${reason}  ` })]).expect(201);
      expect(r.body.lines.map((l: { allergyOverride: string | null }) => l.allergyOverride)).toEqual([null, reason]);
      const metadata = (await audit('clinical.prescription.issue', r.body.id))[0].metadata;
      expect(metadata).toMatchObject({ lines: 2, allergyOverrides: 1 });
      expect(JSON.stringify(metadata)).not.toContain('Bénéfice');
    });

    it('une allergie déclarée erronée ne bloque plus', async () => {
      const peni = await drug({ name: 'Pénicilline X', genericName: 'Pénicilline X' });
      const e = await open(2);
      const allergy = (await post('medecin', `/clinical/patients/${ids.patients[2]}/allergies`, { substance: 'Pénicilline', severity: 'MILD' }).expect(201)).body;
      await prescribe(e, [line(peni)]).expect(409);
      await post('medecin', `/clinical/allergies/${allergy.id}/void`, { reason: 'Mauvais dossier' }).expect(200);
      await prescribe(e, [line(peni)]).expect(201);
    });
  });

  describe('annulation', () => {
    it('annule l\'ordonnance avec un motif ; elle reste lisible ; une seconde annulation est refusée', async () => {
      const d = await drug();
      const e = await open(0);
      const p = (await prescribe(e, [line(d)]).expect(201)).body;
      await post('medecin', `/clinical/prescriptions/${p.id}/cancel`, { reason: '' }).expect(400);
      const done = await post('medecin', `/clinical/prescriptions/${p.id}/cancel`, { reason: 'Posologie erronée' }).expect(200);
      expect(done.body).toMatchObject({ status: 'CANCELLED', cancelledBy: { username: 'medecin' }, cancellationReason: 'Posologie erronée' });
      expect(done.body.lines).toHaveLength(1);
      expect((await audit('clinical.prescription.cancel', p.id))[0].metadata).not.toHaveProperty('reason');
      expect(JSON.stringify((await audit('clinical.prescription.cancel', p.id))[0].metadata)).not.toContain('Posologie');
      expect((await post('medecin', `/clinical/prescriptions/${p.id}/cancel`, { reason: 'Encore' }).expect(409)).body.code).toBe('CLINICAL_PRESCRIPTION_CANCELLED');
      expect((await get('medecin', `/clinical/prescriptions/${p.id}`).expect(200)).body.status).toBe('CANCELLED');
    });

    it('un médecin d\'un autre service ne la voit pas (404) et ne l\'annule pas', async () => {
      const d = await drug();
      const e = await open(1);
      const p = (await prescribe(e, [line(d)]).expect(201)).body;
      await post('medecin2', `/clinical/prescriptions/${p.id}/cancel`, { reason: 'Erreur' }).expect(404);
      await post('medecin', '/clinical/prescriptions/99999999-9999-4999-8999-999999999999/cancel', { reason: 'Erreur' }).expect(404);
      expect((await get('medecin', `/clinical/prescriptions/${p.id}`).expect(200)).body.status).toBe('ISSUED');
    });

    it('une consultation qui a des ordonnances en cours ne s\'annule pas avant elles', async () => {
      const d = await drug();
      const e = await open(2);
      const p = (await prescribe(e, [line(d)]).expect(201)).body;
      const refused = await post('medecin', `/clinical/encounters/${e.id}/cancel`, { reason: 'Ouverte par erreur' }).expect(409);
      expect(refused.body.code).toBe('CLINICAL_ENCOUNTER_HAS_PRESCRIPTIONS');
      await post('medecin', `/clinical/prescriptions/${p.id}/cancel`, { reason: 'Erreur' }).expect(200);
      await post('medecin', `/clinical/encounters/${e.id}/cancel`, { reason: 'Ouverte par erreur' }).expect(200);
    });

    it('une ordonnance survit à la signature de la consultation et reste annulable', async () => {
      const d = await drug();
      const e = await open(0);
      const p = (await prescribe(e, [line(d)]).expect(201)).body;
      await sign(e.id);
      expect((await get('infirmier', `/clinical/encounters/${e.id}/prescriptions`).expect(404)).status).toBe(404);
      await post('medecin', `/clinical/prescriptions/${p.id}/cancel`, { reason: 'Erreur de patient' }).expect(200);
    });
  });
});

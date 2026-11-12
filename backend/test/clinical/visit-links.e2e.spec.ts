import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';

describe('API : liens avec la visite (analyses ↔ consultation, facture ↔ admission)', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  let testId: string;
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
    testId = (await post('admin', '/lab/tests', { code: 'HGB', name: 'Hémoglobine', section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, tatMinutes: 120 }).expect(201)).body.id as string;
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const audit = (action: string, resourceId: string) => c.w.sql.query<{ metadata: Record<string, unknown> }>('SELECT metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  const arrive = async (patient = 0): Promise<string> => (await post('accueil', '/admissions', { patientId: ids.patients[patient], type: 'OUTPATIENT', serviceId: ids.ped }).expect(201)).body.id as string;
  const open = async (patient = 0): Promise<{ id: string }> => (await post('medecin', '/clinical/encounters', { admissionId: await arrive(patient) }).expect(201)).body;

  describe('demande d\'analyses rattachée à la consultation', () => {
    it('rattache la demande à la consultation qui la prescrit, la retrouve par consultation, et le journal garde le lien', async () => {
      const e = await open(0);
      const r = await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [testId], encounterId: e.id }).expect(201);
      expect(r.body.encounterId).toBe(e.id);
      expect((await audit('lab.requisition.order', r.body.id))[0].metadata).toMatchObject({ encounterId: e.id });
      const other = await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [testId] }).expect(201);
      expect(other.body.encounterId).toBeNull();
      const listed = (await get('medecin', `/lab/requisitions?encounterId=${e.id}`).expect(200)).body.items as { id: string }[];
      expect(listed.map((x) => x.id)).toEqual([r.body.id]);
      expect(((await get('medecin', `/lab/requisitions/${r.body.id}`).expect(200)).body as { encounterId: string }).encounterId).toBe(e.id);
    });

    it('le laboratoire retrouve aussi les demandes d\'une consultation', async () => {
      const e = await open(1);
      const r = await post('medecin', '/lab/requisitions', { patientId: ids.patients[1], testIds: [testId], encounterId: e.id }).expect(201);
      const listed = (await get('labo', `/lab/requisitions?encounterId=${e.id}`).expect(200)).body.items as { id: string }[];
      expect(listed.map((x) => x.id)).toEqual([r.body.id]);
    });

    it('refuse une consultation introuvable (404), d\'un autre patient (409) ou annulée (409), sans rien écrire', async () => {
      const e = await open(0);
      await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [testId], encounterId: UNKNOWN }).expect(404);
      const mismatch = await post('medecin', '/lab/requisitions', { patientId: ids.patients[2], testIds: [testId], encounterId: e.id }).expect(409);
      expect(mismatch.body.code).toBe('LAB_ENCOUNTER_PATIENT_MISMATCH');
      const cancelled = await open(1);
      await post('medecin', `/clinical/encounters/${cancelled.id}/cancel`, { reason: 'Erreur' }).expect(200);
      expect((await post('medecin', '/lab/requisitions', { patientId: ids.patients[1], testIds: [testId], encounterId: cancelled.id }).expect(409)).body.code).toBe('LAB_ENCOUNTER_CANCELLED');
      await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [testId], encounterId: 'pas-un-uuid' }).expect(400);
      expect((await get('medecin', `/lab/requisitions?encounterId=${cancelled.id}`).expect(200)).body.items).toEqual([]);
    });

    it('reste possible après la signature de la consultation (analyses de suite)', async () => {
      const e = await open(2);
      await c.http().put(api(`/clinical/encounters/${e.id}/note`)).set(c.bearer('medecin')).send({ assessment: 'Anémie.' }).expect(200);
      await c.http().put(api(`/clinical/encounters/${e.id}/diagnoses`)).set(c.bearer('medecin')).send({ diagnoses: [{ code: 'D64.9', label: 'Anémie', kind: 'PRIMARY' }] }).expect(200);
      await post('medecin', `/clinical/encounters/${e.id}/sign`).expect(200);
      await post('medecin', '/lab/requisitions', { patientId: ids.patients[2], testIds: [testId], encounterId: e.id }).expect(201);
    });
  });

  describe('facture rattachée à l\'admission', () => {
    it('rattache la facture à l\'admission qu\'elle règle, la retrouve par admission, et le journal garde le lien', async () => {
      const adm = await arrive(0);
      const r = await post('caisse', '/billing/invoices', { patientId: ids.patients[0], admissionId: adm }).expect(201);
      expect(r.body.admissionId).toBe(adm);
      expect((await audit('billing.invoice.create', r.body.id))[0].metadata).toMatchObject({ admissionId: adm });
      const free = await post('caisse', '/billing/invoices', { patientId: ids.patients[0] }).expect(201);
      expect(free.body.admissionId).toBeNull();
      const listed = (await get('caisse', `/billing/invoices?admissionId=${adm}`).expect(200)).body.items as { id: string }[];
      expect(listed.map((x) => x.id)).toEqual([r.body.id]);
      expect(((await get('caisse', `/billing/invoices/${r.body.id}`).expect(200)).body as { admissionId: string }).admissionId).toBe(adm);
    });

    it('refuse une admission introuvable (404) ou d\'un autre patient (409)', async () => {
      const adm = await arrive(1);
      await post('caisse', '/billing/invoices', { patientId: ids.patients[1], admissionId: UNKNOWN }).expect(404);
      const mismatch = await post('caisse', '/billing/invoices', { patientId: ids.patients[0], admissionId: adm }).expect(409);
      expect(mismatch.body.code).toBe('BILLING_ADMISSION_PATIENT_MISMATCH');
      await post('caisse', '/billing/invoices', { patientId: ids.patients[1], admissionId: 'pas-un-uuid' }).expect(400);
    });

    it('une admission terminée se facture encore (on règle après la sortie)', async () => {
      const adm = await arrive(2);
      await post('accueil', `/admissions/${adm}/discharge`, { type: 'HOME' }).expect(200);
      await post('caisse', '/billing/invoices', { patientId: ids.patients[2], admissionId: adm }).expect(201);
    });
  });
});

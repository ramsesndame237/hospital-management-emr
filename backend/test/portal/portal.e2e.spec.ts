import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';
/** `days` jours après aujourd'hui, à `hour` h UTC : toujours dans le futur proche (un rendez-vous ne se prend ni dans le passé ni trop loin). */
const future = (days: number, hour = 9, minute = 0) => {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

describe('API portail patient', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const audit = (action: string, resourceId?: string) =>
    c.w.sql.query<{ metadata: Record<string, unknown>; actor_id: string }>(`SELECT metadata, actor_id FROM audit_log WHERE action = $1${resourceId ? ' AND resource_id = $2' : ''}`, resourceId ? [action, resourceId] : [action]);

  const PORTAL = ['me', 'appointments', 'results', 'prescriptions', 'invoices'];

  describe("contrôle d'accès", () => {
    it.each(PORTAL)('GET /portal/%s : sans jeton → 401, profils du personnel → 403', async (section) => {
      expect((await c.http().get(api(`/portal/${section}`))).status).toBe(401);
      for (const who of ['accueil', 'caisse', 'medecin', 'infirmier', 'labo', 'pharmacien', 'admin', 'comptable']) expect([who, (await get(who, `/portal/${section}`)).status]).toEqual([who, 403]);
    });

    it('relier un compte : réservé à l\'accueil et à l\'administrateur système', async () => {
      const body = { username: 'patient', patientId: ids.patients[0] };
      expect((await c.http().post(api('/portal/accounts')).send(body)).status).toBe(401);
      for (const who of ['patient', 'medecin', 'infirmier', 'caisse', 'labo', 'pharmacien', 'comptable']) expect([who, (await post(who, '/portal/accounts', body)).status]).toEqual([who, 403]);
      for (const who of ['patient', 'medecin', 'infirmier', 'caisse']) expect([who, (await get(who, `/portal/patients/${ids.patients[0]}/account`)).status]).toEqual([who, 403]);
    });
  });

  describe('compte non relié', () => {
    it('un compte patient sans dossier reçoit 404 PORTAL_NOT_LINKED, partout', async () => {
      for (const section of PORTAL) {
        const r = await get('patient', `/portal/${section}`).expect(404);
        expect(r.body.code).toBe('PORTAL_NOT_LINKED');
      }
    });
  });

  describe('lien compte ↔ dossier', () => {
    it('refuse un compte inconnu, un dossier inconnu, un compte du personnel et un corps invalide', async () => {
      expect((await post('accueil', '/portal/accounts', { username: 'personne', patientId: ids.patients[0] }).expect(404)).body.code).toBe('PORTAL_USER_NOT_FOUND');
      expect((await post('accueil', '/portal/accounts', { username: 'patient', patientId: UNKNOWN }).expect(404)).body.code).toBe('PORTAL_PATIENT_NOT_FOUND');
      expect((await post('accueil', '/portal/accounts', { username: 'medecin', patientId: ids.patients[0] }).expect(409)).body.code).toBe('PORTAL_USER_NOT_PATIENT');
      await post('accueil', '/portal/accounts', { username: 'patient', patientId: 'pas-un-uuid' }).expect(400);
      await post('accueil', '/portal/accounts', { patientId: ids.patients[0] }).expect(400);
    });

    it('relie le compte patient au dossier, trace qui l\'a fait, et le lien ne se modifie pas', async () => {
      const r = await post('accueil', '/portal/accounts', { username: 'patient', patientId: ids.patients[0] }).expect(201);
      expect(r.body).toMatchObject({ username: 'patient', linkedAt: expect.any(String) });
      const user = (await c.w.sql.query<{ id: string }>("SELECT id FROM iam_users WHERE username = 'patient'"))[0];
      expect((await audit('portal.account.link', user.id))[0].metadata).toMatchObject({ patientId: ids.patients[0] });
      expect((await post('accueil', '/portal/accounts', { username: 'patient', patientId: ids.patients[1] }).expect(409)).body.code).toBe('PORTAL_ALREADY_LINKED');
      await c.w.seed({ username: 'patient2', password: 'une phrase de passe solide', roles: ['PATIENT'], mfa: false });
      expect((await post('admin', '/portal/accounts', { username: 'patient2', patientId: ids.patients[0] }).expect(409)).body.code).toBe('PORTAL_ALREADY_LINKED');
      await expect(c.w.sql.query("UPDATE portal_accounts SET patient_id = $1", [ids.patients[1]])).rejects.toThrow(/ne se modifie pas/);
      await expect(c.w.sql.query('DELETE FROM portal_accounts')).rejects.toThrow(/interdit/);
    });

    it('l\'accueil retrouve le compte d\'un dossier ; un dossier sans compte → 404', async () => {
      expect((await get('accueil', `/portal/patients/${ids.patients[0]}/account`).expect(200)).body).toMatchObject({ username: 'patient' });
      expect((await get('accueil', `/portal/patients/${ids.patients[1]}/account`).expect(404)).body.code).toBe('PORTAL_ACCOUNT_NOT_FOUND');
    });
  });

  describe('espace du patient relié', () => {
    it('lit l\'identité de SON dossier, et le journal garde la section lue', async () => {
      const r = await get('patient', '/portal/me').expect(200);
      expect(r.body).toMatchObject({ id: ids.patients[0], lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14', number: expect.stringMatching(/^PAT-/) });
      const rows = await audit('portal.read');
      expect(rows.some((x) => x.metadata['section'] === 'me' && x.metadata['patientId'] === ids.patients[0])).toBe(true);
    });

    it('un paramètre de la requête ne change jamais de dossier', async () => {
      const r = await get('patient', `/portal/me?patientId=${ids.patients[1]}`).expect(200);
      expect(r.body.id).toBe(ids.patients[0]);
    });

    it('liste ses rendez-vous, les plus récents d\'abord, et pas ceux des autres', async () => {
      const book = (patient: number, days: number) =>
        post('accueil', '/appointments', { patientId: ids.patients[patient], practitionerId: ids.docPed, locationId: ids.ped, startsAt: future(days), durationMinutes: 30 }).expect(201);
      const first = (await book(0, 1)).body;
      const second = (await book(0, 3)).body;
      await book(1, 2);
      const r = (await get('patient', '/portal/appointments').expect(200)).body as { number: string; status: string; startsAt: string; endsAt: string }[];
      expect(r.map((a) => a.number)).toEqual([second.number, first.number]);
      expect(r[0]).toMatchObject({ status: 'SCHEDULED', startsAt: future(3).replace('.000Z', 'Z'), endsAt: future(3, 9, 30).replace('.000Z', 'Z') });
      expect(r[0]).not.toHaveProperty('patientId');
    });

    it('liste ses ordonnances avec ce qui est délivré, et jamais les ordonnances des autres', async () => {
      const drug = (await post('pharmacien', '/pharmacy/drugs', { code: 'PORTAL1', name: 'Paracétamol Doliprane', genericName: 'Paracétamol', strength: '500 mg', form: 'TABLET', schedule: 'PRESCRIPTION', unit: 'comprimé', unitPrice: 25, reorderLevel: 0 }).expect(201)).body;
      await post('pharmacien', '/pharmacy/receipts', { supplier: 'Pharma Distrib', lines: [{ drugId: drug.id, batchNumber: 'P1', expiry: '2031-12-31', quantity: 50, unitCost: 10 }] }).expect(201);
      const prescribe = async (patient: number) => {
        const adm = (await post('accueil', '/admissions', { patientId: ids.patients[patient], type: 'OUTPATIENT', serviceId: ids.ped }).expect(201)).body.id as string;
        const e = (await post('medecin', '/clinical/encounters', { admissionId: adm }).expect(201)).body;
        return (await post('medecin', `/clinical/encounters/${e.id}/prescriptions`, { lines: [{ drugId: drug.id, dose: '1 comprimé', frequency: '3 fois par jour', durationDays: 5, quantity: 15 }] }).expect(201)).body as { id: string; number: string };
      };
      const mine = await prescribe(0);
      await prescribe(1);
      let r = (await get('patient', '/portal/prescriptions').expect(200)).body as { number: string; status: string; dispensing: string; lines: { drugName: string; strength: string; unit: string; quantity: number }[] }[];
      expect(r.map((p) => p.number)).toEqual([mine.number]);
      expect(r[0]).toMatchObject({ status: 'ISSUED', dispensing: 'NONE' });
      expect(r[0].lines[0]).toMatchObject({ drugName: 'Paracétamol Doliprane', strength: '500 mg', unit: 'comprimé', quantity: 15 });
      await post('pharmacien', `/pharmacy/prescriptions/${mine.id}/dispense`, { lines: [{ position: 0, quantity: 5 }] }).expect(200);
      r = (await get('patient', '/portal/prescriptions').expect(200)).body;
      expect(r[0].dispensing).toBe('PARTIAL');
    });

    it('liste ses factures émises avec le reste à payer, sans brouillon ni facture des autres', async () => {
      const act = (await post('admin', '/billing/items', { code: 'PORTAL-ACT', name: 'Consultation', category: 'CONSULTATION', unitPrice: 8000 }).expect(201)).body;
      const draft = (await post('caisse', '/billing/invoices', { patientId: ids.patients[0], lines: [{ itemId: act.id, quantity: 1 }] }).expect(201)).body;
      expect(((await get('patient', '/portal/invoices').expect(200)).body as unknown[]).length).toBe(0);
      const issued = (await post('caisse', `/billing/invoices/${draft.id}/issue`).expect(200)).body;
      const other = (await post('caisse', '/billing/invoices', { patientId: ids.patients[1], lines: [{ itemId: act.id, quantity: 1 }] }).expect(201)).body;
      await post('caisse', `/billing/invoices/${other.id}/issue`).expect(200);
      const r = (await get('patient', '/portal/invoices').expect(200)).body as { number: string; status: string; currency: string; total: number; paid: number; balance: number }[];
      expect(r).toEqual([expect.objectContaining({ number: issued.number, status: 'ISSUED', total: 8000, paid: 0, balance: 8000 })]);
    });

    it('n\'affiche aucun résultat tant que le laboratoire n\'en a pas publié', async () => {
      const t = (await post('admin', '/lab/tests', { code: 'PORT', name: 'Hémoglobine', section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, tatMinutes: 60 }).expect(201)).body;
      await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [t.id] }).expect(201);
      expect((await get('patient', '/portal/results').expect(200)).body).toEqual([]);
    });
  });
});

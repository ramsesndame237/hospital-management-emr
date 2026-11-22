import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const NO_CLINICAL = /Mbarga|Élisabeth|Ndongo|Nkoa|Curie|Pasteur|Abel|Amoxicilline|98|124/;
const NORMAL = { temperature: 37.0, pulse: 70, systolic: 120, diastolic: 80, respiratoryRate: 16, spo2: 98, supplementalOxygen: false, consciousness: 'ALERT' };
const DETERIORATING = { temperature: 39.4, pulse: 135, systolic: 85, respiratoryRate: 26, spo2: 90, supplementalOxygen: true, consciousness: 'VOICE' };

describe('API hospitalisation /api/v1/inpatient (HTTP réel, PostgreSQL réel)', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);

  /** Une hospitalisation en chirurgie (service de l'infirmier et de `medecin2`), chaque patient dans son propre lit. */
  let room = '';
  let bedSeq = 0;
  let patientSeq = 0;
  const admit = async (): Promise<string> => {
    if (!room) room = ((await post('admin', `/structure/${ids.chiUnit}/children`, { code: 'R2', name: 'Salle 2' }).expect(201)).body.id as string);
    bedSeq += 1;
    const bed = bedSeq === 1 ? ids.chiBed1 : ((await post('admin', `/structure/${room}/children`, { code: `L${bedSeq}`, name: `Lit ${bedSeq}` }).expect(201)).body.id as string);
    const patient = ids.patients[patientSeq % ids.patients.length];
    patientSeq += 1;
    return (await post('accueil', '/admissions', { patientId: patient, type: 'INPATIENT', serviceId: ids.chi, bedId: bed }).expect(201)).body.id as string;
  };
  const audit = (action: string, resourceId: string) => c.w.sql.query<{ metadata: Record<string, unknown>; actor_id: string }>('SELECT metadata, actor_id FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  let stay: string;
  beforeAll(async () => {
    stay = await admit();
  });

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', '/inpatient/ward'], ['GET', `/inpatient/admissions/${ID}/chart`], ['POST', `/inpatient/admissions/${ID}/observations`], ['POST', `/inpatient/admissions/${ID}/administrations`], ['POST', `/inpatient/admissions/${ID}/notes`],
    ] as const)('%s %s : sans jeton → 401 ; accueil, caisse, laboratoire, pharmacie et patient → 403', async (method, url) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(url));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of ['accueil', 'caisse', 'labo', 'pharmacien', 'patient']) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });

    it("le médecin ne peut pas administrer un médicament : c'est le rôle de l'infirmier", async () => {
      expect((await post('medecin2', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: UNKNOWN, position: 0, status: 'GIVEN' })).status).toBe(403);
    });

    it("hors de son service, une hospitalisation « n'existe pas » (404) : ni lecture ni écriture", async () => {
      expect((await get('medecin', `/inpatient/admissions/${stay}/chart`)).status).toBe(404); // medecin exerce en pédiatrie
      expect((await post('medecin', `/inpatient/admissions/${stay}/observations`, NORMAL)).status).toBe(404);
      expect((await post('medecin', `/inpatient/admissions/${stay}/notes`, { text: 'x' })).status).toBe(404);
      expect((await get('infirmier', `/inpatient/admissions/${UNKNOWN}/chart`)).status).toBe(404);
    });
  });

  describe('liste des hospitalisés', () => {
    it("montre à l'infirmier ses hospitalisés (avec lit), et rien à un médecin d'un autre service", async () => {
      const mine = (await get('infirmier', '/inpatient/ward').expect(200)).body as { stay: { admissionId: string; bed: string | null; days: number }; patient: { lastName: string } | null; latest: unknown }[];
      const row = mine.find((r) => r.stay.admissionId === stay)!;
      expect(row).toMatchObject({ stay: { bed: 'Lit 1', days: 1 }, patient: { lastName: 'Mbarga' }, latest: null });
      expect((await get('medecin', '/inpatient/ward').expect(200)).body).toEqual([]);
    });

    it('ne montre pas les patients en consultation externe, ni ceux qui sont sortis', async () => {
      const outpatient = (await post('accueil', '/admissions', { patientId: ids.patients[1], type: 'OUTPATIENT', serviceId: ids.chi }).expect(201)).body.id as string;
      const list = (await get('infirmier', '/inpatient/ward').expect(200)).body as { stay: { admissionId: string } }[];
      expect(list.some((r) => r.stay.admissionId === outpatient)).toBe(false);
    });
  });

  describe('constantes et score NEWS2', () => {
    it('enregistre un relevé normal : score 0, risque faible, rien à signaler', async () => {
      const r = await post('infirmier', `/inpatient/admissions/${stay}/observations`, NORMAL);
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ news2: 0, risk: 'LOW', escalate: false, recordedBy: 'infirmier', temperature: 37, consciousness: 'ALERT' });
    });

    it("enregistre une dégradation : score 19, risque élevé, `escalate: true` (prévenir le médecin sans attendre)", async () => {
      const r = await post('infirmier', `/inpatient/admissions/${stay}/observations`, { ...DETERIORATING, note: 'Patient confus' });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ news2: 19, risk: 'HIGH', escalate: true, note: 'Patient confus' });
    });

    it('le médecin du service peut aussi relever des constantes', async () => {
      expect((await post('medecin2', `/inpatient/admissions/${stay}/observations`, NORMAL)).status).toBe(201);
    });

    it('refuse une valeur hors limites (faute de frappe), un niveau de conscience inconnu et un champ manquant', async () => {
      const wrong = await post('infirmier', `/inpatient/admissions/${stay}/observations`, { ...NORMAL, temperature: 370 });
      expect(wrong.status).toBe(400);
      const range = await post('infirmier', `/inpatient/admissions/${stay}/observations`, { ...NORMAL, diastolic: 130 });
      expect([range.status, range.body.code]).toEqual([422, 'INPATIENT_VITALS_INVALID']);
      const level = await post('infirmier', `/inpatient/admissions/${stay}/observations`, { ...NORMAL, consciousness: 'SLEEPY' });
      expect([level.status, level.body.code]).toEqual([422, 'INPATIENT_CONSCIOUSNESS_INVALID']);
      const { spo2: _spo2, ...incomplete } = NORMAL;
      expect((await post('infirmier', `/inpatient/admissions/${stay}/observations`, incomplete)).status).toBe(400);
    });

    it("le dernier relevé apparaît dans la liste des hospitalisés et le dossier trie du plus récent au plus ancien", async () => {
      await post('infirmier', `/inpatient/admissions/${stay}/observations`, DETERIORATING).expect(201);
      const row = ((await get('infirmier', '/inpatient/ward').expect(200)).body as { stay: { admissionId: string }; latest: { news2: number; risk: string } | null }[]).find((r) => r.stay.admissionId === stay)!;
      expect(row.latest).toMatchObject({ news2: 19, risk: 'HIGH' });
      const chart = (await get('infirmier', `/inpatient/admissions/${stay}/chart`).expect(200)).body;
      const times = chart.observations.map((o: { recordedAt: string }) => Date.parse(o.recordedAt));
      expect([...times].sort((a, b) => b - a)).toEqual(times);
    });

    it("l'audit garde qui et le score, jamais les valeurs", async () => {
      const rows = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'inpatient.observation.record'");
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toMatch(NO_CLINICAL);
      expect(rows.some((r) => r.metadata['risk'] === 'HIGH' && r.metadata['news2'] === 19)).toBe(true);
    });
  });

  describe('médicaments prescrits pendant la tournée', () => {
    let rx: { id: string; number: string };
    let drug: { id: string };
    beforeAll(async () => {
      drug = (await post('pharmacien', '/pharmacy/drugs', { code: 'AMOX500', name: 'Amoxicilline', genericName: 'Amoxicilline', strength: '500 mg', form: 'CAPSULE', schedule: 'PRESCRIPTION', unit: 'gélule', unitPrice: 25, reorderLevel: 0 }).expect(201)).body;
      // La tournée du médecin : une consultation sur l'admission du patient hospitalisé.
      const round = (await post('medecin2', '/clinical/encounters', { admissionId: stay }).expect(201)).body as { id: string };
      rx = (await post('medecin2', `/clinical/encounters/${round.id}/prescriptions`, { lines: [{ drugId: drug.id, dose: '1 gélule', frequency: '3 fois par jour', durationDays: 7, quantity: 21 }] }).expect(201)).body;
    });

    it("le dossier de soins liste la ligne prescrite, sans action encore", async () => {
      const chart = (await get('infirmier', `/inpatient/admissions/${stay}/chart`).expect(200)).body;
      expect(chart.medications).toMatchObject([{ prescriptionId: rx.id, prescriptionNumber: rx.number, position: 0, drugName: 'Amoxicilline 500 mg', dose: '1 gélule', frequency: '3 fois par jour', last: null, givenCount: 0, allergyWarning: false }]);
    });

    it("l'infirmier note une dose donnée : dernière action et compteur à jour", async () => {
      const r = await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: rx.id, position: 0, status: 'GIVEN' });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ status: 'GIVEN', reason: null, by: 'infirmier', drugName: 'Amoxicilline 500 mg' });
      const med = (await get('infirmier', `/inpatient/admissions/${stay}/chart`).expect(200)).body.medications[0];
      expect(med).toMatchObject({ givenCount: 1, last: { status: 'GIVEN', by: 'infirmier', reason: null } });
    });

    it('un refus ou une suspension exige un motif ; une dose donnée n\'en a pas', async () => {
      const noReason = await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: rx.id, position: 0, status: 'REFUSED' });
      expect([noReason.status, noReason.body.code]).toEqual([422, 'INPATIENT_REASON_REQUIRED']);
      const given = await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: rx.id, position: 0, status: 'GIVEN', reason: 'Parce que' });
      expect([given.status, given.body.code]).toEqual([422, 'INPATIENT_REASON_NOT_ALLOWED']);
      const refused = await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: rx.id, position: 0, status: 'REFUSED', reason: 'Nausées' });
      expect(refused.status).toBe(201);
      const held = await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: rx.id, position: 0, status: 'HELD', reason: 'À jeun avant examen' });
      expect(held.status).toBe(201);
      const med = (await get('infirmier', `/inpatient/admissions/${stay}/chart`).expect(200)).body.medications[0];
      expect(med).toMatchObject({ givenCount: 1, last: { status: 'HELD', reason: 'À jeun avant examen' } });
      const bad = await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: rx.id, position: 0, status: 'SOMETIME' });
      expect([bad.status, bad.body.code]).toEqual([422, 'INPATIENT_STATUS_INVALID']);
    });

    it("refuse une ligne inconnue, ou d'une ordonnance d'un autre séjour", async () => {
      expect((await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: UNKNOWN, position: 0, status: 'GIVEN' })).body.code).toBe('INPATIENT_MEDICATION_NOT_FOUND');
      expect((await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: rx.id, position: 7, status: 'GIVEN' })).body.code).toBe('INPATIENT_MEDICATION_NOT_FOUND');
    });

    it('une ordonnance annulée disparaît du dossier de soins et ne peut plus être administrée', async () => {
      const encounters = (await c.w.sql.query<{ id: string }>("SELECT id FROM clinical_encounters WHERE admission_id = $1 AND status = 'IN_PROGRESS'", [stay]))[0];
      const second = (await post('medecin2', `/clinical/encounters/${encounters.id}/prescriptions`, { lines: [{ drugId: drug.id, dose: '2 gélules', frequency: '1 fois par jour', durationDays: 3, quantity: 6 }] }).expect(201)).body as { id: string };
      await post('medecin2', `/clinical/prescriptions/${second.id}/cancel`, { reason: 'Erreur de dose' }).expect(200);
      const chart = (await get('infirmier', `/inpatient/admissions/${stay}/chart`).expect(200)).body;
      expect(chart.medications.map((m: { prescriptionId: string }) => m.prescriptionId)).not.toContain(second.id);
      expect((await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: second.id, position: 0, status: 'GIVEN' })).body.code).toBe('INPATIENT_MEDICATION_NOT_FOUND');
    });
  });

  describe('notes de soins', () => {
    it('ajoute une note signée par son auteur, la plus récente en premier', async () => {
      await post('infirmier', `/inpatient/admissions/${stay}/notes`, { text: 'Pansement refait.' }).expect(201);
      const second = await post('medecin2', `/inpatient/admissions/${stay}/notes`, { text: 'Revu en tournée, évolution favorable.' });
      expect(second.status).toBe(201);
      expect(second.body).toMatchObject({ author: 'medecin2' });
      const notes = (await get('infirmier', `/inpatient/admissions/${stay}/chart`).expect(200)).body.notes as { text: string }[];
      expect(notes.map((n) => n.text)).toEqual(['Revu en tournée, évolution favorable.', 'Pansement refait.']);
    });

    it('refuse une note vide ou trop longue', async () => {
      expect((await post('infirmier', `/inpatient/admissions/${stay}/notes`, { text: '   ' })).body.code).toBe('INPATIENT_NOTE_INVALID');
      expect((await post('infirmier', `/inpatient/admissions/${stay}/notes`, { text: 'x'.repeat(1001) })).status).toBe(400);
    });
  });

  describe('ajout seul et sortie du patient', () => {
    it("la base interdit de modifier ou d'effacer un relevé, une administration ou une note", async () => {
      for (const table of ['inpatient_observations', 'inpatient_administrations', 'inpatient_notes']) {
        await expect(c.w.sql.query(`UPDATE ${table} SET id = id`)).rejects.toThrow(/ajout seul/);
        await expect(c.w.sql.query(`DELETE FROM ${table}`)).rejects.toThrow(/ajout seul/);
      }
    });

    it("la lecture est tracée, sans contenu clinique", async () => {
      await get('infirmier', `/inpatient/admissions/${stay}/chart`).expect(200);
      const rows = await audit('inpatient.chart.read', stay);
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toMatch(/Pansement|Nausées|Amoxicilline/);
    });

    it("après la sortie, le dossier reste lisible mais plus aucun soin ne peut être ajouté (409)", async () => {
      const done = await admit();
      await post('infirmier', `/inpatient/admissions/${done}/notes`, { text: 'Avant la sortie.' }).expect(201);
      await post('accueil', `/admissions/${done}/discharge`, { type: 'HOME' }).expect(200);
      const chart = await get('infirmier', `/inpatient/admissions/${done}/chart`).expect(200);
      expect(chart.body.stay.active).toBe(false);
      expect(chart.body.notes).toHaveLength(1);
      for (const [url, body] of [[`/inpatient/admissions/${done}/observations`, NORMAL], [`/inpatient/admissions/${done}/notes`, { text: 'Après.' }], [`/inpatient/admissions/${done}/administrations`, { prescriptionId: UNKNOWN, position: 0, status: 'GIVEN' }]] as const) {
        const r = await post('infirmier', url, body);
        expect([url, r.status, r.body.code]).toEqual([url, 409, 'INPATIENT_STAY_CLOSED']);
      }
      expect(((await get('infirmier', '/inpatient/ward').expect(200)).body as { stay: { admissionId: string } }[]).some((r) => r.stay.admissionId === done)).toBe(false);
    });

    it("n'ouvre le dossier de soins que d'une hospitalisation (pas d'une consultation externe)", async () => {
      const outpatient = (await post('accueil', '/admissions', { patientId: ids.patients[2], type: 'OUTPATIENT', serviceId: ids.chi }).expect(201)).body.id as string;
      expect((await get('infirmier', `/inpatient/admissions/${outpatient}/chart`)).status).toBe(404);
    });
  });
});

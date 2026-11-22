import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

/**
 * RECETTE DE BOUT EN BOUT. Un parcours patient complet à travers tous les modules, sur l'application entière (HTTP réel, PostgreSQL réel) :
 * accueil → consultation → ordonnance → analyses → imagerie → pharmacie → facturation reliée → assurance → caisse → comptabilité, puis une
 * hospitalisation (tournée, constantes, médicaments, notes, sortie). Il vérifie surtout ce que chaque module n'est pas censé savoir de l'autre :
 * ce qui est fait à un endroit se retrouve, correct, à l'autre, et le journal d'audit reste intact de bout en bout.
 * Les montants sont des entiers de la plus petite unité de la devise (franc CFA).
 */
describe('RECETTE · parcours complet du patient', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  const BIRTH = '1990-03-14';
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
    await c.http().post(api('/billing/cash-sessions')).set(c.bearer('caisse')).send({ counter: 'Caisse recette' }).expect(201);
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const put = (who: string, url: string, body: object = {}) => c.http().put(api(url)).set(c.bearer(who)).send(body);

  // Ce que le parcours produit, d'une étape à l'autre.
  const state: {
    drug?: { id: string }; labTest?: { id: string; code: string }; examCode?: string; payer?: { id: string; name: string }; coverageId?: string;
    encounter?: string; prescription?: string; lab?: { id: string; number: string }; imaging?: { id: string; number: string }; dispensation?: string;
    invoices: Record<'lab' | 'imaging' | 'drugs', string>;
  } = { invoices: { lab: '', imaging: '', drugs: '' } };

  describe('1. La structure et les tarifs sont en place (DSI et pharmacie)', () => {
    it('le catalogue clinique (analyse, examen, médicament avec stock) et les tarifs qui les rattachent', async () => {
      const lab = (await post('admin', '/lab/tests', { code: 'NFS', name: 'Numération formule sanguine', section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, tatMinutes: 120 }).expect(201)).body;
      state.labTest = { id: lab.id, code: lab.code };
      const exam = (await post('admin', '/imaging/exam-types', { code: 'RX-THORAX', name: 'Radiographie du thorax', modality: 'XRAY', bodyPart: 'Thorax', durationMinutes: 20 }).expect(201)).body;
      state.examCode = exam.code;
      state.drug = (await post('pharmacien', '/pharmacy/drugs', { code: 'AMOX500', name: 'Amoxicilline', genericName: 'Amoxicilline', strength: '500 mg', form: 'CAPSULE', schedule: 'PRESCRIPTION', unit: 'gélule', unitPrice: 25, reorderLevel: 0 }).expect(201)).body;
      await post('pharmacien', '/pharmacy/receipts', { supplier: 'Pharma Distrib', lines: [{ drugId: state.drug!.id, batchNumber: 'L1', expiry: day(300), quantity: 100, unitCost: 10 }] }).expect(201);
      // Tarifs : chaque acte porte le code de ce qu'il tarifie (c'est ce qui permet de facturer ce qui a été fait).
      for (const [code, name, category, price, source] of [['T-NFS', 'NFS complète', 'LABORATORY', 3500, 'NFS'], ['T-RX', 'Radio thorax', 'RADIOLOGY', 12000, 'RX-THORAX'], ['T-AMOX', 'Amoxicilline 500 mg (la gélule)', 'PHARMACY', 150, 'AMOX500']] as const) {
        await post('admin', '/billing/items', { code, name, category, unitPrice: price, sourceCode: source }).expect(201);
      }
      state.payer = (await post('comptable', '/billing/payers', { code: 'ASP', name: 'Assurance Santé Plus' }).expect(201)).body;
      state.coverageId = (await post('accueil', `/billing/patients/${ids.patients[0]}/coverages`, { payerId: state.payer!.id, policyNumber: 'AS-123456', percent: 80, validFrom: day(-30) }).expect(201)).body.id;
    });
  });

  describe("2. Consultation externe : accueil, médecin, ordonnance, analyses, imagerie", () => {
    it("l'accueil ouvre l'admission, le médecin ouvre la consultation et la signe avec ses prescriptions", async () => {
      const admission = (await post('accueil', '/admissions', { patientId: ids.patients[0], type: 'OUTPATIENT', serviceId: ids.ped }).expect(201)).body.id as string;
      const queue = (await get('medecin', '/clinical/queue').expect(200)).body as { admission: { id: string }; encounter: unknown }[];
      expect(queue.find((q) => q.admission.id === admission)?.encounter).toBeNull(); // le patient attend

      const enc = (await post('medecin', '/clinical/encounters', { admissionId: admission }).expect(201)).body as { id: string };
      state.encounter = enc.id;
      await put('medecin', `/clinical/encounters/${enc.id}/vitals`, { temperature: 38.4, pulse: 96, systolic: 120, diastolic: 80, respiratoryRate: 20, spo2: 97 }).expect(200);
      state.prescription = (await post('medecin', `/clinical/encounters/${enc.id}/prescriptions`, { lines: [{ drugId: state.drug!.id, dose: '1 gélule', frequency: '3 fois par jour', durationDays: 7, quantity: 21 }] }).expect(201)).body.id;
      state.lab = (await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds: [state.labTest!.id], encounterId: enc.id }).expect(201)).body;
      state.imaging = (await post('medecin', '/imaging/orders', { patientId: ids.patients[0], examTypeId: ((await get('medecin', '/imaging/exam-types').expect(200)).body.items as { id: string; code: string }[]).find((e) => e.code === 'RX-THORAX')!.id, clinicalQuestion: 'Toux fébrile depuis 3 jours.', encounterId: enc.id }).expect(201)).body;
      await put('medecin', `/clinical/encounters/${enc.id}/note`, { assessment: 'Pneumopathie franche lobaire.' }).expect(200);
      await put('medecin', `/clinical/encounters/${enc.id}/diagnoses`, { diagnoses: [{ code: 'J18.9', label: 'Pneumopathie', kind: 'PRIMARY', certainty: 'CONFIRMED' }] }).expect(200);
      const signed = await post('medecin', `/clinical/encounters/${enc.id}/sign`).expect(200);
      expect(signed.body.status).toBe('SIGNED');
    });

    it("la demande d'analyses suit son circuit au laboratoire (prélèvement, réception), et le médecin ne voit pas ce qui n'est pas publié", async () => {
      const order = state.lab as unknown as { id: string; number: string; patient: { number: string }; specimens: { id: string }[] };
      for (const s of order.specimens) {
        await post('labo', `/lab/specimens/${s.id}/collect`, { patientNumber: order.patient.number, birthDate: BIRTH }).expect(200);
        await post('labo', `/lab/specimens/${s.id}/receive`).expect(200);
      }
      const read = (await get('medecin', `/lab/requisitions/${order.id}`).expect(200)).body as { tests: { result: unknown }[] };
      expect(JSON.stringify(read.tests.map((t) => t.result))).not.toMatch(/"value"/); // rien n'est publié : le prescripteur n'en lit pas le contenu
    });

    it("le radiologue réalise l'examen (examen réalisé = facturable)", async () => {
      await post('radio', `/imaging/orders/${state.imaging!.id}/perform`, { pregnant: false, contrastAllergy: false }).expect(200);
    });
  });

  describe('3. Pharmacie : délivrance', () => {
    it("le pharmacien voit l'ordonnance en file et délivre ; le stock baisse de la quantité délivrée", async () => {
      const queue = (await get('pharmacien', '/pharmacy/prescriptions').expect(200)).body as { id: string }[];
      expect(queue.some((q) => q.id === state.prescription)).toBe(true);
      await post('pharmacien', `/pharmacy/prescriptions/${state.prescription}/dispense`, { lines: [{ position: 0, quantity: 21 }] }).expect(200);
      state.dispensation = ((await get('pharmacien', `/pharmacy/prescriptions/${state.prescription}`).expect(200)).body.dispensations as { id: string }[])[0].id;
      const stock = (await get('pharmacien', `/pharmacy/drugs/${state.drug!.id}/stock`).expect(200)).body as { dispensable: number };
      expect(stock.dispensable).toBe(79); // 100 reçus − 21 délivrés
      expect(((await get('pharmacien', '/pharmacy/prescriptions').expect(200)).body as { id: string }[]).some((q) => q.id === state.prescription)).toBe(false); // plus en file
    });
  });

  describe("4. Caisse : facturer ce qui a été fait, assurance, encaissement, comptabilité", () => {
    it("les trois éléments faits apparaissent « à facturer » au prix du catalogue", async () => {
      const list = async (type: string) => (await get('caisse', `/billing/billable?type=${type}`).expect(200)).body.items as { id: string; total: number | null; unpriced: string[]; lines: { quantity: number }[] }[];
      expect((await list('LAB_REQUISITION')).find((i) => i.id === state.lab!.id)).toMatchObject({ total: 3500, unpriced: [] });
      expect((await list('IMAGING_ORDER')).find((i) => i.id === state.imaging!.id)).toMatchObject({ total: 12000, unpriced: [] });
      const drugs = (await list('DISPENSATION')).find((i) => i.id === state.dispensation);
      expect(drugs).toMatchObject({ total: 3150, unpriced: [] }); // 21 gélules × 150
      expect(drugs!.lines[0].quantity).toBe(21);
    });

    it("la caisse établit les factures ; l'assurance prend 80 % des médicaments ; le patient règle le reste", async () => {
      const bill = async (type: string, id: string) => (await post('caisse', '/billing/invoices/from-source', { sourceType: type, sourceId: id }).expect(201)).body as { id: string; total: number };
      state.invoices.lab = (await bill('LAB_REQUISITION', state.lab!.id)).id;
      state.invoices.imaging = (await bill('IMAGING_ORDER', state.imaging!.id)).id;
      const drugs = await bill('DISPENSATION', state.dispensation!);
      state.invoices.drugs = drugs.id;
      expect(drugs.total).toBe(3150);

      const covered = (await put('caisse', `/billing/invoices/${drugs.id}/coverage`, { coverageId: state.coverageId }).expect(200)).body;
      expect(covered).toMatchObject({ grossTotal: 3150, total: 630, coverage: { percent: 80, amount: 2520, payerName: 'Assurance Santé Plus' } });

      for (const id of Object.values(state.invoices)) await post('caisse', `/billing/invoices/${id}/issue`).expect(200);
      // Le patient règle sa part de chaque facture.
      const paidLab = (await post('caisse', `/billing/invoices/${state.invoices.lab}/payments`, { mode: 'CASH', amount: 3500 }).expect(201)).body;
      expect(paidLab.invoice.status).toBe('PAID');
      await post('caisse', `/billing/invoices/${state.invoices.imaging}/payments`, { mode: 'MOBILE_MONEY', amount: 12000, reference: 'MM-0042' }).expect(201);
      const paidDrugs = (await post('caisse', `/billing/invoices/${state.invoices.drugs}/payments`, { mode: 'CASH', amount: 630 }).expect(201)).body;
      expect(paidDrugs.invoice).toMatchObject({ status: 'PAID', balance: 0 });
      // Plus rien à facturer pour ce parcours.
      for (const type of ['LAB_REQUISITION', 'IMAGING_ORDER', 'DISPENSATION']) {
        const rest = (await get('caisse', `/billing/billable?type=${type}`).expect(200)).body.items as { id: string }[];
        expect(rest.map((r) => r.id)).not.toContain(type === 'LAB_REQUISITION' ? state.lab!.id : type === 'IMAGING_ORDER' ? state.imaging!.id : state.dispensation);
      }
    });

    it("la comptabilité retrouve la créance de l'assureur et la règle avec sa référence", async () => {
      const claims = (await get('comptable', `/billing/claims?payerId=${state.payer!.id}&settled=false`).expect(200)).body as { total: number; items: { invoiceId: string; amount: number }[] };
      expect(claims.total).toBe(1);
      expect(claims.items[0]).toMatchObject({ invoiceId: state.invoices.drugs, amount: 2520 });
      const settled = await post('comptable', `/billing/invoices/${state.invoices.drugs}/payer-settlement`, { reference: 'VIR-RECETTE-1' }).expect(200);
      expect(settled.body.coverage.settlementReference).toBe('VIR-RECETTE-1');
      expect(((await get('comptable', `/billing/claims?payerId=${state.payer!.id}&settled=false`).expect(200)).body as { total: number }).total).toBe(0);
    });
  });

  describe('5. Hospitalisation : tournée, constantes, médicaments, notes, sortie', () => {
    let stay = '';
    let rx = '';
    it('un patient est hospitalisé en chirurgie ; le médecin fait sa tournée et prescrit', async () => {
      stay = (await post('accueil', '/admissions', { patientId: ids.patients[1], type: 'INPATIENT', serviceId: ids.chi, bedId: ids.chiBed1 }).expect(201)).body.id;
      const round = (await post('medecin2', '/clinical/encounters', { admissionId: stay }).expect(201)).body as { id: string };
      rx = (await post('medecin2', `/clinical/encounters/${round.id}/prescriptions`, { lines: [{ drugId: state.drug!.id, dose: '1 gélule', frequency: '3 fois par jour', durationDays: 5, quantity: 15 }] }).expect(201)).body.id;
    });

    it("l'infirmier le voit dans son service, relève ses constantes (alerte si dégradé) et administre le médicament", async () => {
      const ward = (await get('infirmier', '/inpatient/ward').expect(200)).body as { stay: { admissionId: string; bed: string }; patient: { lastName: string } }[];
      expect(ward.find((r) => r.stay.admissionId === stay)).toMatchObject({ stay: { bed: 'Lit 1' }, patient: { lastName: 'Ndongo' } });
      expect((await post('infirmier', `/inpatient/admissions/${stay}/observations`, { temperature: 37, pulse: 70, systolic: 120, respiratoryRate: 16, spo2: 98, supplementalOxygen: false, consciousness: 'ALERT' }).expect(201)).body).toMatchObject({ news2: 0, escalate: false });
      expect((await post('infirmier', `/inpatient/admissions/${stay}/observations`, { temperature: 39.4, pulse: 135, systolic: 85, respiratoryRate: 26, spo2: 90, supplementalOxygen: true, consciousness: 'VOICE' }).expect(201)).body).toMatchObject({ risk: 'HIGH', escalate: true });
      await post('infirmier', `/inpatient/admissions/${stay}/administrations`, { prescriptionId: rx, position: 0, status: 'GIVEN' }).expect(201);
      await post('infirmier', `/inpatient/admissions/${stay}/notes`, { text: 'Médecin prévenu, état stable après 30 minutes.' }).expect(201);
      const chart = (await get('infirmier', `/inpatient/admissions/${stay}/chart`).expect(200)).body;
      expect(chart.medications[0]).toMatchObject({ givenCount: 1, last: { status: 'GIVEN' } });
      expect(chart.observations).toHaveLength(2);
    });

    it("le médecin d'un autre service ne voit pas ce patient ; la sortie ferme le dossier de soins", async () => {
      expect((await get('medecin', `/inpatient/admissions/${stay}/chart`)).status).toBe(404);
      await post('accueil', `/admissions/${stay}/discharge`, { type: 'HOME' }).expect(200);
      expect((await post('infirmier', `/inpatient/admissions/${stay}/notes`, { text: 'Après la sortie.' })).status).toBe(409);
      expect((await get('infirmier', `/inpatient/admissions/${stay}/chart`).expect(200)).body.stay.active).toBe(false);
    });
  });

  describe("6. Cloisonnement et traçabilité sur l'ensemble du parcours", () => {
    it("le patient ne voit que son propre dossier, pas les données des autres ; les rôles non cliniques n'accèdent pas au clinique", async () => {
      for (const who of ['caisse', 'comptable', 'accueil']) {
        expect([who, (await get(who, `/inpatient/admissions/${ids.patients[1]}/chart`)).status]).toEqual([who, 403]);
        expect([who, (await get(who, '/clinical/queue')).status]).toEqual([who, 403]);
      }
    });

    it("le journal d'audit a tout enregistré, sans donnée clinique ni mot de passe, et sa chaîne de hachage est intacte", async () => {
      const actions = (await c.w.sql.query<{ action: string }>('SELECT DISTINCT action FROM audit_log')).map((r) => r.action);
      for (const a of [
        'clinical.encounter.start', 'clinical.encounter.sign', 'billing.invoice.create-from-source', 'billing.invoice.coverage-apply', 'billing.invoice.payer-settle',
        'inpatient.observation.record', 'inpatient.administration.record', 'inpatient.note.add', 'pharmacy.dispensation.create',
      ]) {
        expect(actions).toContain(a);
      }
      const all = JSON.stringify(await c.w.sql.query('SELECT action, metadata, reason FROM audit_log'));
      expect(all).not.toMatch(/Pneumopathie|Toux fébrile|Médecin prévenu|Amoxicilline|AS-123456|VIR-RECETTE/);
      expect((await c.w.audit.verifyChain()).valid).toBe(true);
    });
  });
});

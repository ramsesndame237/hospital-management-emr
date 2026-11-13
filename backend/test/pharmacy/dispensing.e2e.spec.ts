import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe('API pharmacie : dispensation des ordonnances', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const audit = (action: string, resourceId: string) => c.w.sql.query<{ metadata: Record<string, unknown> }>('SELECT metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  let seq = 0;
  const drug = async (over: Record<string, unknown> = {}): Promise<{ id: string; name: string }> => {
    seq += 1;
    const body = { code: `DSP${seq}`, name: `Médicament ${seq}`, genericName: `Molécule ${seq}`, strength: '500 mg', form: 'TABLET', schedule: 'PRESCRIPTION', unit: 'comprimé', unitPrice: 25, reorderLevel: 0, ...over };
    const r = await post('pharmacien', '/pharmacy/drugs', body).expect(201);
    return { id: r.body.id as string, name: body.name as string };
  };
  const stock = (d: { id: string }, lots: [string, number, number][]) =>
    post('pharmacien', '/pharmacy/receipts', { supplier: 'Pharma Distrib', lines: lots.map(([batchNumber, expiryOffset, quantity]) => ({ drugId: d.id, batchNumber, expiry: day(expiryOffset), quantity, unitCost: 10 })) }).expect(201);
  const available = async (d: { id: string }) => ((await get('pharmacien', `/pharmacy/drugs/${d.id}/stock`).expect(200)).body as { dispensable: number }).dispensable;

  const arrive = async (patient = 0): Promise<string> => (await post('accueil', '/admissions', { patientId: ids.patients[patient], type: 'OUTPATIENT', serviceId: ids.ped }).expect(201)).body.id as string;
  const open = async (patient = 0): Promise<{ id: string }> => (await post('medecin', '/clinical/encounters', { admissionId: await arrive(patient) }).expect(201)).body;
  const line = (d: { id: string }, over: Record<string, unknown> = {}) => ({ drugId: d.id, dose: '1 comprimé', frequency: '3 fois par jour', durationDays: 7, quantity: 10, ...over });
  const prescribe = async (patient: number, lines: object[]) => {
    const e = await open(patient);
    return (await post('medecin', `/clinical/encounters/${e.id}/prescriptions`, { lines }).expect(201)).body as { id: string; number: string };
  };
  const dispense = (rx: { id: string }, lines: object[], who = 'pharmacien', body: object = {}) => post(who, `/pharmacy/prescriptions/${rx.id}/dispense`, { lines, ...body });

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', '/pharmacy/prescriptions', ['patient', 'accueil', 'caisse', 'comptable', 'labo', 'medecin', 'infirmier', 'admin']],
      ['GET', `/pharmacy/prescriptions/${ID}`, ['patient', 'accueil', 'caisse', 'labo', 'medecin', 'infirmier', 'admin']],
      ['POST', `/pharmacy/prescriptions/${ID}/dispense`, ['patient', 'accueil', 'caisse', 'labo', 'medecin', 'infirmier', 'admin']],
    ])('%s %s : sans jeton → 401, profils sans le droit → 403', async (method, path, forbidden) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(path));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of forbidden) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });
  });

  describe('file et lecture', () => {
    it('montre aux deux pharmaciens, tous services confondus, les ordonnances en cours, les plus anciennes d\'abord', async () => {
      const d = await drug();
      await stock(d, [['A', 100, 50]]);
      const first = await prescribe(0, [line(d)]);
      const second = await prescribe(1, [line(d)]);
      for (const who of ['pharmacien', 'pharmacien2']) {
        const queue = (await get(who, '/pharmacy/prescriptions').expect(200)).body as { id: string; patient: { lastName: string } | null; dispensing: string; lines: number; remainingUnits: number }[];
        const ours = queue.filter((q) => [first.id, second.id].includes(q.id));
        expect(ours.map((q) => q.id)).toEqual([first.id, second.id]);
        expect(ours[0]).toMatchObject({ patient: { lastName: 'Mbarga' }, dispensing: 'NONE', lines: 1, remainingUnits: 10, allergyWarning: false });
      }
    });

    it('détaille l\'ordonnance : reste à délivrer, stock délivrable et prélèvement premier périmé, premier sorti ; la lecture est tracée', async () => {
      const d = await drug();
      await stock(d, [['LATE', 300, 8], ['SOON', 20, 6]]);
      const rx = await prescribe(0, [line(d, { quantity: 10 })]);
      const r = (await get('pharmacien', `/pharmacy/prescriptions/${rx.id}`).expect(200)).body;
      expect(r).toMatchObject({ id: rx.id, number: rx.number, status: 'ISSUED', dispensing: 'NONE', doctor: { username: 'medecin' }, patient: { number: expect.stringMatching(/^PAT-/) }, dispensations: [] });
      expect(r.lines[0]).toMatchObject({ position: 0, prescribed: 10, dispensed: 0, remaining: 10, dispensable: 14, needsAcknowledgement: false, drug: { id: d.id, unit: 'comprimé' } });
      expect(r.lines[0].suggestion).toEqual([{ batchNumber: 'SOON', expiry: day(20), quantity: 6 }, { batchNumber: 'LATE', expiry: day(300), quantity: 4 }]);
      expect((await audit('pharmacy.prescription.read', rx.id))[0].metadata).toMatchObject({ number: rx.number });
    });

    it('ordonnance introuvable → 404', async () => {
      await get('pharmacien', `/pharmacy/prescriptions/${UNKNOWN}`).expect(404);
      await dispense({ id: UNKNOWN }, [{ position: 0, quantity: 1 }]).expect(404);
    });
  });

  describe('délivrance', () => {
    it('délivre en une fois : le stock sort lot par lot (premier périmé, premier sorti), chaque prélèvement est inscrit au grand livre, le journal ne contient aucun médicament', async () => {
      const d = await drug();
      await stock(d, [['LATE', 300, 8], ['SOON', 20, 6]]);
      const rx = await prescribe(0, [line(d, { quantity: 10 })]);
      const r = await dispense(rx, [{ position: 0, quantity: 10 }], 'pharmacien', { notes: 'Conseils donnés' }).expect(200);
      expect(r.body).toMatchObject({ dispensing: 'COMPLETE' });
      expect(r.body.lines[0]).toMatchObject({ dispensed: 10, remaining: 0, suggestion: [] });
      expect(r.body.dispensations).toHaveLength(1);
      const dsp = r.body.dispensations[0];
      expect(dsp).toMatchObject({ number: expect.stringMatching(/^DSP-\d{7}$/), dispensedBy: { username: 'pharmacien' }, notes: 'Conseils donnés' });
      expect(dsp.lines.map((l: { batchNumber: string; quantity: number }) => [l.batchNumber, l.quantity])).toEqual([['SOON', 6], ['LATE', 4]]);
      expect(await available(d)).toBe(4);
      const moves = (await get('pharmacien', `/pharmacy/stock/movements?drugId=${d.id}`).expect(200)).body.items as { type: string; delta: number; reference: string | null }[];
      expect(moves.filter((m) => m.type === 'DISPENSE').map((m) => [m.delta, m.reference]).sort()).toEqual([[-4, dsp.number], [-6, dsp.number]].sort());
      const metadata = (await audit('pharmacy.dispensation.create', dsp.id))[0].metadata;
      expect(metadata).toMatchObject({ number: dsp.number, prescriptionNumber: rx.number, lines: 1, units: 10, allergyAcknowledgements: 0 });
      expect(JSON.stringify(metadata)).not.toContain(d.name);
      const queue = (await get('pharmacien', '/pharmacy/prescriptions').expect(200)).body as { id: string }[];
      expect(queue.some((q) => q.id === rx.id)).toBe(false);
    });

    it('délivre en plusieurs fois, jamais plus que prescrit', async () => {
      const d = await drug();
      await stock(d, [['A', 100, 100]]);
      const rx = await prescribe(1, [line(d, { quantity: 10 })]);
      const part = await dispense(rx, [{ position: 0, quantity: 4 }]).expect(200);
      expect(part.body).toMatchObject({ dispensing: 'PARTIAL' });
      expect(part.body.lines[0]).toMatchObject({ dispensed: 4, remaining: 6 });
      const queue = (await get('pharmacien2', '/pharmacy/prescriptions').expect(200)).body as { id: string; dispensing: string; remainingUnits: number }[];
      expect(queue.find((q) => q.id === rx.id)).toMatchObject({ dispensing: 'PARTIAL', remainingUnits: 6 });
      const over = await dispense(rx, [{ position: 0, quantity: 7 }], 'pharmacien2').expect(409);
      expect(over.body).toMatchObject({ code: 'PHARMACY_DISPENSE_EXCEEDS_PRESCRIPTION', message: expect.stringContaining('6 unité') });
      const rest = await dispense(rx, [{ position: 0, quantity: 6 }], 'pharmacien2').expect(200);
      expect(rest.body).toMatchObject({ dispensing: 'COMPLETE' });
      expect(rest.body.dispensations.map((x: { dispensedBy: { username: string } }) => x.dispensedBy.username)).toEqual(['pharmacien', 'pharmacien2']);
      expect(await available(d)).toBe(90);
      await dispense(rx, [{ position: 0, quantity: 1 }]).expect(409);
    });

    it('si un médicament manque, RIEN ne sort : ni lui, ni les autres lignes', async () => {
      const a = await drug();
      const b = await drug();
      await stock(a, [['A', 100, 50]]);
      await stock(b, [['B', 100, 3]]);
      const rx = await prescribe(2, [line(a, { quantity: 10 }), line(b, { quantity: 10 })]);
      const r = await dispense(rx, [{ position: 0, quantity: 10 }, { position: 1, quantity: 10 }]).expect(409);
      expect(r.body).toMatchObject({ code: 'PHARMACY_STOCK_INSUFFICIENT_FOR_LINE', message: expect.stringContaining('Ligne 2') });
      expect(r.body.message).toContain('7 unité');
      expect(await available(a)).toBe(50);
      expect(await available(b)).toBe(3);
      expect((await get('pharmacien', `/pharmacy/prescriptions/${rx.id}`).expect(200)).body.dispensations).toEqual([]);
      await dispense(rx, [{ position: 0, quantity: 10 }, { position: 1, quantity: 3 }]).expect(200);
      expect(await available(b)).toBe(0);
    });

    it('ne prélève ni sur un lot périmé ni sur un lot en quarantaine', async () => {
      const d = await drug();
      await stock(d, [['EXPIRED', 100, 20], ['QUAR', 200, 20], ['OK', 300, 5]]);
      await c.w.sql.query("UPDATE pharmacy_batches SET expiry_date = $1::date WHERE batch_number = 'EXPIRED' AND drug_id = $2", [day(-3), d.id]);
      const quarantined = ((await get('pharmacien', `/pharmacy/drugs/${d.id}/stock`).expect(200)).body.batches as { id: string; batchNumber: string }[]).find((b) => b.batchNumber === 'QUAR')!;
      await post('pharmacien', `/pharmacy/batches/${quarantined.id}/quarantine`, { reason: 'Rappel de lot' }).expect(200);
      const rx = await prescribe(0, [line(d, { quantity: 6 })]);
      expect((await dispense(rx, [{ position: 0, quantity: 6 }]).expect(409)).body.code).toBe('PHARMACY_STOCK_INSUFFICIENT_FOR_LINE');
      const r = await dispense(rx, [{ position: 0, quantity: 5 }]).expect(200);
      expect(r.body.dispensations[0].lines.map((l: { batchNumber: string }) => l.batchNumber)).toEqual(['OK']);
    });

    it('refuse les lignes inconnues, répétées, une quantité invalide et une dispensation vide', async () => {
      const d = await drug();
      await stock(d, [['A', 100, 50]]);
      const rx = await prescribe(1, [line(d)]);
      expect((await dispense(rx, [{ position: 3, quantity: 1 }]).expect(422)).body.code).toBe('PHARMACY_PRESCRIPTION_LINE_NOT_FOUND');
      expect((await dispense(rx, [{ position: 0, quantity: 1 }, { position: 0, quantity: 2 }]).expect(422)).body.code).toBe('PHARMACY_DISPENSE_DUPLICATE_LINE');
      await dispense(rx, [{ position: 0, quantity: 0 }]).expect(400);
      await dispense(rx, [{ position: 0, quantity: 1.5 }]).expect(400);
      await dispense(rx, []).expect(400);
      expect(await available(d)).toBe(50);
    });

    it('ne délivre pas une ordonnance annulée', async () => {
      const d = await drug();
      await stock(d, [['A', 100, 50]]);
      const rx = await prescribe(2, [line(d)]);
      await post('medecin', `/clinical/prescriptions/${rx.id}/cancel`, { reason: 'Erreur de patient' }).expect(200);
      expect((await dispense(rx, [{ position: 0, quantity: 1 }]).expect(409)).body.code).toBe('PHARMACY_PRESCRIPTION_NOT_ACTIVE');
      const queue = (await get('pharmacien', '/pharmacy/prescriptions').expect(200)).body as { id: string }[];
      expect(queue.some((q) => q.id === rx.id)).toBe(false);
    });

    it('un médicament désactivé après l\'ordonnance se délivre encore tant qu\'il reste du stock', async () => {
      const d = await drug();
      await stock(d, [['A', 100, 5]]);
      const rx = await prescribe(0, [line(d, { quantity: 5 })]);
      await post('pharmacien', `/pharmacy/drugs/${d.id}/deactivate`).expect(200);
      await dispense(rx, [{ position: 0, quantity: 5 }]).expect(200);
    });
  });

  describe('allergies revérifiées à la délivrance', () => {
    it('exige le motif du pharmacien quand une allergie saisie APRÈS l\'ordonnance vise le médicament, et le garde', async () => {
      const d = await drug({ name: 'Cotrimoxazole Forte', genericName: 'Cotrimoxazole' });
      await stock(d, [['A', 100, 50]]);
      const rx = await prescribe(0, [line(d, { quantity: 10 })]);
      await post('medecin', `/clinical/patients/${ids.patients[0]}/allergies`, { substance: 'Cotrimoxazole', severity: 'SEVERE' }).expect(201);
      const detail = (await get('pharmacien', `/pharmacy/prescriptions/${rx.id}`).expect(200)).body;
      expect(detail.lines[0]).toMatchObject({ needsAcknowledgement: true, allergyOverride: null, allergyAlerts: [{ substance: 'Cotrimoxazole', severity: 'SEVERE' }] });
      expect(((await get('pharmacien', '/pharmacy/prescriptions').expect(200)).body as { id: string; allergyWarning: boolean }[]).find((q) => q.id === rx.id)!.allergyWarning).toBe(true);
      const refused = await dispense(rx, [{ position: 0, quantity: 10 }]).expect(409);
      expect(refused.body).toMatchObject({ code: 'PHARMACY_ALLERGY_ACKNOWLEDGEMENT_REQUIRED', message: expect.stringContaining('Cotrimoxazole') });
      await dispense(rx, [{ position: 0, quantity: 10, allergyOverride: 'ab' }]).expect(409);
      expect(await available(d)).toBe(50);
      const reason = 'Allergie discutée avec le médecin prescripteur.';
      const ok = await dispense(rx, [{ position: 0, quantity: 10, allergyOverride: reason }]).expect(200);
      expect(ok.body.dispensations[0].lines[0].allergyOverride).toBe(reason);
      const metadata = (await audit('pharmacy.dispensation.create', ok.body.dispensations[0].id))[0].metadata;
      expect(metadata).toMatchObject({ allergyAcknowledgements: 1 });
      expect(JSON.stringify(metadata)).not.toContain('discutée');
    });

    it('ne redemande rien quand le médecin avait levé l\'allergie à l\'émission', async () => {
      const d = await drug({ name: 'Pénicilline V', genericName: 'Phénoxyméthylpénicilline' });
      await stock(d, [['A', 100, 50]]);
      await post('medecin', `/clinical/patients/${ids.patients[1]}/allergies`, { substance: 'Pénicilline', severity: 'MODERATE' }).expect(201);
      const e = await open(1);
      const rx = (await post('medecin', `/clinical/encounters/${e.id}/prescriptions`, { lines: [line(d, { allergyOverride: 'Bénéfice supérieur au risque' })] }).expect(201)).body;
      const detail = (await get('pharmacien', `/pharmacy/prescriptions/${rx.id}`).expect(200)).body;
      expect(detail.lines[0]).toMatchObject({ needsAcknowledgement: false, allergyOverride: 'Bénéfice supérieur au risque' });
      await dispense(rx, [{ position: 0, quantity: 10 }]).expect(200);
    });
  });

  describe('côté clinique', () => {
    it('le médecin voit ce qui est délivré, et ne peut plus annuler une ordonnance délivrée (même en partie)', async () => {
      const d = await drug();
      await stock(d, [['A', 100, 50]]);
      const e = await open(0);
      const rx = (await post('medecin', `/clinical/encounters/${e.id}/prescriptions`, { lines: [line(d, { quantity: 10 })] }).expect(201)).body;
      expect(rx.dispensing).toBe('NONE');
      await dispense(rx, [{ position: 0, quantity: 3 }]).expect(200);
      const listed = (await get('medecin', `/clinical/encounters/${e.id}/prescriptions`).expect(200)).body as { id: string; dispensing: string }[];
      expect(listed.find((p) => p.id === rx.id)!.dispensing).toBe('PARTIAL');
      const refused = await post('medecin', `/clinical/prescriptions/${rx.id}/cancel`, { reason: 'Erreur' }).expect(409);
      expect(refused.body.code).toBe('CLINICAL_PRESCRIPTION_DISPENSED');
      await dispense(rx, [{ position: 0, quantity: 7 }]).expect(200);
      expect(((await get('medecin', `/clinical/prescriptions/${rx.id}`).expect(200)).body as { dispensing: string }).dispensing).toBe('COMPLETE');
    });
  });
});

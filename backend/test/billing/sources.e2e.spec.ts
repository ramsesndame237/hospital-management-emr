import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const NO_PII = /Mbarga|Élisabeth|Ndongo|Nkoa|Curie|Pasteur|Abel/;
const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const NUMERIC = { section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, tatMinutes: 120 };

describe('API facturation reliée /api/v1/billing/billable (HTTP réel, PostgreSQL réel)', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const patch = (who: string, url: string, body: object = {}) => c.http().patch(api(url)).set(c.bearer(who)).send(body);

  let seq = 0;
  /** Une analyse du catalogue clinique. */
  const labTest = async (): Promise<{ id: string; code: string }> => {
    seq += 1;
    const r = await post('admin', '/lab/tests', { code: `SRC-${seq}`, name: `Analyse ${seq}`, ...NUMERIC }).expect(201);
    return { id: r.body.id as string, code: r.body.code as string };
  };
  const requisition = async (testIds: string[]) => (await post('medecin', '/lab/requisitions', { patientId: ids.patients[0], testIds }).expect(201)).body;
  /** Un acte du catalogue de facturation qui tarifie ce code d'analyse. */
  const price = (sourceCode: string, unitPrice: number, over: Record<string, unknown> = {}) => {
    seq += 1;
    return post('admin', '/billing/items', { code: `ACT-SRC-${seq}`, name: `Tarif ${sourceCode}`, category: 'LABORATORY', unitPrice, sourceCode, ...over });
  };
  const billable = async (type = 'LAB_REQUISITION') => (await get('caisse', `/billing/billable?type=${type}&limit=100`).expect(200)).body as { items: Array<{ id: string; reference: string; unpriced: string[]; total: number | null; lines: Array<{ code: string; unitPrice: number | null; quantity: number }>; patient: { number: string } | null }>; total: number };
  const bill = (id: string, sourceType = 'LAB_REQUISITION') => post('caisse', '/billing/invoices/from-source', { sourceType, sourceId: id });

  describe("contrôle d'accès", () => {
    it.each([['GET', '/billing/billable?type=LAB_REQUISITION'], ['POST', '/billing/invoices/from-source']] as const)('%s %s : sans jeton → 401 ; patient, médecin, infirmier et laboratoire → 403', async (method, url) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(url));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of ['patient', 'medecin', 'infirmier', 'labo']) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });
  });

  describe('catalogue : correspondance avec un code source', () => {
    it('normalise le code source en majuscules, le renvoie, et refuse deux actes actifs pour le même code', async () => {
      const t = await labTest();
      const first = await price(t.code.toLowerCase(), 2500);
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ category: 'LABORATORY', sourceCode: t.code });
      const dup = await price(t.code, 3000);
      expect([dup.status, dup.body.code]).toEqual([409, 'BILLING_ITEM_SOURCE_ALREADY_MAPPED']);
    });

    it("refuse un code source sur une catégorie qui n'en a pas, ou mal formé", async () => {
      const wrongCategory = await price('NFS', 1000, { category: 'CONSULTATION' });
      expect([wrongCategory.status, wrongCategory.body.code]).toEqual([422, 'BILLING_ITEM_SOURCE_CATEGORY']);
      const malformed = await price('pas valide!', 1000);
      expect([malformed.status, malformed.body.code]).toEqual([422, 'BILLING_ITEM_SOURCE_CODE_INVALID']);
    });

    it('permet de changer ou de retirer la correspondance, et refuse de réactiver un doublon', async () => {
      const t = await labTest();
      const a = (await price(t.code, 1000)).body;
      expect((await patch('admin', `/billing/items/${a.id}`, { sourceCode: null })).body.sourceCode).toBeNull();
      const b = (await price(t.code, 1200)).body; // le code est libre : un autre acte le prend
      expect(b.sourceCode).toBe(t.code);
      await post('admin', `/billing/items/${a.id}/deactivate`).expect(200); // déjà sans code : sans conflit
      const back = await patch('admin', `/billing/items/${a.id}`, { sourceCode: t.code });
      expect([back.status, back.body.code]).toEqual([409, 'BILLING_ITEM_SOURCE_ALREADY_MAPPED']);
    });
  });

  describe("d'une demande d'analyses à la facture", () => {
    it("liste la demande à facturer sans prix, refuse la facture (422 avec les codes), puis l'établit au prix du catalogue", async () => {
      const t1 = await labTest();
      const t2 = await labTest();
      const req = await requisition([t1.id, t2.id]);

      const before = (await billable()).items.find((i) => i.id === req.id)!;
      expect(before).toMatchObject({ reference: req.number, total: null });
      expect([...before.unpriced].sort()).toEqual([t1.code, t2.code].sort());
      expect(before.patient?.number).toBeDefined();

      const refused = await bill(req.id);
      expect([refused.status, refused.body.code]).toEqual([422, 'BILLING_SOURCE_UNPRICED']);
      expect(refused.body.message).toContain(t1.code);

      await price(t1.code, 3500).then((r) => expect(r.status).toBe(201));
      expect((await bill(req.id)).status).toBe(422); // un code reste sans prix : rien n'est facturé à moitié
      await price(t2.code, 1500).then((r) => expect(r.status).toBe(201));

      const priced = (await billable()).items.find((i) => i.id === req.id)!;
      expect(priced.unpriced).toEqual([]);
      expect(priced.total).toBe(5000);

      const created = await bill(req.id);
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ status: 'DRAFT', subtotal: 5000, total: 5000, note: req.number });
      expect(created.body.lines.map((l: { itemCode: string; unitPrice: number; quantity: number }) => [l.unitPrice, l.quantity]).sort()).toEqual([[1500, 1], [3500, 1]]);
      expect((await billable()).items.some((i) => i.id === req.id)).toBe(false);

      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'billing.invoice.create-from-source' AND resource_id = $1", [created.body.id]);
      expect(entry.metadata).toMatchObject({ sourceType: 'LAB_REQUISITION', sourceReference: req.number, lines: 2 });
      expect(JSON.stringify(entry.metadata)).not.toMatch(NO_PII);
    });

    it("refuse de facturer deux fois la même demande, et la libère quand sa facture est annulée", async () => {
      const t = await labTest();
      await price(t.code, 4000).then((r) => expect(r.status).toBe(201));
      const req = await requisition([t.id]);
      const first = await bill(req.id);
      expect(first.status).toBe(201);
      const again = await bill(req.id);
      expect([again.status, again.body.code]).toEqual([409, 'BILLING_SOURCE_ALREADY_BILLED']);

      await post('caisse', `/billing/invoices/${first.body.id}/cancel`, { reason: 'Erreur de saisie' });
      const cancelled = await get('caisse', `/billing/invoices/${first.body.id}`);
      expect(cancelled.body.status).toBe('CANCELLED');
      expect((await billable()).items.some((i) => i.id === req.id)).toBe(true);
      const second = await bill(req.id);
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);
    });

    it("ne propose pas une demande annulée, et répond 404 à une source inconnue", async () => {
      const t = await labTest();
      await price(t.code, 900).then((r) => expect(r.status).toBe(201));
      const req = await requisition([t.id]);
      await post('medecin', `/lab/requisitions/${req.id}/cancel`, { reason: 'Prescrite par erreur' }).expect(200);
      expect((await billable()).items.some((i) => i.id === req.id)).toBe(false);
      expect((await bill(req.id)).status).toBe(404);
      expect((await bill(UNKNOWN)).status).toBe(404);
    });

    it('lit uniquement identité, numéro, date et codes : aucune donnée clinique dans la liste', async () => {
      const t = await labTest();
      await price(t.code, 700).then((r) => expect(r.status).toBe(201));
      const req = await requisition([t.id]);
      const page = await get('caisse', '/billing/billable?type=LAB_REQUISITION&limit=100').expect(200);
      const row = page.body.items.find((i: { id: string }) => i.id === req.id);
      expect(Object.keys(row).sort()).toEqual(['id', 'lines', 'occurredAt', 'patient', 'reference', 'total', 'type', 'unpriced']);
      expect(Object.keys(row.lines[0]).sort()).toEqual(['code', 'itemName', 'label', 'quantity', 'unitPrice']);
    });
  });

  describe("d'un examen d'imagerie réalisé", () => {
    it("ne propose l'examen qu'une fois réalisé, puis le facture au prix du catalogue", async () => {
      seq += 1;
      const code = `SRC-RX${seq}`;
      await post('admin', '/imaging/exam-types', { code, name: 'Radiographie du thorax', modality: 'XRAY', bodyPart: 'Thorax', durationMinutes: 20 }).expect(201);
      const examId = ((await get('admin', `/imaging/exam-types?search=${code}`).expect(200)).body.items as { id: string; code: string }[]).find((e) => e.code === code)!.id;
      const order = (await post('medecin', '/imaging/orders', { patientId: ids.patients[0], examTypeId: examId, clinicalQuestion: 'Toux persistante.' }).expect(201)).body as { id: string; number: string };

      expect((await billable('IMAGING_ORDER')).items.some((i) => i.id === order.id)).toBe(false);
      expect((await bill(order.id, 'IMAGING_ORDER')).status).toBe(404);

      await post('radio', `/imaging/orders/${order.id}/perform`, { pregnant: false, contrastAllergy: false }).expect(200);
      const row = (await billable('IMAGING_ORDER')).items.find((i) => i.id === order.id)!;
      expect(row).toMatchObject({ reference: order.number, unpriced: [code], total: null });
      expect(row.lines).toMatchObject([{ code, quantity: 1, unitPrice: null }]);

      await price(code, 12000, { category: 'RADIOLOGY' }).then((r) => expect(r.status).toBe(201));
      const created = await bill(order.id, 'IMAGING_ORDER');
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ status: 'DRAFT', total: 12000, note: order.number });
      expect((await bill(order.id, 'IMAGING_ORDER')).body.code).toBe('BILLING_SOURCE_ALREADY_BILLED');
      expect((await billable('IMAGING_ORDER')).items.some((i) => i.id === order.id)).toBe(false);
    });
  });

  describe('de la délivrance de médicaments', () => {
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

    it("facture les unités réellement délivrées (tous lots confondus) au prix du catalogue", async () => {
      seq += 1;
      const code = `SRC-DR${seq}`;
      const drug = (await post('pharmacien', '/pharmacy/drugs', { code, name: 'Amoxicilline 500', genericName: 'Amoxicilline', strength: '500 mg', form: 'CAPSULE', schedule: 'PRESCRIPTION', unit: 'gélule', unitPrice: 25, reorderLevel: 0 }).expect(201)).body as { id: string };
      await post('pharmacien', '/pharmacy/receipts', { supplier: 'Pharma Distrib', lines: [
        { drugId: drug.id, batchNumber: 'B1', expiry: day(30), quantity: 6, unitCost: 10 }, { drugId: drug.id, batchNumber: 'B2', expiry: day(200), quantity: 20, unitCost: 10 },
      ] }).expect(201);
      const admission = (await post('accueil', '/admissions', { patientId: ids.patients[0], type: 'OUTPATIENT', serviceId: ids.ped }).expect(201)).body.id as string;
      const encounter = (await post('medecin', '/clinical/encounters', { admissionId: admission }).expect(201)).body as { id: string };
      const rx = (await post('medecin', `/clinical/encounters/${encounter.id}/prescriptions`, { lines: [{ drugId: drug.id, dose: '1 gélule', frequency: '3 fois par jour', durationDays: 7, quantity: 10 }] }).expect(201)).body as { id: string };

      await post('pharmacien', `/pharmacy/prescriptions/${rx.id}/dispense`, { lines: [{ position: 0, quantity: 10 }] }).expect(200);
      const dispensationId = ((await get('pharmacien', `/pharmacy/prescriptions/${rx.id}`).expect(200)).body.dispensations as { id: string }[])[0].id;

      const row = (await billable('DISPENSATION')).items.find((i) => i.id === dispensationId)!;
      expect(row.lines).toMatchObject([{ code, quantity: 10, unitPrice: null }]); // 6 du lot B1 + 4 du lot B2 : une seule ligne de 10
      expect(row.unpriced).toEqual([code]);

      await price(code, 150, { category: 'PHARMACY' }).then((r) => expect(r.status).toBe(201));
      const created = await bill(dispensationId, 'DISPENSATION');
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ status: 'DRAFT', subtotal: 1500, total: 1500 });
      expect(created.body.lines).toMatchObject([{ itemCode: expect.stringContaining('ACT-SRC'), unitPrice: 150, quantity: 10 }]);
      expect((await billable('DISPENSATION')).items.some((i) => i.id === dispensationId)).toBe(false);
    });
  });

  describe('autres types et validations', () => {
    it('refuse un type inconnu ou absent, et un identifiant mal formé', async () => {
      const bad = await get('caisse', '/billing/billable?type=PIZZA');
      expect([bad.status, bad.body.code]).toEqual([422, 'BILLING_SOURCE_TYPE_INVALID']);
      expect((await get('caisse', '/billing/billable')).status).toBe(422);
      expect((await post('caisse', '/billing/invoices/from-source', { sourceType: 'PIZZA', sourceId: UNKNOWN })).status).toBe(422);
      expect((await post('caisse', '/billing/invoices/from-source', { sourceType: 'LAB_REQUISITION', sourceId: 'pas-un-uuid' })).status).toBe(400);
    });
  });
});

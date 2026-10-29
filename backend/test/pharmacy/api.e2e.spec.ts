import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe('API pharmacie : catalogue, réceptions, stock, ajustements', () => {
  let c: ClinicalWorld;
  beforeAll(async () => {
    c = await buildClinicalWorld();
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const patch = (who: string, url: string, body: object = {}) => c.http().patch(api(url)).set(c.bearer(who)).send(body);
  const audit = (action: string, resourceId: string) => c.w.sql.query<{ metadata: Record<string, unknown> }>('SELECT metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  let seq = 0;
  const drug = async (over: Record<string, unknown> = {}): Promise<{ id: string; code: string }> => {
    seq += 1;
    const r = await post('pharmacien', '/pharmacy/drugs', { code: `D${seq}`, name: `Médicament ${seq}`, genericName: `Molécule ${seq}`, strength: '500 mg', form: 'TABLET', schedule: 'PRESCRIPTION', unit: 'comprimé', unitPrice: 25, reorderLevel: 100, ...over }).expect(201);
    return { id: r.body.id as string, code: r.body.code as string };
  };
  const receive = (lines: object[], over: Record<string, unknown> = {}, who = 'pharmacien') => post(who, '/pharmacy/receipts', { supplier: 'Pharma Distrib', lines, ...over });
  const line = (d: { id: string }, batchNumber: string, expiryOffset: number, quantity: number, unitCost = 10) => ({ drugId: d.id, batchNumber, expiry: day(expiryOffset), quantity, unitCost });
  const stockOf = async (d: { id: string }) => (await get('pharmacien', `/pharmacy/drugs/${d.id}/stock`).expect(200)).body;

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', '/pharmacy/drugs', ['patient', 'accueil', 'caisse', 'comptable', 'labo']],
      ['POST', '/pharmacy/drugs', ['patient', 'accueil', 'medecin', 'infirmier', 'labo']],
      ['PATCH', `/pharmacy/drugs/${ID}`, ['patient', 'medecin', 'infirmier']],
      ['GET', '/pharmacy/stock', ['patient', 'accueil', 'medecin', 'infirmier', 'labo']],
      ['GET', '/pharmacy/stock/summary', ['medecin', 'infirmier', 'caisse']],
      ['GET', '/pharmacy/stock/movements', ['medecin', 'comptable']],
      ['GET', `/pharmacy/drugs/${ID}/fefo?quantity=1`, ['medecin', 'labo']],
      ['POST', `/pharmacy/batches/${ID}/quarantine`, ['admin', 'medecin', 'infirmier', 'labo']],
      ['POST', '/pharmacy/receipts', ['admin', 'medecin', 'infirmier', 'labo', 'caisse']],
      ['GET', '/pharmacy/receipts', ['medecin', 'labo']],
      ['POST', '/pharmacy/adjustments', ['admin', 'medecin', 'infirmier', 'labo']],
      ['POST', `/pharmacy/adjustments/${ID}/approve`, ['admin', 'medecin', 'infirmier', 'labo']],
      ['POST', `/pharmacy/adjustments/${ID}/reject`, ['admin', 'medecin', 'infirmier', 'labo']],
    ])('%s %s : sans jeton → 401, profils sans le droit → 403', async (method, path, forbidden) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(path));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of forbidden) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });

    it('le médecin et l\'infirmier lisent le formulaire sans le modifier ; l\'administrateur le tient mais ne touche pas au stock', async () => {
      const d = await drug();
      for (const who of ['medecin', 'infirmier', 'admin']) expect([who, (await get(who, `/pharmacy/drugs/${d.id}`)).status]).toEqual([who, 200]);
      expect((await patch('medecin', `/pharmacy/drugs/${d.id}`, { unitPrice: 1 })).status).toBe(403);
      expect((await patch('admin', `/pharmacy/drugs/${d.id}`, { unitPrice: 30 })).status).toBe(200);
      expect((await get('admin', '/pharmacy/stock')).status).toBe(200);
      expect((await receive([line(d, 'A', 100, 1)], {}, 'admin')).status).toBe(403);
    });
  });

  describe('catalogue', () => {
    it('crée, lit, normalise le code et refuse un code déjà pris', async () => {
      const r = await post('pharmacien', '/pharmacy/drugs', { code: ' amox-500 ', name: 'Clamoxyl', genericName: 'Amoxicilline', strength: '500 mg', form: 'CAPSULE', schedule: 'PRESCRIPTION', storage: 'COOL', atcCode: 'J01CA04', unit: 'gélule', unitPrice: 150, reorderLevel: 300, notes: 'Conserver au frais' }).expect(201);
      expect(r.body).toMatchObject({ code: 'AMOX-500', genericName: 'Amoxicilline', storage: 'COOL', atcCode: 'J01CA04', unitPrice: 150, reorderLevel: 300, active: true });
      expect((await get('medecin', `/pharmacy/drugs/${r.body.id}`).expect(200)).body.notes).toBe('Conserver au frais');
      expect((await post('pharmacien', '/pharmacy/drugs', { code: 'amox-500', name: 'Autre', genericName: 'Autre', form: 'TABLET', schedule: 'OTC', unit: 'cp' })).status).toBe(409);
      expect((await audit('pharmacy.drug.create', r.body.id))[0].metadata).toMatchObject({ code: 'AMOX-500', form: 'CAPSULE', schedule: 'PRESCRIPTION', unitPrice: 150 });
    });

    it.each([
      [{ code: 'é!' }, 'PHARMACY_DRUG_CODE_INVALID'],
      [{ form: 'LIQUID' }, 'PHARMACY_FORM_INVALID'],
      [{ schedule: 'FREE' }, 'PHARMACY_SCHEDULE_INVALID'],
      [{ storage: 'FRIDGE' }, 'PHARMACY_STORAGE_INVALID'],
      [{ atcCode: 'N02' }, 'PHARMACY_ATC_INVALID'],
    ])('refuse une saisie invalide %j', async (over, code) => {
      seq += 1;
      const r = await post('pharmacien', '/pharmacy/drugs', { code: `V${seq}`, name: 'X', genericName: 'X', form: 'TABLET', schedule: 'OTC', unit: 'cp', ...over });
      expect(r.status).toBe(422);
      expect(JSON.stringify(r.body)).toContain(code);
    });

    it('refuse un prix décimal ou négatif (les montants sont des entiers)', async () => {
      for (const unitPrice of [1.5, -1]) expect((await post('pharmacien', '/pharmacy/drugs', { code: 'PRIX', name: 'X', genericName: 'X', form: 'TABLET', schedule: 'OTC', unit: 'cp', unitPrice })).status).toBe(400);
    });

    it('modifie sans toucher au code, efface avec null, et garde l\'ancien et le nouveau prix au journal', async () => {
      const d = await drug({ unitPrice: 25 });
      const r = await patch('pharmacien', `/pharmacy/drugs/${d.id}`, { unitPrice: 40, strength: null, notes: 'Nouveau', code: 'IGNORE' }).expect(200);
      expect(r.body).toMatchObject({ code: d.code, unitPrice: 40, strength: null, notes: 'Nouveau' });
      const [entry] = await audit('pharmacy.drug.update', d.id);
      expect(entry.metadata).toMatchObject({ priceFrom: 25, priceTo: 40 });
      expect(String(entry.metadata.changed)).toContain('unitPrice');
      const again = await patch('pharmacien', `/pharmacy/drugs/${d.id}`, { unitPrice: 40 }).expect(200);
      expect(again.body.unitPrice).toBe(40);
      expect(await audit('pharmacy.drug.update', d.id)).toHaveLength(1);
      expect((await patch('pharmacien', `/pharmacy/drugs/${UNKNOWN}`, { unitPrice: 1 })).status).toBe(404);
    });

    it('désactive et réactive, filtre et pagine la liste', async () => {
      const d = await drug({ form: 'SYRUP', schedule: 'OTC', genericName: 'Zzyzx unique' });
      expect((await post('pharmacien', `/pharmacy/drugs/${d.id}/deactivate`).expect(200)).body.active).toBe(false);
      const hidden = await get('pharmacien', '/pharmacy/drugs?search=zzyzx').expect(200);
      expect(hidden.body.total).toBe(0);
      const all = await get('pharmacien', '/pharmacy/drugs?search=zzyzx&includeInactive=true&form=SYRUP&schedule=OTC').expect(200);
      expect(all.body.items.map((i: { code: string }) => i.code)).toEqual([d.code]);
      await post('pharmacien', `/pharmacy/drugs/${d.id}/activate`).expect(200);
      expect((await get('pharmacien', '/pharmacy/drugs?search=zzyzx').expect(200)).body.total).toBe(1);
      expect((await get('pharmacien', '/pharmacy/drugs?limit=1').expect(200)).body.items).toHaveLength(1);
      expect((await get('pharmacien', '/pharmacy/drugs?form=X')).status).toBe(422);
    });
  });

  describe('réceptions et stock', () => {
    it('reçoit une livraison : lots, stock, grand livre, numéro, audit', async () => {
      const a = await drug({ reorderLevel: 100 });
      const b = await drug({ reorderLevel: 0 });
      const r = await receive([line(a, 'l-1', 200, 60, 10), line(a, 'L-2', 30, 40, 20), line(b, 'M-1', 300, 5, 100)], { deliveryNote: 'BL-1', notes: 'Livraison complète' }).expect(201);
      expect(r.body).toMatchObject({ supplier: 'Pharma Distrib', deliveryNote: 'BL-1', units: 105, value: 60 * 10 + 40 * 20 + 5 * 100, receivedBy: { username: 'pharmacien' } });
      expect(r.body.number).toMatch(/^GRN-\d{7}$/);
      expect(r.body.lines.map((l: { batchNumber: string }) => l.batchNumber)).toEqual(['L-1', 'L-2', 'M-1']);
      const stock = await stockOf(a);
      expect(stock).toMatchObject({ dispensable: 100, quarantined: 0, expired: 0, expiringSoon: 40, level: 'LOW', value: 1400, nextExpiry: day(30) });
      expect(stock.batches.map((x: { batchNumber: string }) => x.batchNumber)).toEqual(['L-2', 'L-1']);
      expect(stock.batches[0]).toMatchObject({ expiringSoon: true, dispensable: true, daysToExpiry: 30 });
      const moves = (await get('pharmacien', `/pharmacy/stock/movements?drugId=${a.id}`).expect(200)).body;
      expect(moves.total).toBe(2);
      expect(moves.items[0]).toMatchObject({ type: 'RECEIPT', delta: 40, balance: 40, reference: r.body.number, by: { username: 'pharmacien' } });
      expect((await get('pharmacien', `/pharmacy/receipts/${r.body.id}`).expect(200)).body.lines).toHaveLength(3);
      expect((await audit('pharmacy.receipt.post', r.body.id))[0].metadata).toMatchObject({ number: r.body.number, supplier: 'Pharma Distrib', lines: 3, units: 105 });
    });

    it('une seconde livraison du même lot s\'ajoute ; une autre péremption est refusée sans rien écrire', async () => {
      const d = await drug();
      const other = await drug();
      await receive([line(d, 'SAME', 100, 10, 10)]).expect(201);
      await receive([line(d, 'same', 100, 30, 20)]).expect(201);
      const after = await stockOf(d);
      expect(after.batches).toHaveLength(1);
      expect(after.batches[0]).toMatchObject({ quantity: 40, unitCost: 18 });
      const bad = await receive([line(other, 'FRESH', 100, 5), line(d, 'SAME', 120, 5)]);
      expect(bad.status).toBe(409);
      expect(JSON.stringify(bad.body)).toContain('PHARMACY_BATCH_EXPIRY_MISMATCH');
      expect((await stockOf(other)).batches).toHaveLength(0);
      expect((await stockOf(d)).dispensable).toBe(40);
    });

    it('refuse un lot périmé, un doublon, un médicament inconnu ou retiré, des quantités ou dates invalides', async () => {
      const d = await drug();
      const retired = await drug();
      await post('pharmacien', `/pharmacy/drugs/${retired.id}/deactivate`).expect(200);
      expect(JSON.stringify((await receive([line(d, 'OLD', -1, 5)])).body)).toContain('PHARMACY_RECEIPT_EXPIRED');
      expect((await receive([line(d, 'TODAY', 0, 5)])).status).toBe(201);
      expect(JSON.stringify((await receive([line(d, 'DUP', 50, 1), line(d, 'dup', 50, 2)])).body)).toContain('PHARMACY_RECEIPT_DUPLICATE_LINE');
      expect((await receive([{ ...line(d, 'X', 50, 1), drugId: UNKNOWN }])).status).toBe(404);
      const inactive = await receive([line(retired, 'X', 50, 1)]);
      expect([inactive.status, JSON.stringify(inactive.body)]).toEqual([409, expect.stringContaining('PHARMACY_DRUG_INACTIVE')]);
      expect((await receive([{ ...line(d, 'Q', 50, 1), quantity: 0 }])).status).toBe(400);
      expect((await receive([{ ...line(d, 'Q', 50, 1), quantity: 1.5 }])).status).toBe(400);
      expect((await receive([{ ...line(d, 'Q', 50, 1), expiry: '31/12/2030' }])).status).toBe(400);
      expect((await receive([{ ...line(d, 'Q', 50, 1), expiry: '2030-02-30' }])).status).toBe(422);
      expect((await receive([])).status).toBe(400);
      expect((await receive([line(d, 'Q', 50, 1)], { supplier: '' })).status).toBe(400);
    });

    it('liste les réceptions par fournisseur et médicament, et signale une réception introuvable', async () => {
      const d = await drug();
      await receive([line(d, 'R1', 100, 3)], { supplier: 'Fournisseur Unique SARL' }).expect(201);
      expect((await get('pharmacien', '/pharmacy/receipts?supplier=unique%20sarl').expect(200)).body.items.map((r: { supplier: string }) => r.supplier)).toEqual(['Fournisseur Unique SARL']);
      expect((await get('pharmacien', `/pharmacy/receipts?drugId=${d.id}`).expect(200)).body.total).toBe(1);
      expect((await get('pharmacien', `/pharmacy/receipts/${UNKNOWN}`)).status).toBe(404);
    });

    it('classe le stock en vue d\'ensemble : rupture, bas, correct ; filtre et tableau de bord', async () => {
      const out = await drug({ genericName: 'Aaa rupture', reorderLevel: 10 });
      const low = await drug({ genericName: 'Aab bas', reorderLevel: 100 });
      const fine = await drug({ genericName: 'Aac bon', reorderLevel: 10 });
      await receive([line(low, 'B1', 200, 50), line(fine, 'G1', 200, 500)]).expect(201);
      const page = (await get('pharmacien', '/pharmacy/stock?search=Aa').expect(200)).body;
      expect(page.items.map((i: { code: string; level: string }) => [i.code, i.level])).toEqual([[out.code, 'OUT'], [low.code, 'LOW'], [fine.code, 'OK']]);
      expect((await get('pharmacien', '/pharmacy/stock?level=low').expect(200)).body.items.map((i: { code: string }) => i.code)).toContain(low.code);
      expect((await get('pharmacien', '/pharmacy/stock?level=NOPE')).status).toBe(422);
      const summary = (await get('pharmacien', '/pharmacy/stock/summary').expect(200)).body;
      expect(summary).toMatchObject({ expiryAlertDays: 90 });
      expect(summary.out).toBeGreaterThanOrEqual(1);
      expect(summary.low).toBeGreaterThanOrEqual(1);
      expect(summary.value).toBeGreaterThan(0);
    });

    it('propose les lots « premier périmé, premier sorti » et dit ce qui manque', async () => {
      const d = await drug();
      await receive([line(d, 'LATE', 300, 50), line(d, 'SOON', 40, 30), line(d, 'MID', 100, 20)]).expect(201);
      const plan = (await get('pharmacien', `/pharmacy/drugs/${d.id}/fefo?quantity=70`).expect(200)).body;
      expect(plan.allocations.map((a: { batchNumber: string; quantity: number }) => [a.batchNumber, a.quantity])).toEqual([['SOON', 30], ['MID', 20], ['LATE', 20]]);
      expect(plan.shortfall).toBe(0);
      expect((await get('pharmacien', `/pharmacy/drugs/${d.id}/fefo?quantity=150`).expect(200)).body.shortfall).toBe(50);
      expect((await get('pharmacien', `/pharmacy/drugs/${d.id}/fefo?quantity=0`)).status).toBe(422);
      expect((await get('pharmacien', `/pharmacy/drugs/${UNKNOWN}/fefo?quantity=1`)).status).toBe(404);
    });

    it('liste les péremptions, périmés compris, et leur horizon', async () => {
      const d = await drug();
      await receive([line(d, 'NEAR', 10, 5), line(d, 'FAR', 400, 5), line(d, 'TODAY', 0, 5)]).expect(201);
      await c.w.sql.query("UPDATE pharmacy_batches SET expiry_date = $1::date WHERE batch_number = 'TODAY' AND drug_id = $2", [day(-3), d.id]);
      const near = (await get('pharmacien', '/pharmacy/stock/expiry?days=30&limit=200').expect(200)).body;
      const mine = near.items.filter((i: { drug: { id: string } }) => i.drug.id === d.id);
      expect(mine.map((i: { batchNumber: string }) => i.batchNumber)).toEqual(['TODAY', 'NEAR']);
      expect(mine[0]).toMatchObject({ expired: true, dispensable: false, daysToExpiry: -3 });
      expect(mine[1]).toMatchObject({ expired: false, expiringSoon: true, drug: { code: d.code } });
      expect(near.expiryAlertDays).toBe(90);
      expect((await get('pharmacien', '/pharmacy/stock/expiry?days=x')).status).toBe(422);
      expect((await get('pharmacien', '/pharmacy/stock?hasExpired=true').expect(200)).body.items.map((i: { code: string }) => i.code)).toContain(d.code);
      const stock = await stockOf(d);
      expect(stock).toMatchObject({ expired: 5, dispensable: 10 });
    });
  });

  describe('quarantaine', () => {
    it('met un lot de côté avec un motif, le retire de la délivrance, refuse d\'y recevoir, puis le libère', async () => {
      const d = await drug();
      const r = await receive([line(d, 'Q1', 100, 20), line(d, 'Q2', 200, 10)]).expect(201);
      const q1 = r.body.lines[0].batchId as string;
      expect((await post('pharmacien', `/pharmacy/batches/${q1}/quarantine`, { reason: '' })).status).toBe(400);
      const held = (await post('pharmacien', `/pharmacy/batches/${q1}/quarantine`, { reason: 'Rappel de lot du fabricant' }).expect(200)).body;
      expect(held).toMatchObject({ status: 'QUARANTINED', dispensable: false, quarantineReason: 'Rappel de lot du fabricant', quarantinedBy: { username: 'pharmacien' } });
      expect((await post('pharmacien', `/pharmacy/batches/${q1}/quarantine`, { reason: 'Encore' })).status).toBe(409);
      const stock = await stockOf(d);
      expect(stock).toMatchObject({ dispensable: 10, quarantined: 20 });
      const plan = (await get('pharmacien', `/pharmacy/drugs/${d.id}/fefo?quantity=30`).expect(200)).body;
      expect(plan.allocations.map((a: { batchNumber: string }) => a.batchNumber)).toEqual(['Q2']);
      expect((await receive([line(d, 'Q1', 100, 5)])).status).toBe(409);
      expect((await get('pharmacien', '/pharmacy/stock/expiry?quarantinedOnly=true&limit=200').expect(200)).body.items.map((i: { batchNumber: string }) => i.batchNumber)).toContain('Q1');
      expect((await post('pharmacien', `/pharmacy/batches/${q1}/release`).expect(200)).body).toMatchObject({ status: 'AVAILABLE', dispensable: true, quarantineReason: null });
      expect((await post('pharmacien', `/pharmacy/batches/${q1}/release`)).status).toBe(409);
      expect((await stockOf(d)).dispensable).toBe(30);
      expect((await audit('pharmacy.batch.quarantine', q1))[0].metadata).toMatchObject({ batch: 'Q1', reason: 'Rappel de lot du fabricant' });
      expect((await post('pharmacien', `/pharmacy/batches/${UNKNOWN}/quarantine`, { reason: 'x' })).status).toBe(404);
    });
  });

  describe('ajustements', () => {
    const lot = async (quantity = 10, over: Record<string, unknown> = {}) => {
      const d = await drug();
      const r = await receive([line(d, 'ADJ', 100, quantity)]).expect(201);
      return { d, batchId: r.body.lines[0].batchId as string, ...over };
    };
    const request = (batchId: string, over: Record<string, unknown> = {}, who = 'pharmacien') => post(who, '/pharmacy/adjustments', { batchId, direction: 'OUT', quantity: 4, reason: 'DAMAGED', ...over });

    it('ne change rien tant qu\'un autre pharmacien n\'a pas approuvé, puis applique et trace', async () => {
      const { d, batchId } = await lot(10);
      const asked = await request(batchId, { note: 'Flacons tombés' }).expect(201);
      expect(asked.body).toMatchObject({ status: 'PENDING', direction: 'OUT', quantity: 4, reason: 'DAMAGED', requestedBy: { username: 'pharmacien' }, drug: { code: d.code }, batch: { batchNumber: 'ADJ', quantity: 10 } });
      expect(asked.body.number).toMatch(/^ADJ-\d{7}$/);
      expect((await stockOf(d)).dispensable).toBe(10);
      const self = await post('pharmacien', `/pharmacy/adjustments/${asked.body.id}/approve`);
      expect([self.status, JSON.stringify(self.body)]).toEqual([409, expect.stringContaining('PHARMACY_ADJUSTMENT_SELF_APPROVAL')]);
      const done = (await post('pharmacien2', `/pharmacy/adjustments/${asked.body.id}/approve`, { comment: 'Constaté' }).expect(200)).body;
      expect(done).toMatchObject({ status: 'APPROVED', decidedBy: { username: 'pharmacien2' }, decisionComment: 'Constaté' });
      expect((await stockOf(d)).dispensable).toBe(6);
      const moves = (await get('pharmacien', `/pharmacy/stock/movements?batchId=${batchId}`).expect(200)).body.items;
      expect(moves[0]).toMatchObject({ type: 'ADJUSTMENT_OUT', delta: -4, balance: 6, reference: asked.body.number, by: { username: 'pharmacien2' } });
      expect((await post('pharmacien2', `/pharmacy/adjustments/${asked.body.id}/approve`)).status).toBe(409);
      const [entry] = await audit('pharmacy.adjustment.approve', asked.body.id);
      expect(entry.metadata).toMatchObject({ number: asked.body.number, direction: 'OUT', quantity: 4, reason: 'DAMAGED' });
      expect((await audit('pharmacy.adjustment.request', asked.body.id))).toHaveLength(1);
    });

    it('un refus exige un motif, laisse le stock intact et libère le lot pour une nouvelle demande', async () => {
      const { d, batchId } = await lot(10);
      const asked = await request(batchId).expect(201);
      expect((await post('pharmacien2', `/pharmacy/adjustments/${asked.body.id}/reject`, { comment: '' })).status).toBe(400);
      expect((await post('pharmacien', `/pharmacy/adjustments/${asked.body.id}/reject`, { comment: 'Non' })).status).toBe(409);
      const rejected = (await post('pharmacien2', `/pharmacy/adjustments/${asked.body.id}/reject`, { comment: 'Recomptez d\'abord' }).expect(200)).body;
      expect(rejected).toMatchObject({ status: 'REJECTED', decisionComment: 'Recomptez d\'abord' });
      expect((await stockOf(d)).dispensable).toBe(10);
      expect((await request(batchId, { quantity: 1 }).expect(201)).body.status).toBe('PENDING');
    });

    it('refuse tout de suite ce qui ne passera jamais, et une seconde demande en attente sur le même lot', async () => {
      const { batchId } = await lot(5);
      expect(JSON.stringify((await request(batchId, { quantity: 6 })).body)).toContain('PHARMACY_STOCK_INSUFFICIENT');
      expect(JSON.stringify((await request(batchId, { direction: 'IN', reason: 'DAMAGED' })).body)).toContain('PHARMACY_ADJUSTMENT_REASON_MISMATCH');
      expect(JSON.stringify((await request(batchId, { reason: 'OTHER' })).body)).toContain('PHARMACY_ADJUSTMENT_NOTE_REQUIRED');
      expect((await request(batchId, { direction: 'SIDEWAYS' })).status).toBe(400);
      expect((await request(batchId, { quantity: 0 })).status).toBe(400);
      expect((await request(UNKNOWN)).status).toBe(404);
      await request(batchId, { quantity: 1 }).expect(201);
      expect(JSON.stringify((await request(batchId, { quantity: 2 }, 'pharmacien2')).body)).toContain('PHARMACY_ADJUSTMENT_PENDING_EXISTS');
    });

    it('si le stock a baissé entre la demande et l\'approbation, la demande reste en attente', async () => {
      const { d, batchId } = await lot(10);
      const asked = await request(batchId, { quantity: 8 }).expect(201);
      await c.w.sql.query('UPDATE pharmacy_batches SET quantity = 5 WHERE id = $1', [batchId]);
      const refused = await post('pharmacien2', `/pharmacy/adjustments/${asked.body.id}/approve`);
      expect([refused.status, JSON.stringify(refused.body)]).toEqual([409, expect.stringContaining('PHARMACY_STOCK_INSUFFICIENT')]);
      expect((await get('pharmacien', `/pharmacy/adjustments/${asked.body.id}`).expect(200)).body.status).toBe('PENDING');
      expect((await stockOf(d)).dispensable).toBe(5);
    });

    it('une entrée « retrouvé » augmente le lot ; elle est refusée dans un lot périmé', async () => {
      const { d, batchId } = await lot(10);
      const found = await request(batchId, { direction: 'IN', reason: 'FOUND', quantity: 3 }).expect(201);
      await post('pharmacien2', `/pharmacy/adjustments/${found.body.id}/approve`).expect(200);
      expect((await stockOf(d)).dispensable).toBe(13);
      await c.w.sql.query("UPDATE pharmacy_batches SET expiry_date = $1::date WHERE id = $2", [day(-2), batchId]);
      expect(JSON.stringify((await request(batchId, { direction: 'IN', reason: 'FOUND', quantity: 1 })).body)).toContain('PHARMACY_BATCH_EXPIRED');
      const disposal = await request(batchId, { reason: 'EXPIRED', quantity: 13 }).expect(201);
      await post('pharmacien2', `/pharmacy/adjustments/${disposal.body.id}/approve`).expect(200);
      expect((await stockOf(d)).batches).toHaveLength(0);
    });

    it('liste les demandes en attente (les plus anciennes d\'abord), les miennes, et filtre par statut', async () => {
      const first = await lot(10);
      const second = await lot(10);
      const a = await request(first.batchId, { quantity: 1 }).expect(201);
      const b = await request(second.batchId, { quantity: 1 }, 'pharmacien2').expect(201);
      const pending = (await get('pharmacien', '/pharmacy/adjustments?status=PENDING&limit=200').expect(200)).body.items.map((i: { id: string }) => i.id);
      expect(pending.indexOf(a.body.id)).toBeLessThan(pending.indexOf(b.body.id));
      const mine = (await get('pharmacien2', '/pharmacy/adjustments?mine=true&limit=200').expect(200)).body.items.map((i: { id: string }) => i.id);
      expect(mine).toContain(b.body.id);
      expect(mine).not.toContain(a.body.id);
      await post('pharmacien2', `/pharmacy/adjustments/${a.body.id}/approve`).expect(200);
      expect((await get('pharmacien', `/pharmacy/adjustments?status=approved&drugId=${first.d.id}`).expect(200)).body.items.map((i: { id: string }) => i.id)).toEqual([a.body.id]);
      expect((await get('pharmacien', '/pharmacy/adjustments?status=NOPE')).status).toBe(422);
      expect((await get('pharmacien', `/pharmacy/adjustments/${UNKNOWN}`)).status).toBe(404);
      expect((await get('pharmacien', '/pharmacy/stock/summary').expect(200)).body.pendingAdjustments).toBeGreaterThanOrEqual(1);
    });
  });

  it('le journal d\'audit de la pharmacie ne contient ni mot de passe ni donnée personnelle', async () => {
    const rows = await c.w.sql.query<{ action: string; metadata: unknown }>("SELECT action, metadata FROM audit_log WHERE action LIKE 'pharmacy.%'");
    expect(rows.length).toBeGreaterThan(5);
    expect(JSON.stringify(rows)).not.toMatch(/password|birthDate|phone|Mbarga/i);
  });
});

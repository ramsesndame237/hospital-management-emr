import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe('API pharmacie : fournisseurs, bons de commande, réception contre un bon', () => {
  let c: ClinicalWorld;
  beforeAll(async () => {
    c = await buildClinicalWorld();
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const put = (who: string, url: string, body: object = {}) => c.http().put(api(url)).set(c.bearer(who)).send(body);
  const patch = (who: string, url: string, body: object = {}) => c.http().patch(api(url)).set(c.bearer(who)).send(body);
  const audit = (action: string, resourceId: string) => c.w.sql.query<{ metadata: Record<string, unknown> }>('SELECT metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  let seq = 0;
  const supplier = async (over: Record<string, unknown> = {}): Promise<{ id: string; code: string; name: string }> => {
    seq += 1;
    const r = await post('pharmacien', '/pharmacy/suppliers', { code: `S${seq}`, name: `Fournisseur ${seq}`, ...over }).expect(201);
    return { id: r.body.id as string, code: r.body.code as string, name: r.body.name as string };
  };
  const drug = async (over: Record<string, unknown> = {}): Promise<{ id: string; code: string }> => {
    seq += 1;
    const r = await post('pharmacien', '/pharmacy/drugs', { code: `PD${seq}`, name: `Médicament ${seq}`, genericName: `Molécule ${seq}`, form: 'TABLET', schedule: 'PRESCRIPTION', unit: 'comprimé', unitPrice: 25, reorderLevel: 0, ...over }).expect(201);
    return { id: r.body.id as string, code: r.body.code as string };
  };
  const draft = (s: { id: string }, lines: object[], over: Record<string, unknown> = {}, who = 'pharmacien') => post(who, '/pharmacy/orders', { supplierId: s.id, lines, ...over });
  const line = (d: { id: string }, quantity: number, unitCost?: number) => ({ drugId: d.id, quantity, ...(unitCost === undefined ? {} : { unitCost }) });
  /** Un bon établi par `pharmacien`, soumis, puis approuvé par `pharmacien2`. */
  const approvedOrder = async (s: { id: string }, lines: object[]) => {
    const o = (await draft(s, lines).expect(201)).body;
    await post('pharmacien', `/pharmacy/orders/${o.id}/submit`).expect(200);
    return (await post('pharmacien2', `/pharmacy/orders/${o.id}/approve`).expect(200)).body as { id: string; number: string };
  };
  const receive = (orderId: string, lines: object[], over: Record<string, unknown> = {}) => post('pharmacien', '/pharmacy/receipts', { purchaseOrderId: orderId, lines, ...over });
  const rline = (d: { id: string }, batchNumber: string, quantity: number, unitCost?: number) => ({ drugId: d.id, batchNumber, expiry: day(300), quantity, ...(unitCost === undefined ? {} : { unitCost }) });
  const orderOf = async (id: string) => (await get('pharmacien', `/pharmacy/orders/${id}`).expect(200)).body;

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', '/pharmacy/suppliers', ['patient', 'accueil', 'medecin', 'infirmier', 'labo', 'caisse']],
      ['POST', '/pharmacy/suppliers', ['admin', 'medecin', 'infirmier', 'labo']],
      ['PATCH', `/pharmacy/suppliers/${ID}`, ['admin', 'medecin']],
      ['POST', `/pharmacy/suppliers/${ID}/deactivate`, ['admin', 'medecin']],
      ['GET', '/pharmacy/orders', ['patient', 'accueil', 'medecin', 'infirmier', 'labo', 'caisse']],
      ['GET', '/pharmacy/orders/suggestions', ['medecin', 'infirmier', 'labo']],
      ['POST', '/pharmacy/orders', ['admin', 'medecin', 'infirmier', 'labo']],
      ['PUT', `/pharmacy/orders/${ID}`, ['admin', 'medecin']],
      ['POST', `/pharmacy/orders/${ID}/submit`, ['admin', 'medecin']],
      ['POST', `/pharmacy/orders/${ID}/approve`, ['admin', 'medecin', 'infirmier', 'labo']],
      ['POST', `/pharmacy/orders/${ID}/reject`, ['admin', 'medecin', 'infirmier', 'labo']],
      ['POST', `/pharmacy/orders/${ID}/cancel`, ['admin', 'medecin']],
      ['POST', `/pharmacy/orders/${ID}/close`, ['admin', 'medecin']],
    ])('%s %s : sans jeton → 401, profils sans le droit → 403', async (method, path, forbidden) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(path));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of forbidden) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });

    it('l\'administrateur système consulte fournisseurs et bons sans les modifier', async () => {
      const s = await supplier();
      expect((await get('admin', `/pharmacy/suppliers/${s.id}`)).status).toBe(200);
      expect((await get('admin', '/pharmacy/orders')).status).toBe(200);
    });
  });

  describe('fournisseurs', () => {
    it('crée, lit, normalise le code, refuse un code déjà pris et les coordonnées invalides', async () => {
      const r = await post('pharmacien', '/pharmacy/suppliers', { code: ' pharma-x ', name: ' Pharma  X ', contactName: 'Mme Ngo', phone: '+237 699 00 00 00', email: 'a@pharmax.cm', address: 'Douala', paymentTermsDays: 45, notes: 'Livre le lundi' }).expect(201);
      expect(r.body).toMatchObject({ code: 'PHARMA-X', name: 'Pharma X', paymentTermsDays: 45, active: true });
      expect((await get('admin', `/pharmacy/suppliers/${r.body.id}`).expect(200)).body.email).toBe('a@pharmax.cm');
      expect((await post('pharmacien', '/pharmacy/suppliers', { code: 'pharma-x', name: 'Autre' })).status).toBe(409);
      expect(JSON.stringify((await post('pharmacien', '/pharmacy/suppliers', { code: 'MAIL1', name: 'X', email: 'pas-un-mail' })).body)).toContain('PHARMACY_SUPPLIER_EMAIL_INVALID');
      expect((await post('pharmacien', '/pharmacy/suppliers', { code: 'é!', name: 'X' })).status).toBe(422);
      expect((await post('pharmacien', '/pharmacy/suppliers', { code: 'TERM1', name: 'X', paymentTermsDays: 400 })).status).toBe(400);
      expect((await audit('pharmacy.supplier.create', r.body.id))[0].metadata).toMatchObject({ code: 'PHARMA-X', paymentTermsDays: 45 });
    });

    it('modifie, efface avec null, ne touche pas au code, et n\'écrit rien au journal sans changement', async () => {
      const s = await supplier({ phone: '+237 699 00 00 00', contactName: 'Mme Ngo' });
      const r = await patch('pharmacien', `/pharmacy/suppliers/${s.id}`, { phone: null, paymentTermsDays: 60, code: 'IGNORE' }).expect(200);
      expect(r.body).toMatchObject({ code: s.code, phone: null, contactName: 'Mme Ngo', paymentTermsDays: 60 });
      expect(String((await audit('pharmacy.supplier.update', s.id))[0].metadata.changed)).toContain('paymentTermsDays');
      await patch('pharmacien', `/pharmacy/suppliers/${s.id}`, { paymentTermsDays: 60 }).expect(200);
      expect(await audit('pharmacy.supplier.update', s.id)).toHaveLength(1);
      expect((await patch('pharmacien', `/pharmacy/suppliers/${UNKNOWN}`, { name: 'x' })).status).toBe(404);
    });

    it('désactive et réactive, filtre et pagine', async () => {
      const s = await supplier({ name: 'Zzyzx Unique SARL' });
      expect((await post('pharmacien', `/pharmacy/suppliers/${s.id}/deactivate`).expect(200)).body.active).toBe(false);
      expect((await get('pharmacien', '/pharmacy/suppliers?search=zzyzx').expect(200)).body.total).toBe(0);
      expect((await get('pharmacien', '/pharmacy/suppliers?search=zzyzx&includeInactive=true').expect(200)).body.items.map((i: { code: string }) => i.code)).toEqual([s.code]);
      await post('pharmacien', `/pharmacy/suppliers/${s.id}/activate`).expect(200);
      expect((await get('pharmacien', '/pharmacy/suppliers?search=zzyzx').expect(200)).body.total).toBe(1);
      expect((await get('pharmacien', '/pharmacy/suppliers?limit=1').expect(200)).body.items).toHaveLength(1);
    });
  });

  describe('bons de commande', () => {
    it('établit un brouillon avec son numéro, sa valeur et ses lignes ; le coût par défaut est celui du dernier lot reçu', async () => {
      const s = await supplier();
      const known = await drug();
      const fresh = await drug();
      await post('pharmacien', '/pharmacy/receipts', { supplier: 'Ancien', lines: [{ drugId: known.id, batchNumber: 'OLD', expiry: day(200), quantity: 5, unitCost: 15 }] }).expect(201);
      const r = await draft(s, [line(known, 100), line(fresh, 40, 8)], { expectedOn: day(14), notes: ' À livrer avant le 15 ' }).expect(201);
      expect(r.body).toMatchObject({ status: 'DRAFT', supplier: { id: s.id, code: s.code }, expectedOn: day(14), notes: 'À livrer avant le 15', createdBy: { username: 'pharmacien' }, units: 140, receivedUnits: 0, value: 100 * 15 + 40 * 8, currency: 'XAF' });
      expect(r.body.number).toMatch(/^PO-\d{7}$/);
      expect(r.body.lines.map((l: { unitCost: number; outstanding: number; drug: { code: string } }) => [l.drug.code, l.unitCost, l.outstanding])).toEqual([[known.code, 15, 100], [fresh.code, 8, 40]]);
      expect((await audit('pharmacy.order.create', r.body.id))[0].metadata).toMatchObject({ number: r.body.number, lines: 2, value: 1820 });
    });

    it('refuse un fournisseur inconnu ou écarté, un médicament retiré, un doublon, une date passée ou mal écrite', async () => {
      const s = await supplier();
      const gone = await supplier();
      await post('pharmacien', `/pharmacy/suppliers/${gone.id}/deactivate`).expect(200);
      const d = await drug();
      const retired = await drug();
      await post('pharmacien', `/pharmacy/drugs/${retired.id}/deactivate`).expect(200);
      expect((await draft({ id: UNKNOWN }, [line(d, 1)])).status).toBe(404);
      const inactive = await draft(gone, [line(d, 1)]);
      expect([inactive.status, JSON.stringify(inactive.body)]).toEqual([409, expect.stringContaining('PHARMACY_SUPPLIER_INACTIVE')]);
      expect((await draft(s, [{ drugId: UNKNOWN, quantity: 1 }])).status).toBe(404);
      expect(JSON.stringify((await draft(s, [line(retired, 1)])).body)).toContain('PHARMACY_DRUG_INACTIVE');
      expect(JSON.stringify((await draft(s, [line(d, 1), line(d, 2)])).body)).toContain('PHARMACY_ORDER_DUPLICATE_DRUG');
      expect(JSON.stringify((await draft(s, [line(d, 1)], { expectedOn: day(-1) })).body)).toContain('PHARMACY_ORDER_DATE_PAST');
      expect((await draft(s, [line(d, 1)], { expectedOn: '2026-02-30' })).status).toBe(422);
      expect((await draft(s, [line(d, 1)], { expectedOn: '20/11/2026' })).status).toBe(400);
      expect((await draft(s, [])).status).toBe(400);
      expect((await draft(s, [line(d, 0)])).status).toBe(400);
      expect((await draft(s, [line(d, 1.5)])).status).toBe(400);
    });

    it('modifie un brouillon, le soumet, et le contenu ne bouge plus ensuite', async () => {
      const s = await supplier();
      const d1 = await drug();
      const d2 = await drug();
      const o = (await draft(s, [line(d1, 10, 5)]).expect(201)).body;
      const edited = (await put('pharmacien', `/pharmacy/orders/${o.id}`, { supplierId: s.id, lines: [line(d2, 7, 9)], notes: 'Corrigé' }).expect(200)).body;
      expect(edited).toMatchObject({ notes: 'Corrigé', units: 7, value: 63 });
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/submit`).expect(200)).body).toMatchObject({ status: 'PENDING_APPROVAL' });
      const locked = await put('pharmacien', `/pharmacy/orders/${o.id}`, { supplierId: s.id, lines: [line(d1, 1)] });
      expect([locked.status, JSON.stringify(locked.body)]).toEqual([409, expect.stringContaining('PHARMACY_ORDER_STATE_INVALID')]);
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/submit`)).status).toBe(409);
      expect((await put('pharmacien', `/pharmacy/orders/${UNKNOWN}`, { supplierId: s.id, lines: [line(d1, 1)] })).status).toBe(404);
    });

    it('ne s\'approuve pas par son auteur ; un autre pharmacien l\'approuve et la décision est tracée', async () => {
      const s = await supplier();
      const d = await drug();
      const o = (await draft(s, [line(d, 10, 5)]).expect(201)).body;
      expect((await post('pharmacien2', `/pharmacy/orders/${o.id}/approve`)).status).toBe(409);
      await post('pharmacien', `/pharmacy/orders/${o.id}/submit`).expect(200);
      const self = await post('pharmacien', `/pharmacy/orders/${o.id}/approve`);
      expect([self.status, JSON.stringify(self.body)]).toEqual([409, expect.stringContaining('PHARMACY_ORDER_SELF_APPROVAL')]);
      const done = (await post('pharmacien2', `/pharmacy/orders/${o.id}/approve`).expect(200)).body;
      expect(done).toMatchObject({ status: 'APPROVED', approvedBy: { username: 'pharmacien2' }, createdBy: { username: 'pharmacien' } });
      expect((await post('pharmacien2', `/pharmacy/orders/${o.id}/approve`)).status).toBe(409);
      expect((await audit('pharmacy.order.approve', o.id))[0].metadata).toMatchObject({ number: o.number, value: 50 });
      expect((await audit('pharmacy.order.submit', o.id))).toHaveLength(1);
    });

    it('un refus exige un motif, renvoie le bon en brouillon, et il se corrige puis se resoumet', async () => {
      const s = await supplier();
      const d = await drug();
      const o = (await draft(s, [line(d, 500, 5)]).expect(201)).body;
      await post('pharmacien', `/pharmacy/orders/${o.id}/submit`).expect(200);
      expect((await post('pharmacien2', `/pharmacy/orders/${o.id}/reject`, { comment: '' })).status).toBe(400);
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/reject`, { comment: 'Non' })).status).toBe(409);
      const rejected = (await post('pharmacien2', `/pharmacy/orders/${o.id}/reject`, { comment: 'Quantité trop élevée' }).expect(200)).body;
      expect(rejected).toMatchObject({ status: 'DRAFT', rejectionReason: 'Quantité trop élevée' });
      await put('pharmacien', `/pharmacy/orders/${o.id}`, { supplierId: s.id, lines: [line(d, 100, 5)] }).expect(200);
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/submit`).expect(200)).body).toMatchObject({ status: 'PENDING_APPROVAL', rejectionReason: null });
    });

    it('s\'annule avec un motif tant que rien n\'est reçu, et ne se rouvre pas', async () => {
      const s = await supplier();
      const d = await drug();
      const o = (await draft(s, [line(d, 10, 5)]).expect(201)).body;
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/cancel`, { reason: '' })).status).toBe(400);
      const done = (await post('pharmacien', `/pharmacy/orders/${o.id}/cancel`, { reason: 'Plus besoin' }).expect(200)).body;
      expect(done).toMatchObject({ status: 'CANCELLED', closedBy: { username: 'pharmacien' }, closedReason: 'Plus besoin' });
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/cancel`, { reason: 'Encore' })).status).toBe(409);
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/submit`)).status).toBe(409);
      expect((await post('pharmacien', `/pharmacy/orders/${UNKNOWN}/cancel`, { reason: 'x' })).status).toBe(404);
    });

    it('liste les bons à approuver d\'abord par ancienneté, filtre par statut, fournisseur, médicament et auteur', async () => {
      const s = await supplier();
      const d = await drug();
      const a = (await draft(s, [line(d, 1, 1)]).expect(201)).body;
      const b = (await draft(s, [line(d, 2, 1)], {}, 'pharmacien2').expect(201)).body;
      await post('pharmacien', `/pharmacy/orders/${a.id}/submit`).expect(200);
      await post('pharmacien2', `/pharmacy/orders/${b.id}/submit`).expect(200);
      const pending = (await get('pharmacien', '/pharmacy/orders?status=pending_approval&limit=200').expect(200)).body.items.map((i: { id: string }) => i.id);
      expect(pending.indexOf(a.id)).toBeLessThan(pending.indexOf(b.id));
      expect((await get('pharmacien', `/pharmacy/orders?supplierId=${s.id}&drugId=${d.id}`).expect(200)).body.total).toBe(2);
      expect((await get('pharmacien2', `/pharmacy/orders?supplierId=${s.id}&mine=true`).expect(200)).body.items.map((i: { id: string }) => i.id)).toEqual([b.id]);
      const first = (await get('pharmacien', `/pharmacy/orders?supplierId=${s.id}&limit=1`).expect(200)).body;
      expect(first.items).toHaveLength(1);
      expect(first.items[0]).toMatchObject({ supplier: { id: s.id } });
      expect(first.currency).toBe('XAF');
      expect((await get('pharmacien', '/pharmacy/orders?status=NOPE')).status).toBe(422);
      expect((await get('pharmacien', `/pharmacy/orders/${UNKNOWN}`)).status).toBe(404);
    });
  });

  describe('réception contre un bon de commande', () => {
    it('impute la livraison sur le bon : fournisseur et coût convenus par défaut, statut partiel puis reçu', async () => {
      const s = await supplier({ name: 'Pharma Convenu' });
      const d1 = await drug();
      const d2 = await drug();
      const o = await approvedOrder(s, [line(d1, 100, 10), line(d2, 50, 20)]);
      const first = (await receive(o.id, [rline(d1, 'L1', 60)], { supplier: 'Ignoré', deliveryNote: 'BL-1' }).expect(201)).body;
      expect(first).toMatchObject({ supplier: 'Pharma Convenu', order: { id: o.id, number: o.number }, deliveryNote: 'BL-1', value: 600 });
      expect(first.lines[0].unitCost).toBe(10);
      const half = await orderOf(o.id);
      expect(half).toMatchObject({ status: 'PARTIALLY_RECEIVED', receivedUnits: 60 });
      expect(half.lines.map((l: { received: number; outstanding: number }) => [l.received, l.outstanding])).toEqual([[60, 40], [0, 50]]);
      await receive(o.id, [rline(d1, 'L2', 40), rline(d2, 'M1', 50, 22)]).expect(201);
      const full = await orderOf(o.id);
      expect(full).toMatchObject({ status: 'RECEIVED', receivedUnits: 150 });
      expect((await get('pharmacien', `/pharmacy/stock/movements?drugId=${d2.id}`).expect(200)).body.items[0]).toMatchObject({ delta: 50, reference: expect.stringMatching(/^GRN-/) });
      const listed = (await get('pharmacien', '/pharmacy/receipts?supplier=convenu').expect(200)).body.items;
      expect(listed.map((r: { orderNumber: string }) => r.orderNumber)).toEqual([o.number, o.number]);
      expect((await audit('pharmacy.receipt.post', first.id))[0].metadata).toMatchObject({ order: o.number });
      expect((await get('pharmacien', `/pharmacy/receipts/${first.id}`).expect(200)).body.order).toMatchObject({ number: o.number });
    });

    it('refuse tout — lots, réception, bon — quand la livraison dépasse la commande', async () => {
      const s = await supplier();
      const d = await drug();
      const e = await drug();
      const o = await approvedOrder(s, [line(d, 10, 5)]);
      const over = await receive(o.id, [rline(e, 'N1', 1), rline(d, 'L1', 11)]);
      expect(over.status).toBe(409);
      expect(JSON.stringify(over.body)).toMatch(/PHARMACY_ORDER_(OVER_RECEIPT|DRUG_NOT_ORDERED)/);
      const same = await receive(o.id, [rline(d, 'L1', 11)]);
      expect([same.status, JSON.stringify(same.body)]).toEqual([409, expect.stringContaining('PHARMACY_ORDER_OVER_RECEIPT')]);
      expect((await get('pharmacien', `/pharmacy/drugs/${d.id}/stock`).expect(200)).body.batches).toHaveLength(0);
      expect((await orderOf(o.id)).receivedUnits).toBe(0);
    });

    it('refuse un médicament qui n\'est pas au bon, un bon introuvable et un bon qui n\'est pas approuvé', async () => {
      const s = await supplier();
      const d = await drug();
      const other = await drug();
      const o = await approvedOrder(s, [line(d, 10, 5)]);
      expect(JSON.stringify((await receive(o.id, [rline(other, 'X', 1)])).body)).toContain('PHARMACY_ORDER_DRUG_NOT_ORDERED');
      expect((await receive(UNKNOWN, [rline(d, 'X', 1)])).status).toBe(404);
      const pending = (await draft(s, [line(d, 10, 5)]).expect(201)).body;
      const notReady = await receive(pending.id, [rline(d, 'X', 1)]);
      expect([notReady.status, JSON.stringify(notReady.body)]).toEqual([409, expect.stringContaining('PHARMACY_ORDER_NOT_RECEIVABLE')]);
      expect((await receive(o.id, [rline(d, 'X', 1)], { purchaseOrderId: 'pas-un-uuid' })).status).toBe(400);
    });

    it('sans bon, le fournisseur reste obligatoire', async () => {
      const d = await drug();
      const r = await post('pharmacien', '/pharmacy/receipts', { lines: [rline(d, 'FREE', 1)] });
      expect([r.status, JSON.stringify(r.body)]).toEqual([422, expect.stringContaining('PHARMACY_SUPPLIER_INVALID')]);
    });

    it('un bon reçu en partie se clôt avec un motif ; ce qui est arrivé reste en stock, et plus rien ne s\'y impute', async () => {
      const s = await supplier();
      const d = await drug();
      const o = await approvedOrder(s, [line(d, 100, 5)]);
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/close`, { reason: 'Rien reçu' })).status).toBe(409);
      await receive(o.id, [rline(d, 'L1', 30)]).expect(201);
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/cancel`, { reason: 'Trop tard' })).status).toBe(409);
      expect((await post('pharmacien', `/pharmacy/orders/${o.id}/close`, { reason: '' })).status).toBe(400);
      const closed = (await post('pharmacien', `/pharmacy/orders/${o.id}/close`, { reason: 'Le fournisseur ne livrera pas le solde' }).expect(200)).body;
      expect(closed).toMatchObject({ status: 'CLOSED', closedReason: 'Le fournisseur ne livrera pas le solde', receivedUnits: 30 });
      expect((await get('pharmacien', `/pharmacy/drugs/${d.id}/stock`).expect(200)).body.dispensable).toBe(30);
      expect((await receive(o.id, [rline(d, 'L2', 1)])).status).toBe(409);
      expect((await audit('pharmacy.order.close', o.id))[0].metadata).toMatchObject({ reason: 'Le fournisseur ne livrera pas le solde' });
    });
  });

  describe('suggestions de réapprovisionnement', () => {
    it('propose les ruptures et les stocks bas, déduit ce qui est déjà commandé, ignore ceux sans seuil', async () => {
      const s = await supplier();
      const out = await drug({ reorderLevel: 100, genericName: 'Aaa rupture' });
      const low = await drug({ reorderLevel: 100, genericName: 'Aab bas' });
      const fine = await drug({ reorderLevel: 10, genericName: 'Aac bon' });
      const noThreshold = await drug({ reorderLevel: 0, genericName: 'Aad sans seuil' });
      await post('pharmacien', '/pharmacy/receipts', { supplier: 'Init', lines: [{ drugId: low.id, batchNumber: 'B', expiry: day(200), quantity: 60, unitCost: 4 }, { drugId: fine.id, batchNumber: 'G', expiry: day(200), quantity: 500, unitCost: 1 }] }).expect(201);
      const mine = async () => {
        const body = (await get('pharmacien', '/pharmacy/orders/suggestions').expect(200)).body;
        return { currency: body.currency, byCode: Object.fromEntries(body.items.map((i: { drug: { code: string } }) => [i.drug.code, i])) as Record<string, { level: string; dispensable: number; onOrder: number; suggested: number; lastUnitCost: number | null }> };
      };
      let sug = await mine();
      expect(sug.currency).toBe('XAF');
      expect(sug.byCode[out.code]).toMatchObject({ level: 'OUT', dispensable: 0, onOrder: 0, suggested: 200, lastUnitCost: null });
      expect(sug.byCode[low.code]).toMatchObject({ level: 'LOW', dispensable: 60, suggested: 140, lastUnitCost: 4 });
      expect(sug.byCode[fine.code]).toBeUndefined();
      expect(sug.byCode[noThreshold.code]).toBeUndefined();
      await approvedOrder(s, [line(out, 60, 3), line(low, 140, 4)]);
      sug = await mine();
      expect(sug.byCode[out.code]).toMatchObject({ onOrder: 60, suggested: 140 });
      expect(sug.byCode[low.code]).toBeUndefined();
    });
  });

  it('le journal d\'audit de l\'approvisionnement ne contient ni mot de passe ni donnée personnelle', async () => {
    const rows = await c.w.sql.query<{ action: string; metadata: unknown }>("SELECT action, metadata FROM audit_log WHERE action LIKE 'pharmacy.order.%' OR action LIKE 'pharmacy.supplier.%'");
    expect(rows.length).toBeGreaterThan(8);
    expect(JSON.stringify(rows)).not.toMatch(/password|birthDate|a@pharmax|\+237/i);
  });
});

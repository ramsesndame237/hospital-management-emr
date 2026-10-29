import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const NO_PII = /Mbarga|Élisabeth|Ndongo|Nkoa|Curie|Pasteur|Abel/;
const UNKNOWN = '99999999-9999-4999-8999-999999999999';

describe('API facturation /api/v1/billing (HTTP réel, PostgreSQL réel)', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
    // La caisse ouvre sa session : sans elle, aucun encaissement n'est possible.
    await c.http().post(api('/billing/cash-sessions')).set(c.bearer('caisse')).send({ counter: 'Caisse test' }).expect(201);
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const put = (who: string, url: string, body: object = {}) => c.http().put(api(url)).set(c.bearer(who)).send(body);
  const patch = (who: string, url: string, body: object = {}) => c.http().patch(api(url)).set(c.bearer(who)).send(body);

  let seq = 0;
  /** Un acte au catalogue (créé par l'administrateur système). */
  const item = async (price = 5000, over: Record<string, unknown> = {}): Promise<{ id: string; code: string }> => {
    seq += 1;
    const r = await post('admin', '/billing/items', { code: `ACT-${seq}`, name: `Acte ${seq}`, category: 'CONSULTATION', unitPrice: price, ...over }).expect(201);
    return { id: r.body.id as string, code: r.body.code as string };
  };
  const invoice = async (lines: { itemId: string; quantity: number }[], patient = ids.patients[0]) => (await post('caisse', '/billing/invoices', { patientId: patient, lines }).expect(201)).body;
  const issued = async (price = 10000, patient = ids.patients[0]) => {
    const act = await item(price);
    const inv = await invoice([{ itemId: act.id, quantity: 1 }], patient);
    return (await post('caisse', `/billing/invoices/${inv.id}/issue`).expect(200)).body;
  };

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', '/billing/items'], ['POST', '/billing/items'], ['GET', `/billing/items/${ID}`], ['PATCH', `/billing/items/${ID}`], ['POST', `/billing/items/${ID}/deactivate`], ['POST', `/billing/items/${ID}/activate`],
      ['GET', '/billing/invoices'], ['POST', '/billing/invoices'], ['GET', `/billing/invoices/${ID}`], ['POST', `/billing/invoices/${ID}/lines`], ['POST', `/billing/invoices/${ID}/lines/${ID}/remove`],
      ['PUT', `/billing/invoices/${ID}/discount`], ['POST', `/billing/invoices/${ID}/issue`], ['POST', `/billing/invoices/${ID}/cancel`], ['POST', `/billing/invoices/${ID}/payments`], ['POST', `/billing/payments/${ID}/reprint`],
    ])('%s %s : sans jeton → 401 ; patient, médecin et infirmier → 403', async (method, url) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(url));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of ['patient', 'medecin', 'infirmier']) expect((await call(who)).status).toBe(403);
    });

    it("l'accueil lit le catalogue mais n'écrit rien ; la comptabilité lit factures et catalogue sans pouvoir écrire ni encaisser", async () => {
      const act = await item();
      expect((await get('accueil', '/billing/items')).status).toBe(200);
      expect((await post('accueil', '/billing/items', { code: 'X', name: 'x', category: 'OTHER', unitPrice: 1 })).status).toBe(403);
      expect((await get('accueil', '/billing/invoices')).status).toBe(403);
      expect((await get('comptable', '/billing/invoices')).status).toBe(200);
      expect((await get('comptable', '/billing/items')).status).toBe(200);
      expect((await post('comptable', '/billing/invoices', { patientId: ids.patients[0] })).status).toBe(403);
      const inv = await issued();
      expect((await post('comptable', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 1 })).status).toBe(403);
      expect((await get('comptable', `/billing/invoices/${inv.id}`)).status).toBe(200);
      expect(act.id).toBeTruthy();
    });

    it("la caisse crée et encaisse mais ne modifie pas le catalogue ; l'administrateur système tient le catalogue, lit les factures mais n'encaisse pas", async () => {
      expect((await post('caisse', '/billing/items', { code: 'NOPE', name: 'x', category: 'OTHER', unitPrice: 1 })).status).toBe(403);
      expect((await patch('caisse', `/billing/items/${UNKNOWN}`, { name: 'x' })).status).toBe(403);
      const inv = await issued();
      expect((await get('admin', `/billing/invoices/${inv.id}`)).status).toBe(200);
      expect((await post('admin', '/billing/invoices', { patientId: ids.patients[0] })).status).toBe(403);
      expect((await post('admin', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 1 })).status).toBe(403);
    });
  });

  describe('catalogue des actes', () => {
    it("crée un acte actif, normalise son code, et l'inscrit au journal avec le prix", async () => {
      const r = await post('admin', '/billing/items', { code: ' cons-gen ', name: 'Consultation générale', category: 'consultation', unitPrice: 5000, serviceId: ids.ped });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ code: 'CONS-GEN', name: 'Consultation générale', category: 'CONSULTATION', unitPrice: 5000, currency: 'XAF', serviceId: ids.ped, active: true });
      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'billing.item.create' AND resource_id = $1", [r.body.id]);
      expect(entry.metadata).toMatchObject({ code: 'CONS-GEN', unitPrice: 5000 });
    });

    it('refuse un code déjà pris (409), des données invalides (400/422), un service inconnu (404), un service désactivé (409) et un service qui n\'en est pas un', async () => {
      const dup = await post('admin', '/billing/items', { code: 'cons-gen', name: 'Autre', category: 'OTHER', unitPrice: 1 });
      expect([dup.status, dup.body.code]).toEqual([409, 'BILLING_ITEM_CODE_ALREADY_EXISTS']);
      expect((await post('admin', '/billing/items', {})).status).toBe(400);
      expect((await post('admin', '/billing/items', { code: 'F1', name: 'x', category: 'OTHER', unitPrice: 12.5 })).status).toBe(400);
      expect((await post('admin', '/billing/items', { code: 'F2', name: 'x', category: 'OTHER', unitPrice: -1 })).status).toBe(400);
      expect((await post('admin', '/billing/items', { code: 'F3', name: 'x', category: 'OTHER', unitPrice: 2e12 })).status).toBe(400);
      expect((await post('admin', '/billing/items', { code: 'bad code', name: 'x', category: 'OTHER', unitPrice: 1 })).body.code).toBe('BILLING_ITEM_CODE_INVALID');
      expect((await post('admin', '/billing/items', { code: 'F4', name: 'x', category: 'MAGIE', unitPrice: 1 })).body.code).toBe('BILLING_ITEM_CATEGORY_INVALID');
      expect((await post('admin', '/billing/items', { code: 'F5', name: 'x', category: 'OTHER', unitPrice: 1, serviceId: UNKNOWN })).body.code).toBe('BILLING_SERVICE_NOT_FOUND');
      expect((await post('admin', '/billing/items', { code: 'F6', name: 'x', category: 'OTHER', unitPrice: 1, serviceId: ids.pedUnit })).body.code).toBe('BILLING_SERVICE_NOT_FOUND'); // une unité n'est pas un service
      const archive = (await post('admin', `/facilities/${ids.facility}/services`, { code: 'ARCH', name: 'Archives', serviceType: 'ADMINISTRATIVE' }).expect(201)).body.id;
      await post('admin', `/structure/${archive}/deactivate`).expect(200);
      const inactive = await post('admin', '/billing/items', { code: 'F7', name: 'x', category: 'OTHER', unitPrice: 1, serviceId: archive });
      expect([inactive.status, inactive.body.code]).toEqual([409, 'BILLING_SERVICE_INACTIVE']);
    });

    it("modifie un acte, journalise l'ancien prix, et ne touche pas à un acte inchangé", async () => {
      const act = await item(5000);
      const r = await patch('admin', `/billing/items/${act.id}`, { name: 'Renommé', unitPrice: 6000 });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ code: act.code, name: 'Renommé', unitPrice: 6000 });
      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'billing.item.update' AND resource_id = $1", [act.id]);
      expect(entry.metadata).toMatchObject({ changed: 'name,price', previousUnitPrice: 5000, unitPrice: 6000 });
      await patch('admin', `/billing/items/${act.id}`, { name: 'Renommé', unitPrice: 6000 }).expect(200);
      const rows = await c.w.sql.query("SELECT 1 FROM audit_log WHERE action = 'billing.item.update' AND resource_id = $1", [act.id]);
      expect(rows).toHaveLength(1);
      expect((await patch('admin', `/billing/items/${act.id}`, { unitPrice: -5 })).status).toBe(400);
      expect((await patch('admin', `/billing/items/${UNKNOWN}`, { name: 'x' })).status).toBe(404);
    });

    it('détache et rattache un service, et refuse de changer le code (champ ignoré)', async () => {
      const act = await item(100, { serviceId: ids.ped });
      expect((await patch('admin', `/billing/items/${act.id}`, { serviceId: null })).body.serviceId).toBeNull();
      expect((await patch('admin', `/billing/items/${act.id}`, { serviceId: ids.chi })).body.serviceId).toBe(ids.chi);
      const r = await patch('admin', `/billing/items/${act.id}`, { code: 'AUTRE', name: 'Même acte' });
      expect(r.body.code).toBe(act.code);
    });

    it("retire un acte du catalogue : il n'est plus listé par défaut ni facturable, et revient à la réactivation", async () => {
      const act = await item(100);
      await post('admin', `/billing/items/${act.id}/deactivate`).expect(200);
      const hidden = await get('caisse', '/billing/items?limit=200');
      expect(hidden.body.items.some((i: { id: string }) => i.id === act.id)).toBe(false);
      const shown = await get('caisse', '/billing/items?limit=200&includeInactive=true');
      expect(shown.body.items.find((i: { id: string }) => i.id === act.id)).toMatchObject({ active: false });
      expect((await get('caisse', `/billing/items/${act.id}`)).body.active).toBe(false);
      const inv = await post('caisse', '/billing/invoices', { patientId: ids.patients[0], lines: [{ itemId: act.id, quantity: 1 }] });
      expect([inv.status, inv.body.code]).toEqual([409, 'BILLING_ITEM_INACTIVE']);
      await post('admin', `/billing/items/${act.id}/activate`).expect(200);
      expect((await post('caisse', '/billing/invoices', { patientId: ids.patients[0], lines: [{ itemId: act.id, quantity: 1 }] })).status).toBe(201);
    });

    it('liste, recherche, filtre et pagine ; valide les filtres', async () => {
      const echo = await item(15000, { code: 'ECHO-ABD', name: 'Échographie abdominale', category: 'RADIOLOGY' });
      const found = await get('caisse', '/billing/items?search=ECHOGRAPHIE'.replace('ECHOGRAPHIE', 'abdominale'));
      expect(found.body.items.map((i: { id: string }) => i.id)).toEqual([echo.id]);
      expect((await get('caisse', '/billing/items?category=RADIOLOGY')).body.items.every((i: { category: string }) => i.category === 'RADIOLOGY')).toBe(true);
      const page = await get('caisse', '/billing/items?limit=2&offset=1');
      expect(page.body).toMatchObject({ offset: 1, limit: 2 });
      expect(page.body.items.length).toBeLessThanOrEqual(2);
      expect((await get('caisse', '/billing/items?category=MAGIE')).body.code).toBe('BILLING_ITEM_CATEGORY_INVALID');
      expect((await get('caisse', '/billing/items?serviceId=pas-un-uuid')).status).toBe(422);
      expect((await get('caisse', `/billing/items/${UNKNOWN}`)).status).toBe(404);
      expect((await get('caisse', '/billing/items/pas-un-uuid')).status).toBe(400);
    });
  });

  describe('facture : préparation', () => {
    it('crée un brouillon avec ses lignes (prix copiés), les totaux, le patient résumé, et le trace sans donnée personnelle', async () => {
      const a = await item(5000);
      const b = await item(1500);
      const r = await post('caisse', '/billing/invoices', { patientId: ids.patients[0], note: 'Consultation du jour', lines: [{ itemId: a.id, quantity: 2 }, { itemId: b.id, quantity: 1 }] });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
        number: expect.stringMatching(/^FAC-\d{7}$/), status: 'DRAFT', currency: 'XAF', currencyDigits: 0, subtotal: 11500, discount: 0, total: 11500, paid: 0, balance: 11500, note: 'Consultation du jour', issuedAt: null,
        patient: { id: ids.patients[0], lastName: 'Mbarga', firstName: 'Élisabeth' }, payments: [],
      });
      expect(r.body.lines).toMatchObject([{ itemCode: a.code, unitPrice: 5000, quantity: 2, total: 10000 }, { itemCode: b.code, unitPrice: 1500, quantity: 1, total: 1500 }]);
      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'billing.invoice.create' AND resource_id = $1", [r.body.id]);
      expect(entry.metadata).toMatchObject({ invoiceNumber: r.body.number, patientId: ids.patients[0], lines: 2 });
      expect(JSON.stringify(entry)).not.toMatch(NO_PII);
    });

    it('crée un brouillon vide, et refuse un patient inconnu, une ligne invalide ou un acte inconnu', async () => {
      expect((await post('caisse', '/billing/invoices', { patientId: ids.patients[1] })).body).toMatchObject({ status: 'DRAFT', lines: [], total: 0 });
      expect((await post('caisse', '/billing/invoices', { patientId: UNKNOWN })).body.code).toBe('BILLING_PATIENT_NOT_FOUND');
      expect((await post('caisse', '/billing/invoices', {})).status).toBe(400);
      expect((await post('caisse', '/billing/invoices', { patientId: ids.patients[0], note: 'x'.repeat(501) })).status).toBe(400);
      expect((await post('caisse', '/billing/invoices', { patientId: ids.patients[0], lines: [{ itemId: UNKNOWN, quantity: 1 }] })).body.code).toBe('BILLING_ITEM_NOT_FOUND');
      const act = await item();
      expect((await post('caisse', '/billing/invoices', { patientId: ids.patients[0], lines: [{ itemId: act.id, quantity: 0 }] })).status).toBe(400);
      expect((await post('caisse', '/billing/invoices', { patientId: ids.patients[0], lines: [{ itemId: act.id, quantity: 10000 }] })).status).toBe(400);
    });

    it("n'attribue pas deux fois le même numéro, même quand les créations sont simultanées", async () => {
      const results = await Promise.all(Array.from({ length: 6 }, () => post('caisse', '/billing/invoices', { patientId: ids.patients[2] })));
      const numbers = results.map((r) => r.body.number as string);
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(new Set(numbers).size).toBe(6);
    });

    it('ajoute et retire des lignes sur un brouillon, avec une copie du prix qui ne suit pas le catalogue', async () => {
      const act = await item(5000);
      const inv = await invoice([]);
      const added = await post('caisse', `/billing/invoices/${inv.id}/lines`, { itemId: act.id, quantity: 3 });
      expect(added.status).toBe(201);
      expect(added.body).toMatchObject({ subtotal: 15000 });
      await patch('admin', `/billing/items/${act.id}`, { unitPrice: 9000 }).expect(200); // le catalogue change ensuite
      expect((await get('caisse', `/billing/invoices/${inv.id}`)).body.lines[0]).toMatchObject({ unitPrice: 5000, total: 15000 });
      const second = (await post('caisse', `/billing/invoices/${inv.id}/lines`, { itemId: act.id, quantity: 1 })).body; // prix du jour pour une nouvelle ligne
      expect(second.lines.map((l: { unitPrice: number }) => l.unitPrice)).toEqual([5000, 9000]);
      const removed = await post('caisse', `/billing/invoices/${inv.id}/lines/${second.lines[0].id}/remove`);
      expect(removed.status).toBe(200);
      expect(removed.body.lines).toHaveLength(1);
      expect(removed.body.total).toBe(9000);
      expect((await post('caisse', `/billing/invoices/${inv.id}/lines/${UNKNOWN}/remove`)).body.code).toBe('BILLING_LINE_NOT_FOUND');
      expect((await post('caisse', `/billing/invoices/${UNKNOWN}/lines`, { itemId: act.id, quantity: 1 })).status).toBe(404);
    });

    it('applique une remise avec motif, la plafonne au total, la retire, et efface celle qui devient trop grande', async () => {
      // Sous-total 10 100 : le seuil d'approbation (10 %) est à 1 010.
      const a = await item(10000);
      const b = await item(100);
      const inv = await invoice([{ itemId: a.id, quantity: 1 }, { itemId: b.id, quantity: 1 }]);
      const base = `/billing/invoices/${inv.id}`;
      const noReason = await put('caisse', `${base}/discount`, { amount: 500 });
      expect([noReason.status, noReason.body.code]).toEqual([422, 'BILLING_REASON_REQUIRED']);
      const tooHigh = await put('caisse', `${base}/discount`, { amount: 10101, reason: 'Trop' });
      expect([tooHigh.status, tooHigh.body.code]).toEqual([422, 'BILLING_DISCOUNT_TOO_HIGH']);
      const ok = await put('caisse', `${base}/discount`, { amount: 1000, reason: 'Personnel de l\'hôpital' });
      expect(ok.body).toMatchObject({ discount: 1000, discountReason: 'Personnel de l\'hôpital', total: 9100 });
      const [entry] = await c.w.sql.query<{ reason: string; metadata: Record<string, unknown> }>("SELECT reason, metadata FROM audit_log WHERE action = 'billing.invoice.discount' AND resource_id = $1", [inv.id]);
      expect(entry.reason).toBe('Personnel de l\'hôpital');
      expect(entry.metadata).toMatchObject({ discount: 1000 });
      const afterRemoval = await post('caisse', `${base}/lines/${inv.lines[0].id}/remove`);
      expect(afterRemoval.body).toMatchObject({ discount: 0, discountReason: null, total: 100 });
      await put('caisse', `${base}/discount`, { amount: 10, reason: 'Fidélité' }).expect(200);
      expect((await put('caisse', `${base}/discount`, { amount: 0 })).body).toMatchObject({ discount: 0, discountReason: null });
      expect((await put('caisse', `${base}/discount`, { amount: -1, reason: 'x' })).status).toBe(400);
    });
  });

  describe('facture : émission et annulation', () => {
    it("refuse d'émettre une facture vide ou à total nul", async () => {
      const empty = await invoice([]);
      const r = await post('caisse', `/billing/invoices/${empty.id}/issue`);
      expect([r.status, r.body.code]).toEqual([409, 'BILLING_INVOICE_EMPTY']);
      const act = await item(1000);
      const free = await invoice([{ itemId: act.id, quantity: 1 }]);
      // Une gratuité totale dépasse le seuil d'approbation : on la pose directement en base (elle viendrait d'une demande acceptée).
      await c.w.sql.query("UPDATE billing_invoices SET discount_amount = 1000, discount_reason = 'Gratuité' WHERE id = $1", [free.id]);
      expect((await post('caisse', `/billing/invoices/${free.id}/issue`)).body.code).toBe('BILLING_INVOICE_EMPTY');
    });

    it('émet puis verrouille : plus de ligne ni de remise, pas de seconde émission', async () => {
      const act = await item(1000);
      const inv = await invoice([{ itemId: act.id, quantity: 1 }]);
      const r = await post('caisse', `/billing/invoices/${inv.id}/issue`);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ status: 'ISSUED', issuedAt: expect.stringMatching(/Z$/) });
      const attempts: (() => Promise<{ status: number; body: { code: string } }>)[] = [
        () => post('caisse', `/billing/invoices/${inv.id}/lines`, { itemId: act.id, quantity: 1 }),
        () => post('caisse', `/billing/invoices/${inv.id}/lines/${inv.lines[0].id}/remove`),
        () => put('caisse', `/billing/invoices/${inv.id}/discount`, { amount: 100, reason: 'x' }),
        () => post('caisse', `/billing/invoices/${inv.id}/issue`),
      ];
      for (const attempt of attempts) {
        const res = await attempt();
        expect([res.status, res.body.code]).toEqual([409, 'BILLING_INVOICE_NOT_DRAFT']);
      }
    });

    it('annule un brouillon avec un motif, trace le motif, et verrouille la facture annulée', async () => {
      const act = await item(2000);
      const inv = await invoice([{ itemId: act.id, quantity: 1 }]);
      expect((await post('caisse', `/billing/invoices/${inv.id}/cancel`, {})).status).toBe(400);
      const blank = await post('caisse', `/billing/invoices/${inv.id}/cancel`, { reason: '   ' });
      expect([blank.status, blank.body.code]).toEqual([422, 'BILLING_REASON_REQUIRED']);
      const r = await post('caisse', `/billing/invoices/${inv.id}/cancel`, { reason: 'Mauvais patient' });
      expect(r.body).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Mauvais patient' });
      const [entry] = await c.w.sql.query<{ reason: string }>("SELECT reason FROM audit_log WHERE action = 'billing.invoice.cancel' AND resource_id = $1", [inv.id]);
      expect(entry.reason).toBe('Mauvais patient');
      expect((await post('caisse', `/billing/invoices/${inv.id}/cancel`, { reason: 'Encore' })).body.code).toBe('BILLING_INVOICE_ALREADY_CANCELLED');
      expect((await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 100 })).body.code).toBe('BILLING_INVOICE_NOT_PAYABLE');
    });

    it("n'annule pas seule une facture émise : il faut l'accord d'un responsable", async () => {
      const inv = await issued(2000);
      const r = await post('caisse', `/billing/invoices/${inv.id}/cancel`, { reason: 'Mauvais patient' });
      expect([r.status, r.body.code]).toEqual([409, 'BILLING_CANCEL_APPROVAL_REQUIRED']);
      expect((await get('caisse', `/billing/invoices/${inv.id}`)).body.status).toBe('ISSUED');
    });

    it('annule aussi un brouillon vide', async () => {
      const draft = await invoice([]);
      expect((await post('caisse', `/billing/invoices/${draft.id}/cancel`, { reason: 'Abandon' })).body.status).toBe('CANCELLED');
    });
  });

  describe('encaissement', () => {
    it('encaisse en espèces avec la monnaie à rendre, passe en PARTIALLY_PAID, numérote le reçu et trace sans donnée personnelle', async () => {
      const inv = await issued(10000);
      const r = await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 4000, tendered: 5000 });
      expect(r.status).toBe(201);
      expect(r.body.change).toBe(1000);
      expect(r.body.payment).toMatchObject({ receiptNumber: expect.stringMatching(/^REC-\d{7}$/), mode: 'CASH', amount: 4000, reference: null });
      expect(r.body.invoice).toMatchObject({ status: 'PARTIALLY_PAID', paid: 4000, balance: 6000 });
      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'billing.payment.collect' AND resource_id = $1", [inv.id]);
      expect(entry.metadata).toMatchObject({ receiptNumber: r.body.payment.receiptNumber, mode: 'CASH', amount: 4000, balance: 6000 });
      expect(JSON.stringify(entry)).not.toMatch(NO_PII);
    });

    it('règle en plusieurs fois, par plusieurs modes, jusqu\'à PAID, puis refuse tout encaissement de plus', async () => {
      const inv = await issued(10000);
      await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CARD', amount: 3000, reference: 'AUTH-4821' }).expect(201);
      const last = await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'MOBILE_MONEY', amount: 7000, reference: 'MP240131.1234.A56789' });
      expect(last.body.invoice).toMatchObject({ status: 'PAID', paid: 10000, balance: 0 });
      expect(last.body.change).toBe(0);
      const detail = (await get('caisse', `/billing/invoices/${inv.id}`)).body;
      expect(detail.payments.map((p: { mode: string; reference: string; amount: number }) => [p.mode, p.reference, p.amount])).toEqual([['CARD', 'AUTH-4821', 3000], ['MOBILE_MONEY', 'MP240131.1234.A56789', 7000]]);
      const more = await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 1 });
      expect([more.status, more.body.code]).toEqual([409, 'BILLING_INVOICE_NOT_PAYABLE']);
    });

    it("ne perçoit jamais plus que le solde (409 avec le solde) et n'encaisse pas un brouillon", async () => {
      const inv = await issued(10000);
      const over = await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 10001 });
      expect([over.status, over.body.code]).toEqual([409, 'BILLING_OVERPAYMENT']);
      expect(over.body.message).toContain('10000'); // le solde figure dans le message
      expect((await get('caisse', `/billing/invoices/${inv.id}`)).body.paid).toBe(0);
      const act = await item(500);
      const draft = await invoice([{ itemId: act.id, quantity: 1 }]);
      const r = await post('caisse', `/billing/invoices/${draft.id}/payments`, { mode: 'CASH', amount: 100 });
      expect([r.status, r.body.code]).toEqual([409, 'BILLING_INVOICE_NOT_PAYABLE']);
    });

    it('deux caisses qui encaissent en même temps ne dépassent pas le total', async () => {
      const inv = await issued(10000);
      const results = await Promise.all([
        post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 7000 }),
        post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'MOBILE_MONEY', amount: 7000, reference: 'MP-2' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.code).toBe('BILLING_OVERPAYMENT');
      expect((await get('caisse', `/billing/invoices/${inv.id}`)).body).toMatchObject({ paid: 7000, balance: 3000, status: 'PARTIALLY_PAID' });
    });

    it('valide le mode, le montant, la référence et le montant remis', async () => {
      const inv = await issued(10000);
      const url = `/billing/invoices/${inv.id}/payments`;
      expect((await post('caisse', url, {})).status).toBe(400);
      expect((await post('caisse', url, { mode: 'BITCOIN', amount: 100 })).status).toBe(400);
      expect((await post('caisse', url, { mode: 'CASH', amount: 0 })).status).toBe(400);
      expect((await post('caisse', url, { mode: 'CASH', amount: 10.5 })).status).toBe(400);
      expect((await post('caisse', url, { mode: 'CASH', amount: 100, reference: "x'; DROP TABLE billing_payments; --" })).body.code).toBe('BILLING_PAYMENT_REFERENCE_INVALID');
      const notCash = await post('caisse', url, { mode: 'CARD', amount: 100, tendered: 200 });
      expect([notCash.status, notCash.body.code]).toEqual([422, 'BILLING_TENDERED_NOT_ALLOWED']);
      const low = await post('caisse', url, { mode: 'CASH', amount: 100, tendered: 50 });
      expect([low.status, low.body.code]).toEqual([422, 'BILLING_TENDERED_TOO_LOW']);
      expect((await post('caisse', `/billing/invoices/${UNKNOWN}/payments`, { mode: 'CASH', amount: 100 })).status).toBe(404);
      expect((await get('caisse', `/billing/invoices/${inv.id}`)).body.paid).toBe(0);
    });

    it("refuse d'annuler une facture encaissée, même en partie", async () => {
      const inv = await issued(10000);
      await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 100 }).expect(201);
      const r = await post('caisse', `/billing/invoices/${inv.id}/cancel`, { reason: 'Erreur' });
      expect([r.status, r.body.code]).toEqual([409, 'BILLING_INVOICE_HAS_PAYMENTS']);
    });
  });

  describe('réimpression de reçu', () => {
    it('exige un motif, renvoie une copie marquée « duplicate » et trace la réimpression avec son motif', async () => {
      const inv = await issued(10000);
      const paid = await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 4000 }).expect(201);
      const paymentId = paid.body.payment.id as string;
      expect((await post('caisse', `/billing/payments/${paymentId}/reprint`, {})).status).toBe(400);
      const r = await post('caisse', `/billing/payments/${paymentId}/reprint`, { reason: 'Reçu perdu par le patient' });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        receiptNumber: paid.body.payment.receiptNumber, invoiceNumber: inv.number, mode: 'CASH', amount: 4000, currency: 'XAF', duplicate: true, invoiceBalance: 6000,
        patient: { lastName: 'Mbarga' },
      });
      const [entry] = await c.w.sql.query<{ reason: string; metadata: Record<string, unknown> }>("SELECT reason, metadata FROM audit_log WHERE action = 'billing.payment.reprint' AND resource_id = $1", [inv.id]);
      expect(entry.reason).toBe('Reçu perdu par le patient');
      expect(entry.metadata).toMatchObject({ receiptNumber: paid.body.payment.receiptNumber });
      expect(JSON.stringify(entry)).not.toMatch(NO_PII);
      expect((await post('caisse', `/billing/payments/${UNKNOWN}/reprint`, { reason: 'x' })).status).toBe(404);
    });
  });

  describe('consultation', () => {
    it("lit une facture (tracé), et l'introuvable renvoie 404", async () => {
      const inv = await issued(3000);
      const r = await get('comptable', `/billing/invoices/${inv.id}`);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ id: inv.id, status: 'ISSUED', total: 3000 });
      const [entry] = await c.w.sql.query("SELECT 1 FROM audit_log WHERE action = 'billing.invoice.read' AND resource_id = $1", [inv.id]);
      expect(entry).toBeDefined();
      expect((await get('comptable', `/billing/invoices/${UNKNOWN}`)).status).toBe(404);
      expect((await get('comptable', '/billing/invoices/pas-un-uuid')).status).toBe(400);
    });

    it('liste les factures, filtre par patient, statut, numéro et période, pagine, et trace la consultation par critères', async () => {
      const mine = await issued(2500, ids.patients[1]);
      const all = await get('comptable', `/billing/invoices?patientId=${ids.patients[1]}&limit=200`);
      expect(all.status).toBe(200);
      const found = all.body.items.find((i: { id: string }) => i.id === mine.id);
      expect(found).toMatchObject({ number: mine.number, status: 'ISSUED', total: 2500, paid: 0, balance: 2500, patient: { lastName: 'Ndongo' } });
      expect(all.body.items.every((i: { patient: { id: string } }) => i.patient.id === ids.patients[1])).toBe(true);
      expect((await get('comptable', `/billing/invoices?number=${mine.number}`)).body.total).toBe(1);
      expect((await get('comptable', '/billing/invoices?status=CANCELLED&limit=200')).body.items.every((i: { status: string }) => i.status === 'CANCELLED')).toBe(true);
      expect((await get('comptable', '/billing/invoices?from=2100-01-01T00:00:00Z')).body.total).toBe(0);
      expect((await get('comptable', '/billing/invoices?limit=1')).body.items).toHaveLength(1);
      expect((await get('comptable', '/billing/invoices?status=BIZARRE')).body.code).toBe('BILLING_STATUS_FILTER_INVALID');
      expect((await get('comptable', '/billing/invoices?from=2026-01-01')).body.code).toBe('BILLING_DATE_INVALID');
      expect((await get('comptable', '/billing/invoices?number=XYZ')).body.code).toBe('BILLING_INVOICE_NUMBER_INVALID');
      expect((await get('comptable', '/billing/invoices?patientId=nope')).status).toBe(422);
      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>(
        "SELECT metadata FROM audit_log WHERE action = 'billing.invoice.list' AND metadata->>'criteria' = 'patientId' ORDER BY occurred_at DESC LIMIT 1",
      );
      expect(entry.metadata).toMatchObject({ criteria: 'patientId' });
      expect(JSON.stringify(entry)).not.toMatch(NO_PII);
    });
  });

  describe('messages et documentation', () => {
    it("traduit les erreurs de facturation dans la langue demandée", async () => {
      const fr = await get('caisse', `/billing/invoices/${UNKNOWN}`);
      expect(fr.body.message).toBe('Facture introuvable.');
      const en = await c.http().get(api(`/billing/invoices/${UNKNOWN}`)).set(c.bearer('caisse')).set('Accept-Language', 'en');
      expect(en.body.message).toBe('Invoice not found.');
      const inv = await issued(100);
      const over = await c.http().post(api(`/billing/invoices/${inv.id}/payments`)).set(c.bearer('caisse')).set('Accept-Language', 'en').send({ mode: 'CASH', amount: 999 });
      expect(over.body.message).toBe('The amount exceeds the invoice balance (100).');
    });
  });
});

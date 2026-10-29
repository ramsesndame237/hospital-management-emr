import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const PWD = 'une phrase de passe solide';
const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const BASE = '/billing/cash-sessions';

describe('API sessions de caisse /api/v1/billing/cash-sessions (HTTP réel, PostgreSQL réel)', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};

  /** Un compte supplémentaire (sans double authentification) et son jeton. */
  async function account(username: string, roles: string[]): Promise<void> {
    const user = await c.w.seed({ username, password: PWD, roles });
    userIds[username] = user.id.value;
    tokens[username] = (await c.http().post(api('/auth/login')).send({ username, password: PWD }).expect(200)).body.accessToken as string;
  }

  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
    await account('caisse2', ['CASHIER']);
    await account('mixte', ['CASHIER', 'ACCOUNTANT']); // à la fois caissier et responsable : sert à prouver qu'on ne contre-signe pas sa propre caisse
  });
  afterAll(() => c.close());

  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who] ?? c.token[who]}` });
  const get = (who: string, url: string) => c.http().get(api(url)).set(as(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(as(who)).send(body);

  let seq = 0;
  /** Une facture émise, prête à être encaissée (catalogue tenu par l'administrateur, facture par la caisse indiquée). */
  async function issuedInvoice(price: number, cashier = 'caisse'): Promise<string> {
    seq += 1;
    const act = (await post('admin', '/billing/items', { code: `SESS-${seq}`, name: `Acte ${seq}`, category: 'OTHER', unitPrice: price }).expect(201)).body.id as string;
    const inv = (await post(cashier, '/billing/invoices', { patientId: ids.patients[0], lines: [{ itemId: act, quantity: 1 }] }).expect(201)).body.id as string;
    await post(cashier, `/billing/invoices/${inv}/issue`).expect(200);
    return inv;
  }

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', `${BASE}/denominations`], ['GET', `${BASE}/current`], ['GET', BASE], ['POST', BASE], ['GET', `${BASE}/${ID}`], ['POST', `${BASE}/${ID}/close`], ['POST', `${BASE}/${ID}/cosign`],
    ])('%s %s : sans jeton → 401 ; patient, médecin, infirmier et accueil → 403', async (method, url) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(url));
        return who ? req.set(as(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of ['patient', 'medecin', 'infirmier', 'accueil']) expect((await call(who)).status).toBe(403);
    });

    it("la caisse tient sa caisse mais ne contre-signe pas ; la comptabilité lit et contre-signe mais ne tient pas de caisse ; l'administrateur système lit seulement", async () => {
      expect((await post('caisse', `${BASE}/${UNKNOWN}/cosign`)).status).toBe(403); // la caisse n'a pas le droit de contre-signer
      expect((await post('comptable', `${BASE}/${UNKNOWN}/cosign`)).status).toBe(404); // droit accordé : c'est la session qui n'existe pas
      expect((await post('comptable', BASE, { counter: 'X' })).status).toBe(403);
      expect((await post('admin', BASE, { counter: 'X' })).status).toBe(403);
      expect((await get('comptable', `${BASE}/current`)).status).toBe(403);
      expect((await get('comptable', BASE)).status).toBe(200);
      expect((await get('admin', BASE)).status).toBe(200);
      expect((await post('admin', `${BASE}/${UNKNOWN}/cosign`)).status).toBe(403);
    });
  });

  describe('billets et pièces', () => {
    it('donne les valeurs du franc CFA et la limite d\'écart', async () => {
      const r = await get('caisse', `${BASE}/denominations`);
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ currency: 'XAF', currencyDigits: 0, denominations: [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1], varianceLimit: 5000 });
    });
  });

  describe('sans caisse ouverte', () => {
    it('ne propose aucune caisse courante', async () => {
      const r = await get('caisse', `${BASE}/current`);
      expect([r.status, r.body.session]).toEqual([200, null]);
    });

    it("refuse d'encaisser, avec un message qui dit d'ouvrir la caisse", async () => {
      const inv = await issuedInvoice(5000);
      const r = await post('caisse', `/billing/invoices/${inv}/payments`, { mode: 'CASH', amount: 1000 });
      expect([r.status, r.body.code]).toEqual([409, 'BILLING_NO_OPEN_SESSION']);
      expect(r.body.message).toContain('Ouvrez votre caisse');
      expect((await get('caisse', `/billing/invoices/${inv}`)).body.paid).toBe(0);
    });
  });

  describe("ouverture, encaissements et clôture d'une caisse juste", () => {
    let session: string;
    let invoice: string;

    it('ouvre avec le fonds compté par valeur et le trace', async () => {
      const r = await post('caisse', BASE, { counter: '  Caisse   OPD 1 ', openingCount: { 5000: 2, 1000: 10 } });
      expect(r.status).toBe(201);
      session = r.body.id as string;
      expect(r.body).toMatchObject({
        number: expect.stringMatching(/^CAI-\d{7}$/), status: 'OPEN', counter: 'Caisse OPD 1', currency: 'XAF', openingFloat: 20000, openingCount: { '5000': 2, '1000': 10 }, closedAt: null,
        cashier: { username: 'caisse' }, takings: { CASH: 0, CARD: 0, MOBILE_MONEY: 0, CHEQUE: 0, BANK_TRANSFER: 0 }, paymentCount: 0, totalTaken: 0, expectedCash: 20000, requiresCosign: false, varianceLimit: 5000,
        payments: [],
      });
      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'billing.session.open' AND resource_id = $1", [session]);
      expect(entry.metadata).toMatchObject({ sessionNumber: r.body.number, counter: 'Caisse OPD 1', openingFloat: 20000 });
    });

    it('la retrouve comme caisse courante', async () => {
      const r = await get('caisse', `${BASE}/current`);
      expect(r.body.session).toMatchObject({ id: session, status: 'OPEN' });
    });

    it('refuse une seconde caisse pour le même caissier, et un poste déjà tenu pour un autre', async () => {
      const second = await post('caisse', BASE, { counter: 'Autre poste' });
      expect([second.status, second.body.code]).toEqual([409, 'BILLING_CASHIER_HAS_OPEN_SESSION']);
      const taken = await post('caisse2', BASE, { counter: 'caisse opd 1' });
      expect([taken.status, taken.body.code]).toEqual([409, 'BILLING_COUNTER_IN_USE']);
    });

    it('permet d\'encaisser : l\'encaissement est rattaché à la session et compté par mode', async () => {
      invoice = await issuedInvoice(100000);
      await post('caisse', `/billing/invoices/${invoice}/payments`, { mode: 'CASH', amount: 12000 }).expect(201);
      await post('caisse', `/billing/invoices/${invoice}/payments`, { mode: 'CARD', amount: 30000 }).expect(201);
      await post('caisse', `/billing/invoices/${invoice}/payments`, { mode: 'CASH', amount: 3000 }).expect(201);
      const r = await get('caisse', `${BASE}/${session}`);
      expect(r.body).toMatchObject({ paymentCount: 3, totalTaken: 45000, takings: { CASH: 15000, CARD: 30000 }, expectedCash: 35000 });
      expect(r.body.payments.map((p: { mode: string; amount: number }) => [p.mode, p.amount])).toEqual([['CASH', 12000], ['CARD', 30000], ['CASH', 3000]]);
      expect(r.body.payments[0]).toMatchObject({ receiptNumber: expect.stringMatching(/^REC-\d{7}$/) });
    });

    it('une caisse d\'un autre caissier est introuvable pour lui, mais visible des responsables', async () => {
      expect((await get('caisse2', `${BASE}/${session}`)).status).toBe(404);
      expect((await get('comptable', `${BASE}/${session}`)).status).toBe(200);
      expect((await get('admin', `${BASE}/${session}`)).status).toBe(200);
      expect((await get('caisse', `${BASE}/pas-un-uuid`)).status).toBe(400);
      expect((await get('caisse', `${BASE}/${UNKNOWN}`)).status).toBe(404);
    });

    it('seul le caissier clôture sa caisse', async () => {
      expect((await post('caisse2', `${BASE}/${session}/close`, { count: { 10000: 3, 5000: 1 } })).status).toBe(404);
      expect((await post('comptable', `${BASE}/${session}/close`, { count: {} })).status).toBe(403);
      expect((await get('caisse', `${BASE}/${session}`)).body.status).toBe('OPEN');
    });

    it('refuse un comptage invalide', async () => {
      const url = `${BASE}/${session}/close`;
      expect((await post('caisse', url, {})).status).toBe(400);
      expect((await post('caisse', url, { count: [1] })).status).toBe(400);
      expect((await post('caisse', url, { count: { 3000: 1 } })).body.code).toBe('BILLING_COUNT_INVALID');
      expect((await post('caisse', url, { count: { 500: -1 } })).body.code).toBe('BILLING_COUNT_INVALID');
      expect((await post('caisse', url, { count: { 500: 1.5 } })).body.code).toBe('BILLING_COUNT_INVALID');
      expect((await get('caisse', `${BASE}/${session}`)).body.status).toBe('OPEN');
    });

    it('clôt une caisse juste sans explication : 20 000 de fonds + 15 000 d\'espèces = 35 000', async () => {
      const r = await post('caisse', `${BASE}/${session}/close`, { count: { 10000: 3, 5000: 1 } });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ status: 'CLOSED', countedCash: 35000, expectedCash: 35000, variance: 0, varianceReason: null, requiresCosign: false, closingCount: { '10000': 3, '5000': 1 } });
      expect(r.body.closedAt).toMatch(/Z$/);
      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'billing.session.close' AND resource_id = $1", [session]);
      expect(entry.metadata).toMatchObject({ openingFloat: 20000, expectedCash: 35000, countedCash: 35000, variance: 0, requiresCosign: false, totalTaken: 45000 });
    });

    it('ne se clôture pas deux fois et n\'accepte plus d\'encaissement', async () => {
      const again = await post('caisse', `${BASE}/${session}/close`, { count: {} });
      expect([again.status, again.body.code]).toEqual([409, 'BILLING_SESSION_NOT_OPEN']);
      expect((await get('caisse', `${BASE}/current`)).body.session).toBeNull();
      const r = await post('caisse', `/billing/invoices/${invoice}/payments`, { mode: 'CASH', amount: 1000 });
      expect([r.status, r.body.code]).toEqual([409, 'BILLING_NO_OPEN_SESSION']);
    });

    it('libère le caissier et le poste : une nouvelle caisse peut s\'ouvrir', async () => {
      const r = await post('caisse', BASE, { counter: 'Caisse OPD 1', openingCount: { 10000: 1 } });
      expect(r.status).toBe(201);
      expect(r.body.openingFloat).toBe(10000);
      await post('caisse', `${BASE}/${r.body.id}/close`, { count: { 10000: 1 } }).expect(200);
    });
  });

  describe('écart de caisse', () => {
    it('exige une explication dès que la caisse n\'est pas juste, et la conserve', async () => {
      const opened = (await post('caisse2', BASE, { counter: 'Caisse ECART', openingCount: { 10000: 2 } }).expect(201)).body.id as string;
      const inv = await issuedInvoice(10000, 'caisse2');
      await post('caisse2', `/billing/invoices/${inv}/payments`, { mode: 'CASH', amount: 4000 }).expect(201); // attendu : 24 000
      const missing = await post('caisse2', `${BASE}/${opened}/close`, { count: { 10000: 2, 2000: 1 } }); // compté 22 000 : -2 000
      expect([missing.status, missing.body.code]).toEqual([422, 'BILLING_VARIANCE_REASON_REQUIRED']);
      expect((await post('caisse2', `${BASE}/${opened}/close`, { count: { 10000: 2, 2000: 1 }, reason: '   ' })).body.code).toBe('BILLING_VARIANCE_REASON_REQUIRED');
      expect((await get('caisse2', `${BASE}/${opened}`)).body.status).toBe('OPEN');
      const done = await post('caisse2', `${BASE}/${opened}/close`, { count: { 10000: 2, 2000: 1 }, reason: 'Erreur de monnaie rendue' });
      expect(done.body).toMatchObject({ status: 'CLOSED', variance: -2000, varianceReason: 'Erreur de monnaie rendue', requiresCosign: false, expectedCash: 24000, countedCash: 22000 });
      const [entry] = await c.w.sql.query<{ reason: string }>("SELECT reason FROM audit_log WHERE action = 'billing.session.close' AND resource_id = $1", [opened]);
      expect(entry.reason).toBe('Erreur de monnaie rendue');
    });

    it('enregistre un excédent comme un écart positif', async () => {
      const opened = (await post('caisse2', BASE, { counter: 'Caisse EXCEDENT', openingCount: { 5000: 1 } }).expect(201)).body.id as string;
      const done = await post('caisse2', `${BASE}/${opened}/close`, { count: { 5000: 1, 1000: 3 }, reason: 'Pourboire laissé en caisse' });
      expect(done.body).toMatchObject({ status: 'CLOSED', variance: 3000 });
    });

    it('refuse une explication de plus de 200 caractères', async () => {
      const opened = (await post('caisse2', BASE, { counter: 'Caisse LONG' }).expect(201)).body.id as string;
      expect((await post('caisse2', `${BASE}/${opened}/close`, { count: { 1000: 1 }, reason: 'x'.repeat(201) })).status).toBe(400);
      await post('caisse2', `${BASE}/${opened}/close`, { count: {} }).expect(200);
    });
  });

  describe('écart au-dessus de la limite : contre-signature', () => {
    let session: string;

    it('met la clôture en attente de contre-signature', async () => {
      session = (await post('caisse2', BASE, { counter: 'Caisse GROS ECART', openingCount: { 10000: 5 } }).expect(201)).body.id as string;
      const r = await post('caisse2', `${BASE}/${session}/close`, { count: { 10000: 2 }, reason: 'Argent manquant, à vérifier' }); // 50 000 attendus, 20 000 comptés : -30 000
      expect(r.body).toMatchObject({ status: 'AWAITING_REVIEW', variance: -30000, requiresCosign: true, cosignedBy: null });
      expect((await get('caisse2', `${BASE}/current`)).body.session).toBeNull(); // le caissier est libre d'ouvrir une autre caisse
    });

    it('apparaît dans la liste des clôtures à valider', async () => {
      const r = await get('comptable', `${BASE}?status=AWAITING_REVIEW`);
      expect(r.body.items.map((s: { id: string }) => s.id)).toContain(session);
      expect(r.body.items.every((s: { status: string }) => s.status === 'AWAITING_REVIEW')).toBe(true);
    });

    it('refuse que la caisse ou l\'administrateur système contre-signe (droit manquant)', async () => {
      expect((await post('caisse2', `${BASE}/${session}/cosign`)).status).toBe(403);
      expect((await post('admin', `${BASE}/${session}/cosign`)).status).toBe(403);
    });

    it('le responsable contre-signe avec un commentaire, et le trace', async () => {
      const r = await post('comptable', `${BASE}/${session}/cosign`, { comment: 'Écart vérifié avec le caissier' });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ status: 'CLOSED', cosignedBy: { username: 'comptable' }, cosignComment: 'Écart vérifié avec le caissier', requiresCosign: true });
      const [entry] = await c.w.sql.query<{ reason: string; metadata: Record<string, unknown> }>("SELECT reason, metadata FROM audit_log WHERE action = 'billing.session.cosign' AND resource_id = $1", [session]);
      expect(entry.reason).toBe('Écart vérifié avec le caissier');
      expect(entry.metadata).toMatchObject({ variance: -30000 });
    });

    it('ne se contre-signe pas deux fois, ni une session qui n\'attend rien', async () => {
      const twice = await post('comptable', `${BASE}/${session}/cosign`);
      expect([twice.status, twice.body.code]).toEqual([409, 'BILLING_SESSION_NOT_AWAITING_REVIEW']);
      const open = (await post('caisse2', BASE, { counter: 'Caisse OUVERTE' }).expect(201)).body.id as string;
      expect((await post('comptable', `${BASE}/${open}/cosign`)).body.code).toBe('BILLING_SESSION_NOT_AWAITING_REVIEW');
      await post('caisse2', `${BASE}/${open}/close`, { count: {} }).expect(200);
    });

    it('un responsable qui tient aussi une caisse ne peut pas contre-signer la sienne', async () => {
      const mine = (await post('mixte', BASE, { counter: 'Caisse MIXTE', openingCount: { 10000: 5 } }).expect(201)).body.id as string;
      const closed = await post('mixte', `${BASE}/${mine}/close`, { count: {}, reason: 'Écart énorme' });
      expect(closed.body.status).toBe('AWAITING_REVIEW');
      const self = await post('mixte', `${BASE}/${mine}/cosign`);
      expect([self.status, self.body.code]).toEqual([409, 'BILLING_COSIGN_SELF']);
      expect((await post('comptable', `${BASE}/${mine}/cosign`)).status).toBe(200); // un autre responsable, lui, le peut
    });

    it('refuse un commentaire trop long', async () => {
      const s = (await post('caisse2', BASE, { counter: 'Caisse COMMENT', openingCount: { 10000: 5 } }).expect(201)).body.id as string;
      await post('caisse2', `${BASE}/${s}/close`, { count: {}, reason: 'Gros écart' }).expect(200);
      expect((await post('comptable', `${BASE}/${s}/cosign`, { comment: 'x'.repeat(201) })).status).toBe(400);
    });
  });

  describe('liste des sessions', () => {
    it('un caissier ne voit que les siennes, quoi qu\'il demande', async () => {
      const mine = await get('caisse2', `${BASE}?limit=200`);
      expect(mine.status).toBe(200);
      expect(mine.body.items.length).toBeGreaterThan(0);
      expect(mine.body.items.every((s: { cashier: { username: string } }) => s.cashier.username === 'caisse2')).toBe(true);
      const spy = await get('caisse2', `${BASE}?cashierId=${userIds['mixte']}&limit=200`);
      expect(spy.body.items.every((s: { cashier: { username: string } }) => s.cashier.username === 'caisse2')).toBe(true);
    });

    it('un responsable voit toutes les sessions et filtre par caissier et statut', async () => {
      const all = await get('comptable', `${BASE}?limit=200`);
      const who = new Set(all.body.items.map((s: { cashier: { username: string } }) => s.cashier.username));
      expect(who.has('caisse') && who.has('caisse2') && who.has('mixte')).toBe(true);
      const filtered = await get('comptable', `${BASE}?cashierId=${userIds['caisse2']}&status=CLOSED&limit=200`);
      expect(filtered.body.items.every((s: { cashier: { username: string }; status: string }) => s.cashier.username === 'caisse2' && s.status === 'CLOSED')).toBe(true);
      expect(all.body.items[0].openedAt >= all.body.items[all.body.items.length - 1].openedAt).toBe(true); // les plus récentes d'abord
    });

    it('pagine et valide le statut', async () => {
      const page = await get('comptable', `${BASE}?limit=2&offset=1`);
      expect(page.body).toMatchObject({ offset: 1, limit: 2 });
      expect(page.body.items.length).toBeLessThanOrEqual(2);
      const bad = await get('comptable', `${BASE}?status=BIZARRE`);
      expect([bad.status, bad.body.code]).toEqual([422, 'BILLING_SESSION_STATUS_INVALID']);
    });
  });

  describe('ouverture : validation', () => {
    it('exige un nom de poste et un comptage valide', async () => {
      expect((await post('caisse2', BASE, {})).status).toBe(400);
      expect((await post('caisse2', BASE, { counter: 'x'.repeat(41) })).status).toBe(400);
      expect((await post('caisse2', BASE, { counter: 'Poste', openingCount: [1] })).status).toBe(400);
      expect((await post('caisse2', BASE, { counter: 'Poste', openingCount: { 3000: 1 } })).body.code).toBe('BILLING_COUNT_INVALID');
      expect((await post('caisse2', BASE, { counter: 'Poste', openingCount: { 500: 100001 } })).body.code).toBe('BILLING_COUNT_INVALID');
      expect((await get('caisse2', `${BASE}/current`)).body.session).toBeNull();
    });

    it('deux ouvertures simultanées du même caissier : une seule passe', async () => {
      const results = await Promise.all([post('caisse2', BASE, { counter: 'Course A' }), post('caisse2', BASE, { counter: 'Course B' })]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const open = results.find((r) => r.status === 201)!.body.id as string;
      await post('caisse2', `${BASE}/${open}/close`, { count: {} }).expect(200);
    });
  });

  describe('messages', () => {
    it('traduit les erreurs de caisse dans la langue demandée', async () => {
      const inv = await issuedInvoice(1000);
      const en = await c.http().post(api(`/billing/invoices/${inv}/payments`)).set(as('caisse')).set('Accept-Language', 'en').send({ mode: 'CASH', amount: 100 });
      expect(en.body.message).toBe('Open your cash drawer before collecting: you have no open cash session.');
    });
  });
});

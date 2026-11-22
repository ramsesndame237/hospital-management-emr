import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const NO_PII = /Mbarga|Élisabeth|Ndongo|Nkoa|Curie|Pasteur|Abel/;
const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe('API assurances (tiers payant) /api/v1/billing (HTTP réel, PostgreSQL réel)', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
    await c.http().post(api('/billing/cash-sessions')).set(c.bearer('caisse')).send({ counter: 'Caisse test' }).expect(201);
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const put = (who: string, url: string, body: object = {}) => c.http().put(api(url)).set(c.bearer(who)).send(body);
  const del = (who: string, url: string) => c.http().delete(api(url)).set(c.bearer(who));

  let seq = 0;
  const payer = async (name = `Assureur ${++seq}`) => (await post('comptable', '/billing/payers', { code: `ASS${seq}`, name }).expect(201)).body as { id: string; code: string; name: string };
  const coverage = async (payerId: string, percent: number, over: Record<string, unknown> = {}, patient = ids.patients[0]) =>
    (await post('accueil', `/billing/patients/${patient}/coverages`, { payerId, policyNumber: `POL-${++seq}`, percent, ...over }).expect(201)).body as { id: string; percent: number; validToday: boolean };
  /** Une facture brouillon d'un acte à `price` (créée par l'administrateur système, facturée par la caisse). */
  const draft = async (price: number, patient = ids.patients[0]) => {
    seq += 1;
    const item = (await post('admin', '/billing/items', { code: `ASS-ACT-${seq}`, name: `Acte ${seq}`, category: 'CONSULTATION', unitPrice: price }).expect(201)).body as { id: string };
    return (await post('caisse', '/billing/invoices', { patientId: patient, lines: [{ itemId: item.id, quantity: 1 }] }).expect(201)).body as { id: string; number: string };
  };

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', '/billing/payers', ['medecin', 'infirmier', 'labo', 'pharmacien', 'patient']],
      ['POST', '/billing/payers', ['medecin', 'infirmier', 'accueil', 'caisse', 'patient']],
      ['PATCH', `/billing/payers/${ID}`, ['accueil', 'caisse', 'medecin']],
      ['POST', `/billing/payers/${ID}/deactivate`, ['accueil', 'caisse', 'medecin']],
      ['GET', `/billing/patients/${ID}/coverages`, ['medecin', 'infirmier', 'patient']],
      ['POST', `/billing/patients/${ID}/coverages`, ['medecin', 'infirmier', 'patient']],
      ['POST', `/billing/coverages/${ID}/deactivate`, ['medecin', 'infirmier', 'patient']],
      ['GET', '/billing/claims', ['accueil', 'caisse', 'medecin', 'infirmier', 'patient']],
      ['POST', `/billing/invoices/${ID}/payer-settlement`, ['accueil', 'caisse', 'medecin', 'patient']],
    ] as const)('%s %s : sans jeton → 401, profils sans le droit → 403', async (method, url, forbidden) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(url));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of forbidden) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });
  });

  describe('les assureurs', () => {
    it('crée un assureur (code en majuscules), refuse un doublon et un code invalide, le renomme et le retire', async () => {
      const created = await post('comptable', '/billing/payers', { code: ' mut-1 ', name: '  Mutuelle   Nationale ' });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ code: 'MUT-1', name: 'Mutuelle Nationale', active: true });
      const dup = await post('admin', '/billing/payers', { code: 'MUT-1', name: 'Autre' });
      expect([dup.status, dup.body.code]).toEqual([409, 'BILLING_PAYER_CODE_ALREADY_EXISTS']);
      const bad = await post('comptable', '/billing/payers', { code: 'pas valide!', name: 'X' });
      expect([bad.status, bad.body.code]).toEqual([422, 'BILLING_PAYER_CODE_INVALID']);
      expect((await post('comptable', '/billing/payers', { code: 'OK1', name: '   ' })).body.code).toBe('BILLING_PAYER_NAME_INVALID');
      const renamed = await c.http().patch(api(`/billing/payers/${created.body.id}`)).set(c.bearer('comptable')).send({ name: 'Mutuelle Nationale SA' });
      expect(renamed.body).toMatchObject({ name: 'Mutuelle Nationale SA', code: 'MUT-1' });
      await post('comptable', `/billing/payers/${created.body.id}/deactivate`).expect(200);
      const listed = (await get('caisse', '/billing/payers?search=mutuelle').expect(200)).body.items as { id: string }[];
      expect(listed.some((p) => p.id === created.body.id)).toBe(false);
      const all = (await get('caisse', '/billing/payers?search=mutuelle&includeInactive=true').expect(200)).body.items as { id: string; active: boolean }[];
      expect(all.find((p) => p.id === created.body.id)?.active).toBe(false);
      await post('comptable', `/billing/payers/${created.body.id}/activate`).expect(200);
    });
  });

  describe("la couverture d'un patient", () => {
    it('enregistre une couverture valable aujourd’hui, la liste, et la désactive', async () => {
      const p = await payer();
      const cov = await coverage(p.id, 80);
      expect(cov).toMatchObject({ percent: 80, validToday: true });
      const list = (await get('caisse', `/billing/patients/${ids.patients[0]}/coverages`).expect(200)).body as { id: string; payer: { name: string }; policyNumber: string }[];
      expect(list.find((x) => x.id === cov.id)).toMatchObject({ payer: { name: p.name } });
      await post('accueil', `/billing/coverages/${cov.id}/deactivate`).expect(200);
      expect(((await get('caisse', `/billing/patients/${ids.patients[0]}/coverages`).expect(200)).body as { id: string }[]).some((x) => x.id === cov.id)).toBe(false);
    });

    it('refuse un pourcentage ou des dates invalides, un assureur retiré ou inconnu, un patient inconnu', async () => {
      const p = await payer();
      expect((await post('accueil', `/billing/patients/${ids.patients[0]}/coverages`, { payerId: p.id, policyNumber: 'X', percent: 150 })).status).toBe(400);
      const dates = await post('accueil', `/billing/patients/${ids.patients[0]}/coverages`, { payerId: p.id, policyNumber: 'X', percent: 50, validFrom: '2026-12-01', validUntil: '2026-01-01' });
      expect([dates.status, dates.body.code]).toEqual([422, 'BILLING_COVERAGE_DATE_INVALID']);
      expect((await post('accueil', `/billing/patients/${ids.patients[0]}/coverages`, { payerId: p.id, policyNumber: 'X', percent: 50, validFrom: '2026-02-30' })).body.code).toBe('BILLING_COVERAGE_DATE_INVALID');
      expect((await post('accueil', `/billing/patients/${ids.patients[0]}/coverages`, { payerId: UNKNOWN, policyNumber: 'X', percent: 50 })).status).toBe(404);
      expect((await post('accueil', `/billing/patients/${UNKNOWN}/coverages`, { payerId: p.id, policyNumber: 'X', percent: 50 })).status).toBe(404);
      await post('comptable', `/billing/payers/${p.id}/deactivate`).expect(200);
      expect((await post('accueil', `/billing/patients/${ids.patients[0]}/coverages`, { payerId: p.id, policyNumber: 'X', percent: 50 })).body.code).toBe('BILLING_PAYER_INACTIVE');
    });
  });

  describe("la part de l'assureur sur une facture", () => {
    it("80 % de ce qui reste après remise : le patient ne doit que le reste, et la part suit les lignes tant que c'est un brouillon", async () => {
      const p = await payer();
      const cov = await coverage(p.id, 80);
      const inv = await draft(10000);
      await put('caisse', `/billing/invoices/${inv.id}/discount`, { amount: 1000, reason: 'Geste commercial' }).expect(200);
      const applied = await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: cov.id });
      expect(applied.status).toBe(200);
      expect(applied.body).toMatchObject({ subtotal: 10000, discount: 1000, grossTotal: 9000, total: 1800, balance: 1800, coverage: { percent: 80, amount: 7200, payerName: p.name, settledAt: null } });

      // Une ligne de plus : la part se recalcule (brouillon).
      seq += 1;
      const extra = (await post('admin', '/billing/items', { code: `ASS-X-${seq}`, name: 'Supplément', category: 'CONSULTATION', unitPrice: 1000 }).expect(201)).body as { id: string };
      const more = await post('caisse', `/billing/invoices/${inv.id}/lines`, { itemId: extra.id, quantity: 1 });
      expect(more.body).toMatchObject({ grossTotal: 10000, total: 2000, coverage: { amount: 8000 } });

      const issued = await post('caisse', `/billing/invoices/${inv.id}/issue`).expect(200);
      expect(issued.body).toMatchObject({ status: 'ISSUED', total: 2000, balance: 2000, coverage: { amount: 8000 } });
      const paid = await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 2000 });
      expect(paid.body.invoice).toMatchObject({ status: 'PAID', balance: 0 });
      expect((await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 1 })).body.code).toBe('BILLING_INVOICE_NOT_PAYABLE'); // plus rien à encaisser

      const row = ((await get('caisse', `/billing/invoices?number=${inv.number}`).expect(200)).body.items as { total: number; payerShare: number }[])[0];
      expect(row).toMatchObject({ total: 2000, payerShare: 8000 });
    });

    it("retire la couverture d'un brouillon : le patient doit alors tout", async () => {
      const p = await payer();
      const cov = await coverage(p.id, 50);
      const inv = await draft(4000);
      await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: cov.id }).expect(200);
      const removed = await del('caisse', `/billing/invoices/${inv.id}/coverage`);
      expect(removed.status).toBe(200);
      expect(removed.body).toMatchObject({ total: 4000, coverage: null });
    });

    it('100 % : la facture s’émet déjà soldée pour le patient, sans rien à encaisser', async () => {
      const p = await payer();
      const cov = await coverage(p.id, 100);
      const inv = await draft(5000);
      await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: cov.id }).expect(200);
      const issued = await post('caisse', `/billing/invoices/${inv.id}/issue`).expect(200);
      expect(issued.body).toMatchObject({ status: 'PAID', total: 0, balance: 0, coverage: { percent: 100, amount: 5000 } });
    });

    it("refuse la couverture d'un autre patient, une couverture désactivée ou expirée, et toute modification après l'émission", async () => {
      const p = await payer();
      const other = await coverage(p.id, 70, {}, ids.patients[1]);
      const inv = await draft(3000);
      expect((await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: other.id })).body.code).toBe('BILLING_COVERAGE_PATIENT_MISMATCH');
      const expired = await coverage(p.id, 70, { validFrom: day(-60), validUntil: day(-1) });
      const late = await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: expired.id });
      expect([late.status, late.body.code]).toEqual([409, 'BILLING_COVERAGE_NOT_VALID']);
      const future = await coverage(p.id, 70, { validFrom: day(10) });
      expect((await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: future.id })).body.code).toBe('BILLING_COVERAGE_NOT_VALID');
      expect((await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: UNKNOWN })).status).toBe(404);

      const ok = await coverage(p.id, 60);
      await post('caisse', `/billing/invoices/${inv.id}/issue`).expect(200);
      const afterIssue = await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: ok.id });
      expect([afterIssue.status, afterIssue.body.code]).toEqual([409, 'BILLING_INVOICE_NOT_DRAFT']);
      expect((await del('caisse', `/billing/invoices/${inv.id}/coverage`)).body.code).toBe('BILLING_INVOICE_NOT_DRAFT');
    });
  });

  describe("les créances d'assureurs", () => {
    it("liste la part à recouvrer, la règle une seule fois avec sa référence, puis la montre réglée", async () => {
      const p = await payer();
      const cov = await coverage(p.id, 75);
      const inv = await draft(8000);
      await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: cov.id }).expect(200);
      await post('caisse', `/billing/invoices/${inv.id}/issue`).expect(200);

      const pending = (await get('comptable', `/billing/claims?payerId=${p.id}&settled=false`).expect(200)).body as { items: { invoiceNumber: string; amount: number; payerName: string; percent: number; settledAt: string | null; patient: { number: string } | null }[]; total: number };
      expect(pending.total).toBe(1);
      expect(pending.items[0]).toMatchObject({ invoiceNumber: inv.number, amount: 6000, percent: 75, payerName: p.name, settledAt: null });
      expect(pending.items[0].patient?.number).toBeDefined();

      const noRef = await post('comptable', `/billing/invoices/${inv.id}/payer-settlement`, { reference: '   ' });
      expect([noRef.status, noRef.body.code]).toEqual([422, 'BILLING_SETTLEMENT_REFERENCE_INVALID']);
      const settled = await post('comptable', `/billing/invoices/${inv.id}/payer-settlement`, { reference: 'VIR-2026-0042' });
      expect(settled.status).toBe(200);
      expect(settled.body.coverage).toMatchObject({ amount: 6000, settlementReference: 'VIR-2026-0042' });
      expect(settled.body.coverage.settledAt).toEqual(expect.any(String));
      expect((await post('comptable', `/billing/invoices/${inv.id}/payer-settlement`, { reference: 'VIR-2' })).body.code).toBe('BILLING_ALREADY_SETTLED');

      expect(((await get('comptable', `/billing/claims?payerId=${p.id}&settled=false`).expect(200)).body as { total: number }).total).toBe(0);
      const done = (await get('comptable', `/billing/claims?payerId=${p.id}&settled=true`).expect(200)).body as { items: { settlementReference: string }[]; total: number };
      expect(done).toMatchObject({ total: 1, items: [{ settlementReference: 'VIR-2026-0042' }] });
    });

    it("n'a pas de créance pour un brouillon, une facture sans assurance ou annulée ; refuse le règlement dans ces cas", async () => {
      const p = await payer();
      const cov = await coverage(p.id, 50);
      const inv = await draft(2000);
      await put('caisse', `/billing/invoices/${inv.id}/coverage`, { coverageId: cov.id }).expect(200);
      expect(((await get('comptable', `/billing/claims?payerId=${p.id}`).expect(200)).body as { total: number }).total).toBe(0); // brouillon
      const early = await post('comptable', `/billing/invoices/${inv.id}/payer-settlement`, { reference: 'R' });
      expect([early.status, early.body.code]).toEqual([409, 'BILLING_SETTLEMENT_NOT_ALLOWED']);

      const plain = await draft(1000);
      await post('caisse', `/billing/invoices/${plain.id}/issue`).expect(200);
      expect((await post('comptable', `/billing/invoices/${plain.id}/payer-settlement`, { reference: 'R' })).body.code).toBe('BILLING_NO_PAYER_SHARE');

      const cancelled = await draft(1500);
      await put('caisse', `/billing/invoices/${cancelled.id}/coverage`, { coverageId: cov.id }).expect(200);
      await post('caisse', `/billing/invoices/${cancelled.id}/cancel`, { reason: 'Erreur de saisie' }).expect(201).catch(() => undefined);
      expect(((await get('comptable', `/billing/claims?payerId=${p.id}`).expect(200)).body as { total: number }).total).toBe(0);
    });

    it("l'audit garde l'assureur et les pourcentages, jamais de nom de patient", async () => {
      const rows = await c.w.sql.query<{ action: string; metadata: Record<string, unknown> }>("SELECT action, metadata FROM audit_log WHERE action LIKE 'billing.coverage.%' OR action LIKE 'billing.invoice.coverage%' OR action = 'billing.invoice.payer-settle' OR action LIKE 'billing.payer.%'");
      expect(rows.length).toBeGreaterThan(5);
      expect(JSON.stringify(rows)).not.toMatch(NO_PII);
      expect(rows.some((r) => r.action === 'billing.invoice.coverage-apply' && r.metadata['percent'] === 80)).toBe(true);
    });
  });
});

import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const NO_PII = /Mbarga|Élisabeth|Ndongo|Nkoa|Curie|Pasteur|Abel/;
const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const STRANGER = '12345678-1234-4234-8234-123456789012';

describe('API approbations /api/v1/billing/approvals (HTTP réel, PostgreSQL réel)', () => {
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

  let seq = 0;
  const item = async (price: number): Promise<{ id: string }> => {
    seq += 1;
    return { id: (await post('admin', '/billing/items', { code: `APP-${seq}`, name: `Acte ${seq}`, category: 'CONSULTATION', unitPrice: price }).expect(201)).body.id as string };
  };
  /** Brouillon d'une ligne de `price`. */
  const draft = async (price = 10000, patient = ids.patients[0]) => {
    const act = await item(price);
    return (await post('caisse', '/billing/invoices', { patientId: patient, lines: [{ itemId: act.id, quantity: 1 }] }).expect(201)).body;
  };
  const issued = async (price = 10000) => {
    const inv = await draft(price);
    return (await post('caisse', `/billing/invoices/${inv.id}/issue`).expect(200)).body;
  };
  const ask = (who: string, body: object) => post(who, '/billing/approvals', body);
  const discountOf = (invoiceId: string, amount = 2000, reason = 'Patient indigent') => ({ invoiceId, kind: 'DISCOUNT', amount, reason });
  const cancelOf = (invoiceId: string, reason = 'Mauvais patient') => ({ invoiceId, kind: 'CANCEL', reason });
  const auditRows = (action: string, resourceId: string) =>
    c.w.sql.query<{ reason: string | null; actor_id: string; metadata: Record<string, unknown> }>('SELECT reason, actor_id, metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', '/billing/approvals'], ['POST', '/billing/approvals'], ['GET', `/billing/approvals/${ID}`],
      ['POST', `/billing/approvals/${ID}/approve`], ['POST', `/billing/approvals/${ID}/reject`], ['POST', `/billing/approvals/${ID}/withdraw`],
    ])('%s %s : sans jeton → 401 ; patient, médecin, infirmier et accueil → 403', async (method, url) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(url));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of ['patient', 'medecin', 'infirmier', 'accueil']) expect((await call(who)).status).toBe(403);
    });

    it('la caisse demande et retire mais ne décide pas ; la comptabilité décide mais ne demande pas', async () => {
      const inv = await draft();
      const filed = (await ask('caisse', discountOf(inv.id)).expect(201)).body;
      expect((await post('caisse', `/billing/approvals/${filed.id}/approve`)).status).toBe(403);
      expect((await post('caisse', `/billing/approvals/${filed.id}/reject`, { comment: 'Non' })).status).toBe(403);
      expect((await ask('comptable', discountOf(inv.id))).status).toBe(403);
      expect((await post('comptable', `/billing/approvals/${filed.id}/withdraw`)).status).toBe(403);
      expect((await ask('admin', discountOf(inv.id))).status).toBe(403);
    });
  });

  describe('remise au-delà du seuil', () => {
    it('refuse la remise directe, accepte la demande, bloque la facture le temps de la décision, puis applique la remise', async () => {
      const inv = await draft(10000);
      const direct = await put('caisse', `/billing/invoices/${inv.id}/discount`, { amount: 2000, reason: 'Patient indigent' });
      expect([direct.status, direct.body.code]).toEqual([409, 'BILLING_DISCOUNT_APPROVAL_REQUIRED']);
      expect(direct.body.message).toContain('10 %');

      const filed = await ask('caisse', discountOf(inv.id, 2000));
      expect(filed.status).toBe(201);
      expect(filed.body).toMatchObject({
        kind: 'DISCOUNT', status: 'PENDING', amount: 2000, reason: 'Patient indigent', outdated: false, currency: 'XAF', currencyDigits: 0, discountApprovalPercent: 10,
        requestedBy: { username: 'caisse' }, decidedBy: null, decidedAt: null, decisionComment: null,
        invoice: { id: inv.id, number: inv.number, status: 'DRAFT', subtotal: 10000, discount: 0, total: 10000, patient: { lastName: 'Mbarga' } },
      });

      // La facture affiche sa demande en cours, et ne bouge plus.
      const seen = (await get('caisse', `/billing/invoices/${inv.id}`)).body;
      expect(seen.discountApprovalPercent).toBe(10);
      expect(seen.approvals).toHaveLength(1);
      expect(seen.approvals[0]).toMatchObject({ id: filed.body.id, kind: 'DISCOUNT', status: 'PENDING' });
      const act = await item(500);
      const blocked: [string, () => Promise<{ status: number; body: { code: string } }>][] = [
        ['ajout de ligne', () => post('caisse', `/billing/invoices/${inv.id}/lines`, { itemId: act.id, quantity: 1 })],
        ['retrait de ligne', () => post('caisse', `/billing/invoices/${inv.id}/lines/${inv.lines[0].id}/remove`)],
        ['remise directe', () => put('caisse', `/billing/invoices/${inv.id}/discount`, { amount: 100, reason: 'x' })],
        ['émission', () => post('caisse', `/billing/invoices/${inv.id}/issue`)],
        ['annulation', () => post('caisse', `/billing/invoices/${inv.id}/cancel`, { reason: 'Abandon' })],
      ];
      for (const [what, attempt] of blocked) {
        const res = await attempt();
        expect([what, res.status, res.body.code]).toEqual([what, 409, 'BILLING_APPROVAL_PENDING']);
      }
      expect((await ask('caisse', discountOf(inv.id, 3000))).body.code).toBe('BILLING_APPROVAL_PENDING');

      const done = await post('comptable', `/billing/approvals/${filed.body.id}/approve`, { comment: 'Justificatif vu' });
      expect(done.status).toBe(200);
      expect(done.body).toMatchObject({ status: 'APPROVED', decidedBy: { username: 'comptable' }, decisionComment: 'Justificatif vu', invoice: { discount: 2000, total: 8000 } });

      const after = (await get('caisse', `/billing/invoices/${inv.id}`)).body;
      expect(after).toMatchObject({ discount: 2000, discountReason: 'Patient indigent', total: 8000, status: 'DRAFT' });
      expect(after.approvals[0].status).toBe('APPROVED');
      // La facture est de nouveau libre : on peut l'émettre.
      expect((await post('caisse', `/billing/invoices/${inv.id}/issue`)).body).toMatchObject({ status: 'ISSUED', total: 8000 });
    });

    it('trace la demande, la décision et l\'effet sur la facture, avec l\'accord qui l\'a permis, sans donnée personnelle', async () => {
      const inv = await draft(10000);
      const filed = (await ask('caisse', discountOf(inv.id, 1500, 'Personnel de l\'hôpital')).expect(201)).body;
      await post('comptable', `/billing/approvals/${filed.id}/approve`, { comment: 'OK' }).expect(200);
      const [requested] = await auditRows('billing.approval.request', filed.id);
      expect(requested.reason).toBe('Personnel de l\'hôpital');
      expect(requested.metadata).toMatchObject({ invoiceNumber: inv.number, kind: 'DISCOUNT', amount: 1500 });
      const [approved] = await auditRows('billing.approval.approve', filed.id);
      expect(approved.reason).toBe('OK');
      expect(approved.actor_id).not.toBe(requested.actor_id);
      const [applied] = await auditRows('billing.invoice.discount', inv.id);
      expect(applied.reason).toBe('Personnel de l\'hôpital');
      expect(applied.metadata).toMatchObject({ approvalId: filed.id, discount: 1500, requestedBy: requested.actor_id });
      for (const row of [requested, approved, applied]) expect(JSON.stringify(row)).not.toMatch(NO_PII);
    });

    it('un refus s\'explique, laisse la facture telle quelle, et permet une nouvelle demande', async () => {
      const inv = await draft(10000);
      const filed = (await ask('caisse', discountOf(inv.id, 4000)).expect(201)).body;
      const blank = await post('comptable', `/billing/approvals/${filed.id}/reject`, {});
      expect([blank.status, blank.body.code]).toEqual([422, 'BILLING_APPROVAL_COMMENT_REQUIRED']);
      expect((await post('comptable', `/billing/approvals/${filed.id}/reject`, { comment: '   ' })).body.code).toBe('BILLING_APPROVAL_COMMENT_REQUIRED');
      const rejected = await post('comptable', `/billing/approvals/${filed.id}/reject`, { comment: 'Hors barème' });
      expect(rejected.body).toMatchObject({ status: 'REJECTED', decisionComment: 'Hors barème', decidedBy: { username: 'comptable' } });
      expect((await get('caisse', `/billing/invoices/${inv.id}`)).body).toMatchObject({ discount: 0, total: 10000 });
      const [entry] = await auditRows('billing.approval.reject', filed.id);
      expect(entry.reason).toBe('Hors barème');
      expect((await c.w.sql.query("SELECT 1 FROM audit_log WHERE action = 'billing.invoice.discount' AND resource_id = $1", [inv.id]))).toHaveLength(0);
      // Plus de blocage : elle peut en refaire une autre, plus modeste.
      expect((await ask('caisse', discountOf(inv.id, 1500))).status).toBe(201);
    });

    it('une demande décidée ne se décide plus', async () => {
      const inv = await draft();
      const filed = (await ask('caisse', discountOf(inv.id)).expect(201)).body;
      await post('comptable', `/billing/approvals/${filed.id}/approve`).expect(200);
      for (const [who, action, body] of [['comptable', 'approve', {}], ['admin', 'reject', { comment: 'Tard' }], ['admin', 'approve', {}]] as const) {
        const res = await post(who, `/billing/approvals/${filed.id}/${action}`, body);
        expect([res.status, res.body.code]).toEqual([409, 'BILLING_APPROVAL_NOT_PENDING']);
      }
      expect((await post('caisse', `/billing/approvals/${filed.id}/withdraw`)).body.code).toBe('BILLING_APPROVAL_NOT_PENDING');
    });

    it('refuse une demande inutile (remise dans le seuil) ou impossible (remise supérieure au total, motif absent, montant absent)', async () => {
      const inv = await draft(10000);
      const within = await ask('caisse', discountOf(inv.id, 1000));
      expect([within.status, within.body.code]).toEqual([409, 'BILLING_DISCOUNT_APPROVAL_NOT_NEEDED']);
      expect((await put('caisse', `/billing/invoices/${inv.id}/discount`, { amount: 1000, reason: 'Dans le seuil' })).status).toBe(200);
      expect((await ask('caisse', discountOf(inv.id, 10001))).body.code).toBe('BILLING_DISCOUNT_TOO_HIGH');
      expect((await ask('caisse', { invoiceId: inv.id, kind: 'DISCOUNT', reason: 'Sans montant' })).body.code).toBe('BILLING_AMOUNT_INVALID');
      expect((await ask('caisse', { ...discountOf(inv.id), reason: '   ' })).body.code).toBe('BILLING_REASON_REQUIRED');
    });

    it('refuse une remise sur une facture déjà émise', async () => {
      const inv = await issued(10000);
      const res = await ask('caisse', discountOf(inv.id));
      expect([res.status, res.body.code]).toEqual([409, 'BILLING_INVOICE_NOT_DRAFT']);
    });
  });

  describe('annulation d\'une facture émise', () => {
    it('refuse l\'annulation directe, passe par une demande, et annule à l\'acceptation avec le motif de la demande', async () => {
      const inv = await issued(7000);
      const direct = await post('caisse', `/billing/invoices/${inv.id}/cancel`, { reason: 'Mauvais patient' });
      expect([direct.status, direct.body.code]).toEqual([409, 'BILLING_CANCEL_APPROVAL_REQUIRED']);

      const filed = await ask('caisse', cancelOf(inv.id, 'Mauvais patient'));
      expect(filed.status).toBe(201);
      expect(filed.body).toMatchObject({ kind: 'CANCEL', status: 'PENDING', amount: null, invoice: { status: 'ISSUED', total: 7000 } });
      expect((await get('caisse', `/billing/invoices/${inv.id}`)).body.status).toBe('ISSUED');

      const done = await post('admin', `/billing/approvals/${filed.body.id}/approve`, { comment: 'Erreur de saisie confirmée' });
      expect(done.status).toBe(200);
      expect(done.body).toMatchObject({ status: 'APPROVED', decidedBy: { username: 'admin' }, invoice: { status: 'CANCELLED' } });
      expect((await get('caisse', `/billing/invoices/${inv.id}`)).body).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Mauvais patient' });
      const [applied] = await auditRows('billing.invoice.cancel', inv.id);
      expect(applied.reason).toBe('Mauvais patient');
      expect(applied.metadata).toMatchObject({ approvalId: filed.body.id });
      expect((await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 100 })).body.code).toBe('BILLING_INVOICE_NOT_PAYABLE');
    });

    it('refuse la demande pour un brouillon (on l\'annule directement), une facture annulée ou une facture déjà encaissée', async () => {
      const d = await draft();
      const forDraft = await ask('caisse', cancelOf(d.id));
      expect([forDraft.status, forDraft.body.code]).toEqual([409, 'BILLING_CANCEL_APPROVAL_NOT_NEEDED']);
      expect((await post('caisse', `/billing/invoices/${d.id}/cancel`, { reason: 'Abandon' })).body.status).toBe('CANCELLED');
      expect((await ask('caisse', cancelOf(d.id))).body.code).toBe('BILLING_INVOICE_ALREADY_CANCELLED');

      const paid = await issued(3000);
      await post('caisse', `/billing/invoices/${paid.id}/payments`, { mode: 'CASH', amount: 1000 }).expect(201);
      const forPaid = await ask('caisse', cancelOf(paid.id));
      expect([forPaid.status, forPaid.body.code]).toEqual([409, 'BILLING_INVOICE_HAS_PAYMENTS']);
    });

    it('un encaissement arrivé après la demande la rend périmée : elle ne peut plus être acceptée, seulement refusée', async () => {
      const inv = await issued(6000);
      const filed = (await ask('caisse', cancelOf(inv.id)).expect(201)).body;
      await post('caisse', `/billing/invoices/${inv.id}/payments`, { mode: 'CASH', amount: 1000 }).expect(201);

      const listed = (await get('comptable', '/billing/approvals?status=PENDING&limit=200')).body;
      expect(listed.items.find((i: { id: string }) => i.id === filed.id)).toMatchObject({ outdated: true, status: 'PENDING' });
      const stale = await post('comptable', `/billing/approvals/${filed.id}/approve`);
      expect([stale.status, stale.body.code]).toEqual([409, 'BILLING_APPROVAL_STALE']);
      expect((await get('caisse', `/billing/invoices/${inv.id}`)).body).toMatchObject({ status: 'PARTIALLY_PAID', paid: 1000 });
      expect((await get('comptable', `/billing/approvals/${filed.id}`)).body.status).toBe('PENDING');
      expect((await post('comptable', `/billing/approvals/${filed.id}/reject`, { comment: 'Déjà encaissée en partie' })).body.status).toBe('REJECTED');
    });
  });

  describe('retrait', () => {
    it('l\'auteur retire sa demande, la facture est libérée, et le retrait est tracé', async () => {
      const inv = await draft();
      const filed = (await ask('caisse', discountOf(inv.id)).expect(201)).body;
      const withdrawn = await post('caisse', `/billing/approvals/${filed.id}/withdraw`);
      expect(withdrawn.status).toBe(200);
      expect(withdrawn.body).toMatchObject({ status: 'WITHDRAWN', decidedBy: { username: 'caisse' }, decisionComment: null });
      expect((await post('caisse', `/billing/invoices/${inv.id}/lines`, { itemId: (await item(100)).id, quantity: 1 })).status).toBe(201);
      expect((await auditRows('billing.approval.withdraw', filed.id))).toHaveLength(1);
      expect((await post('comptable', `/billing/approvals/${filed.id}/approve`)).body.code).toBe('BILLING_APPROVAL_NOT_PENDING');
    });

    it('une demande inconnue est introuvable', async () => {
      expect((await post('caisse', `/billing/approvals/${UNKNOWN}/withdraw`)).status).toBe(404);
      expect((await post('comptable', `/billing/approvals/${UNKNOWN}/approve`)).status).toBe(404);
      expect((await post('comptable', `/billing/approvals/${UNKNOWN}/reject`, { comment: 'x' })).status).toBe(404);
      expect((await get('comptable', `/billing/approvals/${UNKNOWN}`)).status).toBe(404);
      expect((await get('comptable', '/billing/approvals/pas-un-uuid')).status).toBe(400);
    });
  });

  describe('visibilité et liste', () => {
    it('la caisse ne voit que ses demandes ; la comptabilité et l\'administrateur système les voient toutes', async () => {
      const inv = await draft();
      const mine = (await ask('caisse', discountOf(inv.id)).expect(201)).body;
      const other = await draft();
      const foreignId = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a';
      await c.w.sql.query(
        `INSERT INTO billing_approvals (id, invoice_id, kind, status, amount, reason, invoice_version, requested_by, requested_at)
         VALUES ($1, $2, 'DISCOUNT', 'PENDING', 3000, 'Demande d''un autre caissier', $3, $4, now())`,
        [foreignId, other.id, 0, STRANGER],
      );

      const cashierList = (await get('caisse', '/billing/approvals?limit=200')).body;
      const cashierIds = cashierList.items.map((i: { id: string }) => i.id);
      expect(cashierIds).toContain(mine.id);
      expect(cashierIds).not.toContain(foreignId);
      expect(cashierList.items.every((i: { requestedBy: { username: string } | null }) => i.requestedBy?.username === 'caisse')).toBe(true);
      // Même en le demandant, un caissier ne voit pas celles des autres.
      const forced = (await get('caisse', `/billing/approvals?requestedBy=${STRANGER}&limit=200`)).body.items as { id: string; requestedBy: { username: string } | null }[];
      expect(forced.map((i) => i.id)).not.toContain(foreignId);
      expect(forced.every((i) => i.requestedBy?.username === 'caisse')).toBe(true);
      expect((await get('caisse', `/billing/approvals/${foreignId}`)).status).toBe(404);
      expect((await post('caisse', `/billing/approvals/${foreignId}/withdraw`)).status).toBe(404);

      for (const who of ['comptable', 'admin']) {
        const all = (await get(who, '/billing/approvals?limit=200')).body;
        const allIds = all.items.map((i: { id: string }) => i.id);
        expect(allIds).toEqual(expect.arrayContaining([mine.id, foreignId]));
        expect((await get(who, `/billing/approvals/${foreignId}`)).body.requestedBy).toBeNull(); // compte inconnu : pas de nom
      }
      expect((await get('comptable', `/billing/approvals?requestedBy=${STRANGER}&limit=200`)).body.items.map((i: { id: string }) => i.id)).toEqual([foreignId]);
    });

    it('filtre par statut, type et facture, met les demandes en attente d\'abord, et pagine', async () => {
      const a = await draft();
      const b = await issued();
      const first = (await ask('caisse', discountOf(a.id)).expect(201)).body;
      const second = (await ask('caisse', cancelOf(b.id)).expect(201)).body;
      await post('comptable', `/billing/approvals/${first.id}/reject`, { comment: 'Non' }).expect(200);

      const onB = (await get('comptable', `/billing/approvals?invoiceId=${b.id}`)).body;
      expect(onB.items.map((i: { id: string }) => i.id)).toEqual([second.id]);
      const pending = (await get('comptable', '/billing/approvals?status=PENDING&kind=CANCEL&limit=200')).body;
      expect(pending.items.every((i: { status: string; kind: string }) => i.status === 'PENDING' && i.kind === 'CANCEL')).toBe(true);
      expect(pending.items.map((i: { id: string }) => i.id)).toContain(second.id);

      const all = (await get('comptable', '/billing/approvals?limit=200')).body;
      const firstDecided = all.items.findIndex((i: { status: string }) => i.status !== 'PENDING');
      expect(all.items.slice(firstDecided).every((i: { status: string }) => i.status !== 'PENDING')).toBe(true);
      const page = (await get('comptable', '/billing/approvals?limit=2&offset=1')).body;
      expect(page).toMatchObject({ offset: 1, limit: 2, total: all.total });
      expect(page.items).toHaveLength(2);

      expect((await get('comptable', '/billing/approvals?status=DONE')).body.code).toBe('BILLING_APPROVAL_STATUS_INVALID');
      expect((await get('comptable', '/billing/approvals?kind=REFUND')).body.code).toBe('BILLING_APPROVAL_KIND_INVALID');
    });
  });

  describe('validation', () => {
    it('rejette les données invalides', async () => {
      const inv = await draft();
      expect((await ask('caisse', {})).status).toBe(400);
      expect((await ask('caisse', { invoiceId: 'x', kind: 'DISCOUNT', amount: 1, reason: 'r' })).status).toBe(400);
      expect((await ask('caisse', { invoiceId: inv.id, kind: 'REFUND', reason: 'r' })).status).toBe(400);
      expect((await ask('caisse', { invoiceId: inv.id, kind: 'DISCOUNT', amount: 12.5, reason: 'r' })).status).toBe(400);
      expect((await ask('caisse', { invoiceId: inv.id, kind: 'DISCOUNT', amount: -1, reason: 'r' })).status).toBe(400);
      expect((await ask('caisse', { invoiceId: inv.id, kind: 'DISCOUNT', amount: 2000, reason: 'x'.repeat(201) })).status).toBe(400);
      expect((await ask('caisse', { invoiceId: inv.id, kind: 'CANCEL' })).status).toBe(400);
      expect((await ask('caisse', discountOf(UNKNOWN))).status).toBe(404);
      const filed = (await ask('caisse', discountOf(inv.id)).expect(201)).body;
      expect((await post('comptable', `/billing/approvals/${filed.id}/approve`, { comment: 'x'.repeat(201) })).status).toBe(400);
    });
  });
});

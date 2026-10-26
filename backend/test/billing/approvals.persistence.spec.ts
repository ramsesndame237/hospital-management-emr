import { PGlite } from '@electric-sql/pglite';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { ApprovalId, ApprovalKind, ApprovalRequest, ApprovalStatus } from '../../src/modules/billing/domain/approval';
import { BillableItem } from '../../src/modules/billing/domain/item';
import { Invoice, Payment } from '../../src/modules/billing/domain/invoice';
import { Amount, Currency, InvoiceId, InvoiceStatus, ItemCategory, ItemCode, ItemId, ItemName, LineId, PatientRef, PaymentId, PaymentMode, Quantity, Reason } from '../../src/modules/billing/domain/values';
import { PgApprovalRepository } from '../../src/modules/billing/infrastructure/persistence/pg-approval.repository';
import { PgInvoiceRepository } from '../../src/modules/billing/infrastructure/persistence/pg-invoice.repository';
import { PgItemRepository } from '../../src/modules/billing/infrastructure/persistence/pg-item.repository';
import { DomainError, err, ok } from '../../src/shared-kernel/result';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, MIGRATIONS, seedFixture, uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const XAF = must(Currency.create('XAF'));
const CASHIER = uuid(11);
const SUPERVISOR = uuid(12);
const reason = (text = 'Patient indigent') => must(Reason.create(text));
const REFUSED = new DomainError('TEST_REFUSED', 'refusée par la règle');
const STALE = new DomainError('BILLING_APPROVAL_STALE', 'périmée');

describe('schéma du circuit d\'approbation sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let approvals: PgApprovalRepository;
  let invoices: PgInvoiceRepository;
  let items: PgItemRepository;
  let seq = 0;

  /** Un brouillon d'une ligne de `price`, enregistré. */
  const draft = async (price = 10000): Promise<Invoice> => {
    seq += 1;
    const item = BillableItem.create({ id: must(ItemId.create(uuid(6000 + seq))), code: must(ItemCode.create(`ACT${seq}`)), name: must(ItemName.create('Acte')), category: ItemCategory.CONSULTATION, unitPrice: must(Amount.create(price)), serviceId: null });
    await items.insert(item);
    const inv = Invoice.draft({ id: must(InvoiceId.create(uuid(7000 + seq))), number: await invoices.nextInvoiceNumber(), patientId: must(PatientRef.create(f.patient1)), currency: XAF, note: null, createdBy: CASHIER });
    must(inv.addLine({ id: must(LineId.create(uuid(8000 + seq))), itemId: item.id, itemCode: item.state.code, itemName: item.state.name, unitPrice: item.state.unitPrice, quantity: must(Quantity.create(1)) }));
    await invoices.insert(inv);
    return (await invoices.findById(inv.id))!;
  };

  const issued = async (price = 10000): Promise<Invoice> => {
    const inv = await draft(price);
    must(inv.issue(NOW));
    expect(await invoices.save(inv)).toBe('SAVED');
    return (await invoices.findById(inv.id))!;
  };

  const request = (inv: Invoice, kind: ApprovalKind, over: Partial<{ amount: number; by: string; at: Temporal.Instant; text: string }> = {}): ApprovalRequest => {
    seq += 1;
    return must(ApprovalRequest.request({
      id: must(ApprovalId.create(uuid(9000 + seq))), invoiceId: inv.id, kind, amount: kind === ApprovalKind.DISCOUNT ? must(Amount.create(over.amount ?? 2000)) : null, reason: reason(over.text),
      invoiceVersion: inv.state.version, requestedBy: over.by ?? CASHIER, requestedAt: over.at ?? NOW,
    }));
  };

  /** Crée la demande et la relit. */
  const filed = async (inv: Invoice, kind: ApprovalKind, over: Parameters<typeof request>[2] = {}) => {
    const r = request(inv, kind, over);
    expect(await approvals.create(r)).toBe('CREATED');
    return r;
  };

  const approve = (id: ApprovalId, by = SUPERVISOR) => approvals.decide(id, (r, inv) => {
    const decided = r.decide(by, true, null, NOW);
    if (!decided.ok) return err(decided.error);
    const s = r.state;
    const applied = s.kind === ApprovalKind.DISCOUNT ? inv.setDiscount(s.amount!, s.reason) : inv.cancel(s.reason);
    return applied.ok ? ok(true) : err(applied.error);
  });

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    approvals = new PgApprovalRepository(sql);
    invoices = new PgInvoiceRepository(sql);
    items = new PgItemRepository(sql);
    seq = 0;
  });
  afterEach(() => db.close());

  describe('droits', () => {
    it('est idempotent et répartit les droits : la caisse demande, la comptabilité et l\'administrateur système décident', async () => {
      const r = await filed(await draft(), ApprovalKind.DISCOUNT);
      for (const ddl of MIGRATIONS) await db.exec(ddl);
      expect((await approvals.list({}, 0, 10)).total).toBe(1);
      expect((await approvals.findById(r.id))?.request.status).toBe(ApprovalStatus.PENDING);
      const roles = new Map((await new PgRoleRepository(sql).findAll()).map((role) => [role.code.value, new Set(role.permissions.map((p) => p.value))]));
      const holders = (p: string) => [...roles].filter(([, s]) => s.has(p)).map(([c]) => c).sort();
      expect(holders('billing.approvals:request:all')).toEqual(['CASHIER']);
      expect(holders('billing.approvals:read:own')).toEqual(['CASHIER']);
      expect(holders('billing.approvals:read:all')).toEqual(['ACCOUNTANT', 'SYSTEM_ADMIN']);
      expect(holders('billing.approvals:decide:all')).toEqual(['ACCOUNTANT', 'SYSTEM_ADMIN']);
    });
  });

  describe('enregistrement', () => {
    it('relit la demande avec sa facture telle qu\'elle est maintenant', async () => {
      const inv = await draft(10000);
      const r = await filed(inv, ApprovalKind.DISCOUNT, { amount: 2500, text: 'Personnel de l\'hôpital' });
      const found = (await approvals.findById(r.id))!;
      expect(found.request.state).toMatchObject({ kind: ApprovalKind.DISCOUNT, status: ApprovalStatus.PENDING, requestedBy: CASHIER, invoiceVersion: inv.state.version, decidedBy: null, decisionComment: null });
      expect(found.request.state.amount?.value).toBe(2500);
      expect(found.request.state.reason.value).toBe('Personnel de l\'hôpital');
      expect(found.request.state.requestedAt.toString()).toBe(NOW.toString());
      expect(found.invoice).toEqual({ id: inv.id.value, number: inv.state.number.value, patientId: f.patient1, status: InvoiceStatus.DRAFT, currency: 'XAF', subtotal: 10000, discount: 0, version: inv.state.version });
      expect(await approvals.findById(must(ApprovalId.create(uuid(99999))))).toBeNull();
    });

    it('n\'accepte qu\'une demande en attente par facture, quel que soit son type', async () => {
      const inv = await issued();
      await filed(inv, ApprovalKind.CANCEL);
      expect(await approvals.hasPending(inv.id)).toBe(true);
      expect(await approvals.create(request(inv, ApprovalKind.CANCEL))).toBe('ALREADY_PENDING');
      expect(await approvals.create(request(inv, ApprovalKind.DISCOUNT))).toBe('ALREADY_PENDING');
    });

    it('en accepte une nouvelle une fois la précédente décidée ou retirée', async () => {
      const inv = await draft();
      const first = await filed(inv, ApprovalKind.DISCOUNT);
      expect(must(await approvals.mutate(first.id, (r) => r.decide(SUPERVISOR, false, 'Hors barème', NOW))).request.status).toBe(ApprovalStatus.REJECTED);
      expect(await approvals.hasPending(inv.id)).toBe(false);
      const second = await filed(inv, ApprovalKind.DISCOUNT);
      expect(must(await approvals.mutate(second.id, (r) => r.withdraw(CASHIER, NOW))).request.status).toBe(ApprovalStatus.WITHDRAWN);
      await filed(inv, ApprovalKind.DISCOUNT);
      expect((await approvals.list({ invoiceId: inv.id }, 0, 10)).total).toBe(3);
    });

    it('refuse (INVOICE_CHANGED) une demande lue sur une version dépassée de la facture, ou sur une facture inconnue', async () => {
      const inv = await draft();
      const stale = request(inv, ApprovalKind.DISCOUNT);
      must(inv.setDiscount(must(Amount.create(100)), reason('Geste')));
      expect(await invoices.save(inv)).toBe('SAVED');
      expect(await approvals.create(stale)).toBe('INVOICE_CHANGED');
      expect((await approvals.list({}, 0, 10)).total).toBe(0);
      const ghost = Invoice.draft({ id: must(InvoiceId.create(uuid(55555))), number: await invoices.nextInvoiceNumber(), patientId: must(PatientRef.create(f.patient1)), currency: XAF, note: null, createdBy: CASHIER });
      expect(await approvals.create(request(ghost, ApprovalKind.CANCEL))).toBe('INVOICE_CHANGED');
    });

    it('deux demandes simultanées sur la même facture : une seule est enregistrée', async () => {
      const inv = await draft();
      const outcomes = await Promise.all([approvals.create(request(inv, ApprovalKind.DISCOUNT)), approvals.create(request(inv, ApprovalKind.DISCOUNT, { by: uuid(13) }))]);
      expect([...outcomes].sort()).toEqual(['ALREADY_PENDING', 'CREATED']);
      expect((await approvals.list({ invoiceId: inv.id, status: ApprovalStatus.PENDING }, 0, 10)).total).toBe(1);
    });
  });

  describe('décision', () => {
    it('accepter une remise l\'applique à la facture dans la même transaction', async () => {
      const inv = await draft(10000);
      const r = await filed(inv, ApprovalKind.DISCOUNT, { amount: 2000, text: 'Indigent' });
      const done = must(await approve(r.id));
      expect(done.request.state).toMatchObject({ status: ApprovalStatus.APPROVED, decidedBy: SUPERVISOR });
      expect(done.request.state.decidedAt?.toString()).toBe(NOW.toString());
      const after = (await invoices.findById(inv.id))!;
      expect(after.state.discount.value).toBe(2000);
      expect(after.state.discountReason?.value).toBe('Indigent');
      expect(after.total.value).toBe(8000);
      expect(after.state.version).toBe(inv.state.version + 1);
      expect(done.invoice).toMatchObject({ discount: 2000, version: inv.state.version + 1 });
    });

    it('accepter une annulation annule la facture émise, avec le motif de la demande', async () => {
      const inv = await issued(5000);
      const r = await filed(inv, ApprovalKind.CANCEL, { text: 'Mauvais patient' });
      must(await approve(r.id));
      const after = (await invoices.findById(inv.id))!;
      expect(after.status).toBe(InvoiceStatus.CANCELLED);
      expect(after.state.cancellationReason?.value).toBe('Mauvais patient');
    });

    it('refuser ne touche pas la facture', async () => {
      const inv = await draft();
      const r = await filed(inv, ApprovalKind.DISCOUNT);
      const done = must(await approvals.decide(r.id, (req) => {
        const decided = req.decide(SUPERVISOR, false, 'Non justifié', NOW);
        return decided.ok ? ok(false) : err(decided.error);
      }));
      expect(done.request.state).toMatchObject({ status: ApprovalStatus.REJECTED, decisionComment: 'Non justifié' });
      const after = (await invoices.findById(inv.id))!;
      expect(after.state.discount.value).toBe(0);
      expect(after.state.version).toBe(inv.state.version);
    });

    it('si la règle refuse, rien n\'est écrit : ni la décision, ni la facture', async () => {
      const inv = await draft();
      const r = await filed(inv, ApprovalKind.DISCOUNT);
      const refused = await approvals.decide(r.id, (req, invoice) => {
        req.decide(SUPERVISOR, true, null, NOW);
        must(invoice.setDiscount(must(Amount.create(2000)), reason()));
        return err(REFUSED);
      });
      expect(refused && refused.ok).toBe(false);
      expect((await approvals.findById(r.id))!.request.status).toBe(ApprovalStatus.PENDING);
      expect((await invoices.findById(inv.id))!.state.discount.value).toBe(0);
      const self = await approve(r.id, CASHIER);
      expect(self && !self.ok && self.error.code).toBe('BILLING_APPROVAL_SELF');
      expect((await approvals.findById(r.id))!.request.status).toBe(ApprovalStatus.PENDING);
    });

    it('une demande inconnue répond null ; une demande décidée ne se décide plus', async () => {
      expect(await approve(must(ApprovalId.create(uuid(99999))))).toBeNull();
      const r = await filed(await draft(), ApprovalKind.DISCOUNT);
      must(await approve(r.id));
      const again = await approve(r.id, uuid(14));
      expect(again && !again.ok && again.error.code).toBe('BILLING_APPROVAL_NOT_PENDING');
    });

    it('un encaissement arrivé après la demande rend l\'annulation périmée : la facture n\'est pas annulée', async () => {
      const inv = await issued(5000);
      const r = await filed(inv, ApprovalKind.CANCEL);
      const pay: Payment = {
        id: must(PaymentId.create(uuid(40000))), receiptNumber: await invoices.nextReceiptNumber(), mode: PaymentMode.CASH, amount: must(Amount.positive(1000)), reference: null, receivedBy: CASHIER, receivedAt: NOW, sessionId: null,
      };
      expect(await invoices.addPayment(inv, pay)).toBe('SAVED');
      const done = await approvals.decide(r.id, (req, invoice) => (invoice.state.version !== req.state.invoiceVersion ? err(STALE) : ok(true)));
      expect(done && !done.ok && done.error.code).toBe('BILLING_APPROVAL_STALE');
      const after = (await invoices.findById(inv.id))!;
      expect(after.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect((await approvals.findById(r.id))!.request.status).toBe(ApprovalStatus.PENDING);
      expect((await approvals.findById(r.id))!.invoice.version).toBeGreaterThan(r.state.invoiceVersion);
    });

    it('acceptation et encaissement simultanés : une facture encaissée n\'est jamais annulée', async () => {
      const inv = await issued(5000);
      const r = await filed(inv, ApprovalKind.CANCEL);
      const pay: Payment = {
        id: must(PaymentId.create(uuid(40001))), receiptNumber: await invoices.nextReceiptNumber(), mode: PaymentMode.CASH, amount: must(Amount.positive(1000)), reference: null, receivedBy: CASHIER, receivedAt: NOW, sessionId: null,
      };
      const [decision, payment] = await Promise.all([
        approvals.decide(r.id, (req, invoice) => {
          if (invoice.state.version !== req.state.invoiceVersion) return err(STALE);
          const decided = req.decide(SUPERVISOR, true, null, NOW);
          if (!decided.ok) return err(decided.error);
          const cancelled = invoice.cancel(req.state.reason);
          return cancelled.ok ? ok(true) : err(cancelled.error);
        }),
        invoices.addPayment(inv, pay),
      ]);
      const after = (await invoices.findById(inv.id))!;
      expect(after.status === InvoiceStatus.CANCELLED && after.state.payments.length > 0).toBe(false);
      // Exactement l'un des deux a réussi.
      expect([decision?.ok === true, payment === 'SAVED'].filter(Boolean)).toHaveLength(1);
    });
  });

  describe('liste', () => {
    it('met les demandes en attente d\'abord (la plus ancienne en tête), puis les autres de la plus récente à la plus ancienne', async () => {
      const a = await filed(await draft(), ApprovalKind.DISCOUNT, { at: NOW.add({ minutes: 1 }) });
      const b = await filed(await draft(), ApprovalKind.DISCOUNT, { at: NOW.add({ minutes: 2 }) });
      const c = await filed(await draft(), ApprovalKind.DISCOUNT, { at: NOW.add({ minutes: 3 }) });
      const d = await filed(await draft(), ApprovalKind.DISCOUNT, { at: NOW.add({ minutes: 4 }) });
      await approvals.mutate(a.id, (r) => r.decide(SUPERVISOR, false, 'Non', NOW));
      await approvals.mutate(d.id, (r) => r.withdraw(CASHIER, NOW));
      const order = (await approvals.list({}, 0, 10)).items.map((i) => i.request.id.value);
      expect(order).toEqual([b.id.value, c.id.value, d.id.value, a.id.value]);
    });

    it('filtre par auteur, statut, type et facture, pagine, et compte toutes les pages', async () => {
      const i1 = await draft();
      const i2 = await issued();
      await filed(i1, ApprovalKind.DISCOUNT, { by: CASHIER });
      await filed(i2, ApprovalKind.CANCEL, { by: uuid(13) });
      expect((await approvals.list({ requestedBy: CASHIER }, 0, 10)).total).toBe(1);
      expect((await approvals.list({ kind: ApprovalKind.CANCEL }, 0, 10)).items.map((i) => i.invoice.number)).toEqual([i2.state.number.value]);
      expect((await approvals.list({ status: ApprovalStatus.APPROVED }, 0, 10)).total).toBe(0);
      expect((await approvals.list({ invoiceId: i1.id }, 0, 10)).total).toBe(1);
      const page = await approvals.list({}, 1, 1);
      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(2);
    });
  });

  describe('garde-fous de la base', () => {
    const insert = (over: Record<string, unknown> = {}) => {
      seq += 1;
      const row = { id: uuid(20000 + seq), kind: 'DISCOUNT', status: 'PENDING', amount: 1000, reason: 'Motif', decided_by: null, decided_at: null, comment: null, ...over } as Record<string, unknown>;
      return async (invoiceId: string) => sql.query(
        `INSERT INTO billing_approvals (id, invoice_id, kind, status, amount, reason, invoice_version, requested_by, requested_at, decided_by, decided_at, decision_comment)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, now(), $8, $9, $10)`,
        [row.id, invoiceId, row.kind, row.status, row.amount, row.reason, CASHIER, row.decided_by, row.decided_at, row.comment],
      );
    };

    it('refuse des lignes incohérentes : remise sans montant, annulation avec montant, décision sans auteur, refus sans explication, décision sur sa propre demande', async () => {
      const inv = await draft();
      await expect(insert({ amount: null })(inv.id.value)).rejects.toThrow();
      await expect(insert({ kind: 'CANCEL', amount: 500 })(inv.id.value)).rejects.toThrow();
      await expect(insert({ amount: 0 })(inv.id.value)).rejects.toThrow();
      await expect(insert({ status: 'APPROVED', decided_by: SUPERVISOR })(inv.id.value)).rejects.toThrow(); // pas de date de décision
      await expect(insert({ status: 'REJECTED', decided_by: SUPERVISOR, decided_at: '2026-11-02T09:00:00Z' })(inv.id.value)).rejects.toThrow(); // refus sans commentaire
      await expect(insert({ status: 'APPROVED', decided_by: CASHIER, decided_at: '2026-11-02T09:00:00Z' })(inv.id.value)).rejects.toThrow(); // se décide soi-même
      await expect(insert({ status: 'WITHDRAWN', decided_by: SUPERVISOR, decided_at: '2026-11-02T09:00:00Z' })(inv.id.value)).rejects.toThrow(); // retrait par un tiers
      await expect(insert({ status: 'PENDING', decided_by: SUPERVISOR })(inv.id.value)).rejects.toThrow(); // en attente mais décidée
      await expect(insert({ reason: '' })(inv.id.value)).rejects.toThrow();
      await expect(insert({ status: 'DONE' })(inv.id.value)).rejects.toThrow();
      await insert({ status: 'APPROVED', decided_by: SUPERVISOR, decided_at: '2026-11-02T09:00:00Z' })(inv.id.value);
    });

    it('refuse une seconde demande en attente pour la même facture, même en SQL direct', async () => {
      const inv = await draft();
      await insert()(inv.id.value);
      await expect(insert()(inv.id.value)).rejects.toThrow();
    });

    it('ne supprime ni ne vide jamais une demande, et ne modifie plus une demande décidée', async () => {
      const inv = await draft();
      const r = await filed(inv, ApprovalKind.DISCOUNT);
      await expect(sql.query('DELETE FROM billing_approvals WHERE id = $1', [r.id.value])).rejects.toThrow(/ne se supprime pas/);
      await expect(sql.query('TRUNCATE billing_approvals')).rejects.toThrow(/ne se supprime pas/);
      must(await approve(r.id));
      await expect(sql.query("UPDATE billing_approvals SET reason = 'Autre' WHERE id = $1", [r.id.value])).rejects.toThrow(/ne se supprime pas/);
      await expect(sql.query("UPDATE billing_approvals SET status = 'PENDING', decided_by = NULL, decided_at = NULL WHERE id = $1", [r.id.value])).rejects.toThrow(/ne se supprime pas/);
      expect((await approvals.findById(r.id))!.request.status).toBe(ApprovalStatus.APPROVED);
    });
  });
});

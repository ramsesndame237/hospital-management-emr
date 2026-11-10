import { PurchaseOrder, OrderContent } from '../../src/modules/pharmacy/domain/purchase-order';
import { Supplier } from '../../src/modules/pharmacy/domain/supplier';
import { DrugId, Money, PurchaseOrderId, PurchaseOrderNumber, Reason, SupplierCode, SupplierId } from '../../src/modules/pharmacy/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const AUTHOR = 'u-author';
const APPROVER = 'u-approver';
const reason = (text: string) => must(Reason.create(text));
const drug = (n: number) => must(DrugId.create(uuid(n)));

const supplier = (over: Partial<Parameters<typeof Supplier.create>[0]> = {}) =>
  Supplier.create({
    id: must(SupplierId.create(uuid(1))), code: must(SupplierCode.create('PHARMADIS')), name: 'Pharma Distrib', contactName: null, phone: null, email: null, address: null, paymentTermsDays: 30, notes: null, ...over,
  });

describe('Supplier', () => {
  it('se crée active, normalise le code et accepte les coordonnées valides', () => {
    expect(must(SupplierCode.create(' pharma-1 ')).value).toBe('PHARMA-1');
    expect(SupplierCode.create('é!').ok).toBe(false);
    const s = must(supplier({ contactName: 'Mme Ngo', phone: '+237 699 00 00 00', email: 'a@b.cm', address: 'Douala', paymentTermsDays: 0 }));
    expect(s.active).toBe(true);
    expect(s.state).toMatchObject({ contactName: 'Mme Ngo', paymentTermsDays: 0 });
  });

  it.each([
    [{ name: '' }, 'PHARMACY_SUPPLIER_NAME_INVALID'],
    [{ phone: '12' }, 'PHARMACY_SUPPLIER_PHONE_INVALID'],
    [{ email: 'pas-un-mail' }, 'PHARMACY_SUPPLIER_EMAIL_INVALID'],
    [{ paymentTermsDays: -1 }, 'PHARMACY_SUPPLIER_TERMS_INVALID'],
    [{ paymentTermsDays: 366 }, 'PHARMACY_SUPPLIER_TERMS_INVALID'],
    [{ paymentTermsDays: 1.5 }, 'PHARMACY_SUPPLIER_TERMS_INVALID'],
    [{ contactName: 'x'.repeat(101) }, 'PHARMACY_SUPPLIER_CONTACT_INVALID'],
    [{ address: '' }, 'PHARMACY_SUPPLIER_ADDRESS_INVALID'],
  ])('refuse %j', (over, code) => {
    expect(supplier(over as Parameters<typeof supplier>[0])).toMatchObject({ ok: false, error: { code } });
  });

  it('se modifie, efface avec null, et se désactive sans toucher au code', () => {
    const s = must(supplier({ phone: '+237 699 00 00 00' }));
    must(s.update({ name: 'Nouveau nom', phone: null, paymentTermsDays: 45 }));
    expect(s.state).toMatchObject({ name: 'Nouveau nom', phone: null, paymentTermsDays: 45, code: { value: 'PHARMADIS' } });
    expect(s.update({ email: 'mauvais' }).ok).toBe(false);
    expect(s.state.email).toBeNull();
    s.setActive(false);
    expect(s.active).toBe(false);
  });
});

describe('PurchaseOrder', () => {
  const content = (over: Partial<OrderContent> = {}): OrderContent => ({
    supplierId: must(SupplierId.create(uuid(1))), expectedOn: Temporal.PlainDate.from('2026-11-20'), notes: null,
    lines: [{ drugId: drug(10), quantity: 100, unitCost: must(Money.create(10)) }, { drugId: drug(11), quantity: 50, unitCost: must(Money.create(200)) }], ...over,
  });
  const order = (over: Partial<OrderContent> = {}) =>
    must(PurchaseOrder.create({ id: must(PurchaseOrderId.create(uuid(900))), number: must(PurchaseOrderNumber.fromSequence(1)), createdBy: AUTHOR, createdAt: NOW, content: content(over) }));
  /** Un bon approuvé par quelqu'un d'autre que son auteur. */
  const approved = () => {
    const o = order();
    must(o.submit(NOW));
    must(o.approve(APPROVER, LATER));
    return o;
  };
  const got = (entries: [number, number][]) => new Map(entries.map(([n, q]) => [uuid(n), q]));

  it('se crée en brouillon avec sa valeur au coût convenu et rien de reçu', () => {
    const o = order();
    expect(o.status).toBe('DRAFT');
    expect(o.value).toBe(100 * 10 + 50 * 200);
    expect(o.state.lines.map((l) => l.received)).toEqual([0, 0]);
    expect(o.outstanding(drug(10))).toBe(100);
    expect(o.outstanding(drug(99))).toBe(0);
  });

  it('refuse un bon sans ligne, avec trop de lignes, un doublon ou une quantité invalide', () => {
    const base = { id: must(PurchaseOrderId.create(uuid(900))), number: must(PurchaseOrderNumber.fromSequence(1)), createdBy: AUTHOR, createdAt: NOW };
    const create = (lines: OrderContent['lines']) => PurchaseOrder.create({ ...base, content: content({ lines }) });
    const line = (n: number, quantity = 1) => ({ drugId: drug(n), quantity, unitCost: must(Money.create(1)) });
    expect(create([])).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_LINES_INVALID' } });
    expect(create(Array.from({ length: 51 }, (_, i) => line(100 + i)))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_LINES_INVALID' } });
    expect(create([line(10), line(10, 5)])).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_DUPLICATE_DRUG' } });
    for (const quantity of [0, -1, 1.5, 1_000_001]) expect(create([line(10, quantity)])).toMatchObject({ ok: false, error: { code: 'PHARMACY_QUANTITY_INVALID' } });
    expect(PurchaseOrder.create({ ...base, content: content({ notes: 'x'.repeat(301) }) }).ok).toBe(false);
  });

  it('se modifie seulement en brouillon', () => {
    const o = order();
    must(o.edit(content({ notes: 'Urgent', lines: [{ drugId: drug(12), quantity: 5, unitCost: must(Money.create(7)) }] })));
    expect(o.state).toMatchObject({ notes: 'Urgent', lines: [{ quantity: 5, received: 0 }] });
    must(o.submit(NOW));
    expect(o.edit(content())).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_STATE_INVALID' } });
  });

  it('n\'est pas approuvable par son auteur, ni sans avoir été soumis', () => {
    const o = order();
    expect(o.approve(APPROVER, LATER)).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_STATE_INVALID' } });
    must(o.submit(NOW));
    expect(o.approve(AUTHOR, LATER)).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_SELF_APPROVAL' } });
    expect(o.reject(AUTHOR, reason('Non'))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_SELF_APPROVAL' } });
    expect(o.status).toBe('PENDING_APPROVAL');
    must(o.approve(APPROVER, LATER));
    expect(o.state).toMatchObject({ status: 'APPROVED', approvedBy: APPROVER });
    expect(o.approve('u-other', LATER)).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_STATE_INVALID' } });
  });

  it('un refus le renvoie en brouillon avec son motif, effacé à la nouvelle soumission', () => {
    const o = order();
    must(o.submit(NOW));
    must(o.reject(APPROVER, reason('Trop d\'amoxicilline')));
    expect(o.state).toMatchObject({ status: 'DRAFT', rejectionReason: 'Trop d\'amoxicilline', submittedAt: null });
    must(o.edit(content()));
    must(o.submit(LATER));
    expect(o.state).toMatchObject({ status: 'PENDING_APPROVAL', rejectionReason: null });
  });

  it('impute les livraisons : jamais plus que commandé, partielle puis totale', () => {
    const o = approved();
    must(o.receive(got([[10, 60]])));
    expect(o.status).toBe('PARTIALLY_RECEIVED');
    expect(o.outstanding(drug(10))).toBe(40);
    expect(o.receive(got([[10, 41]]))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_OVER_RECEIPT', details: { outstanding: 40 } } });
    expect(o.receive(got([[99, 1]]))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_DRUG_NOT_ORDERED' } });
    expect(o.state.lines[0].received).toBe(60);
    must(o.receive(got([[10, 40], [11, 50]])));
    expect(o.status).toBe('RECEIVED');
    expect(o.receive(got([[10, 1]]))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_NOT_RECEIVABLE' } });
  });

  it('ne reçoit rien tant qu\'il n\'est pas approuvé', () => {
    const o = order();
    expect(o.receive(got([[10, 1]]))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_NOT_RECEIVABLE', details: { status: 'DRAFT' } } });
    must(o.submit(NOW));
    expect(o.receive(got([[10, 1]])).ok).toBe(false);
  });

  it('une livraison refusée en partie ne modifie aucune ligne', () => {
    const o = approved();
    expect(o.receive(got([[10, 10], [11, 51]])).ok).toBe(false);
    expect(o.state.lines.map((l) => l.received)).toEqual([0, 0]);
    expect(o.status).toBe('APPROVED');
  });

  it('s\'annule tant que rien n\'est reçu, avec motif ; après une réception partielle on le clôt', () => {
    const draft = order();
    must(draft.cancel(AUTHOR, NOW, reason('Plus besoin')));
    expect(draft.state).toMatchObject({ status: 'CANCELLED', closedBy: AUTHOR, closedReason: 'Plus besoin' });
    expect(draft.submit(NOW)).toMatchObject({ ok: false });
    expect(draft.cancel(AUTHOR, NOW, reason('Encore'))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_STATE_INVALID' } });

    const o = approved();
    expect(o.close(AUTHOR, NOW, reason('Rien'))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_STATE_INVALID' } });
    must(o.receive(got([[10, 30]])));
    expect(o.cancel(AUTHOR, NOW, reason('Trop tard'))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ORDER_STATE_INVALID' } });
    must(o.close(AUTHOR, LATER, reason('Le fournisseur ne livrera pas le solde')));
    expect(o.state).toMatchObject({ status: 'CLOSED', closedReason: 'Le fournisseur ne livrera pas le solde' });
    expect(o.state.lines[0].received).toBe(30);
  });
});

import { StockAdjustment } from '../../src/modules/pharmacy/domain/adjustment';
import { allocateFefo, Batch, stockLevel } from '../../src/modules/pharmacy/domain/batch';
import { Drug } from '../../src/modules/pharmacy/domain/drug';
import { GoodsReceipt, ReceiptLine } from '../../src/modules/pharmacy/domain/receipt';
import {
  AdjustmentId, AdjustmentNumber, BatchId, BatchNumber, DrugCode, DrugId, DrugName, GenericName, Money, parseExpiry, Quantity, Reason, ReceiptId, ReceiptNumber,
} from '../../src/modules/pharmacy/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { uuid } from '../support/seed-sql';

const TODAY = Temporal.PlainDate.from('2026-11-02');
const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const day = (s: string) => must(parseExpiry(s));
const money = (n: number) => must(Money.create(n));
const code = (s: string) => must(DrugCode.create(s));

const drug = (over: Partial<Parameters<typeof Drug.create>[0]> = {}) =>
  must(Drug.create({
    id: must(DrugId.create(uuid(1))), code: code('PARA500'), name: must(DrugName.create('Doliprane 500')), genericName: must(GenericName.create('Paracétamol')), strength: '500 mg', form: 'TABLET',
    schedule: 'OTC', storage: 'ROOM', atcCode: 'N02BE01', unit: 'comprimé', unitPrice: money(25), reorderLevel: 100, notes: null, ...over,
  }));

let seq = 0;
const batch = (number: string, expiry: string, quantity: number, over: { receivedAt?: string; cost?: number } = {}) => {
  seq += 1;
  return Batch.create({
    id: must(BatchId.create(uuid(100 + seq))), drugId: must(DrugId.create(uuid(1))), batchNumber: must(BatchNumber.create(number)), expiry: day(expiry), quantity, unitCost: money(over.cost ?? 10),
    receivedAt: Temporal.Instant.from(over.receivedAt ?? '2026-10-01T08:00:00Z'),
  });
};

describe('valeurs de la pharmacie', () => {
  it('normalise les codes et refuse ceux qui sont invalides', () => {
    expect(must(DrugCode.create(' para-500 ')).value).toBe('PARA-500');
    expect(DrugCode.create('').ok).toBe(false);
    expect(DrugCode.create('é!').ok).toBe(false);
    expect(must(BatchNumber.create(' ab  12/x ')).value).toBe('AB 12/X');
    expect(BatchNumber.create('').ok).toBe(false);
    expect(BatchNumber.create('-X').ok).toBe(false);
  });

  it('une date de péremption est un vrai jour du calendrier', () => {
    expect(parseExpiry('2027-02-28').ok).toBe(true);
    for (const bad of ['2027-02-30', '28/02/2027', '2027-2-3', '', 'demain']) expect(parseExpiry(bad)).toMatchObject({ ok: false, error: { code: 'PHARMACY_EXPIRY_INVALID' } });
  });

  it('une quantité est un entier positif, un montant un entier sans décimales', () => {
    expect(Quantity.create(1).ok).toBe(true);
    for (const bad of [0, -1, 1.5, 1_000_001, Number.NaN]) expect(Quantity.create(bad).ok).toBe(false);
    expect(Money.create(0).ok).toBe(true);
    for (const bad of [-1, 0.5, Number.NaN, 1e13]) expect(Money.create(bad).ok).toBe(false);
  });
});

describe('Drug', () => {
  it('se crée active et refuse un dosage, un code ATC, une unité ou un seuil invalides', () => {
    expect(drug().active).toBe(true);
    const base = { id: must(DrugId.create(uuid(1))), code: code('X'), name: must(DrugName.create('X')), genericName: must(GenericName.create('X')), form: 'TABLET' as const, schedule: 'OTC' as const, storage: 'ROOM' as const, unitPrice: money(0), notes: null };
    expect(Drug.create({ ...base, strength: null, atcCode: 'N02BE', unit: 'cp', reorderLevel: 0 })).toMatchObject({ ok: false, error: { code: 'PHARMACY_ATC_INVALID' } });
    expect(Drug.create({ ...base, strength: null, atcCode: null, unit: '', reorderLevel: 0 })).toMatchObject({ ok: false, error: { code: 'PHARMACY_UNIT_INVALID' } });
    expect(Drug.create({ ...base, strength: null, atcCode: null, unit: 'cp', reorderLevel: -1 })).toMatchObject({ ok: false, error: { code: 'PHARMACY_REORDER_LEVEL_INVALID' } });
    expect(Drug.create({ ...base, strength: '', atcCode: null, unit: 'cp', reorderLevel: 0 })).toMatchObject({ ok: false, error: { code: 'PHARMACY_STRENGTH_INVALID' } });
  });

  it('se modifie sans toucher au code, efface un champ avec null et se désactive', () => {
    const d = drug();
    expect(d.update({ unitPrice: money(30), strength: null, reorderLevel: 50 }).ok).toBe(true);
    expect(d.state).toMatchObject({ strength: null, reorderLevel: 50, code: { value: 'PARA500' } });
    expect(d.state.unitPrice.value).toBe(30);
    expect(d.update({ atcCode: 'bad' })).toMatchObject({ ok: false });
    expect(d.state.atcCode).toBe('N02BE01');
    d.setActive(false);
    expect(d.active).toBe(false);
  });
});

describe('Batch', () => {
  it('est périmé le lendemain de sa date, la date incluse', () => {
    const b = batch('L1', '2026-11-02', 10);
    expect(b.isExpired(TODAY)).toBe(false);
    expect(b.isExpired(Temporal.PlainDate.from('2026-11-03'))).toBe(true);
    expect(b.isDispensable(TODAY)).toBe(true);
    expect(b.isDispensable(Temporal.PlainDate.from('2026-11-03'))).toBe(false);
  });

  it('une seconde livraison du même lot s\'ajoute et moyenne le coût, à péremption identique', () => {
    const b = batch('L1', '2027-01-01', 10, { cost: 10 });
    const movement = must(b.receive(day('2027-01-01'), 30, money(20), 'GRN-0000001'));
    expect(movement).toEqual({ type: 'RECEIPT', delta: 30, reason: null, reference: 'GRN-0000001' });
    expect(b.state.quantity).toBe(40);
    expect(b.state.unitCost.value).toBe(18); // (10×10 + 30×20) / 40 = 17,5 → 18
  });

  it('refuse une autre péremption pour le même lot, et toute livraison dans un lot en quarantaine', () => {
    const b = batch('L1', '2027-01-01', 10);
    expect(b.receive(day('2027-02-01'), 5, money(1), 'GRN-1')).toMatchObject({ ok: false, error: { code: 'PHARMACY_BATCH_EXPIRY_MISMATCH' } });
    expect(b.state.quantity).toBe(10);
    must(b.quarantine(must(Reason.create('Rappel de lot')), 'u1', NOW));
    expect(b.receive(day('2027-01-01'), 5, money(1), 'GRN-1')).toMatchObject({ ok: false, error: { code: 'PHARMACY_BATCH_QUARANTINED' } });
  });

  it('le coût moyen reste exact avec de très grandes quantités et de très grands coûts', () => {
    const b = batch('L1', '2027-01-01', 900_000, { cost: 900_000_000_000 });
    must(b.receive(day('2027-01-01'), 100_000, money(0), 'GRN-1'));
    expect(b.state.unitCost.value).toBe(810_000_000_000);
  });

  it('un ajustement en sortie ne dépasse pas le stock, une entrée est refusée sur un lot périmé', () => {
    const b = batch('L1', '2026-12-01', 10);
    expect(b.adjust('OUT', 11, TODAY, 'perte', 'ADJ-1')).toMatchObject({ ok: false, error: { code: 'PHARMACY_STOCK_INSUFFICIENT', details: { available: 10 } } });
    expect(must(b.adjust('OUT', 4, TODAY, 'casse', 'ADJ-1'))).toEqual({ type: 'ADJUSTMENT_OUT', delta: -4, reason: 'casse', reference: 'ADJ-1' });
    expect(b.state.quantity).toBe(6);
    expect(must(b.adjust('IN', 2, TODAY, null, 'ADJ-2')).delta).toBe(2);
    const old = batch('L2', '2026-10-01', 5);
    expect(old.adjust('IN', 1, TODAY, null, 'ADJ-3')).toMatchObject({ ok: false, error: { code: 'PHARMACY_BATCH_EXPIRED' } });
    expect(old.adjust('OUT', 5, TODAY, 'périmé', 'ADJ-4').ok).toBe(true);
  });

  it('la quarantaine retire le lot de la délivrance, et se lève', () => {
    const b = batch('L1', '2027-01-01', 10);
    expect(b.release()).toMatchObject({ ok: false, error: { code: 'PHARMACY_BATCH_NOT_QUARANTINED' } });
    must(b.quarantine(must(Reason.create('Doute sur la chaîne du froid')), 'u1', NOW));
    expect(b.isDispensable(TODAY)).toBe(false);
    expect(b.state).toMatchObject({ status: 'QUARANTINED', quarantineReason: 'Doute sur la chaîne du froid', quarantinedBy: 'u1' });
    expect(b.quarantine(must(Reason.create('Encore')), 'u1', NOW)).toMatchObject({ ok: false, error: { code: 'PHARMACY_BATCH_ALREADY_QUARANTINED' } });
    must(b.release());
    expect(b.isDispensable(TODAY)).toBe(true);
    expect(b.state.quarantineReason).toBeNull();
  });
});

describe('FEFO et niveau de stock', () => {
  it('sert d\'abord le lot qui périme le plus tôt, puis le plus ancien reçu, et ignore périmés, quarantaine et lots vides', () => {
    const late = batch('LATE', '2027-06-01', 50);
    const soon = batch('SOON', '2026-12-01', 30);
    const tieOld = batch('TIE-A', '2027-01-01', 20, { receivedAt: '2026-09-01T08:00:00Z' });
    const tieNew = batch('TIE-B', '2027-01-01', 20, { receivedAt: '2026-10-01T08:00:00Z' });
    const expired = batch('OLD', '2026-10-01', 99);
    const held = batch('HELD', '2026-11-20', 99);
    must(held.quarantine(must(Reason.create('Rappel')), 'u1', NOW));
    const empty = batch('EMPTY', '2026-11-10', 0);
    const { allocations, shortfall } = allocateFefo([late, tieNew, expired, held, empty, tieOld, soon], 70, TODAY);
    expect(allocations.map((a) => [a.batchNumber, a.quantity])).toEqual([['SOON', 30], ['TIE-A', 20], ['TIE-B', 20]]);
    expect(shortfall).toBe(0);
  });

  it('dit ce qui manque quand le stock délivrable ne suffit pas', () => {
    const { allocations, shortfall } = allocateFefo([batch('A', '2027-01-01', 5), batch('OLD', '2026-01-01', 100)], 12, TODAY);
    expect(allocations.map((a) => a.quantity)).toEqual([5]);
    expect(shortfall).toBe(7);
    expect(allocateFefo([], 3, TODAY)).toEqual({ allocations: [], shortfall: 3 });
  });

  it('classe le stock : rupture, bas (au seuil compris), correct', () => {
    expect(stockLevel(0, 100)).toBe('OUT');
    expect(stockLevel(100, 100)).toBe('LOW');
    expect(stockLevel(101, 100)).toBe('OK');
    expect(stockLevel(1, 0)).toBe('OK');
    expect(stockLevel(0, 0)).toBe('OUT');
  });
});

describe('GoodsReceipt', () => {
  const line = (batchNumber: string, expiry: string, quantity = 10, drug = 1): ReceiptLine => ({
    drugId: must(DrugId.create(uuid(drug))), batchId: must(BatchId.create(uuid(500 + quantity + drug))), batchNumber: must(BatchNumber.create(batchNumber)), expiry: day(expiry), quantity, unitCost: money(10),
  });
  const draft = (lines: ReceiptLine[], over: Record<string, unknown> = {}) => ({
    id: must(ReceiptId.create(uuid(900))), number: must(ReceiptNumber.fromSequence(1)), supplier: '  Pharma  Distrib ', receivedBy: 'u1', receivedAt: NOW, lines, ...over,
  });

  it('enregistre une livraison et normalise le fournisseur', () => {
    const r = must(GoodsReceipt.create(draft([line('L1', '2027-01-01')], { deliveryNote: ' BL-77 ', notes: '' }), TODAY));
    expect(r.state).toMatchObject({ supplier: 'Pharma Distrib', deliveryNote: 'BL-77', notes: null });
  });

  it('refuse un fournisseur vide, aucune ligne, trop de lignes, un doublon de lot et un lot déjà périmé', () => {
    expect(GoodsReceipt.create(draft([line('L1', '2027-01-01')], { supplier: ' ' }), TODAY)).toMatchObject({ ok: false, error: { code: 'PHARMACY_SUPPLIER_INVALID' } });
    expect(GoodsReceipt.create(draft([]), TODAY)).toMatchObject({ ok: false, error: { code: 'PHARMACY_RECEIPT_LINES_INVALID' } });
    const many = Array.from({ length: 51 }, (_, i) => line(`L${i}`, '2027-01-01'));
    expect(GoodsReceipt.create(draft(many), TODAY)).toMatchObject({ ok: false, error: { code: 'PHARMACY_RECEIPT_LINES_INVALID' } });
    expect(GoodsReceipt.create(draft([line('L1', '2027-01-01'), line('l1', '2027-01-01', 5)]), TODAY)).toMatchObject({ ok: false, error: { code: 'PHARMACY_RECEIPT_DUPLICATE_LINE' } });
    expect(GoodsReceipt.create(draft([line('L1', '2027-01-01'), line('L1', '2027-01-01', 5, 2)]), TODAY).ok).toBe(true);
    expect(GoodsReceipt.create(draft([line('L1', '2026-11-01')]), TODAY)).toMatchObject({ ok: false, error: { code: 'PHARMACY_RECEIPT_EXPIRED' } });
    expect(GoodsReceipt.create(draft([line('L1', '2026-11-02')]), TODAY).ok).toBe(true);
  });
});

describe('StockAdjustment', () => {
  const request = (over: Record<string, unknown> = {}) =>
    StockAdjustment.request({
      id: must(AdjustmentId.create(uuid(700))), number: must(AdjustmentNumber.fromSequence(1)), drugId: must(DrugId.create(uuid(1))), batchId: must(BatchId.create(uuid(101))), direction: 'OUT',
      quantity: must(Quantity.create(4)), reason: 'DAMAGED', note: null, requestedBy: 'u1', requestedAt: NOW, ...over,
    } as Parameters<typeof StockAdjustment.request>[0]);

  it('refuse un motif qui ne convient pas au sens, et « autre » sans précision', () => {
    expect(request({ direction: 'IN', reason: 'DAMAGED' })).toMatchObject({ ok: false, error: { code: 'PHARMACY_ADJUSTMENT_REASON_MISMATCH' } });
    expect(request({ direction: 'OUT', reason: 'FOUND' })).toMatchObject({ ok: false, error: { code: 'PHARMACY_ADJUSTMENT_REASON_MISMATCH' } });
    expect(request({ reason: 'OTHER' })).toMatchObject({ ok: false, error: { code: 'PHARMACY_ADJUSTMENT_NOTE_REQUIRED' } });
    expect(request({ reason: 'OTHER', note: 'Vol constaté' }).ok).toBe(true);
    expect(request({ direction: 'IN', reason: 'FOUND' }).ok).toBe(true);
  });

  it('ne change rien tant qu\'elle n\'est pas décidée, et n\'est pas approuvable par son demandeur', () => {
    const a = must(request());
    const b = batch('L1', '2027-01-01', 10);
    expect(a.state.status).toBe('PENDING');
    expect(a.approve('u1', NOW, b, TODAY, null)).toMatchObject({ ok: false, error: { code: 'PHARMACY_ADJUSTMENT_SELF_APPROVAL' } });
    expect(a.reject('u1', NOW, must(Reason.create('Non')))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ADJUSTMENT_SELF_APPROVAL' } });
    expect(a.state.status).toBe('PENDING');
    expect(b.state.quantity).toBe(10);
  });

  it('appliquée au lot par un autre, une seule fois', () => {
    const a = must(request());
    const b = batch('L1', '2027-01-01', 10);
    const movement = must(a.approve('u2', NOW, b, TODAY, 'ok'));
    expect(movement).toMatchObject({ type: 'ADJUSTMENT_OUT', delta: -4, reference: 'ADJ-0000001' });
    expect(a.state).toMatchObject({ status: 'APPROVED', decidedBy: 'u2', decisionComment: 'ok' });
    expect(b.state.quantity).toBe(6);
    expect(a.approve('u3', NOW, b, TODAY, null)).toMatchObject({ ok: false, error: { code: 'PHARMACY_ADJUSTMENT_NOT_PENDING' } });
    expect(a.reject('u3', NOW, must(Reason.create('Trop tard')))).toMatchObject({ ok: false, error: { code: 'PHARMACY_ADJUSTMENT_NOT_PENDING' } });
  });

  it('reste en attente quand le lot ne peut plus honorer la sortie', () => {
    const a = must(request());
    const b = batch('L1', '2027-01-01', 3);
    expect(a.approve('u2', NOW, b, TODAY, null)).toMatchObject({ ok: false, error: { code: 'PHARMACY_STOCK_INSUFFICIENT' } });
    expect(a.state).toMatchObject({ status: 'PENDING', decidedBy: null });
    expect(b.state.quantity).toBe(3);
  });

  it('refusée avec un motif, le stock est inchangé', () => {
    const a = must(request());
    must(a.reject('u2', NOW, must(Reason.create('Recomptez d\'abord'))));
    expect(a.state).toMatchObject({ status: 'REJECTED', decidedBy: 'u2', decisionComment: 'Recomptez d\'abord' });
  });
});

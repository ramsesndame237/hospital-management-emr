import { allocateFefo, Batch } from '../../src/modules/pharmacy/domain/batch';
import { Dispensation, DispensationLine } from '../../src/modules/pharmacy/domain/dispensation';
import { BatchId, BatchNumber, DispensationId, DispensationNumber, DrugId, Money } from '../../src/modules/pharmacy/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { uuid } from '../support/seed-sql';

const TODAY = Temporal.PlainDate.from('2026-11-02');
const NOW = Temporal.Instant.from('2026-11-02T09:00:00Z');
let seq = 0;

const batch = (number: string, expiry: string, quantity: number, status: 'AVAILABLE' | 'QUARANTINED' = 'AVAILABLE') => {
  seq += 1;
  return Batch.restore({
    id: must(BatchId.create(uuid(100 + seq))), drugId: must(DrugId.create(uuid(1))), batchNumber: must(BatchNumber.create(number)), expiry: Temporal.PlainDate.from(expiry), quantity, unitCost: must(Money.create(10)),
    status, quarantineReason: status === 'QUARANTINED' ? 'Rappel' : null, quarantinedBy: status === 'QUARANTINED' ? 'u' : null, quarantinedAt: status === 'QUARANTINED' ? NOW : null, receivedAt: Temporal.Instant.from('2026-10-01T08:00:00Z'),
  });
};

describe('lot : délivrance', () => {
  it('sort la quantité du lot et rend un mouvement négatif de type DISPENSE rattaché au numéro de dispensation', () => {
    const b = batch('A', '2027-01-01', 10);
    const draft = must(b.dispense(4, TODAY, 'DSP-0000001'));
    expect(draft).toEqual({ type: 'DISPENSE', delta: -4, reason: null, reference: 'DSP-0000001' });
    expect(b.state.quantity).toBe(6);
  });

  it.each([
    ['plus que le stock', batch('A', '2027-01-01', 3), 4],
    ['un lot périmé', batch('B', '2026-11-01', 10), 1],
    ['un lot en quarantaine', batch('C', '2027-01-01', 10, 'QUARANTINED'), 1],
    ['un lot vide', batch('D', '2027-01-01', 0), 1],
  ])('refuse %s sans rien retirer', (_label, b, quantity) => {
    const before = b.state.quantity;
    expect(b.dispense(quantity, TODAY, 'DSP-0000001')).toMatchObject({ ok: false, error: { code: 'PHARMACY_STOCK_INSUFFICIENT' } });
    expect(b.state.quantity).toBe(before);
  });

  it('accepte le dernier jour de validité et vide le lot exactement', () => {
    const b = batch('A', '2026-11-02', 5);
    must(b.dispense(5, TODAY, 'DSP-0000001'));
    expect(b.state.quantity).toBe(0);
  });

  it('suit l\'ordre premier périmé, premier sorti, hors périmé et quarantaine', () => {
    const plan = allocateFefo([batch('LATE', '2027-06-01', 10), batch('EXPIRED', '2026-10-01', 10), batch('QUAR', '2026-12-01', 10, 'QUARANTINED'), batch('SOON', '2026-12-15', 4)], 9, TODAY);
    expect(plan.allocations.map((a) => [a.batchNumber, a.quantity])).toEqual([['SOON', 4], ['LATE', 5]]);
    expect(plan.shortfall).toBe(0);
  });
});

describe('dispensation', () => {
  const line = (over: Partial<DispensationLine> = {}): DispensationLine => ({
    prescriptionPosition: 0, drugId: uuid(1), batchId: uuid(2), batchNumber: 'A', expiry: Temporal.PlainDate.from('2027-01-01'), quantity: 3, allergyOverride: null, ...over,
  });
  const make = (lines: DispensationLine[], notes: string | null = null) =>
    Dispensation.create({ id: must(DispensationId.create(uuid(9))), number: must(DispensationNumber.fromSequence(1)), prescriptionId: uuid(10), patientId: uuid(11), dispensedBy: 'u-ph', dispensedAt: NOW, notes, lines });

  it('se crée avec son numéro DSP-… et ses prélèvements', () => {
    const d = must(make([line(), line({ batchId: uuid(3), batchNumber: 'B', quantity: 2 })]));
    expect(d.state.number.value).toBe('DSP-0000001');
    expect(d.state.lines).toHaveLength(2);
  });

  it.each([
    [[], 'PHARMACY_DISPENSATION_EMPTY'],
    [Array.from({ length: 41 }, () => line()), 'PHARMACY_DISPENSATION_TOO_LONG'],
    [[line({ quantity: 0 })], 'PHARMACY_DISPENSE_QUANTITY_INVALID'],
    [[line({ quantity: 1.5 })], 'PHARMACY_DISPENSE_QUANTITY_INVALID'],
  ])('refuse une dispensation invalide (%#)', (lines, code) => {
    expect(make(lines as DispensationLine[])).toMatchObject({ ok: false, error: { code } });
  });

  it('refuse une remarque vide ou de plus de 200 caractères', () => {
    expect(make([line()], '')).toMatchObject({ ok: false, error: { code: 'PHARMACY_NOTES_INVALID' } });
    expect(make([line()], 'x'.repeat(201))).toMatchObject({ ok: false, error: { code: 'PHARMACY_NOTES_INVALID' } });
  });

  it('refuse un numéro mal formé', () => {
    expect(DispensationNumber.create('DSP-12')).toMatchObject({ ok: false });
    expect(DispensationNumber.create(' dsp-0000012 ')).toMatchObject({ ok: true });
  });
});

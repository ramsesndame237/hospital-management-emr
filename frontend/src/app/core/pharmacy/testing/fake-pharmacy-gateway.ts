import { PharmacyGateway } from '../pharmacy.gateway';
import {
  Adjustment, AdjustmentFilter, AdjustmentInput, Batch, Drug, DrugChanges, DrugFilter, DrugInput, DrugPage, DrugStock, ExpiryFilter, ExpiryPage, ExpiryRow, Movement, MovementFilter, Page, Receipt,
  ReceiptFilter, ReceiptInput, ReceiptPage, ReceiptSummary, StockFilter, StockPage, StockRow, StockSummary,
} from '../pharmacy.models';

export const pharmacist = { id: 'u-pha', username: 'pharmacien' };
export const colleague = { id: 'u-pha2', username: 'pharmacien2' };

export const page = <T>(items: readonly T[], over: Partial<Page<T>> = {}): Page<T> => ({ items, total: items.length, offset: 0, limit: 25, ...over });

export const drug = (over: Partial<Drug> = {}): Drug => ({
  id: 'd-1', code: 'PARA500', name: 'Doliprane 500', genericName: 'Paracétamol', strength: '500 mg', form: 'TABLET', schedule: 'PRESCRIPTION', storage: 'ROOM', atcCode: 'N02BE01', unit: 'comprimé',
  unitPrice: 25, currency: 'XAF', reorderLevel: 200, notes: null, active: true, ...over,
});

export const stockRow = (over: Partial<StockRow> = {}): StockRow => ({
  drugId: 'd-1', code: 'PARA500', name: 'Doliprane 500', genericName: 'Paracétamol', strength: '500 mg', form: 'TABLET', schedule: 'PRESCRIPTION', unit: 'comprimé', active: true, reorderLevel: 200,
  dispensable: 340, quarantined: 0, expired: 0, expiringSoon: 0, nextExpiry: '2027-03-31', level: 'OK', value: 3400, ...over,
});

export const batch = (over: Partial<Batch> = {}): Batch => ({
  id: 'b-1', drugId: 'd-1', batchNumber: 'B2026-114', expiry: '2027-03-31', daysToExpiry: 150, quantity: 340, unitCost: 10, status: 'AVAILABLE', expired: false, expiringSoon: false, dispensable: true,
  quarantineReason: null, quarantinedBy: null, quarantinedAt: null, receivedAt: '2026-10-01T08:00:00Z', ...over,
});

export const drugStock = (over: Partial<DrugStock> = {}): DrugStock => ({
  drug: drug(), dispensable: 340, quarantined: 0, expired: 0, expiringSoon: 0, nextExpiry: '2027-03-31', level: 'OK', value: 3400, expiryAlertDays: 90, currency: 'XAF', batches: [batch()], ...over,
});

export const summary = (over: Partial<StockSummary> = {}): StockSummary => ({
  drugs: 120, out: 4, low: 9, expiring: 6, expired: 1, quarantinedBatches: 2, pendingAdjustments: 3, value: 1_250_000, expiryAlertDays: 90, currency: 'XAF', ...over,
});

export const expiryRow = (over: Partial<ExpiryRow> = {}): ExpiryRow => ({
  ...batch({ daysToExpiry: 20, expiringSoon: true, expiry: '2026-11-20' }), drug: { id: 'd-1', code: 'PARA500', name: 'Doliprane 500', genericName: 'Paracétamol', strength: '500 mg', unit: 'comprimé' }, ...over,
});

export const movement = (over: Partial<Movement> = {}): Movement => ({
  id: 'm-1', drugId: 'd-1', batchId: 'b-1', batchNumber: 'B2026-114', type: 'RECEIPT', delta: 340, balance: 340, reason: null, reference: 'GRN-0000001', by: pharmacist, at: '2026-10-01T08:00:00Z', ...over,
});

export const receipt = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'r-1', number: 'GRN-0000001', supplier: 'Pharma Distrib', deliveryNote: 'BL-2026-0412', notes: null, receivedBy: pharmacist, receivedAt: '2026-10-01T08:00:00Z', units: 340, value: 3400, currency: 'XAF',
  lines: [{ drug: { id: 'd-1', code: 'PARA500', name: 'Doliprane 500', genericName: 'Paracétamol', strength: '500 mg', unit: 'comprimé' }, batchId: 'b-1', batchNumber: 'B2026-114', expiry: '2027-03-31', quantity: 340, unitCost: 10, value: 3400 }],
  ...over,
});

export const receiptSummary = (over: Partial<ReceiptSummary> = {}): ReceiptSummary => ({
  id: 'r-1', number: 'GRN-0000001', supplier: 'Pharma Distrib', deliveryNote: 'BL-2026-0412', receivedBy: pharmacist, receivedAt: '2026-10-01T08:00:00Z', lines: 1, units: 340, value: 3400, ...over,
});

export const adjustment = (over: Partial<Adjustment> = {}): Adjustment => ({
  id: 'a-1', number: 'ADJ-0000001', drug: { id: 'd-1', code: 'PARA500', name: 'Doliprane 500', genericName: 'Paracétamol', strength: '500 mg', unit: 'comprimé' },
  batch: { id: 'b-1', batchNumber: 'B2026-114', expiry: '2027-03-31', quantity: 340 }, direction: 'OUT', quantity: 4, reason: 'DAMAGED', note: null, status: 'PENDING', requestedBy: pharmacist,
  requestedAt: '2026-10-02T08:00:00Z', decidedBy: null, decidedAt: null, decisionComment: null, ...over,
});

/** Double de test du port `PharmacyGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakePharmacyGateway extends PharmacyGateway {
  override listDrugs = vi.fn<(filter: DrugFilter, offset: number, limit: number) => Promise<DrugPage>>().mockResolvedValue({
    ...page([drug(), drug({ id: 'd-2', code: 'AMOX500', name: 'Clamoxyl', genericName: 'Amoxicilline', form: 'CAPSULE', unit: 'gélule', unitPrice: 150 })]), currency: 'XAF',
  });
  override createDrug = vi.fn<(input: DrugInput) => Promise<Drug>>().mockImplementation((input) => Promise.resolve(drug({ id: 'd-new', ...input, strength: input.strength ?? null, atcCode: input.atcCode ?? null, notes: input.notes ?? null, storage: input.storage ?? 'ROOM', unitPrice: input.unitPrice ?? 0, reorderLevel: input.reorderLevel ?? 0 })));
  override updateDrug = vi.fn<(id: string, changes: DrugChanges) => Promise<Drug>>().mockImplementation((id, changes) => Promise.resolve(drug({ id, ...changes } as Partial<Drug>)));
  override setDrugActive = vi.fn<(id: string, active: boolean) => Promise<Drug>>().mockImplementation((id, active) => Promise.resolve(drug({ id, active })));
  override listStock = vi.fn<(filter: StockFilter, offset: number, limit: number) => Promise<StockPage>>().mockResolvedValue({
    ...page([stockRow({ drugId: 'd-2', code: 'AMOX500', name: 'Clamoxyl', genericName: 'Amoxicilline', dispensable: 0, level: 'OUT', nextExpiry: null, value: 0 }), stockRow()]), expiryAlertDays: 90, currency: 'XAF',
  });
  override getSummary = vi.fn<() => Promise<StockSummary>>().mockResolvedValue(summary());
  override getDrugStock = vi.fn<(id: string) => Promise<DrugStock>>().mockImplementation(() => Promise.resolve(drugStock()));
  override listExpiry = vi.fn<(filter: ExpiryFilter, offset: number, limit: number) => Promise<ExpiryPage>>().mockResolvedValue({ ...page([expiryRow()]), expiryAlertDays: 90, currency: 'XAF' });
  override listMovements = vi.fn<(filter: MovementFilter, offset: number, limit: number) => Promise<Page<Movement>>>().mockResolvedValue(page([movement()]));
  override quarantine = vi.fn<(batchId: string, reason: string) => Promise<Batch>>().mockImplementation((_id, reason) =>
    Promise.resolve(batch({ status: 'QUARANTINED', dispensable: false, quarantineReason: reason, quarantinedBy: pharmacist, quarantinedAt: '2026-10-02T09:00:00Z' })),
  );
  override release = vi.fn<(batchId: string) => Promise<Batch>>().mockImplementation(() => Promise.resolve(batch()));
  override postReceipt = vi.fn<(input: ReceiptInput) => Promise<Receipt>>().mockImplementation((input) => Promise.resolve(receipt({ supplier: input.supplier, deliveryNote: input.deliveryNote ?? null })));
  override listReceipts = vi.fn<(filter: ReceiptFilter, offset: number, limit: number) => Promise<ReceiptPage>>().mockResolvedValue({ ...page([receiptSummary()]), currency: 'XAF' });
  override getReceipt = vi.fn<(id: string) => Promise<Receipt>>().mockImplementation(() => Promise.resolve(receipt()));
  override requestAdjustment = vi.fn<(input: AdjustmentInput) => Promise<Adjustment>>().mockImplementation((input) => Promise.resolve(adjustment({ direction: input.direction, quantity: input.quantity, reason: input.reason, note: input.note ?? null })));
  override listAdjustments = vi.fn<(filter: AdjustmentFilter, offset: number, limit: number) => Promise<Page<Adjustment>>>().mockResolvedValue(page([adjustment()]));
  override approveAdjustment = vi.fn<(id: string, comment: string | null) => Promise<Adjustment>>().mockImplementation((_id, comment) =>
    Promise.resolve(adjustment({ status: 'APPROVED', decidedBy: colleague, decidedAt: '2026-10-02T10:00:00Z', decisionComment: comment })),
  );
  override rejectAdjustment = vi.fn<(id: string, comment: string) => Promise<Adjustment>>().mockImplementation((_id, comment) =>
    Promise.resolve(adjustment({ status: 'REJECTED', decidedBy: colleague, decidedAt: '2026-10-02T10:00:00Z', decisionComment: comment })),
  );
}

import { BillingGateway } from '../billing.gateway';
import { BillableItem, CollectInput, CollectedPayment, Invoice, InvoiceFilter, InvoiceLine, InvoiceSummary, ItemFilter, Page, Payment, Receipt } from '../billing.models';

export const patient = { id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'Élisabeth' };

export const line = (over: Partial<InvoiceLine> = {}): InvoiceLine => ({
  id: 'l-1', itemId: 'i-1', itemCode: 'CONS-GEN', itemName: 'Consultation générale', unitPrice: 5000, quantity: 1, total: 5000, ...over,
});

export const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'pay-1', receiptNumber: 'REC-0000001', mode: 'CASH', amount: 4000, reference: null, receivedAt: '2026-10-24T09:15:00Z', ...over,
});

/** Une facture, avec des totaux cohérents recalculés à partir de ses lignes, de sa remise et de ses encaissements. */
export function invoice(over: Partial<Invoice> = {}): Invoice {
  const lines = over.lines ?? [line({ id: 'l-1', total: 10000, quantity: 2 }), line({ id: 'l-2', itemId: 'i-2', itemCode: 'ECHO', itemName: 'Échographie', unitPrice: 1500, total: 1500 })];
  const payments = over.payments ?? [];
  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const discount = over.discount ?? 0;
  const total = subtotal - discount;
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    id: 'inv-1', number: 'FAC-0000123', status: 'DRAFT', currency: 'XAF', currencyDigits: 0, patient, lines, subtotal, discount, discountReason: discount > 0 ? 'Personnel' : null,
    total, paid, balance: total - paid, note: null, cancellationReason: null, issuedAt: null, payments, approvals: [], discountApprovalPercent: 10, ...over,
  };
}

export const summary = (over: Partial<InvoiceSummary> = {}): InvoiceSummary => ({
  id: 'inv-1', number: 'FAC-0000123', status: 'ISSUED', currency: 'XAF', patient, subtotal: 11500, discount: 0, total: 11500, paid: 0, balance: 11500,
  issuedAt: '2026-10-24T09:10:00Z', createdAt: '2026-10-24T09:05:00Z', ...over,
});

export const item = (over: Partial<BillableItem> = {}): BillableItem => ({
  id: 'i-1', code: 'CONS-GEN', name: 'Consultation générale', category: 'CONSULTATION', unitPrice: 5000, currency: 'XAF', serviceId: null, active: true, ...over,
});

export const page = <T>(items: readonly T[], over: Partial<Page<T>> = {}): Page<T> => ({ items, total: items.length, offset: 0, limit: 25, ...over });

/** Double de test du port `BillingGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeBillingGateway extends BillingGateway {
  override listInvoices = vi.fn<(filter: InvoiceFilter, offset: number, limit: number) => Promise<Page<InvoiceSummary>>>().mockResolvedValue(
    page([summary(), summary({ id: 'inv-2', number: 'FAC-0000122', status: 'PAID', paid: 3000, total: 3000, subtotal: 3000, balance: 0 })]),
  );
  override getInvoice = vi.fn<(id: string) => Promise<Invoice>>().mockImplementation(() => Promise.resolve(invoice()));
  override createInvoice = vi.fn<(patientId: string) => Promise<Invoice>>().mockImplementation(() => Promise.resolve(invoice({ lines: [] })));
  override addLine = vi.fn<(invoiceId: string, itemId: string, quantity: number) => Promise<Invoice>>().mockImplementation(() => Promise.resolve(invoice()));
  override removeLine = vi.fn<(invoiceId: string, lineId: string) => Promise<Invoice>>().mockImplementation(() => Promise.resolve(invoice({ lines: [] })));
  override setDiscount = vi.fn<(invoiceId: string, amount: number, reason: string | null) => Promise<Invoice>>().mockImplementation((_id, amount) => Promise.resolve(invoice({ discount: amount })));
  override issue = vi.fn<(invoiceId: string) => Promise<Invoice>>().mockImplementation(() => Promise.resolve(invoice({ status: 'ISSUED', issuedAt: '2026-10-24T09:10:00Z' })));
  override cancel = vi.fn<(invoiceId: string, reason: string) => Promise<Invoice>>().mockImplementation((_id, reason) => Promise.resolve(invoice({ status: 'CANCELLED', cancellationReason: reason })));
  override collect = vi.fn<(invoiceId: string, input: CollectInput) => Promise<CollectedPayment>>().mockImplementation((_id, input) => {
    const p = payment({ mode: input.mode, amount: input.amount, reference: input.reference ?? null });
    return Promise.resolve({ payment: p, change: input.tendered ? input.tendered - input.amount : 0, invoice: invoice({ status: 'PARTIALLY_PAID', issuedAt: '2026-10-24T09:10:00Z', payments: [p] }) });
  });
  override reprintReceipt = vi.fn<(paymentId: string, reason: string) => Promise<Receipt>>().mockImplementation(() =>
    Promise.resolve({
      receiptNumber: 'REC-0000001', invoiceNumber: 'FAC-0000123', patient, mode: 'CASH', amount: 4000, currency: 'XAF', currencyDigits: 0, reference: null,
      receivedAt: '2026-10-24T09:15:00Z', duplicate: true, invoiceBalance: 7500,
    }),
  );
  override listItems = vi.fn<(filter: ItemFilter, offset: number, limit: number) => Promise<Page<BillableItem>>>().mockResolvedValue(
    page([item(), item({ id: 'i-2', code: 'ECHO', name: 'Échographie', category: 'RADIOLOGY', unitPrice: 15000 })]),
  );
}

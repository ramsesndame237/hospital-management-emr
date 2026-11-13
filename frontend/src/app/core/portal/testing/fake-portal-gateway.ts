import { PortalGateway } from '../portal.gateway';
import { PortalAccount, PortalAppointment, PortalInvoice, PortalPatient, PortalPrescription, PortalResult } from '../portal.models';

export const me: PortalPatient = { id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14' };

export const appointment = (over: Partial<PortalAppointment> = {}): PortalAppointment => ({ number: 'RDV-0000045', status: 'SCHEDULED', startsAt: '2026-11-02T08:00:00Z', endsAt: '2026-11-02T08:30:00Z', ...over });

export const result = (over: Partial<PortalResult> = {}): PortalResult => ({
  number: 'LAB-0000123', orderedAt: '2026-10-24T08:00:00Z',
  items: [
    { testName: 'Hémoglobine', value: '12,4', unit: 'g/dL', flag: null, refLow: 12, refHigh: 16, amended: false },
    { testName: 'Glycémie', value: '7,9', unit: 'mmol/L', flag: 'HIGH', refLow: 3.9, refHigh: 6.1, amended: true },
  ], ...over,
});

export const prescription = (over: Partial<PortalPrescription> = {}): PortalPrescription => ({
  number: 'RX-0000001', issuedAt: '2026-10-24T08:20:00Z', status: 'ISSUED', dispensing: 'PARTIAL',
  lines: [{ drugName: 'Amoxicilline Biogaran', strength: '500 mg', dose: '1 gélule', frequency: '3 fois par jour', durationDays: 7, quantity: 21, unit: 'gélule' }], ...over,
});

export const invoice = (over: Partial<PortalInvoice> = {}): PortalInvoice => ({ number: 'FAC-0000123', status: 'PARTIALLY_PAID', currency: 'XAF', total: 12500, paid: 5000, balance: 7500, issuedAt: '2026-10-24T09:00:00Z', ...over });

/** Double de test du port `PortalGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakePortalGateway extends PortalGateway {
  override getMe = vi.fn<() => Promise<PortalPatient>>().mockResolvedValue(me);
  override getAppointments = vi.fn<() => Promise<readonly PortalAppointment[]>>().mockResolvedValue([appointment()]);
  override getResults = vi.fn<() => Promise<readonly PortalResult[]>>().mockResolvedValue([result()]);
  override getPrescriptions = vi.fn<() => Promise<readonly PortalPrescription[]>>().mockResolvedValue([prescription()]);
  override getInvoices = vi.fn<() => Promise<readonly PortalInvoice[]>>().mockResolvedValue([invoice()]);
  override getAccountOf = vi.fn<(patientId: string) => Promise<PortalAccount | null>>().mockResolvedValue(null);
  override linkAccount = vi.fn<(username: string, patientId: string) => Promise<PortalAccount>>().mockImplementation((username) => Promise.resolve({ username, linkedAt: '2026-11-02T09:00:00Z' }));
}

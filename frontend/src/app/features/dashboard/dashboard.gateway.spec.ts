import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BillingGateway } from '../../core/billing/billing.gateway';
import { ClinicalGateway } from '../../core/clinical/clinical.gateway';
import { ImagingGateway } from '../../core/imaging/imaging.gateway';
import { LabGateway } from '../../core/lab/lab.gateway';
import { PharmacyGateway } from '../../core/pharmacy/pharmacy.gateway';
import { ReceptionGateway } from '../../core/reception/reception.gateway';
import { Clock } from '../../core/time/clock';
import { Temporal } from '../../core/time/temporal';
import { DashboardGateway, HttpDashboardGateway } from './dashboard.gateway';

const page = (total: number, items: unknown[] = []) => Promise.resolve({ items, total, offset: 0, limit: 1 });
const appointment = (id: string, startsAt: string, status: string) => ({ id, number: `RDV-${id}`, status, startsAt, patient: { lastName: 'Ndom', firstName: 'Évelyne' } });

describe('HttpDashboardGateway', () => {
  const reception = { listAppointments: vi.fn() };
  const clinical = { getQueue: vi.fn() };
  const lab = { listRequisitions: vi.fn() };
  const imaging = { listOrders: vi.fn() };
  const pharmacy = { getDispensingQueue: vi.fn(), getSummary: vi.fn() };
  const billing = { listInvoices: vi.fn() };
  let gateway: DashboardGateway;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: DashboardGateway, useClass: HttpDashboardGateway },
        { provide: ReceptionGateway, useValue: reception },
        { provide: ClinicalGateway, useValue: clinical },
        { provide: LabGateway, useValue: lab },
        { provide: ImagingGateway, useValue: imaging },
        { provide: PharmacyGateway, useValue: pharmacy },
        { provide: BillingGateway, useValue: billing },
        { provide: Clock, useValue: { now: () => Temporal.Instant.from('2026-10-24T09:00:00Z') } },
      ],
    });
    gateway = TestBed.inject(DashboardGateway);
  });

  it("n'interroge rien quand le rôle n'a aucun droit utile", async () => {
    const snapshot = await gateway.snapshot([]);
    expect(snapshot).toEqual({ tiles: [], visits: [] });
    for (const mock of [reception.listAppointments, clinical.getQueue, lab.listRequisitions, imaging.listOrders, pharmacy.getDispensingQueue, pharmacy.getSummary, billing.listInvoices]) {
      expect(mock).not.toHaveBeenCalled();
    }
  });

  it('compte les patients en attente (sans consultation en cours) et les ordonnances à délivrer', async () => {
    clinical.getQueue.mockResolvedValue([{ encounter: null }, { encounter: { id: 'e-1' } }, { encounter: null }]);
    pharmacy.getDispensingQueue.mockResolvedValue([{}, {}, {}, {}]);
    const snapshot = await gateway.snapshot(['clinical.encounters:read:department', 'pharmacy.dispensing:dispense']);
    expect(snapshot.tiles.map((t) => [t.id, t.value])).toEqual([['waiting', 2], ['toDispense', 4]]);
  });

  it("liste les rendez-vous du jour dans l'ordre, sans les annulés, et en compte le total", async () => {
    reception.listAppointments.mockResolvedValue({
      items: [appointment('2', '2026-10-24T10:30:00Z', 'SCHEDULED'), appointment('1', '2026-10-24T08:30:00Z', 'ARRIVED'), appointment('3', '2026-10-24T09:00:00Z', 'CANCELLED')],
      total: 3, offset: 0, limit: 100,
    });
    const snapshot = await gateway.snapshot(['appointments:read:department']);
    expect(snapshot.tiles).toEqual([{ id: 'appointments', labelKey: 'dashboard.tile.appointments', route: '/appointments', value: 2 }]);
    expect(snapshot.visits.map((v) => [v.id, v.patient, v.statusKey])).toEqual([['1', 'Ndom Évelyne', 'dashboard.status.ARRIVED'], ['2', 'Ndom Évelyne', 'dashboard.status.SCHEDULED']]);
    const filter = reception.listAppointments.mock.calls[0][0] as { from: string; to: string };
    expect(Date.parse(filter.to) - Date.parse(filter.from)).toBe(24 * 3600 * 1000);
  });

  it('additionne les états à traiter du laboratoire, de l’imagerie et de la caisse', async () => {
    lab.listRequisitions.mockImplementation((f: { status: string }) => page(f.status === 'ORDERED' ? 5 : 2));
    imaging.listOrders.mockImplementation((f: { status: string }) => page(f.status === 'ORDERED' ? 3 : f.status === 'SCHEDULED' ? 4 : 1));
    billing.listInvoices.mockImplementation((f: { status: string }) => page(f.status === 'ISSUED' ? 6 : 1));
    const snapshot = await gateway.snapshot(['lab.specimens:collect', 'lab.results:verify', 'imaging.exams:perform', 'billing.invoices:write']);
    expect(Object.fromEntries(snapshot.tiles.map((t) => [t.id, t.value]))).toEqual({ toCollect: 5, toVerify: 2, toPerform: 7, toPay: 7 });
  });

  it("un chiffre qui échoue manque, sans emporter les autres ni être remplacé par une valeur inventée", async () => {
    clinical.getQueue.mockRejectedValue(new Error('503'));
    pharmacy.getDispensingQueue.mockResolvedValue([{}]);
    const snapshot = await gateway.snapshot(['clinical.encounters:read:department', 'pharmacy.dispensing:dispense']);
    expect(snapshot.tiles.map((t) => t.id)).toEqual(['toDispense']);
  });

  it("le médecin voit ses résultats publiés, pas le laborantin (qui a la saisie)", async () => {
    lab.listRequisitions.mockImplementation(() => page(9));
    expect((await gateway.snapshot(['lab.requisitions:order'])).tiles.map((t) => t.id)).toEqual(['released']);
    expect((await gateway.snapshot(['lab.requisitions:order', 'lab.results:enter'])).tiles).toEqual([]);
  });
});

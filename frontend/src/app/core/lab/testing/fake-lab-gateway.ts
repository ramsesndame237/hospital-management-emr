import { LabGateway } from '../lab.gateway';
import {
  CollectInput, LabTest, LabPatient, NotifyInput, ResultVersion, TestResult, OrderInput, Page, RejectInput, Requisition, RequisitionBySpecimen, RequisitionFilter, RequisitionSummary, Specimen, TestFilter,
} from '../lab.models';

export const patient: LabPatient = { id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14' };
export const technician = { id: 'u-lab', username: 'labo' };
export const doctor = { id: 'u-doc', username: 'medecin' };

export const page = <T>(items: readonly T[], over: Partial<Page<T>> = {}): Page<T> => ({ items, total: items.length, offset: 0, limit: 25, ...over });

export const labTest = (over: Partial<LabTest> = {}): LabTest => ({
  id: 't-1', code: 'HGB', name: 'Hémoglobine', section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, choices: [], tatMinutes: 120, instructions: null,
  ranges: [{ sex: 'FEMALE', ageMinDays: 6574, ageMaxDays: null, low: 11.5, high: 15.5, criticalLow: 7, criticalHigh: 20 }], active: true, ...over,
});

export const version = (over: Partial<ResultVersion> = {}): ResultVersion => ({
  version: 1, value: '13.5', flag: 'NORMAL', unit: 'g/dL', refLow: 11.5, refHigh: 15.5, criticalLow: 7, criticalHigh: 20, previousValue: null, deltaAlert: false, enteredBy: technician, enteredAt: '2026-10-24T10:00:00Z',
  comment: null, amendmentReason: null, ...over,
});

/** Un résultat saisi (en attente de validation) par défaut. */
export const result = (over: Partial<TestResult> = {}): TestResult => ({
  status: 'ENTERED', currentVersion: 1, releasedVersion: null, versions: [version()], returnReason: null, verifiedBy: null, verifiedAt: null, releasedBy: null, releasedAt: null,
  criticalRequired: false, criticalNotified: false, notifications: [], amendmentPending: false, ...over,
});

export const specimen = (over: Partial<Specimen> = {}): Specimen => ({
  id: 's-1', barcode: 'SPC-0000001', specimenType: 'BLOOD', container: 'PURPLE', status: 'PENDING_COLLECTION', collectedBy: null, collectedAt: null, receivedBy: null, receivedAt: null,
  rejectionReason: null, rejectionNote: null, rejectedBy: null, rejectedAt: null, recollectionOf: null, events: [{ kind: 'CREATED', at: '2026-10-24T08:00:00Z', actor: doctor, note: null }], ...over,
});

export const orderedTest = (over: Partial<Requisition['tests'][number]> = {}): Requisition['tests'][number] => ({
  testId: 't-1', code: 'HGB', name: 'Hémoglobine', section: 'HAEMATOLOGY', specimenId: 's-1', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, choices: [], result: null, ...over,
});

/** Une demande d'un échantillon à prélever, avec une analyse. */
export const requisition = (over: Partial<Requisition> = {}): Requisition => ({
  id: 'r-1', number: 'LAB-0000123', status: 'ORDERED', patient, priority: 'ROUTINE', source: 'OPD', clinicalNotes: null, orderedBy: doctor, orderedAt: '2026-10-24T08:00:00Z',
  tests: [orderedTest()], specimens: [specimen()], cancelledBy: null, cancelledAt: null, cancellationReason: null, ...over,
});

export const summary = (over: Partial<RequisitionSummary> = {}): RequisitionSummary => ({
  id: 'r-1', number: 'LAB-0000123', status: 'ORDERED', priority: 'ROUTINE', source: 'OPD', patient, orderedBy: doctor, orderedAt: '2026-10-24T08:00:00Z', testCodes: ['HGB'], sections: ['HAEMATOLOGY'], ...over,
});

/** Double de test du port `LabGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeLabGateway extends LabGateway {
  override listTests = vi.fn<(filter: TestFilter, offset: number, limit: number) => Promise<Page<LabTest>>>().mockResolvedValue(
    page([labTest(), labTest({ id: 't-2', code: 'GLU', name: 'Glycémie', section: 'BIOCHEMISTRY', specimenType: 'SERUM', container: 'YELLOW', unit: 'mmol/L', ranges: [] })]),
  );
  override listRequisitions = vi.fn<(filter: RequisitionFilter, offset: number, limit: number) => Promise<Page<RequisitionSummary>>>().mockResolvedValue(
    page([summary({ priority: 'STAT', source: 'ER', id: 'r-2', number: 'LAB-0000124' }), summary()]),
  );
  override getRequisition = vi.fn<(id: string) => Promise<Requisition>>().mockImplementation(() => Promise.resolve(requisition()));
  override order = vi.fn<(input: OrderInput) => Promise<Requisition>>().mockImplementation((input) => Promise.resolve(requisition({ priority: input.priority, source: input.source, clinicalNotes: input.clinicalNotes ?? null })));
  override cancel = vi.fn<(id: string, reason: string) => Promise<Requisition>>().mockImplementation((_id, reason) =>
    Promise.resolve(requisition({ status: 'CANCELLED', cancellationReason: reason, cancelledBy: doctor, cancelledAt: '2026-10-24T09:00:00Z' })),
  );
  override findByBarcode = vi.fn<(barcode: string) => Promise<RequisitionBySpecimen>>().mockImplementation(() => Promise.resolve({ ...requisition(), specimenId: 's-1' }));
  override collect = vi.fn<(specimenId: string, input: CollectInput) => Promise<Requisition>>().mockImplementation(() =>
    Promise.resolve(requisition({
      status: 'COLLECTED',
      specimens: [specimen({ status: 'COLLECTED', collectedBy: technician, collectedAt: '2026-10-24T08:30:00Z', events: [
        { kind: 'CREATED', at: '2026-10-24T08:00:00Z', actor: doctor, note: null }, { kind: 'COLLECTED', at: '2026-10-24T08:30:00Z', actor: technician, note: null },
      ] })],
    })),
  );
  override receive = vi.fn<(specimenId: string) => Promise<Requisition>>().mockImplementation(() =>
    Promise.resolve(requisition({ status: 'RECEIVED', specimens: [specimen({ status: 'RECEIVED', collectedBy: technician, collectedAt: '2026-10-24T08:30:00Z', receivedBy: technician, receivedAt: '2026-10-24T09:00:00Z' })] })),
  );
  override reject = vi.fn<(specimenId: string, input: RejectInput) => Promise<Requisition>>().mockImplementation((_id, input) =>
    Promise.resolve(requisition({
      specimens: [
        specimen({ status: 'REJECTED', rejectionReason: input.reason, rejectionNote: input.note ?? null, rejectedBy: technician, rejectedAt: '2026-10-24T09:00:00Z' }),
        specimen({ id: 's-2', barcode: 'SPC-0000002', recollectionOf: 's-1' }),
      ],
      tests: [orderedTest({ specimenId: 's-2' })],
    })),
  );
  override enterResult = vi.fn<(requisitionId: string, testId: string, value: string, comment: string | null) => Promise<Requisition>>().mockImplementation((_r, _t, value, comment) =>
    Promise.resolve(requisition({ status: 'RESULTED', specimens: [specimen({ status: 'RECEIVED' })], tests: [orderedTest({ result: result({ versions: [version({ value, comment })] }) })] })),
  );
  override verifyResult = vi.fn<(requisitionId: string, testId: string) => Promise<Requisition>>().mockImplementation(() =>
    Promise.resolve(requisition({ status: 'VERIFIED', specimens: [specimen({ status: 'RECEIVED' })], tests: [orderedTest({ result: result({ status: 'VERIFIED', verifiedBy: { id: 'u-lab2', username: 'labo2' }, verifiedAt: '2026-10-24T10:10:00Z' }) })] })),
  );
  override returnResult = vi.fn<(requisitionId: string, testId: string, reason: string) => Promise<Requisition>>().mockImplementation((_r, _t, reason) =>
    Promise.resolve(requisition({ status: 'IN_ANALYSIS', specimens: [specimen({ status: 'RECEIVED' })], tests: [orderedTest({ result: result({ status: 'RETURNED', returnReason: reason }) })] })),
  );
  override notifyCritical = vi.fn<(requisitionId: string, testId: string, input: NotifyInput) => Promise<Requisition>>().mockImplementation((_r, _t, input) =>
    Promise.resolve(requisition({
      status: 'VERIFIED', specimens: [specimen({ status: 'RECEIVED' })],
      tests: [orderedTest({ result: result({ status: 'VERIFIED', criticalRequired: true, criticalNotified: true, notifications: [{ version: 1, notifiedName: input.notifiedName, notifiedRole: input.notifiedRole, method: input.method, at: '2026-10-24T10:12:00Z', by: technician }] }) })],
    })),
  );
  override releaseResult = vi.fn<(requisitionId: string, testId: string) => Promise<Requisition>>().mockImplementation(() =>
    Promise.resolve(requisition({
      status: 'RELEASED', specimens: [specimen({ status: 'RECEIVED' })],
      tests: [orderedTest({ result: result({ status: 'RELEASED', releasedVersion: 1, releasedBy: { id: 'u-lab2', username: 'labo2' }, releasedAt: '2026-10-24T10:20:00Z' }) })],
    })),
  );
  override amendResult = vi.fn<(requisitionId: string, testId: string, value: string, reason: string, comment: string | null) => Promise<Requisition>>().mockImplementation((_r, _t, value, reason) =>
    Promise.resolve(requisition({
      status: 'RESULTED', specimens: [specimen({ status: 'RECEIVED' })],
      tests: [orderedTest({ result: result({ status: 'ENTERED', releasedVersion: 1, currentVersion: 2, amendmentPending: true, versions: [version(), version({ version: 2, value, amendmentReason: reason })] }) })],
    })),
  );
}

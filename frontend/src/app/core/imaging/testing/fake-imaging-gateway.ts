import { ImagingGateway } from '../imaging.gateway';
import {
  AddendumInput, Communication, CommunicationInput, DraftInput, ExamType, ExamTypeChanges, ExamTypeFilter, ExamTypeInput, ImagingPatient, Order, OrderFilter, OrderInput, OrderSummary, Page, PerformInput,
  Report, ReportDraft, ReportVersion,
} from '../imaging.models';

export const patient: ImagingPatient = { id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14' };
export const radiologist = { id: 'u-rad', username: 'radio' };
export const doctor = { id: 'u-doc', username: 'medecin' };

export const page = <T>(items: readonly T[], over: Partial<Page<T>> = {}): Page<T> => ({ items, total: items.length, offset: 0, limit: 25, ...over });

export const examType = (over: Partial<ExamType> = {}): ExamType => ({
  id: 'e-1', code: 'RX-THORAX', name: 'Radiographie du thorax de face', modality: 'XRAY', bodyPart: 'Thorax', usesContrast: false, durationMinutes: 20, preparation: null, active: true, ...over,
});

export const draft = (over: Partial<ReportDraft> = {}): ReportDraft => ({
  technique: 'Face, debout.', findings: 'Opacité alvéolaire du lobe inférieur droit.', impression: 'Pneumopathie.', critical: false, by: radiologist, at: '2026-10-24T10:00:00Z', ...over,
});

export const reportVersion = (over: Partial<ReportVersion> = {}): ReportVersion => ({
  version: 1, technique: 'Face, debout.', findings: 'Opacité alvéolaire du lobe inférieur droit.', impression: 'Pneumopathie.', critical: false, reason: null, signedBy: radiologist, signedAt: '2026-10-24T10:30:00Z', ...over,
});

export const communication = (over: Partial<Communication> = {}): Communication => ({
  version: 1, notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', at: '2026-10-24T10:25:00Z', by: radiologist, ...over,
});

export const emptyReport = (over: Partial<Report> = {}): Report => ({ draft: null, versions: [], communications: [], criticalRequired: false, criticalCommunicated: false, ...over });

/** Une demande non planifiée, avec la question clinique et sans compte rendu. */
export const order = (over: Partial<Order> = {}): Order => ({
  id: 'o-1', number: 'IMG-0000123', status: 'ORDERED', patient, examTypeId: 'e-1', examCode: 'RX-THORAX', examName: 'Radiographie du thorax de face', modality: 'XRAY', usesContrast: false, preparation: null, priority: 'ROUTINE', source: 'OPD',
  clinicalQuestion: 'Toux persistante depuis 3 semaines.', encounterId: null, orderedBy: doctor, orderedAt: '2026-10-24T08:00:00Z', scheduledFor: null, scheduledBy: null, performedAt: null, performedBy: null,
  techniqueNote: null, screening: null, report: emptyReport(), cancelledBy: null, cancelledAt: null, cancellationReason: null, ...over,
});

/** Une demande réalisée : le compte rendu est à rédiger. */
export const performedOrder = (over: Partial<Order> = {}): Order =>
  order({ status: 'PERFORMED', performedAt: '2026-10-24T09:00:00Z', performedBy: radiologist, screening: { pregnant: false, contrastAllergy: false, overrideReason: null }, ...over });

/** Une demande dont le compte rendu est signé. */
export const reportedOrder = (over: Partial<Order> = {}): Order =>
  performedOrder({ status: 'REPORTED', report: emptyReport({ versions: [reportVersion()] }), ...over });

export const summary = (over: Partial<OrderSummary> = {}): OrderSummary => ({
  id: 'o-1', number: 'IMG-0000123', status: 'ORDERED', priority: 'ROUTINE', source: 'OPD', modality: 'XRAY', examCode: 'RX-THORAX', examName: 'Radiographie du thorax de face', patient, orderedBy: doctor,
  orderedAt: '2026-10-24T08:00:00Z', scheduledFor: null, critical: false, ...over,
});

/** Double de test du port `ImagingGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeImagingGateway extends ImagingGateway {
  override listExamTypes = vi.fn<(filter: ExamTypeFilter, offset: number, limit: number) => Promise<Page<ExamType>>>().mockResolvedValue(
    page([examType(), examType({ id: 'e-2', code: 'ECHO-ABD', name: 'Échographie abdominale', modality: 'ULTRASOUND', bodyPart: 'Abdomen', preparation: 'À jeun depuis 6 heures.' })]),
  );
  override createExamType = vi.fn<(input: ExamTypeInput) => Promise<ExamType>>().mockImplementation((input) =>
    Promise.resolve(examType({ id: 'e-new', code: input.code, name: input.name, modality: input.modality, bodyPart: input.bodyPart ?? null, usesContrast: input.usesContrast ?? false, durationMinutes: input.durationMinutes ?? 30, preparation: input.preparation ?? null })),
  );
  override updateExamType = vi.fn<(id: string, changes: ExamTypeChanges) => Promise<ExamType>>().mockImplementation((id, changes) => Promise.resolve(examType({ id, ...changes })));
  override setExamTypeActive = vi.fn<(id: string, active: boolean) => Promise<ExamType>>().mockImplementation((id, active) => Promise.resolve(examType({ id, active })));
  override listOrders = vi.fn<(filter: OrderFilter, offset: number, limit: number) => Promise<Page<OrderSummary>>>().mockResolvedValue(
    page([summary({ priority: 'STAT', source: 'ER', id: 'o-2', number: 'IMG-0000124' }), summary()]),
  );
  override getOrder = vi.fn<(id: string) => Promise<Order>>().mockImplementation(() => Promise.resolve(order()));
  override order = vi.fn<(input: OrderInput) => Promise<Order>>().mockImplementation((input) =>
    Promise.resolve(order({ priority: input.priority ?? 'ROUTINE', source: input.source ?? 'OPD', clinicalQuestion: input.clinicalQuestion, encounterId: input.encounterId ?? null })),
  );
  override cancel = vi.fn<(id: string, reason: string) => Promise<Order>>().mockImplementation((_id, reason) =>
    Promise.resolve(order({ status: 'CANCELLED', cancellationReason: reason, cancelledBy: doctor, cancelledAt: '2026-10-24T09:00:00Z' })),
  );
  override schedule = vi.fn<(id: string, scheduledFor: string) => Promise<Order>>().mockImplementation((_id, scheduledFor) =>
    Promise.resolve(order({ status: 'SCHEDULED', scheduledFor, scheduledBy: radiologist })),
  );
  override perform = vi.fn<(id: string, input: PerformInput) => Promise<Order>>().mockImplementation((_id, input) =>
    Promise.resolve(performedOrder({ techniqueNote: input.techniqueNote ?? null, screening: { pregnant: input.pregnant, contrastAllergy: input.contrastAllergy, overrideReason: input.overrideReason ?? null } })),
  );
  override saveDraft = vi.fn<(id: string, input: DraftInput) => Promise<Order>>().mockImplementation((_id, input) =>
    Promise.resolve(performedOrder({
      report: emptyReport({
        draft: draft({ technique: input.technique ?? null, findings: input.findings ?? null, impression: input.impression ?? null, critical: input.critical === true }),
        criticalRequired: input.critical === true,
      }),
    })),
  );
  override communicate = vi.fn<(id: string, input: CommunicationInput) => Promise<Order>>().mockImplementation(() =>
    Promise.resolve(performedOrder({ report: emptyReport({ draft: draft({ critical: true }), criticalRequired: true, criticalCommunicated: true }) })),
  );
  override sign = vi.fn<(id: string) => Promise<Order>>().mockImplementation(() => Promise.resolve(reportedOrder()));
  override addendum = vi.fn<(id: string, input: AddendumInput) => Promise<Order>>().mockImplementation((_id, input) =>
    Promise.resolve(reportedOrder({
      report: emptyReport({
        versions: [reportVersion(), reportVersion({ version: 2, findings: input.findings ?? '', impression: input.impression ?? '', reason: input.reason, critical: input.critical === true, signedAt: '2026-10-24T11:00:00Z' })],
      }),
    })),
  );
}

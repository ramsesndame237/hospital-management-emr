import { ClinicalGateway } from '../clinical.gateway';
import {
  Addendum, Allergy, AllergyChanges, AllergyInput, Diagnosis, DiagnosisInput, Encounter, EncounterFilter, EncounterSummary, NoteInput, Page, PatientSummary, QueueItem, VitalsInput,
} from '../clinical.models';

export const doctor = { id: 'u-doc', username: 'medecin' };
export const nurse = { id: 'u-nur', username: 'infirmier' };
export const colleague = { id: 'u-doc2', username: 'medecin2' };

export const patient: PatientSummary = { id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14' };

export const page = <T>(items: readonly T[], over: Partial<Page<T>> = {}): Page<T> => ({ items, total: items.length, offset: 0, limit: 25, ...over });

export const allergy = (over: Partial<Allergy> = {}): Allergy => ({
  id: 'al-1', patientId: 'p-1', substance: 'Pénicilline', reaction: 'Urticaire généralisée', severity: 'SEVERE', status: 'ACTIVE', recordedBy: doctor, recordedAt: '2026-10-20T08:00:00Z',
  voidedBy: null, voidedAt: null, voidReason: null, ...over,
});

export const diagnosis = (over: Partial<Diagnosis> = {}): Diagnosis => ({ code: 'J18.9', label: 'Pneumopathie, sans précision', kind: 'PRIMARY', certainty: 'CONFIRMED', ...over });

/** Une consultation en cours, vide, conduite par `medecin`. */
export const encounter = (over: Partial<Encounter> = {}): Encounter => ({
  id: 'e-1', number: 'CON-0000001', status: 'IN_PROGRESS', patient, serviceId: 'svc-1', admissionId: 'adm-1', doctor, startedAt: '2026-10-24T08:00:00Z', vitals: null,
  note: { chiefComplaint: null, history: null, examination: null, assessment: null, plan: null }, diagnoses: [], missingForSignature: ['PRIMARY_DIAGNOSIS', 'ASSESSMENT'], signedBy: null, signedAt: null,
  addenda: [], cancelledBy: null, cancelledAt: null, cancellationReason: null, allergies: [], ...over,
});

export const addendum = (over: Partial<Addendum> = {}): Addendum => ({ seq: 1, text: 'Radiographie reçue : pneumopathie confirmée.', by: doctor, at: '2026-10-24T12:00:00Z', ...over });

export const summary = (over: Partial<EncounterSummary> = {}): EncounterSummary => ({
  id: 'e-1', number: 'CON-0000001', patient, serviceId: 'svc-1', doctor, status: 'SIGNED', startedAt: '2026-10-24T08:00:00Z', signedAt: '2026-10-24T08:40:00Z',
  primaryDiagnosis: { code: 'J18.9', label: 'Pneumopathie, sans précision' }, ...over,
});

export const queueItem = (over: Partial<QueueItem> = {}): QueueItem => ({
  admission: { id: 'adm-1', number: 'ADM-0000012', type: 'OUTPATIENT', admittedAt: '2026-10-24T11:15:00Z', serviceId: 'svc-1' }, patient, encounter: null, ...over,
});

/** Double de test du port `ClinicalGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeClinicalGateway extends ClinicalGateway {
  override getQueue = vi.fn<() => Promise<readonly QueueItem[]>>().mockResolvedValue([
    queueItem({ admission: { id: 'adm-2', number: 'ADM-0000013', type: 'EMERGENCY', admittedAt: '2026-10-24T11:50:00Z', serviceId: 'svc-1' }, patient: { ...patient, id: 'p-2', number: 'PAT-0000002', lastName: 'Ndongo', firstName: 'Paul', sex: 'MALE' } }),
    queueItem(),
  ]);
  override listEncounters = vi.fn<(filter: EncounterFilter, offset: number, limit: number) => Promise<Page<EncounterSummary>>>().mockResolvedValue(page([summary()]));
  override startEncounter = vi.fn<(admissionId: string) => Promise<Encounter>>().mockImplementation((admissionId) => Promise.resolve(encounter({ admissionId })));
  override getEncounter = vi.fn<(id: string) => Promise<Encounter>>().mockImplementation(() => Promise.resolve(encounter()));
  override recordVitals = vi.fn<(id: string, input: VitalsInput) => Promise<Encounter>>().mockImplementation((_id, input) =>
    Promise.resolve(encounter({ vitals: { temperature: null, pulse: null, systolic: null, diastolic: null, respiratoryRate: null, spo2: null, weightKg: null, heightCm: null, ...input, bmi: null, recordedBy: doctor, recordedAt: '2026-10-24T08:05:00Z' } })),
  );
  override updateNote = vi.fn<(id: string, input: NoteInput) => Promise<Encounter>>().mockImplementation((_id, input) =>
    Promise.resolve(encounter({ note: { chiefComplaint: null, history: null, examination: null, assessment: null, plan: null, ...input } })),
  );
  override setDiagnoses = vi.fn<(id: string, diagnoses: readonly DiagnosisInput[]) => Promise<Encounter>>().mockImplementation((_id, diagnoses) =>
    Promise.resolve(encounter({ diagnoses: diagnoses.map((d) => ({ code: d.code, label: d.label, kind: d.kind, certainty: d.certainty ?? 'PROVISIONAL' })) })),
  );
  override signEncounter = vi.fn<(id: string) => Promise<Encounter>>().mockImplementation(() =>
    Promise.resolve(encounter({ status: 'SIGNED', signedBy: doctor, signedAt: '2026-10-24T08:40:00Z', missingForSignature: [] })),
  );
  override addAddendum = vi.fn<(id: string, text: string) => Promise<Encounter>>().mockImplementation((_id, text) =>
    Promise.resolve(encounter({ status: 'SIGNED', signedBy: doctor, signedAt: '2026-10-24T08:40:00Z', missingForSignature: [], addenda: [addendum({ text })] })),
  );
  override cancelEncounter = vi.fn<(id: string, reason: string) => Promise<Encounter>>().mockImplementation((_id, reason) =>
    Promise.resolve(encounter({ status: 'CANCELLED', cancelledBy: doctor, cancelledAt: '2026-10-24T08:10:00Z', cancellationReason: reason })),
  );
  override listAllergies = vi.fn<(patientId: string, includeVoided: boolean) => Promise<readonly Allergy[]>>().mockResolvedValue([allergy()]);
  override recordAllergy = vi.fn<(patientId: string, input: AllergyInput) => Promise<Allergy>>().mockImplementation((patientId, input) =>
    Promise.resolve(allergy({ id: 'al-new', patientId, substance: input.substance, reaction: input.reaction ?? null, severity: input.severity })),
  );
  override updateAllergy = vi.fn<(id: string, changes: AllergyChanges) => Promise<Allergy>>().mockImplementation((id, changes) => Promise.resolve(allergy({ id, ...changes } as Partial<Allergy>)));
  override voidAllergy = vi.fn<(id: string, reason: string) => Promise<Allergy>>().mockImplementation((id, reason) =>
    Promise.resolve(allergy({ id, status: 'ENTERED_IN_ERROR', voidedBy: doctor, voidedAt: '2026-10-24T09:00:00Z', voidReason: reason })),
  );
}

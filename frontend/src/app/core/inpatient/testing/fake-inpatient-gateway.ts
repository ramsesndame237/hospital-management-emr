import { vi } from 'vitest';
import { InpatientGateway } from '../inpatient.gateway';
import { Administration, AdministrationInput, Chart, Medication, NursingNote, Observation, ObservationInput, PatientCard, RecordedObservation, Stay, WardRow } from '../inpatient.models';

export const patientCard: PatientCard = { id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '2019-03-14' };

export const stay = (over: Partial<Stay> = {}): Stay => ({ admissionId: 'adm-1', number: 'ADM-0000012', bed: 'Lit 1', serviceId: 's-1', admittedAt: '2026-11-18T08:00:00Z', days: 3, active: true, ...over });

export const observation = (over: Partial<Observation> = {}): Observation => ({
  id: 'o-1', recordedAt: '2026-11-20T09:30:00Z', recordedBy: 'nurse', temperature: 37.2, pulse: 88, systolic: 124, diastolic: 78, respiratoryRate: 16, spo2: 97, supplementalOxygen: false,
  consciousness: 'ALERT', news2: 0, risk: 'LOW', note: null, ...over,
});

export const medication = (over: Partial<Medication> = {}): Medication => ({
  prescriptionId: 'rx-1', prescriptionNumber: 'RX-0000007', position: 0, drugName: 'Amoxicilline 500 mg', dose: '1 gélule', frequency: '3 fois par jour', instructions: null,
  issuedAt: '2026-11-19T08:30:00Z', allergyWarning: false, last: null, givenCount: 0, ...over,
});

export const wardRow = (over: Partial<WardRow> = {}): WardRow => ({ stay: stay(), patient: patientCard, latest: { recordedAt: '2026-11-20T09:30:00Z', news2: 1, risk: 'LOW' }, ...over });

export const chart = (over: Partial<Chart> = {}): Chart => ({
  stay: stay(), patient: patientCard, observations: [observation()], medications: [medication()], administrations: [], notes: [{ id: 'n-1', text: 'Pansement refait.', writtenAt: '2026-11-20T10:00:00Z', author: 'nurse' }], ...over,
});

/** Double de test : chaque appel est un espion que le test configure. */
export class FakeInpatientGateway extends InpatientGateway {
  override ward = vi.fn<() => Promise<readonly WardRow[]>>().mockResolvedValue([wardRow(), wardRow({ stay: stay({ admissionId: 'adm-2', bed: 'Lit 2' }), patient: { ...patientCard, id: 'p-2', lastName: 'Ndom', firstName: 'Berthe' }, latest: null })]);
  override chart = vi.fn<(admissionId: string) => Promise<Chart>>().mockImplementation(() => Promise.resolve(chart()));
  override recordObservation = vi.fn<(admissionId: string, input: ObservationInput) => Promise<RecordedObservation>>().mockImplementation((_id, input) =>
    Promise.resolve({ ...observation({ id: 'o-new', ...input, diastolic: input.diastolic ?? null, note: input.note ?? null }), escalate: false }),
  );
  override recordAdministration = vi.fn<(admissionId: string, input: AdministrationInput) => Promise<Administration>>().mockImplementation((_id, input) =>
    Promise.resolve({ id: 'a-new', prescriptionNumber: 'RX-0000007', drugName: 'Amoxicilline 500 mg', status: input.status, reason: input.reason ?? null, at: '2026-11-20T11:00:00Z', by: 'nurse' }),
  );
  override addNote = vi.fn<(admissionId: string, text: string) => Promise<NursingNote>>().mockImplementation((_id, text) => Promise.resolve({ id: 'n-new', text, writtenAt: '2026-11-20T11:05:00Z', author: 'nurse' }));
}

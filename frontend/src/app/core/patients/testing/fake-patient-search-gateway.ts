import { PatientPage, PatientSearchGateway, PatientSummary } from '../patient-search.gateway';

export const patientSummary = (over: Partial<PatientSummary> = {}): PatientSummary => ({
  id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14', ageYears: 36, status: 'ACTIVE', city: 'Douala', ...over,
});

/** Double de test du port `PatientSearchGateway`. */
export class FakePatientSearchGateway extends PatientSearchGateway {
  override search = vi.fn<(query: string, limit: number) => Promise<PatientPage>>().mockResolvedValue({
    items: [patientSummary(), patientSummary({ id: 'p-2', number: 'PAT-0000002', lastName: 'Mbarga', firstName: 'Paul', sex: 'MALE', ageYears: 41, city: null })],
    total: 2,
  });
}

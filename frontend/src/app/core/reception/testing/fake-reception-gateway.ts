import { ReceptionGateway } from '../reception.gateway';
import {
  Admission, AdmissionFilter, Appointment, AppointmentChanges, AppointmentFilter, AppointmentInput, Occupancy, OpenAdmissionInput, Page, Patient, PatientCriteria, PatientInput, PatientSummary, Practitioner, Service,
} from '../reception.models';

export const page = <T>(items: readonly T[], over: Partial<Page<T>> = {}): Page<T> => ({ items, total: items.length, offset: 0, limit: 20, ...over });

export const summary = (over: Partial<PatientSummary> = {}): PatientSummary => ({
  id: 'p-1', number: 'PAT-0000001', identityStatus: 'CONFIRMED', lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14', birthDateEstimated: false, ageYears: 36, status: 'ACTIVE', ...over,
});

export const patient = (over: Partial<Patient> = {}): Patient => ({
  ...summary(), birthPlace: 'Douala', nationality: 'CM', maritalStatus: 'MARRIED', occupation: 'Enseignante', phone: '+237 655 00 00 00', email: 'e.mbarga@example.org',
  address: { line: 'Rue de la Joie', quarter: 'Bastos', city: 'Yaoundé', region: 'Centre', country: 'CM' }, identityDocument: { type: 'NATIONAL_ID', number: '123456789' },
  nextOfKin: { name: 'Jeanne Ngo', relationship: 'SPOUSE', phone: '+237 677 00 00 00' }, dateOfDeath: null, ...over,
});

export const service = (over: Partial<Service> = {}): Service => ({ id: 'svc-ped', facilityId: 'fac-1', code: 'PED', name: 'Pédiatrie', ...over });

export const admission = (over: Partial<Admission> = {}): Admission => ({
  id: 'adm-1', number: 'ADM-0000045', type: 'OUTPATIENT', status: 'IN_PROGRESS', patient: { id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'Élisabeth' }, serviceId: 'svc-ped', bed: null,
  appointmentId: null, reasonCode: null, admittedAt: '2026-10-24T11:15:00Z', dischargedAt: null, dischargeType: null, cancellationReason: null, ...over,
});

export const occupancy = (over: Partial<Occupancy> = {}): Occupancy => ({
  serviceId: 'svc-ped', capacity: 2, occupied: 1, free: 1,
  beds: [
    { bedId: 'bed-1', code: 'B1', name: 'Lit 1', location: 'Néonatologie › Salle 1', active: true, occupied: true, admissionId: 'adm-9' },
    { bedId: 'bed-2', code: 'B2', name: 'Lit 2', location: 'Néonatologie › Salle 1', active: true, occupied: false, admissionId: null },
  ], ...over,
});

export const practitioner = (over: Partial<Practitioner> = {}): Practitioner => ({ id: 'st-1', staffNumber: 'D-PED', firstName: 'Marie', lastName: 'Curie', professionCode: 'DOCTOR', ...over });

export const appointment = (over: Partial<Appointment> = {}): Appointment => ({
  id: 'rdv-1', number: 'RDV-0000045', status: 'SCHEDULED', startsAt: '2026-10-24T09:00:00Z', endsAt: '2026-10-24T09:30:00Z', durationMinutes: 30,
  patient: { id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'Élisabeth' }, practitioner: { id: 'st-1', staffNumber: 'D-PED', lastName: 'Curie', firstName: 'Marie' },
  locationId: 'svc-ped', serviceId: 'svc-ped', reasonCode: null, cancellationReason: null, ...over,
});

/** Double de test du port `ReceptionGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeReceptionGateway extends ReceptionGateway {
  override searchPatients = vi.fn<(criteria: PatientCriteria, offset: number, limit: number) => Promise<Page<PatientSummary>>>().mockResolvedValue(page([summary()]));
  override getPatient = vi.fn<(id: string) => Promise<Patient>>().mockImplementation((id) => Promise.resolve(patient({ id })));
  override registerPatient = vi.fn<(input: PatientInput) => Promise<Patient>>().mockImplementation((input) =>
    Promise.resolve(patient({ id: 'p-new', number: 'PAT-0000002', lastName: input.lastName ?? '', firstName: input.firstName ?? '', birthDate: input.birthDate ?? '' })),
  );
  override updatePatient = vi.fn<(id: string, input: PatientInput) => Promise<Patient>>().mockImplementation((id, input) => Promise.resolve(patient({ id, ...(input.lastName ? { lastName: input.lastName } : {}) })));
  override listServices = vi.fn<() => Promise<readonly Service[]>>().mockResolvedValue([service(), service({ id: 'svc-chi', code: 'CHI', name: 'Chirurgie' })]);
  override getOccupancy = vi.fn<(serviceId: string) => Promise<Occupancy>>().mockResolvedValue(occupancy());
  override listAdmissions = vi.fn<(filter: AdmissionFilter, offset: number, limit: number) => Promise<Page<Admission>>>().mockResolvedValue(page([admission()]));
  override openAdmission = vi.fn<(input: OpenAdmissionInput) => Promise<Admission>>().mockImplementation((input) =>
    Promise.resolve(admission({ id: 'adm-new', number: 'ADM-0000046', type: input.type, serviceId: input.serviceId ?? 'svc-ped', bed: input.bedId ? { id: input.bedId, code: 'B2', name: 'Lit 2', location: 'Néonatologie › Salle 1' } : null })),
  );
  override dischargeAdmission = vi.fn<(id: string, type: string) => Promise<Admission>>().mockImplementation((id, type) =>
    Promise.resolve(admission({ id, status: 'DISCHARGED', dischargedAt: '2026-10-24T12:00:00Z', dischargeType: type })),
  );
  override cancelAdmission = vi.fn<(id: string, reason: string) => Promise<Admission>>().mockImplementation((id, reason) =>
    Promise.resolve(admission({ id, status: 'CANCELLED', cancellationReason: reason })),
  );
  override transferAdmission = vi.fn<(id: string, target: { bedId?: string; serviceId?: string }) => Promise<Admission>>().mockImplementation((id, target) =>
    Promise.resolve(admission({ id, serviceId: target.serviceId ?? 'svc-ped' })),
  );
  override listAppointments = vi.fn<(filter: AppointmentFilter, offset: number, limit: number) => Promise<Page<Appointment>>>().mockResolvedValue(page([appointment()]));
  override listPractitioners = vi.fn<(serviceId: string) => Promise<readonly Practitioner[]>>().mockResolvedValue([practitioner()]);
  override scheduleAppointment = vi.fn<(input: AppointmentInput) => Promise<Appointment>>().mockImplementation((input) =>
    Promise.resolve(appointment({ id: 'rdv-new', number: 'RDV-0000046', startsAt: input.startsAt, durationMinutes: input.durationMinutes, serviceId: input.locationId, locationId: input.locationId })),
  );
  override rescheduleAppointment = vi.fn<(id: string, changes: AppointmentChanges) => Promise<Appointment>>().mockImplementation((id, changes) =>
    Promise.resolve(appointment({ id, ...(changes.startsAt ? { startsAt: changes.startsAt } : {}) })),
  );
  override cancelAppointment = vi.fn<(id: string, reason: string) => Promise<Appointment>>().mockImplementation((id, reason) =>
    Promise.resolve(appointment({ id, status: 'CANCELLED', cancellationReason: reason })),
  );
  override markNoShow = vi.fn<(id: string) => Promise<Appointment>>().mockImplementation((id) => Promise.resolve(appointment({ id, status: 'NO_SHOW' })));
}

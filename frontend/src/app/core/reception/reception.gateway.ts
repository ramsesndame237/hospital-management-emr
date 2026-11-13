import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import {
  Admission, AdmissionFilter, Appointment, AppointmentChanges, AppointmentFilter, AppointmentInput, Occupancy, OpenAdmissionInput, Page, Patient, PatientCriteria, PatientInput, PatientSummary, Practitioner, Service,
} from './reception.models';

/**
 * Port d'accès à l'accueil : dossiers patients (recherche, ouverture avec contrôle des doublons, correction) et admissions (arrivée, transfert,
 * sortie, annulation, occupation des lits). Toutes les méthodes rejettent avec une `ApiError` (409 `PATIENT_POSSIBLE_DUPLICATE` avec les
 * dossiers qui ressemblent dans `body.candidates`, 422 `PATIENT_SEARCH_*` pour une recherche trop large).
 */
export abstract class ReceptionGateway {
  abstract searchPatients(criteria: PatientCriteria, offset: number, limit: number): Promise<Page<PatientSummary>>;
  abstract getPatient(id: string): Promise<Patient>;
  abstract registerPatient(input: PatientInput): Promise<Patient>;
  abstract updatePatient(id: string, input: PatientInput): Promise<Patient>;
  /** Les services actifs, pour choisir où accueillir un patient. */
  abstract listServices(): Promise<readonly Service[]>;
  abstract getOccupancy(serviceId: string): Promise<Occupancy>;
  abstract listAdmissions(filter: AdmissionFilter, offset: number, limit: number): Promise<Page<Admission>>;
  abstract openAdmission(input: OpenAdmissionInput): Promise<Admission>;
  abstract dischargeAdmission(id: string, type: string): Promise<Admission>;
  abstract cancelAdmission(id: string, reason: string): Promise<Admission>;
  /** Hospitalisation : `bedId` du nouveau lit ; autre admission : `serviceId` du nouveau service. */
  abstract transferAdmission(id: string, target: { readonly bedId?: string; readonly serviceId?: string }): Promise<Admission>;
  /** L'agenda des services visibles, du plus proche au plus lointain. */
  abstract listAppointments(filter: AppointmentFilter, offset: number, limit: number): Promise<Page<Appointment>>;
  /** Les professionnels actuellement affectés à ce service. */
  abstract listPractitioners(serviceId: string): Promise<readonly Practitioner[]>;
  abstract scheduleAppointment(input: AppointmentInput): Promise<Appointment>;
  abstract rescheduleAppointment(id: string, changes: AppointmentChanges): Promise<Appointment>;
  abstract cancelAppointment(id: string, reason: string): Promise<Appointment>;
  /** Le patient ne s'est pas présenté (possible une fois le créneau commencé). */
  abstract markNoShow(id: string): Promise<Appointment>;
}

/** Adaptateur HTTP des API `/api/v1/patients`, `/api/v1/admissions` et `/api/v1/structure/services`. */
@Injectable()
export class HttpReceptionGateway extends ReceptionGateway {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  override searchPatients(criteria: PatientCriteria, offset: number, limit: number): Promise<Page<PatientSummary>> {
    return this.call(this.http.get<Page<PatientSummary>>(`${this.base}/patients`, { params: { ...clean(criteria), offset, limit } }));
  }

  override getPatient(id: string): Promise<Patient> {
    return this.call(this.http.get<Patient>(`${this.base}/patients/${id}`));
  }

  override registerPatient(input: PatientInput): Promise<Patient> {
    return this.call(this.http.post<Patient>(`${this.base}/patients`, input));
  }

  override updatePatient(id: string, input: PatientInput): Promise<Patient> {
    return this.call(this.http.patch<Patient>(`${this.base}/patients/${id}`, input));
  }

  override listServices(): Promise<readonly Service[]> {
    return this.call(this.http.get<Service[]>(`${this.base}/structure/services`));
  }

  override getOccupancy(serviceId: string): Promise<Occupancy> {
    return this.call(this.http.get<Occupancy>(`${this.base}/admissions/occupancy`, { params: { serviceId } }));
  }

  override listAdmissions(filter: AdmissionFilter, offset: number, limit: number): Promise<Page<Admission>> {
    return this.call(this.http.get<Page<Admission>>(`${this.base}/admissions`, { params: { ...clean(filter), offset, limit } }));
  }

  override openAdmission(input: OpenAdmissionInput): Promise<Admission> {
    return this.call(this.http.post<Admission>(`${this.base}/admissions`, input));
  }

  override dischargeAdmission(id: string, type: string): Promise<Admission> {
    return this.call(this.http.post<Admission>(`${this.base}/admissions/${id}/discharge`, { type }));
  }

  override cancelAdmission(id: string, reason: string): Promise<Admission> {
    return this.call(this.http.post<Admission>(`${this.base}/admissions/${id}/cancel`, { reason }));
  }

  override transferAdmission(id: string, target: { readonly bedId?: string; readonly serviceId?: string }): Promise<Admission> {
    return this.call(this.http.post<Admission>(`${this.base}/admissions/${id}/transfer`, target));
  }

  override listAppointments(filter: AppointmentFilter, offset: number, limit: number): Promise<Page<Appointment>> {
    return this.call(this.http.get<Page<Appointment>>(`${this.base}/appointments`, { params: { ...clean(filter), offset, limit } }));
  }

  override listPractitioners(serviceId: string): Promise<readonly Practitioner[]> {
    return this.call(this.http.get<Practitioner[]>(`${this.base}/structure/${serviceId}/practitioners`));
  }

  override scheduleAppointment(input: AppointmentInput): Promise<Appointment> {
    return this.call(this.http.post<Appointment>(`${this.base}/appointments`, input));
  }

  override rescheduleAppointment(id: string, changes: AppointmentChanges): Promise<Appointment> {
    return this.call(this.http.post<Appointment>(`${this.base}/appointments/${id}/reschedule`, changes));
  }

  override cancelAppointment(id: string, reason: string): Promise<Appointment> {
    return this.call(this.http.post<Appointment>(`${this.base}/appointments/${id}/cancel`, { reason }));
  }

  override markNoShow(id: string): Promise<Appointment> {
    return this.call(this.http.post<Appointment>(`${this.base}/appointments/${id}/no-show`, null));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

/** Les critères renseignés seulement : une valeur vide n'est pas un critère. */
function clean(values: object): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => typeof v === 'string' && v.trim() !== '').map(([k, v]) => [k, (v as string).trim()]));
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { Administration, AdministrationInput, Chart, NursingNote, ObservationInput, RecordedObservation, WardRow } from './inpatient.models';

/**
 * Port des soins au lit du patient hospitalisé : constantes (score NEWS2), administration des médicaments et notes de soins. Les écrans ne
 * connaissent que ce contrat ; toutes les méthodes rejettent avec une `ApiError` (404 hors du service du soignant, 409 si le patient est sorti).
 */
export abstract class InpatientGateway {
  abstract ward(): Promise<readonly WardRow[]>;
  abstract chart(admissionId: string): Promise<Chart>;
  abstract recordObservation(admissionId: string, input: ObservationInput): Promise<RecordedObservation>;
  abstract recordAdministration(admissionId: string, input: AdministrationInput): Promise<Administration>;
  abstract addNote(admissionId: string, text: string): Promise<NursingNote>;
}

/** Adaptateur HTTP de l'API `/api/v1/inpatient`. */
@Injectable()
export class HttpInpatientGateway extends InpatientGateway {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/inpatient`;

  override ward(): Promise<readonly WardRow[]> {
    return this.call(this.http.get<WardRow[]>(`${this.base}/ward`));
  }

  override chart(admissionId: string): Promise<Chart> {
    return this.call(this.http.get<Chart>(`${this.base}/admissions/${admissionId}/chart`));
  }

  override recordObservation(admissionId: string, input: ObservationInput): Promise<RecordedObservation> {
    return this.call(this.http.post<RecordedObservation>(`${this.base}/admissions/${admissionId}/observations`, input));
  }

  override recordAdministration(admissionId: string, input: AdministrationInput): Promise<Administration> {
    return this.call(this.http.post<Administration>(`${this.base}/admissions/${admissionId}/administrations`, input));
  }

  override addNote(admissionId: string, text: string): Promise<NursingNote> {
    return this.call(this.http.post<NursingNote>(`${this.base}/admissions/${admissionId}/notes`, { text }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

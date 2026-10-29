import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';

/** Résumé d'un dossier patient tel que la recherche le renvoie : identité et âge, jamais de donnée clinique. */
export interface PatientSummary {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
  readonly ageYears: number;
  readonly status: 'ACTIVE' | 'DECEASED';
  readonly city: string | null;
}

export interface PatientPage {
  readonly items: readonly PatientSummary[];
  readonly total: number;
}

/**
 * Port de recherche de patients (module Patients de l'API). L'API exige au moins un critère et deux lettres par mot : une
 * recherche trop large est refusée par le serveur (422 `PATIENT_SEARCH_*`), pas par l'écran.
 */
export abstract class PatientSearchGateway {
  abstract search(query: string, limit: number): Promise<PatientPage>;
}

@Injectable()
export class HttpPatientSearchGateway extends PatientSearchGateway {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  override async search(query: string, limit: number): Promise<PatientPage> {
    return this.call(this.http.get<PatientPage>(`${this.base}/patients`, { params: { q: query, limit } }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

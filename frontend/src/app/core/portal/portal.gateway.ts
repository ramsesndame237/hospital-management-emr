import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { PortalAccount, PortalAppointment, PortalInvoice, PortalPatient, PortalPrescription, PortalResult } from './portal.models';

/**
 * Port du portail patient : le patient lit SON espace (le serveur ne sert que le dossier auquel son compte est relié — jamais un identifiant donné par
 * l'écran) ; l'accueil relie un compte à un dossier. Toutes les méthodes rejettent avec une `ApiError` (404 `PORTAL_NOT_LINKED` pour un compte sans dossier).
 */
export abstract class PortalGateway {
  abstract getMe(): Promise<PortalPatient>;
  abstract getAppointments(): Promise<readonly PortalAppointment[]>;
  abstract getResults(): Promise<readonly PortalResult[]>;
  abstract getPrescriptions(): Promise<readonly PortalPrescription[]>;
  abstract getInvoices(): Promise<readonly PortalInvoice[]>;
  /** Le compte du portail d'un dossier, `null` s'il n'en a pas. */
  abstract getAccountOf(patientId: string): Promise<PortalAccount | null>;
  /** Relie un compte patient à un dossier : un lien ne se modifie pas (409 `PORTAL_ALREADY_LINKED`). */
  abstract linkAccount(username: string, patientId: string): Promise<PortalAccount>;
}

/** Adaptateur HTTP de l'API `/api/v1/portal`. */
@Injectable()
export class HttpPortalGateway extends PortalGateway {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/portal`;

  override getMe(): Promise<PortalPatient> {
    return this.call(this.http.get<PortalPatient>(`${this.base}/me`));
  }

  override getAppointments(): Promise<readonly PortalAppointment[]> {
    return this.call(this.http.get<PortalAppointment[]>(`${this.base}/appointments`));
  }

  override getResults(): Promise<readonly PortalResult[]> {
    return this.call(this.http.get<PortalResult[]>(`${this.base}/results`));
  }

  override getPrescriptions(): Promise<readonly PortalPrescription[]> {
    return this.call(this.http.get<PortalPrescription[]>(`${this.base}/prescriptions`));
  }

  override getInvoices(): Promise<readonly PortalInvoice[]> {
    return this.call(this.http.get<PortalInvoice[]>(`${this.base}/invoices`));
  }

  override async getAccountOf(patientId: string): Promise<PortalAccount | null> {
    try {
      return await this.call(this.http.get<PortalAccount>(`${this.base}/patients/${patientId}/account`));
    } catch (error) {
      if (toApiError(error).code === 'PORTAL_ACCOUNT_NOT_FOUND') return null;
      throw error;
    }
  }

  override linkAccount(username: string, patientId: string): Promise<PortalAccount> {
    return this.call(this.http.post<PortalAccount>(`${this.base}/accounts`, { username, patientId }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

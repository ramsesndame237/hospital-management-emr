import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { Allergy, AllergyChanges, AllergyInput, DiagnosisInput, Encounter, EncounterFilter, EncounterSummary, NoteInput, Page, QueueItem, VitalsInput } from './clinical.models';

/**
 * Port d'accès au dossier clinique : file d'attente du médecin, consultations (constantes, note SOAP, diagnostics, signature, addenda) et
 * allergies des patients. Les écrans ne connaissent que ce contrat ; toutes les méthodes rejettent avec une `ApiError` (409
 * `CLINICAL_ENCOUNTER_LOCKED` sur une consultation signée, 403 `CLINICAL_NOT_AUTHOR` pour un autre médecin que son auteur).
 */
export abstract class ClinicalGateway {
  /** Patients arrivés dans les services de l'utilisateur et pas encore vus, les plus anciens d'abord. */
  abstract getQueue(): Promise<readonly QueueItem[]>;
  abstract listEncounters(filter: EncounterFilter, offset: number, limit: number): Promise<Page<EncounterSummary>>;
  /** Ouvre la consultation d'un patient arrivé ; 409 `CLINICAL_ENCOUNTER_ALREADY_OPEN` s'il y en a déjà une en cours (la file donne celle à reprendre). */
  abstract startEncounter(admissionId: string): Promise<Encounter>;
  abstract getEncounter(id: string): Promise<Encounter>;
  /** Remplace le relevé de constantes. */
  abstract recordVitals(id: string, input: VitalsInput): Promise<Encounter>;
  /** Champs absents : inchangés ; vides : effacés. */
  abstract updateNote(id: string, input: NoteInput): Promise<Encounter>;
  /** Remplace d'un bloc les diagnostics. */
  abstract setDiagnoses(id: string, diagnoses: readonly DiagnosisInput[]): Promise<Encounter>;
  /** Signe et verrouille : il faut un diagnostic principal et une évaluation. */
  abstract signEncounter(id: string): Promise<Encounter>;
  abstract addAddendum(id: string, text: string): Promise<Encounter>;
  abstract cancelEncounter(id: string, reason: string): Promise<Encounter>;
  abstract listAllergies(patientId: string, includeVoided: boolean): Promise<readonly Allergy[]>;
  abstract recordAllergy(patientId: string, input: AllergyInput): Promise<Allergy>;
  abstract updateAllergy(id: string, changes: AllergyChanges): Promise<Allergy>;
  /** Déclare une saisie erronée : l'allergie sort de la liste active mais reste au dossier. */
  abstract voidAllergy(id: string, reason: string): Promise<Allergy>;
}

/** Adaptateur HTTP de l'API `/api/v1/clinical`. */
@Injectable()
export class HttpClinicalGateway extends ClinicalGateway {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/clinical`;

  override getQueue(): Promise<readonly QueueItem[]> {
    return this.call(this.http.get<QueueItem[]>(`${this.base}/queue`));
  }

  override listEncounters(filter: EncounterFilter, offset: number, limit: number): Promise<Page<EncounterSummary>> {
    const params: Record<string, string | number> = { offset, limit };
    for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== false && value !== '') params[key] = value === true ? 'true' : (value as string);
    return this.call(this.http.get<Page<EncounterSummary>>(`${this.base}/encounters`, { params }));
  }

  override startEncounter(admissionId: string): Promise<Encounter> {
    return this.call(this.http.post<Encounter>(`${this.base}/encounters`, { admissionId }));
  }

  override getEncounter(id: string): Promise<Encounter> {
    return this.call(this.http.get<Encounter>(`${this.base}/encounters/${id}`));
  }

  override recordVitals(id: string, input: VitalsInput): Promise<Encounter> {
    return this.call(this.http.put<Encounter>(`${this.base}/encounters/${id}/vitals`, input));
  }

  override updateNote(id: string, input: NoteInput): Promise<Encounter> {
    return this.call(this.http.put<Encounter>(`${this.base}/encounters/${id}/note`, input));
  }

  override setDiagnoses(id: string, diagnoses: readonly DiagnosisInput[]): Promise<Encounter> {
    return this.call(this.http.put<Encounter>(`${this.base}/encounters/${id}/diagnoses`, { diagnoses }));
  }

  override signEncounter(id: string): Promise<Encounter> {
    return this.call(this.http.post<Encounter>(`${this.base}/encounters/${id}/sign`, null));
  }

  override addAddendum(id: string, text: string): Promise<Encounter> {
    return this.call(this.http.post<Encounter>(`${this.base}/encounters/${id}/addenda`, { text }));
  }

  override cancelEncounter(id: string, reason: string): Promise<Encounter> {
    return this.call(this.http.post<Encounter>(`${this.base}/encounters/${id}/cancel`, { reason }));
  }

  override listAllergies(patientId: string, includeVoided: boolean): Promise<readonly Allergy[]> {
    return this.call(this.http.get<Allergy[]>(`${this.base}/patients/${patientId}/allergies`, { params: includeVoided ? { includeVoided: 'true' } : {} }));
  }

  override recordAllergy(patientId: string, input: AllergyInput): Promise<Allergy> {
    return this.call(this.http.post<Allergy>(`${this.base}/patients/${patientId}/allergies`, input));
  }

  override updateAllergy(id: string, changes: AllergyChanges): Promise<Allergy> {
    return this.call(this.http.patch<Allergy>(`${this.base}/allergies/${id}`, changes));
  }

  override voidAllergy(id: string, reason: string): Promise<Allergy> {
    return this.call(this.http.post<Allergy>(`${this.base}/allergies/${id}/void`, { reason }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

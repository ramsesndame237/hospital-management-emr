import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { Translator } from '../i18n/translator';
import { AssignInput, Assignment, ReferenceChoice, RegisterStaffInput, StaffChanges, StaffMember, StaffPage, StaffQuery } from './staff.models';

/**
 * Port des fiches du personnel : la personne qui travaille, avec ou sans compte de connexion, et ses affectations.
 * Toutes les méthodes rejettent avec une `ApiError`. Une fiche n'est jamais supprimée : un départ est une date.
 */
export abstract class StaffGateway {
  abstract list(query: StaffQuery): Promise<StaffPage>;
  abstract register(input: RegisterStaffInput): Promise<StaffMember>;
  abstract update(id: string, changes: StaffChanges): Promise<StaffMember>;
  abstract depart(id: string, departedOn?: string): Promise<StaffMember>;
  /** Un compte pour une fiche, et inversement. */
  abstract linkAccount(id: string, userId: string): Promise<StaffMember>;
  abstract unlinkAccount(id: string): Promise<StaffMember>;
  abstract assignments(id: string): Promise<readonly Assignment[]>;
  abstract assign(id: string, input: AssignInput): Promise<Assignment>;
  abstract endAssignment(assignmentId: string, endDate?: string): Promise<Assignment>;
  abstract professions(): Promise<readonly ReferenceChoice[]>;
  abstract specialties(): Promise<readonly ReferenceChoice[]>;
}

interface ReferenceEntry {
  readonly code: string;
  readonly labels: Record<string, string>;
}

/** Adaptateur HTTP de `/api/v1/staff`, `/api/v1/assignments` et des référentiels PROFESSION / SPECIALTY. */
@Injectable()
export class HttpStaffGateway extends StaffGateway {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);
  private readonly i18n = inject(Translator);

  override list(query: StaffQuery): Promise<StaffPage> {
    const params: Record<string, string | number> = { offset: query.offset, limit: query.limit };
    if (query.search) params['search'] = query.search;
    if (query.status) params['status'] = query.status;
    return this.call(this.http.get<StaffPage>(`${this.base}/staff`, { params }));
  }

  override register(input: RegisterStaffInput): Promise<StaffMember> {
    return this.call(this.http.post<StaffMember>(`${this.base}/staff`, input));
  }

  override update(id: string, changes: StaffChanges): Promise<StaffMember> {
    return this.call(this.http.patch<StaffMember>(`${this.base}/staff/${id}`, changes));
  }

  override depart(id: string, departedOn?: string): Promise<StaffMember> {
    return this.call(this.http.post<StaffMember>(`${this.base}/staff/${id}/depart`, departedOn ? { departedOn } : {}));
  }

  override linkAccount(id: string, userId: string): Promise<StaffMember> {
    return this.call(this.http.put<StaffMember>(`${this.base}/staff/${id}/account`, { userId }));
  }

  override unlinkAccount(id: string): Promise<StaffMember> {
    return this.call(this.http.delete<StaffMember>(`${this.base}/staff/${id}/account`));
  }

  override assignments(id: string): Promise<readonly Assignment[]> {
    return this.call(this.http.get<Assignment[]>(`${this.base}/staff/${id}/assignments`));
  }

  override assign(id: string, input: AssignInput): Promise<Assignment> {
    return this.call(this.http.post<Assignment>(`${this.base}/staff/${id}/assignments`, input));
  }

  override endAssignment(assignmentId: string, endDate?: string): Promise<Assignment> {
    return this.call(this.http.post<Assignment>(`${this.base}/assignments/${assignmentId}/end`, endDate ? { endDate } : {}));
  }

  override professions(): Promise<readonly ReferenceChoice[]> {
    return this.reference('PROFESSION');
  }

  override specialties(): Promise<readonly ReferenceChoice[]> {
    return this.reference('SPECIALTY');
  }

  private async reference(catalog: string): Promise<readonly ReferenceChoice[]> {
    const page = await this.call(this.http.get<{ items: ReferenceEntry[] }>(`${this.base}/referentials/${catalog}/entries`, { params: { limit: 200 } }));
    const locale = this.i18n.locale();
    return page.items.map((e) => ({ code: e.code, label: e.labels[locale] ?? e.labels['fr'] ?? Object.values(e.labels)[0] ?? e.code }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

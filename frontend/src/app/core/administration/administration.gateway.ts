import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { ApiError, toApiError } from '../http/api-error';
import { Translator } from '../i18n/translator';
import {
  ChildInput, Facility, FacilityInput, FacilityStatus, NodeChanges, Organization, ReferenceOption, ServiceInput, StructureNode, StructureTree,
} from './administration.models';

/**
 * Port d'accès à l'administration de l'établissement : organisation, sites et structure (services, unités, salles, lits).
 * Les écrans ne connaissent que ce contrat. Toutes les méthodes rejettent avec une `ApiError`.
 */
export abstract class AdministrationGateway {
  /** `null` tant que l'organisation n'est pas configurée. */
  abstract getOrganization(): Promise<Organization | null>;
  abstract saveOrganization(name: string): Promise<Organization>;
  abstract listFacilities(): Promise<readonly Facility[]>;
  abstract registerFacility(input: FacilityInput): Promise<Facility>;
  abstract updateFacility(id: string, changes: { name?: string; code?: string }): Promise<Facility>;
  abstract changeFacilityStatus(id: string, status: FacilityStatus): Promise<Facility>;
  abstract structure(facilityId: string, includeInactive: boolean): Promise<StructureTree>;
  abstract createService(facilityId: string, input: ServiceInput): Promise<StructureNode>;
  abstract createChild(parentId: string, input: ChildInput): Promise<StructureNode>;
  abstract updateNode(id: string, changes: NodeChanges): Promise<StructureNode>;
  abstract setNodeActive(id: string, active: boolean): Promise<StructureNode>;
  /** Spécialités actives du référentiel, libellées dans la langue courante. */
  abstract specialties(): Promise<readonly ReferenceOption[]>;
}

interface ReferenceEntry {
  readonly code: string;
  readonly labels: Readonly<Record<string, string>>;
}

/** Adaptateur HTTP de l'API `/api/v1` (organisation, établissements, structure, référentiels). */
@Injectable()
export class HttpAdministrationGateway extends AdministrationGateway {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);
  private readonly i18n = inject(Translator);

  override async getOrganization(): Promise<Organization | null> {
    try {
      return await this.call(this.http.get<Organization>(`${this.base}/organization`));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ORGANIZATION_NOT_FOUND') return null;
      throw error;
    }
  }

  override saveOrganization(name: string): Promise<Organization> {
    return this.call(this.http.put<Organization>(`${this.base}/organization`, { name }));
  }

  override async listFacilities(): Promise<readonly Facility[]> {
    const page = await this.call(this.http.get<{ items: Facility[] }>(`${this.base}/facilities`, { params: { limit: 200 } }));
    return page.items;
  }

  override registerFacility(input: FacilityInput): Promise<Facility> {
    return this.call(this.http.post<Facility>(`${this.base}/facilities`, input));
  }

  override updateFacility(id: string, changes: { name?: string; code?: string }): Promise<Facility> {
    return this.call(this.http.patch<Facility>(`${this.base}/facilities/${id}`, changes));
  }

  override changeFacilityStatus(id: string, status: FacilityStatus): Promise<Facility> {
    return this.call(this.http.post<Facility>(`${this.base}/facilities/${id}/status`, { status }));
  }

  override structure(facilityId: string, includeInactive: boolean): Promise<StructureTree> {
    return this.call(this.http.get<StructureTree>(`${this.base}/facilities/${facilityId}/structure`, { params: { includeInactive } }));
  }

  override createService(facilityId: string, input: ServiceInput): Promise<StructureNode> {
    return this.call(this.http.post<StructureNode>(`${this.base}/facilities/${facilityId}/services`, input));
  }

  override createChild(parentId: string, input: ChildInput): Promise<StructureNode> {
    return this.call(this.http.post<StructureNode>(`${this.base}/structure/${parentId}/children`, input));
  }

  override updateNode(id: string, changes: NodeChanges): Promise<StructureNode> {
    return this.call(this.http.patch<StructureNode>(`${this.base}/structure/${id}`, changes));
  }

  override setNodeActive(id: string, active: boolean): Promise<StructureNode> {
    return this.call(this.http.post<StructureNode>(`${this.base}/structure/${id}/${active ? 'activate' : 'deactivate'}`, null));
  }

  override async specialties(): Promise<readonly ReferenceOption[]> {
    const page = await this.call(this.http.get<{ items: ReferenceEntry[] }>(`${this.base}/referentials/SPECIALTY/entries`, { params: { limit: 200 } }));
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

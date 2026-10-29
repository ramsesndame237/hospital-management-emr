import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import {
  CollectInput, LabTest, OrderInput, Page, RejectInput, Requisition, RequisitionBySpecimen, RequisitionFilter, RequisitionSummary, TestFilter,
} from './lab.models';

/**
 * Port d'accès au laboratoire : catalogue des analyses, demandes d'analyses, prélèvement, réception et rejet des échantillons. Les écrans
 * ne connaissent que ce contrat ; toutes les méthodes rejettent avec une `ApiError` (409 `LAB_IDENTITY_MISMATCH` si le bracelet ne
 * correspond pas à la demande).
 */
export abstract class LabGateway {
  abstract listTests(filter: TestFilter, offset: number, limit: number): Promise<Page<LabTest>>;
  abstract listRequisitions(filter: RequisitionFilter, offset: number, limit: number): Promise<Page<RequisitionSummary>>;
  abstract getRequisition(id: string): Promise<Requisition>;
  abstract order(input: OrderInput): Promise<Requisition>;
  abstract cancel(id: string, reason: string): Promise<Requisition>;
  /** Retrouve la demande d'un échantillon d'après son code-barres (scan). */
  abstract findByBarcode(barcode: string): Promise<RequisitionBySpecimen>;
  /** Prélève : le préleveur confirme le numéro de dossier ET la date de naissance lus sur le bracelet. */
  abstract collect(specimenId: string, input: CollectInput): Promise<Requisition>;
  abstract receive(specimenId: string): Promise<Requisition>;
  /** Rejette l'échantillon : un nouveau prélèvement est créé automatiquement. */
  abstract reject(specimenId: string, input: RejectInput): Promise<Requisition>;
}

/** Adaptateur HTTP de l'API `/api/v1/lab`. */
@Injectable()
export class HttpLabGateway extends LabGateway {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/lab`;

  override listTests(filter: TestFilter, offset: number, limit: number): Promise<Page<LabTest>> {
    const params: Record<string, string | number> = { offset, limit };
    if (filter.search) params['search'] = filter.search;
    if (filter.section) params['section'] = filter.section;
    return this.call(this.http.get<Page<LabTest>>(`${this.base}/tests`, { params }));
  }

  override listRequisitions(filter: RequisitionFilter, offset: number, limit: number): Promise<Page<RequisitionSummary>> {
    const params: Record<string, string | number> = { offset, limit };
    for (const [key, value] of Object.entries(filter)) if (value) params[key] = value;
    return this.call(this.http.get<Page<RequisitionSummary>>(`${this.base}/requisitions`, { params }));
  }

  override getRequisition(id: string): Promise<Requisition> {
    return this.call(this.http.get<Requisition>(`${this.base}/requisitions/${id}`));
  }

  override order(input: OrderInput): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.base}/requisitions`, input));
  }

  override cancel(id: string, reason: string): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.base}/requisitions/${id}/cancel`, { reason }));
  }

  override findByBarcode(barcode: string): Promise<RequisitionBySpecimen> {
    return this.call(this.http.get<RequisitionBySpecimen>(`${this.base}/specimens/by-barcode/${encodeURIComponent(barcode)}`));
  }

  override collect(specimenId: string, input: CollectInput): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.base}/specimens/${specimenId}/collect`, input));
  }

  override receive(specimenId: string): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.base}/specimens/${specimenId}/receive`, null));
  }

  override reject(specimenId: string, input: RejectInput): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.base}/specimens/${specimenId}/reject`, input));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

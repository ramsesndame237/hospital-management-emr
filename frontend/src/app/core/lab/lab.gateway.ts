import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import {
  BatchOutcome, CollectInput, LabTest, NotifyInput, ReferenceRange, Report, TestChanges, TestInput, OrderInput, Page, RejectInput, Requisition, RequisitionBySpecimen, RequisitionFilter, RequisitionSummary, TestFilter,
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
  /** Saisit (ou corrige, tant que rien n'est validé) le résultat d'une analyse. Le serveur calcule le drapeau et l'alerte de variation. */
  abstract enterResult(requisitionId: string, testId: string, value: string, comment: string | null): Promise<Requisition>;
  /** Valide un résultat saisi : jamais par son auteur (409 `LAB_VERIFY_SELF`). */
  abstract verifyResult(requisitionId: string, testId: string): Promise<Requisition>;
  abstract returnResult(requisitionId: string, testId: string, reason: string): Promise<Requisition>;
  /** Documente l'appel du clinicien pour une valeur critique ; condition de la publication. */
  abstract notifyCritical(requisitionId: string, testId: string, input: NotifyInput): Promise<Requisition>;
  abstract releaseResult(requisitionId: string, testId: string): Promise<Requisition>;
  /** Valide d'un coup tous les résultats saisis, sauf ceux de l'appelant (quatre yeux). */
  abstract verifyAll(requisitionId: string): Promise<BatchOutcome>;
  /** Publie d'un coup tous les résultats validés, sauf ceux de l'appelant et les valeurs critiques sans appel documenté. */
  abstract releaseAll(requisitionId: string): Promise<BatchOutcome>;
  abstract getReport(requisitionId: string): Promise<Report>;
  abstract createTest(input: TestInput): Promise<LabTest>;
  abstract updateTest(id: string, changes: TestChanges): Promise<LabTest>;
  /** Remplace d'un bloc les valeurs de référence (analyse numérique). */
  abstract setRanges(id: string, ranges: readonly ReferenceRange[]): Promise<LabTest>;
  abstract setTestActive(id: string, active: boolean): Promise<LabTest>;
  /** Amende un résultat publié : nouvelle version avec son motif. */
  abstract amendResult(requisitionId: string, testId: string, value: string, reason: string, comment: string | null): Promise<Requisition>;
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
    if (filter.includeInactive) params['includeInactive'] = 'true';
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

  override verifyAll(requisitionId: string): Promise<BatchOutcome> {
    return this.call(this.http.post<BatchOutcome>(`${this.base}/requisitions/${requisitionId}/results/verify`, null));
  }

  override releaseAll(requisitionId: string): Promise<BatchOutcome> {
    return this.call(this.http.post<BatchOutcome>(`${this.base}/requisitions/${requisitionId}/results/release`, null));
  }

  override getReport(requisitionId: string): Promise<Report> {
    return this.call(this.http.get<Report>(`${this.base}/requisitions/${requisitionId}/report`));
  }

  override createTest(input: TestInput): Promise<LabTest> {
    return this.call(this.http.post<LabTest>(`${this.base}/tests`, input));
  }

  override updateTest(id: string, changes: TestChanges): Promise<LabTest> {
    return this.call(this.http.patch<LabTest>(`${this.base}/tests/${id}`, changes));
  }

  override setRanges(id: string, ranges: readonly ReferenceRange[]): Promise<LabTest> {
    return this.call(this.http.put<LabTest>(`${this.base}/tests/${id}/ranges`, { ranges }));
  }

  override setTestActive(id: string, active: boolean): Promise<LabTest> {
    return this.call(this.http.post<LabTest>(`${this.base}/tests/${id}/${active ? 'activate' : 'deactivate'}`, null));
  }

  private results(requisitionId: string, testId: string): string {
    return `${this.base}/requisitions/${requisitionId}/results/${testId}`;
  }

  override enterResult(requisitionId: string, testId: string, value: string, comment: string | null): Promise<Requisition> {
    return this.call(this.http.put<Requisition>(this.results(requisitionId, testId), { value, comment }));
  }

  override verifyResult(requisitionId: string, testId: string): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.results(requisitionId, testId)}/verify`, null));
  }

  override returnResult(requisitionId: string, testId: string, reason: string): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.results(requisitionId, testId)}/return`, { reason }));
  }

  override notifyCritical(requisitionId: string, testId: string, input: NotifyInput): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.results(requisitionId, testId)}/critical-notification`, input));
  }

  override releaseResult(requisitionId: string, testId: string): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.results(requisitionId, testId)}/release`, null));
  }

  override amendResult(requisitionId: string, testId: string, value: string, reason: string, comment: string | null): Promise<Requisition> {
    return this.call(this.http.post<Requisition>(`${this.results(requisitionId, testId)}/amend`, { value, reason, comment }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import {
  AddendumInput, CommunicationInput, DraftInput, ExamType, ExamTypeChanges, ExamTypeFilter, ExamTypeInput, Order, OrderFilter, OrderInput, OrderSummary, Page, PerformInput,
} from './imaging.models';

/**
 * Port d'accès à l'imagerie : catalogue des examens, demandes, planning, réalisation avec dépistage de sécurité, comptes rendus. Les écrans ne
 * connaissent que ce contrat ; toutes les méthodes rejettent avec une `ApiError` (409 `IMG_PREGNANCY_RISK` / `IMG_CONTRAST_ALLERGY` tant qu'aucune
 * dérogation motivée n'est donnée, 409 `IMG_CRITICAL_NOT_COMMUNICATED` tant que l'appel du clinicien n'est pas documenté).
 */
export abstract class ImagingGateway {
  abstract listExamTypes(filter: ExamTypeFilter, offset: number, limit: number): Promise<Page<ExamType>>;
  abstract createExamType(input: ExamTypeInput): Promise<ExamType>;
  abstract updateExamType(id: string, changes: ExamTypeChanges): Promise<ExamType>;
  abstract setExamTypeActive(id: string, active: boolean): Promise<ExamType>;
  abstract listOrders(filter: OrderFilter, offset: number, limit: number): Promise<Page<OrderSummary>>;
  abstract getOrder(id: string): Promise<Order>;
  abstract order(input: OrderInput): Promise<Order>;
  abstract cancel(id: string, reason: string): Promise<Order>;
  /** (Re)planifie l'examen au créneau donné (ISO 8601, jamais dans le passé). */
  abstract schedule(id: string, scheduledFor: string): Promise<Order>;
  /** Réalise l'examen après le dépistage de sécurité (grossesse, allergie au contraste). */
  abstract perform(id: string, input: PerformInput): Promise<Order>;
  abstract saveDraft(id: string, input: DraftInput): Promise<Order>;
  /** Documente l'appel du clinicien pour une découverte critique ; condition de la signature. */
  abstract communicate(id: string, input: CommunicationInput): Promise<Order>;
  abstract sign(id: string): Promise<Order>;
  abstract addendum(id: string, input: AddendumInput): Promise<Order>;
}

/** Adaptateur HTTP de l'API `/api/v1/imaging`. */
@Injectable()
export class HttpImagingGateway extends ImagingGateway {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/imaging`;

  override listExamTypes(filter: ExamTypeFilter, offset: number, limit: number): Promise<Page<ExamType>> {
    const params: Record<string, string | number> = { offset, limit };
    if (filter.search) params['search'] = filter.search;
    if (filter.modality) params['modality'] = filter.modality;
    if (filter.includeInactive) params['includeInactive'] = 'true';
    return this.call(this.http.get<Page<ExamType>>(`${this.base}/exam-types`, { params }));
  }

  override createExamType(input: ExamTypeInput): Promise<ExamType> {
    return this.call(this.http.post<ExamType>(`${this.base}/exam-types`, input));
  }

  override updateExamType(id: string, changes: ExamTypeChanges): Promise<ExamType> {
    return this.call(this.http.patch<ExamType>(`${this.base}/exam-types/${id}`, changes));
  }

  override setExamTypeActive(id: string, active: boolean): Promise<ExamType> {
    return this.call(this.http.post<ExamType>(`${this.base}/exam-types/${id}/${active ? 'activate' : 'deactivate'}`, null));
  }

  override listOrders(filter: OrderFilter, offset: number, limit: number): Promise<Page<OrderSummary>> {
    const params: Record<string, string | number> = { offset, limit };
    for (const [key, value] of Object.entries(filter)) if (value) params[key] = value;
    return this.call(this.http.get<Page<OrderSummary>>(`${this.base}/orders`, { params }));
  }

  override getOrder(id: string): Promise<Order> {
    return this.call(this.http.get<Order>(`${this.base}/orders/${id}`));
  }

  override order(input: OrderInput): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders`, input));
  }

  override cancel(id: string, reason: string): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/cancel`, { reason }));
  }

  override schedule(id: string, scheduledFor: string): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/schedule`, { scheduledFor }));
  }

  override perform(id: string, input: PerformInput): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/perform`, input));
  }

  override saveDraft(id: string, input: DraftInput): Promise<Order> {
    return this.call(this.http.put<Order>(`${this.base}/orders/${id}/report-draft`, input));
  }

  override communicate(id: string, input: CommunicationInput): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/critical-communication`, input));
  }

  override sign(id: string): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/report/sign`, null));
  }

  override addendum(id: string, input: AddendumInput): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/report/addendum`, input));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

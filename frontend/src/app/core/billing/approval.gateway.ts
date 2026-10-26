import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { Approval, ApprovalFilter, ApprovalPage, RequestApprovalInput } from './approval.models';

/**
 * Port d'accès au circuit d'approbation : le caissier envoie une demande motivée (remise au-delà du seuil, annulation d'une facture
 * émise), un responsable l'accepte ou la refuse. Toutes les méthodes rejettent avec une `ApiError` (409 `BILLING_APPROVAL_STALE` si la
 * facture a changé depuis la demande, `BILLING_APPROVAL_SELF` si l'on décide de sa propre demande).
 */
export abstract class ApprovalGateway {
  abstract list(filter: ApprovalFilter, offset: number, limit: number): Promise<ApprovalPage>;
  abstract request(input: RequestApprovalInput): Promise<Approval>;
  /** Accepte : la remise ou l'annulation est appliquée à la facture. Le commentaire est facultatif. */
  abstract approve(id: string, comment: string | null): Promise<Approval>;
  /** Refuse : le commentaire est obligatoire. */
  abstract reject(id: string, comment: string): Promise<Approval>;
  /** L'auteur retire sa demande tant qu'elle n'est pas décidée. */
  abstract withdraw(id: string): Promise<Approval>;
}

/** Adaptateur HTTP de l'API `/api/v1/billing/approvals`. */
@Injectable()
export class HttpApprovalGateway extends ApprovalGateway {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/billing/approvals`;

  override list(filter: ApprovalFilter, offset: number, limit: number): Promise<ApprovalPage> {
    const params: Record<string, string | number> = { offset, limit };
    if (filter.status) params['status'] = filter.status;
    if (filter.kind) params['kind'] = filter.kind;
    return this.call(this.http.get<ApprovalPage>(this.base, { params }));
  }

  override request(input: RequestApprovalInput): Promise<Approval> {
    return this.call(this.http.post<Approval>(this.base, input));
  }

  override approve(id: string, comment: string | null): Promise<Approval> {
    return this.call(this.http.post<Approval>(`${this.base}/${id}/approve`, { comment }));
  }

  override reject(id: string, comment: string): Promise<Approval> {
    return this.call(this.http.post<Approval>(`${this.base}/${id}/reject`, { comment }));
  }

  override withdraw(id: string): Promise<Approval> {
    return this.call(this.http.post<Approval>(`${this.base}/${id}/withdraw`, null));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

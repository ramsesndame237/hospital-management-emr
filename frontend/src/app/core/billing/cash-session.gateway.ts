import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { CashSessionDetail, CloseSessionInput, DenominationsInfo, OpenSessionInput, SessionFilter, SessionPage } from './cash-session.models';

/**
 * Port d'accès aux sessions de caisse : ouverture (fonds compté), clôture (comptage final, écart expliqué), contre-signature d'un
 * responsable, consultation. Toutes les méthodes rejettent avec une `ApiError`.
 */
export abstract class CashSessionGateway {
  abstract denominations(): Promise<DenominationsInfo>;
  /** La caisse ouverte du caissier connecté, ou `null` : sans elle, il ne peut pas encaisser. */
  abstract current(): Promise<CashSessionDetail | null>;
  abstract open(input: OpenSessionInput): Promise<CashSessionDetail>;
  abstract close(id: string, input: CloseSessionInput): Promise<CashSessionDetail>;
  abstract get(id: string): Promise<CashSessionDetail>;
  abstract list(filter: SessionFilter, offset: number, limit: number): Promise<SessionPage>;
  abstract cosign(id: string, comment: string | null): Promise<CashSessionDetail>;
}

/** Adaptateur HTTP de l'API `/api/v1/billing/cash-sessions`. */
@Injectable()
export class HttpCashSessionGateway extends CashSessionGateway {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/billing/cash-sessions`;

  override denominations(): Promise<DenominationsInfo> {
    return this.call(this.http.get<DenominationsInfo>(`${this.base}/denominations`));
  }

  override async current(): Promise<CashSessionDetail | null> {
    return (await this.call(this.http.get<{ session: CashSessionDetail | null }>(`${this.base}/current`))).session;
  }

  override open(input: OpenSessionInput): Promise<CashSessionDetail> {
    return this.call(this.http.post<CashSessionDetail>(this.base, input));
  }

  override close(id: string, input: CloseSessionInput): Promise<CashSessionDetail> {
    return this.call(this.http.post<CashSessionDetail>(`${this.base}/${id}/close`, input));
  }

  override get(id: string): Promise<CashSessionDetail> {
    return this.call(this.http.get<CashSessionDetail>(`${this.base}/${id}`));
  }

  override list(filter: SessionFilter, offset: number, limit: number): Promise<SessionPage> {
    const params: Record<string, string | number> = { offset, limit };
    if (filter.status) params['status'] = filter.status;
    return this.call(this.http.get<SessionPage>(this.base, { params }));
  }

  override cosign(id: string, comment: string | null): Promise<CashSessionDetail> {
    return this.call(this.http.post<CashSessionDetail>(`${this.base}/${id}/cosign`, { comment }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

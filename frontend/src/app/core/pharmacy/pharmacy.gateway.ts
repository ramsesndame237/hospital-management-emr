import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import {
  Adjustment, AdjustmentFilter, AdjustmentInput, Batch, Drug, DrugChanges, DrugFilter, DrugInput, DrugPage, DrugStock, ExpiryFilter, ExpiryPage, Movement, MovementFilter, Page, Receipt, ReceiptFilter,
  ReceiptInput, ReceiptPage, StockFilter, StockPage, StockSummary,
} from './pharmacy.models';

/**
 * Port d'accès à la pharmacie : formulaire des médicaments, stock par lot, péremptions, réceptions de marchandises, ajustements approuvés.
 * Les écrans ne connaissent que ce contrat ; toutes les méthodes rejettent avec une `ApiError` (409 `PHARMACY_ADJUSTMENT_SELF_APPROVAL` si
 * l'on décide sa propre demande, `PHARMACY_STOCK_INSUFFICIENT` si le lot ne contient plus assez).
 */
export abstract class PharmacyGateway {
  abstract listDrugs(filter: DrugFilter, offset: number, limit: number): Promise<DrugPage>;
  abstract createDrug(input: DrugInput): Promise<Drug>;
  abstract updateDrug(id: string, changes: DrugChanges): Promise<Drug>;
  abstract setDrugActive(id: string, active: boolean): Promise<Drug>;
  abstract listStock(filter: StockFilter, offset: number, limit: number): Promise<StockPage>;
  abstract getSummary(): Promise<StockSummary>;
  abstract getDrugStock(id: string): Promise<DrugStock>;
  abstract listExpiry(filter: ExpiryFilter, offset: number, limit: number): Promise<ExpiryPage>;
  abstract listMovements(filter: MovementFilter, offset: number, limit: number): Promise<Page<Movement>>;
  /** Met un lot de côté : il n'est plus délivrable, son stock reste visible. Le motif est obligatoire. */
  abstract quarantine(batchId: string, reason: string): Promise<Batch>;
  abstract release(batchId: string): Promise<Batch>;
  abstract postReceipt(input: ReceiptInput): Promise<Receipt>;
  abstract listReceipts(filter: ReceiptFilter, offset: number, limit: number): Promise<ReceiptPage>;
  abstract getReceipt(id: string): Promise<Receipt>;
  /** Demande une correction de stock ; rien ne change tant qu'un AUTRE pharmacien ne l'a pas approuvée. */
  abstract requestAdjustment(input: AdjustmentInput): Promise<Adjustment>;
  abstract listAdjustments(filter: AdjustmentFilter, offset: number, limit: number): Promise<Page<Adjustment>>;
  abstract approveAdjustment(id: string, comment: string | null): Promise<Adjustment>;
  abstract rejectAdjustment(id: string, comment: string): Promise<Adjustment>;
}

/** Adaptateur HTTP de l'API `/api/v1/pharmacy`. */
@Injectable()
export class HttpPharmacyGateway extends PharmacyGateway {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/pharmacy`;

  /** Paramètres de requête : seules les valeurs renseignées partent (`true` s'écrit `'true'`). */
  private params(filter: object, offset: number, limit: number): Record<string, string | number> {
    const params: Record<string, string | number> = { offset, limit };
    for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== false && value !== '') params[key] = value === true ? 'true' : (value as string | number);
    return params;
  }

  override listDrugs(filter: DrugFilter, offset: number, limit: number): Promise<DrugPage> {
    return this.call(this.http.get<DrugPage>(`${this.base}/drugs`, { params: this.params(filter, offset, limit) }));
  }

  override createDrug(input: DrugInput): Promise<Drug> {
    return this.call(this.http.post<Drug>(`${this.base}/drugs`, input));
  }

  override updateDrug(id: string, changes: DrugChanges): Promise<Drug> {
    return this.call(this.http.patch<Drug>(`${this.base}/drugs/${id}`, changes));
  }

  override setDrugActive(id: string, active: boolean): Promise<Drug> {
    return this.call(this.http.post<Drug>(`${this.base}/drugs/${id}/${active ? 'activate' : 'deactivate'}`, null));
  }

  override listStock(filter: StockFilter, offset: number, limit: number): Promise<StockPage> {
    return this.call(this.http.get<StockPage>(`${this.base}/stock`, { params: this.params(filter, offset, limit) }));
  }

  override getSummary(): Promise<StockSummary> {
    return this.call(this.http.get<StockSummary>(`${this.base}/stock/summary`));
  }

  override getDrugStock(id: string): Promise<DrugStock> {
    return this.call(this.http.get<DrugStock>(`${this.base}/drugs/${id}/stock`));
  }

  override listExpiry(filter: ExpiryFilter, offset: number, limit: number): Promise<ExpiryPage> {
    return this.call(this.http.get<ExpiryPage>(`${this.base}/stock/expiry`, { params: this.params(filter, offset, limit) }));
  }

  override listMovements(filter: MovementFilter, offset: number, limit: number): Promise<Page<Movement>> {
    return this.call(this.http.get<Page<Movement>>(`${this.base}/stock/movements`, { params: this.params(filter, offset, limit) }));
  }

  override quarantine(batchId: string, reason: string): Promise<Batch> {
    return this.call(this.http.post<Batch>(`${this.base}/batches/${batchId}/quarantine`, { reason }));
  }

  override release(batchId: string): Promise<Batch> {
    return this.call(this.http.post<Batch>(`${this.base}/batches/${batchId}/release`, null));
  }

  override postReceipt(input: ReceiptInput): Promise<Receipt> {
    return this.call(this.http.post<Receipt>(`${this.base}/receipts`, input));
  }

  override listReceipts(filter: ReceiptFilter, offset: number, limit: number): Promise<ReceiptPage> {
    return this.call(this.http.get<ReceiptPage>(`${this.base}/receipts`, { params: this.params(filter, offset, limit) }));
  }

  override getReceipt(id: string): Promise<Receipt> {
    return this.call(this.http.get<Receipt>(`${this.base}/receipts/${id}`));
  }

  override requestAdjustment(input: AdjustmentInput): Promise<Adjustment> {
    return this.call(this.http.post<Adjustment>(`${this.base}/adjustments`, input));
  }

  override listAdjustments(filter: AdjustmentFilter, offset: number, limit: number): Promise<Page<Adjustment>> {
    return this.call(this.http.get<Page<Adjustment>>(`${this.base}/adjustments`, { params: this.params(filter, offset, limit) }));
  }

  override approveAdjustment(id: string, comment: string | null): Promise<Adjustment> {
    return this.call(this.http.post<Adjustment>(`${this.base}/adjustments/${id}/approve`, comment ? { comment } : {}));
  }

  override rejectAdjustment(id: string, comment: string): Promise<Adjustment> {
    return this.call(this.http.post<Adjustment>(`${this.base}/adjustments/${id}/reject`, { comment }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

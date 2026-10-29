import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import {
  Adjustment, AdjustmentFilter, AdjustmentInput, Batch, Drug, Order, OrderFilter, OrderInput, OrderPage, SuggestionList, Supplier, SupplierChanges, SupplierFilter, SupplierInput, DrugChanges, DrugFilter, DrugInput, DrugPage, DrugStock, ExpiryFilter, ExpiryPage, Movement, MovementFilter, Page, Receipt, ReceiptFilter,
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
  abstract listSuppliers(filter: SupplierFilter, offset: number, limit: number): Promise<Page<Supplier>>;
  abstract createSupplier(input: SupplierInput): Promise<Supplier>;
  abstract updateSupplier(id: string, changes: SupplierChanges): Promise<Supplier>;
  abstract setSupplierActive(id: string, active: boolean): Promise<Supplier>;
  abstract listOrders(filter: OrderFilter, offset: number, limit: number): Promise<OrderPage>;
  abstract getOrder(id: string): Promise<Order>;
  /** Établit un brouillon : rien n'est commandé tant qu'il n'est pas soumis puis approuvé par un AUTRE pharmacien. */
  abstract createOrder(input: OrderInput): Promise<Order>;
  /** Remplace le contenu d'un brouillon (celui d'un bon refusé aussi). */
  abstract updateOrder(id: string, input: OrderInput): Promise<Order>;
  abstract submitOrder(id: string): Promise<Order>;
  /** Approuve un bon : jamais par son auteur (409 `PHARMACY_ORDER_SELF_APPROVAL`). */
  abstract approveOrder(id: string): Promise<Order>;
  /** Refuse un bon : il revient en brouillon avec ce motif. */
  abstract rejectOrder(id: string, comment: string): Promise<Order>;
  abstract cancelOrder(id: string, reason: string): Promise<Order>;
  /** Clôt un bon partiellement reçu dont le solde ne viendra pas. */
  abstract closeOrder(id: string, reason: string): Promise<Order>;
  abstract getSuggestions(): Promise<SuggestionList>;
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

  override listSuppliers(filter: SupplierFilter, offset: number, limit: number): Promise<Page<Supplier>> {
    return this.call(this.http.get<Page<Supplier>>(`${this.base}/suppliers`, { params: this.params(filter, offset, limit) }));
  }

  override createSupplier(input: SupplierInput): Promise<Supplier> {
    return this.call(this.http.post<Supplier>(`${this.base}/suppliers`, input));
  }

  override updateSupplier(id: string, changes: SupplierChanges): Promise<Supplier> {
    return this.call(this.http.patch<Supplier>(`${this.base}/suppliers/${id}`, changes));
  }

  override setSupplierActive(id: string, active: boolean): Promise<Supplier> {
    return this.call(this.http.post<Supplier>(`${this.base}/suppliers/${id}/${active ? 'activate' : 'deactivate'}`, null));
  }

  override listOrders(filter: OrderFilter, offset: number, limit: number): Promise<OrderPage> {
    return this.call(this.http.get<OrderPage>(`${this.base}/orders`, { params: this.params(filter, offset, limit) }));
  }

  override getOrder(id: string): Promise<Order> {
    return this.call(this.http.get<Order>(`${this.base}/orders/${id}`));
  }

  override createOrder(input: OrderInput): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders`, input));
  }

  override updateOrder(id: string, input: OrderInput): Promise<Order> {
    return this.call(this.http.put<Order>(`${this.base}/orders/${id}`, input));
  }

  override submitOrder(id: string): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/submit`, null));
  }

  override approveOrder(id: string): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/approve`, null));
  }

  override rejectOrder(id: string, comment: string): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/reject`, { comment }));
  }

  override cancelOrder(id: string, reason: string): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/cancel`, { reason }));
  }

  override closeOrder(id: string, reason: string): Promise<Order> {
    return this.call(this.http.post<Order>(`${this.base}/orders/${id}/close`, { reason }));
  }

  override getSuggestions(): Promise<SuggestionList> {
    return this.call(this.http.get<SuggestionList>(`${this.base}/orders/suggestions`));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

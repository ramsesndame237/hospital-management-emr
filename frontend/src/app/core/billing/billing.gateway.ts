import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { BillableItem, CollectInput, CollectedPayment, Invoice, InvoiceFilter, InvoiceSummary, ItemFilter, Page, Receipt } from './billing.models';

/**
 * Port d'accès à la facturation : factures, encaissements, reçus et catalogue des tarifs. Les écrans ne connaissent que ce
 * contrat ; toutes les méthodes rejettent avec une `ApiError` (409 `BILLING_INVOICE_CHANGED` si quelqu'un a modifié la facture).
 */
export abstract class BillingGateway {
  abstract listInvoices(filter: InvoiceFilter, offset: number, limit: number): Promise<Page<InvoiceSummary>>;
  abstract getInvoice(id: string): Promise<Invoice>;
  /** Crée un brouillon pour un patient. */
  abstract createInvoice(patientId: string): Promise<Invoice>;
  abstract addLine(invoiceId: string, itemId: string, quantity: number): Promise<Invoice>;
  abstract removeLine(invoiceId: string, lineId: string): Promise<Invoice>;
  /** Un montant nul retire la remise ; sinon le motif est obligatoire. */
  abstract setDiscount(invoiceId: string, amount: number, reason: string | null): Promise<Invoice>;
  abstract issue(invoiceId: string): Promise<Invoice>;
  abstract cancel(invoiceId: string, reason: string): Promise<Invoice>;
  abstract collect(invoiceId: string, input: CollectInput): Promise<CollectedPayment>;
  /** Renvoie les données du reçu comme copie ; la réimpression est tracée avec son motif. */
  abstract reprintReceipt(paymentId: string, reason: string): Promise<Receipt>;
  abstract listItems(filter: ItemFilter, offset: number, limit: number): Promise<Page<BillableItem>>;
}

/** Adaptateur HTTP de l'API `/api/v1/billing`. */
@Injectable()
export class HttpBillingGateway extends BillingGateway {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/billing`;

  override listInvoices(filter: InvoiceFilter, offset: number, limit: number): Promise<Page<InvoiceSummary>> {
    const params: Record<string, string | number> = { offset, limit };
    if (filter.number) params['number'] = filter.number;
    if (filter.status) params['status'] = filter.status;
    if (filter.patientId) params['patientId'] = filter.patientId;
    return this.call(this.http.get<Page<InvoiceSummary>>(`${this.base}/invoices`, { params }));
  }

  override getInvoice(id: string): Promise<Invoice> {
    return this.call(this.http.get<Invoice>(`${this.base}/invoices/${id}`));
  }

  override createInvoice(patientId: string): Promise<Invoice> {
    return this.call(this.http.post<Invoice>(`${this.base}/invoices`, { patientId }));
  }

  override addLine(invoiceId: string, itemId: string, quantity: number): Promise<Invoice> {
    return this.call(this.http.post<Invoice>(`${this.base}/invoices/${invoiceId}/lines`, { itemId, quantity }));
  }

  override removeLine(invoiceId: string, lineId: string): Promise<Invoice> {
    return this.call(this.http.post<Invoice>(`${this.base}/invoices/${invoiceId}/lines/${lineId}/remove`, null));
  }

  override setDiscount(invoiceId: string, amount: number, reason: string | null): Promise<Invoice> {
    return this.call(this.http.put<Invoice>(`${this.base}/invoices/${invoiceId}/discount`, { amount, reason }));
  }

  override issue(invoiceId: string): Promise<Invoice> {
    return this.call(this.http.post<Invoice>(`${this.base}/invoices/${invoiceId}/issue`, null));
  }

  override cancel(invoiceId: string, reason: string): Promise<Invoice> {
    return this.call(this.http.post<Invoice>(`${this.base}/invoices/${invoiceId}/cancel`, { reason }));
  }

  override collect(invoiceId: string, input: CollectInput): Promise<CollectedPayment> {
    return this.call(this.http.post<CollectedPayment>(`${this.base}/invoices/${invoiceId}/payments`, input));
  }

  override reprintReceipt(paymentId: string, reason: string): Promise<Receipt> {
    return this.call(this.http.post<Receipt>(`${this.base}/payments/${paymentId}/reprint`, { reason }));
  }

  override listItems(filter: ItemFilter, offset: number, limit: number): Promise<Page<BillableItem>> {
    const params: Record<string, string | number> = { offset, limit };
    if (filter.search) params['search'] = filter.search;
    if (filter.category) params['category'] = filter.category;
    return this.call(this.http.get<Page<BillableItem>>(`${this.base}/items`, { params }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { Claim, ClaimFilter, CoverageInput, Invoice as InvoiceModel, PatientCoverage, Payer, BillablePage, BillableItem, CollectInput, CollectedPayment, Invoice, InvoiceFilter, InvoiceSummary, ItemChanges, ItemFilter, ItemInput, Page, Receipt, SourceType } from './billing.models';

/**
 * Port d'accès à la facturation : factures, encaissements, reçus et catalogue des tarifs. Les écrans ne connaissent que ce
 * contrat ; toutes les méthodes rejettent avec une `ApiError` (409 `BILLING_INVOICE_CHANGED` si quelqu'un a modifié la facture).
 */
export abstract class BillingGateway {
  abstract listInvoices(filter: InvoiceFilter, offset: number, limit: number): Promise<Page<InvoiceSummary>>;
  abstract getInvoice(id: string): Promise<Invoice>;
  /** Crée un brouillon pour un patient. */
  /** Ouvre un brouillon pour un patient, rattaché à une admission si elle est donnée (elle doit concerner le même patient). */
  abstract createInvoice(patientId: string, admissionId?: string): Promise<Invoice>;
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
  abstract createItem(input: ItemInput): Promise<BillableItem>;
  abstract updateItem(id: string, changes: ItemChanges): Promise<BillableItem>;
  /** Un acte retiré reste lisible mais ne peut plus être facturé. */
  abstract setItemActive(id: string, active: boolean): Promise<BillableItem>;
  /** Ce qui a été fait et n'est pas encore facturé (demandes d'analyses, examens réalisés, délivrances), avec le prix du catalogue. */
  abstract listBillable(type: SourceType, offset: number, limit: number): Promise<BillablePage>;
  abstract listPayers(search: string, includeInactive: boolean, offset: number, limit: number): Promise<Page<Payer>>;
  abstract createPayer(code: string, name: string): Promise<Payer>;
  abstract renamePayer(id: string, name: string): Promise<Payer>;
  abstract setPayerActive(id: string, active: boolean): Promise<Payer>;
  /** Couvertures actives d'un patient. */
  abstract listCoverages(patientId: string): Promise<readonly PatientCoverage[]>;
  abstract recordCoverage(patientId: string, input: CoverageInput): Promise<PatientCoverage>;
  /** Applique une couverture valable à un brouillon : la part de l'assureur se calcule, le patient ne doit que le reste. */
  abstract applyCoverage(invoiceId: string, coverageId: string): Promise<InvoiceModel>;
  abstract removeCoverage(invoiceId: string): Promise<InvoiceModel>;
  abstract listClaims(filter: ClaimFilter, offset: number, limit: number): Promise<Page<Claim>>;
  /** La comptabilité constate que l'assureur a réglé sa part (référence obligatoire, une seule fois). */
  abstract settleClaim(invoiceId: string, reference: string): Promise<InvoiceModel>;
  /** Établit le brouillon de facture d'une source (422 `BILLING_SOURCE_UNPRICED` si un code n'a pas de prix, 409 si déjà facturée). */
  abstract billFromSource(type: SourceType, sourceId: string): Promise<Invoice>;
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

  override createInvoice(patientId: string, admissionId?: string): Promise<Invoice> {
    return this.call(this.http.post<Invoice>(`${this.base}/invoices`, { patientId, ...(admissionId ? { admissionId } : {}) }));
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

  override createItem(input: ItemInput): Promise<BillableItem> {
    return this.call(this.http.post<BillableItem>(`${this.base}/items`, input));
  }

  override updateItem(id: string, changes: ItemChanges): Promise<BillableItem> {
    return this.call(this.http.patch<BillableItem>(`${this.base}/items/${id}`, changes));
  }

  override setItemActive(id: string, active: boolean): Promise<BillableItem> {
    return this.call(this.http.post<BillableItem>(`${this.base}/items/${id}/${active ? 'activate' : 'deactivate'}`, null));
  }

  override listBillable(type: SourceType, offset: number, limit: number): Promise<BillablePage> {
    return this.call(this.http.get<BillablePage>(`${this.base}/billable`, { params: { type, offset, limit } }));
  }

  override billFromSource(type: SourceType, sourceId: string): Promise<Invoice> {
    return this.call(this.http.post<Invoice>(`${this.base}/invoices/from-source`, { sourceType: type, sourceId }));
  }

  override listPayers(search: string, includeInactive: boolean, offset: number, limit: number): Promise<Page<Payer>> {
    const params: Record<string, string | number | boolean> = { offset, limit, includeInactive };
    if (search) params['search'] = search;
    return this.call(this.http.get<Page<Payer>>(`${this.base}/payers`, { params }));
  }

  override createPayer(code: string, name: string): Promise<Payer> {
    return this.call(this.http.post<Payer>(`${this.base}/payers`, { code, name }));
  }

  override renamePayer(id: string, name: string): Promise<Payer> {
    return this.call(this.http.patch<Payer>(`${this.base}/payers/${id}`, { name }));
  }

  override setPayerActive(id: string, active: boolean): Promise<Payer> {
    return this.call(this.http.post<Payer>(`${this.base}/payers/${id}/${active ? 'activate' : 'deactivate'}`, null));
  }

  override listCoverages(patientId: string): Promise<readonly PatientCoverage[]> {
    return this.call(this.http.get<PatientCoverage[]>(`${this.base}/patients/${patientId}/coverages`));
  }

  override recordCoverage(patientId: string, input: CoverageInput): Promise<PatientCoverage> {
    return this.call(this.http.post<PatientCoverage>(`${this.base}/patients/${patientId}/coverages`, input));
  }

  override applyCoverage(invoiceId: string, coverageId: string): Promise<InvoiceModel> {
    return this.call(this.http.put<InvoiceModel>(`${this.base}/invoices/${invoiceId}/coverage`, { coverageId }));
  }

  override removeCoverage(invoiceId: string): Promise<InvoiceModel> {
    return this.call(this.http.delete<InvoiceModel>(`${this.base}/invoices/${invoiceId}/coverage`));
  }

  override listClaims(filter: ClaimFilter, offset: number, limit: number): Promise<Page<Claim>> {
    const params: Record<string, string | number | boolean> = { offset, limit };
    if (filter.payerId) params['payerId'] = filter.payerId;
    if (filter.settled !== undefined) params['settled'] = filter.settled;
    return this.call(this.http.get<Page<Claim>>(`${this.base}/claims`, { params }));
  }

  override settleClaim(invoiceId: string, reference: string): Promise<InvoiceModel> {
    return this.call(this.http.post<InvoiceModel>(`${this.base}/invoices/${invoiceId}/payer-settlement`, { reference }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

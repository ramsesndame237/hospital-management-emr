import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, order } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { NewReceiptPage } from './new-receipt.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();
const DRUG_2 = { id: 'd-2', code: 'AMOX500', name: 'Clamoxyl 500', genericName: 'Amoxicilline', strength: '500 mg', unit: 'gélule' };

/** Un bon approuvé de deux lignes : 500 comprimés à 12 (200 déjà reçus) et 150 gélules à 80. */
const approved = () =>
  order({
    status: 'PARTIALLY_RECEIVED', units: 650, receivedUnits: 200,
    lines: [
      { ...order().lines[0], received: 200, outstanding: 300 },
      { drug: DRUG_2, quantity: 150, unitCost: 80, received: 0, outstanding: 150, value: 12_000 },
    ],
  });

describe('NewReceiptPage : livraison contre un bon de commande', () => {
  let fixture: ComponentFixture<NewReceiptPage>;
  let pharmacy: FakePharmacyGateway;
  let navigate: ReturnType<typeof vi.spyOn>;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');

  async function setup(prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    pharmacy.getOrder.mockResolvedValue(approved());
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions: ['pharmacy.stock:read', 'pharmacy.stock:receive'], providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(NewReceiptPage);
    fixture.componentRef.setInput('order', 'o-1');
    await settle(fixture);
  }

  function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('préremplit une ligne par médicament encore attendu : reste à recevoir et coût convenu', async () => {
    await setup();
    expect(pharmacy.getOrder).toHaveBeenCalledWith('o-1');
    expect(q('[data-test="order-banner"]')?.textContent).toContain('Livraison contre le bon PO-0000001 (Pharma Distrib SARL)');
    expect(q<HTMLInputElement>('#line-0-quantity')!.value).toBe('300');
    expect(q<HTMLInputElement>('#line-0-unitCost')!.value).toBe('12');
    expect(q<HTMLInputElement>('#line-1-quantity')!.value).toBe('150');
    expect(q<HTMLInputElement>('#line-1-unitCost')!.value).toBe('80');
    expect(q('#receipt-search')).toBeNull();
    expect(q('#receipt-header-supplier')).toBeNull();
    expect(q('#receipt-header-deliveryNote')).not.toBeNull();
  });

  it('ne reprend pas les lignes déjà reçues en totalité', async () => {
    await setup((g) => g.getOrder.mockResolvedValue(order({ status: 'PARTIALLY_RECEIVED', lines: [{ ...order().lines[0], received: 500, outstanding: 0 }, { drug: DRUG_2, quantity: 10, unitCost: 80, received: 0, outstanding: 10, value: 800 }] })));
    expect(q('#line-0-quantity')!.id).toBe('line-0-quantity');
    expect(q<HTMLInputElement>('#line-0-quantity')!.value).toBe('10');
    expect(q('#line-1-quantity')).toBeNull();
  });

  it('enregistre la livraison sur le bon, sans fournisseur saisi, une fois lot et péremption renseignés', async () => {
    await setup();
    type('#line-0-batchNumber', 'PA-2701');
    type('#line-0-expiry', '2027-12-31');
    type('#line-0-quantity', '100');
    type('#line-1-batchNumber', 'AM-9');
    type('#line-1-expiry', '2028-01-31');
    type('#receipt-header-deliveryNote', 'BL-77');
    await submit('receipt-header');
    expect(pharmacy.postReceipt).toHaveBeenCalledWith({
      purchaseOrderId: 'o-1', deliveryNote: 'BL-77',
      lines: [
        { drugId: 'd-1', batchNumber: 'PA-2701', expiry: '2027-12-31', quantity: 100, unitCost: 12 },
        { drugId: 'd-2', batchNumber: 'AM-9', expiry: '2028-01-31', quantity: 150, unitCost: 80 },
      ],
    });
    expect(navigate).toHaveBeenCalledWith(['/pharmacy/receipts', 'r-1']);
  });

  it('une ligne retirée n\'est pas envoyée (médicament pas encore arrivé)', async () => {
    await setup();
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.getAttribute('aria-label') === 'Retirer la ligne 2')!.click();
    fixture.detectChanges();
    type('#line-0-batchNumber', 'PA-2701');
    type('#line-0-expiry', '2027-12-31');
    await submit('receipt-header');
    expect(pharmacy.postReceipt).toHaveBeenCalledWith({ purchaseOrderId: 'o-1', lines: [{ drugId: 'd-1', batchNumber: 'PA-2701', expiry: '2027-12-31', quantity: 300, unitCost: 12 }] });
  });

  it('affiche le refus du serveur (livraison supérieure à la commande) et reste sur la page', async () => {
    await setup((g) => g.postReceipt.mockRejectedValue(new ApiError(409, 'PHARMACY_ORDER_OVER_RECEIPT', 'Livraison supérieure à la commande : il ne reste que 300 unité(s) à recevoir.')));
    type('#line-0-batchNumber', 'PA-2701');
    type('#line-0-expiry', '2027-12-31');
    type('#line-0-quantity', '999');
    type('#line-1-batchNumber', 'AM-9');
    type('#line-1-expiry', '2028-01-31');
    await submit('receipt-header');
    expect(q('[role=alert]')?.textContent).toContain('il ne reste que 300');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('signale un bon introuvable', async () => {
    await setup((g) => g.getOrder.mockRejectedValue(new ApiError(404, 'PHARMACY_ORDER_NOT_FOUND', 'Bon de commande introuvable.')));
    expect(text()).toContain('introuvable');
    expect(q('[data-test="order-banner"]')).toBeNull();
  });
});

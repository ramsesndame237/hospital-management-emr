import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, drug, page } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { NewReceiptPage } from './new-receipt.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('NewReceiptPage', () => {
  let fixture: ComponentFixture<NewReceiptPage>;
  let pharmacy: FakePharmacyGateway;
  let navigate: ReturnType<typeof vi.spyOn>;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions: ['pharmacy.stock:read', 'pharmacy.stock:receive'], providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(NewReceiptPage);
    await settle(fixture);
  }

  async function click(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

  /** Cherche « para », ajoute le premier résultat et remplit sa ligne. */
  async function withOneLine(over: Partial<Record<'batchNumber' | 'expiry' | 'quantity' | 'unitCost', string>> = {}) {
    type('#receipt-search-q', 'para');
    await submit('receipt-search');
    await click(buttonNamed('Ajouter Doliprane 500 à la réception'));
    const values = { batchNumber: 'B-1', expiry: '2027-03-31', quantity: '100', unitCost: '10', ...over };
    for (const [field, value] of Object.entries(values)) type(`#line-0-${field}`, value);
    type('#receipt-header-supplier', ' Pharma Distrib ');
  }

  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => t.message);

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('cherche un médicament actif, l\'ajoute et enregistre la livraison avec ses montants en entiers', async () => {
    await setup();
    expect(text()).toContain('Ajoutez au moins un médicament.');
    await withOneLine();
    expect(pharmacy.listDrugs).toHaveBeenCalledWith({ search: 'para' }, 0, 10);
    type('#receipt-header-deliveryNote', ' BL-1 ');
    await submit('receipt-header');
    expect(pharmacy.postReceipt).toHaveBeenCalledWith({
      supplier: 'Pharma Distrib', deliveryNote: 'BL-1', lines: [{ drugId: 'd-1', batchNumber: 'B-1', expiry: '2027-03-31', quantity: 100, unitCost: 10 }],
    });
    expect(toasts()[0]).toMatch(/^Réception GRN-0000001 enregistrée \(/);
    expect(navigate).toHaveBeenCalledWith(['/pharmacy/receipts', 'r-1']);
  });

  it('un coût laissé vide vaut zéro ; plusieurs lots du même médicament sont permis', async () => {
    await setup();
    await withOneLine({ unitCost: '' });
    await click(buttonNamed('Ajouter Doliprane 500 à la réception'));
    type('#line-1-batchNumber', 'B-2');
    type('#line-1-expiry', '2027-06-30');
    type('#line-1-quantity', '50');
    await submit('receipt-header');
    expect(pharmacy.postReceipt).toHaveBeenCalledWith({
      supplier: 'Pharma Distrib',
      lines: [
        { drugId: 'd-1', batchNumber: 'B-1', expiry: '2027-03-31', quantity: 100, unitCost: 0 },
        { drugId: 'd-1', batchNumber: 'B-2', expiry: '2027-06-30', quantity: 50, unitCost: 0 },
      ],
    });
  });

  it('retire une ligne', async () => {
    await setup();
    await withOneLine();
    await click(buttonNamed('Retirer la ligne 1'));
    expect(q('#line-0-batchNumber')).toBeNull();
    expect(text()).toContain('Ajoutez au moins un médicament.');
  });

  it.each([
    [{ batchNumber: ' ' }, 'Ligne 1 : saisissez le numéro de lot.'],
    [{ expiry: '' }, 'Ligne 1 : saisissez la date de péremption.'],
    [{ quantity: '0' }, 'Ligne 1 : la quantité doit être un entier de 1 à 1 000 000.'],
    [{ quantity: '1,5' }, 'Ligne 1 : la quantité doit être un entier de 1 à 1 000 000.'],
    [{ unitCost: '10,5' }, 'Ligne 1 : le coût unitaire n’est pas un montant valide.'],
  ])('refuse une ligne invalide %j sans rien envoyer', async (over, message) => {
    await setup();
    await withOneLine(over);
    await submit('receipt-header');
    expect(q('[role=alert]')?.textContent).toContain(message);
    expect(pharmacy.postReceipt).not.toHaveBeenCalled();
  });

  it('exige un fournisseur et au moins une ligne', async () => {
    await setup();
    await submit('receipt-header');
    expect(text()).toContain('Indiquez le fournisseur.');
    expect(pharmacy.postReceipt).not.toHaveBeenCalled();
    type('#receipt-header-supplier', 'Pharma');
    await submit('receipt-header');
    expect(q('[role=alert]')?.textContent).toContain('Ajoutez au moins un médicament.');
    expect(pharmacy.postReceipt).not.toHaveBeenCalled();
  });

  it('dit quand aucun médicament actif ne correspond à la recherche', async () => {
    await setup((g) => g.listDrugs.mockResolvedValue({ ...page([]), currency: 'XAF' }));
    type('#receipt-search-q', 'zzz');
    await submit('receipt-search');
    expect(text()).toContain('Aucun médicament actif ne correspond.');
  });

  it('affiche le refus du serveur (péremption différente de celle du lot en stock) et reste sur la page', async () => {
    await setup((g) => g.postReceipt.mockRejectedValue(new ApiError(409, 'PHARMACY_BATCH_EXPIRY_MISMATCH', 'Le lot B-1 existe déjà avec une autre date de péremption (2027-01-01).')));
    await withOneLine();
    await submit('receipt-header');
    expect(q('[role=alert]')?.textContent).toContain('autre date de péremption');
    expect(navigate).not.toHaveBeenCalled();
    expect(q('#line-0-batchNumber')?.getAttribute('value') ?? (q<HTMLInputElement>('#line-0-batchNumber')!.value)).toBe('B-1');
  });

  it('ne propose que les médicaments que la recherche renvoie (le serveur n\'envoie que des actifs)', async () => {
    await setup((g) => g.listDrugs.mockResolvedValue({ ...page([drug(), drug({ id: 'd-2', code: 'IBU400', name: 'Brufen 400', genericName: 'Ibuprofène' })]), currency: 'XAF' }));
    type('#receipt-search-q', 'a');
    await submit('receipt-search');
    expect([...root().querySelectorAll('li[data-test]')].map((li) => li.getAttribute('data-test'))).toEqual(['PARA500', 'IBU400']);
  });
});

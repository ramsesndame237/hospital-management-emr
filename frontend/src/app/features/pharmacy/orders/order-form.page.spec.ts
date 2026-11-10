import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, drug, order, page, suggestion } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { OrderFormPage } from './order-form.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('OrderFormPage', () => {
  let fixture: ComponentFixture<OrderFormPage>;
  let pharmacy: FakePharmacyGateway;
  let navigate: ReturnType<typeof vi.spyOn>;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(id?: string, prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions: ['pharmacy.procurement:read', 'pharmacy.procurement:manage'], providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(OrderFormPage);
    if (id) fixture.componentRef.setInput('id', id);
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

  function choose(selector: string, value: string) {
    const select = q<HTMLSelectElement>(selector)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => t.message);

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('charge les fournisseurs actifs et propose les médicaments à recommander', async () => {
    await setup();
    expect(pharmacy.listSuppliers).toHaveBeenCalledWith({}, 0, 200);
    expect(pharmacy.getSuggestions).toHaveBeenCalled();
    expect(q('h1')?.textContent).toContain('Nouveau bon de commande');
    expect(text()).toContain('À recommander');
    const first = norm(q('[data-test="suggestion-AMOX500"]')!.textContent!);
    expect(first).toContain('Clamoxyl 500');
    expect(first).toContain('Rupture');
    expect(first).toContain('proposé : 600');
    const options = [...q<HTMLSelectElement>('#order-header-supplierId')!.options].map((o) => o.textContent?.trim());
    expect(options).toContain('Pharma Distrib SARL (PHARMADIS)');
  });

  it('ajoute une suggestion avec sa quantité proposée et le coût du dernier lot reçu, une seule fois', async () => {
    await setup();
    await click(buttonNamed('Ajouter Clamoxyl 500 d’après la suggestion'));
    expect(q<HTMLInputElement>('#order-line-0-quantity')!.value).toBe('600');
    expect(q<HTMLInputElement>('#order-line-0-unitCost')!.value).toBe('80');
    expect(buttonNamed('Ajouter Clamoxyl 500 d’après la suggestion').disabled).toBe(true);
    await click(buttonNamed('Ajouter Doliprane 500 d’après la suggestion'));
    expect(q<HTMLInputElement>('#order-line-1-unitCost')!.value).toBe('');
  });

  it('crée le brouillon : coût laissé vide absent (le serveur prend le dernier coût), date et remarques facultatives', async () => {
    await setup();
    await click(buttonNamed('Ajouter Clamoxyl 500 d’après la suggestion'));
    await click(buttonNamed('Ajouter Doliprane 500 d’après la suggestion'));
    type('#order-line-1-quantity', '280');
    choose('#order-header-supplierId', 's-1');
    type('#order-header-expectedOn', '2026-11-20');
    await submit('order-header');
    expect(pharmacy.createOrder).toHaveBeenCalledWith({
      supplierId: 's-1', expectedOn: '2026-11-20', notes: null, lines: [{ drugId: 'd-2', quantity: 600, unitCost: 80 }, { drugId: 'd-1', quantity: 280 }],
    });
    expect(toasts()[0]).toMatch(/^Brouillon PO-0000001 enregistré \(/);
    expect(navigate).toHaveBeenCalledWith(['/pharmacy/orders', 'o-new']);
  });

  it('cherche un autre médicament, l\'ajoute et ne l\'ajoute pas deux fois', async () => {
    await setup(undefined, (g) => g.listDrugs.mockResolvedValue({ ...page([drug({ id: 'd-7', code: 'IBU400', name: 'Brufen 400', genericName: 'Ibuprofène' })]), currency: 'XAF' }));
    type('#order-search-q', 'ibu');
    await submit('order-search');
    expect(pharmacy.listDrugs).toHaveBeenCalledWith({ search: 'ibu' }, 0, 10);
    await click(buttonNamed('Ajouter Brufen 400 au bon'));
    expect(buttonNamed('Ajouter Brufen 400 au bon').disabled).toBe(true);
    type('#order-line-0-quantity', '50');
    choose('#order-header-supplierId', 's-1');
    await submit('order-header');
    expect(pharmacy.createOrder).toHaveBeenCalledWith({ supplierId: 's-1', expectedOn: null, notes: null, lines: [{ drugId: 'd-7', quantity: 50 }] });
  });

  it('retire une ligne', async () => {
    await setup();
    await click(buttonNamed('Ajouter Clamoxyl 500 d’après la suggestion'));
    await click(buttonNamed('Retirer la ligne 1'));
    expect(q('#order-line-0-quantity')).toBeNull();
    expect(text()).toContain('Ajoutez au moins un médicament.');
  });

  it.each([
    ['quantity', '0', 'Ligne 1 : la quantité doit être un entier de 1 à 1 000 000.'],
    ['quantity', '1,5', 'Ligne 1 : la quantité doit être un entier de 1 à 1 000 000.'],
    ['unitCost', '12,5', 'Ligne 1 : le coût unitaire n’est pas un montant valide.'],
  ])('refuse une ligne invalide (%s = %s) sans rien envoyer', async (field, value, message) => {
    await setup();
    await click(buttonNamed('Ajouter Clamoxyl 500 d’après la suggestion'));
    type(`#order-line-0-${field}`, value);
    choose('#order-header-supplierId', 's-1');
    await submit('order-header');
    expect(q('[role=alert]')?.textContent).toContain(message);
    expect(pharmacy.createOrder).not.toHaveBeenCalled();
  });

  it('exige un fournisseur, une date bien écrite et au moins une ligne', async () => {
    await setup();
    await submit('order-header');
    expect(text()).toContain('Choisissez un fournisseur.');
    choose('#order-header-supplierId', 's-1');
    type('#order-header-expectedOn', '20/11/2026');
    await submit('order-header');
    expect(text()).toContain('Saisissez une date au format AAAA-MM-JJ.');
    type('#order-header-expectedOn', '');
    await submit('order-header');
    expect(q('[role=alert]')?.textContent).toContain('Ajoutez au moins un médicament.');
    expect(pharmacy.createOrder).not.toHaveBeenCalled();
  });

  it('affiche le refus du serveur (fournisseur écarté) et reste sur la page', async () => {
    await setup(undefined, (g) => g.createOrder.mockRejectedValue(new ApiError(409, 'PHARMACY_SUPPLIER_INACTIVE', 'Le fournisseur PHARMADIS est écarté : on ne lui passe plus de commande.')));
    await click(buttonNamed('Ajouter Clamoxyl 500 d’après la suggestion'));
    choose('#order-header-supplierId', 's-1');
    await submit('order-header');
    expect(q('[role=alert]')?.textContent).toContain('est écarté');
    expect(navigate).not.toHaveBeenCalled();
    expect(q<HTMLInputElement>('#order-line-0-quantity')!.value).toBe('600');
  });

  describe('correction d\'un brouillon', () => {
    it('précharge le bon : lignes, fournisseur, date et remarques', async () => {
      await setup('o-1', (g) => g.getOrder.mockResolvedValue(order({ notes: 'Urgent' })));
      expect(pharmacy.getOrder).toHaveBeenCalledWith('o-1');
      expect(q('h1')?.textContent).toContain('Corriger le brouillon');
      expect(q<HTMLInputElement>('#order-line-0-quantity')!.value).toBe('500');
      expect(q<HTMLInputElement>('#order-line-0-unitCost')!.value).toBe('12');
      expect(q<HTMLSelectElement>('#order-header-supplierId')!.value).toBe('s-1');
      expect(q<HTMLInputElement>('#order-header-expectedOn')!.value).toBe('2026-11-20');
      expect(q<HTMLInputElement>('#order-header-notes')!.value).toBe('Urgent');
    });

    it('enregistre les corrections sur le même bon', async () => {
      await setup('o-1');
      type('#order-line-0-quantity', '300');
      await submit('order-header');
      expect(pharmacy.updateOrder).toHaveBeenCalledWith('o-1', { supplierId: 's-1', expectedOn: '2026-11-20', notes: null, lines: [{ drugId: 'd-1', quantity: 300, unitCost: 12 }] });
      expect(pharmacy.createOrder).not.toHaveBeenCalled();
      expect(toasts()[0]).toMatch(/^Brouillon PO-0000001 mis à jour \(/);
    });

    it('signale un bon introuvable sans afficher le formulaire', async () => {
      await setup('o-9', (g) => g.getOrder.mockRejectedValue(new ApiError(404, 'PHARMACY_ORDER_NOT_FOUND', 'Bon de commande introuvable.')));
      expect(q('[role=alert]')?.textContent).toContain('introuvable');
      expect(q('#order-header')).toBeNull();
    });
  });

  it('n\'affiche pas la section des suggestions quand il n\'y a rien à recommander', async () => {
    await setup(undefined, (g) => g.getSuggestions.mockResolvedValue({ items: [suggestion()].slice(1), currency: 'XAF' }));
    expect(text()).not.toContain('À recommander');
  });
});

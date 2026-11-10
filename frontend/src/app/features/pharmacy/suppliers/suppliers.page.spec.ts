import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, page, supplier } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { SuppliersPage } from './suppliers.page';

const READ = ['pharmacy.procurement:read'];
const MANAGE = [...READ, 'pharmacy.procurement:manage'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function spaced(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('SuppliersPage', () => {
  let fixture: ComponentFixture<SuppliersPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(permissions: readonly string[] = MANAGE, prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions, providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(SuppliersPage);
    await settle(fixture);
  }

  async function click(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  function type(selector: string, value: string) {
    const input = q<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => t.message);

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les fournisseurs avec leur contact et leur délai de paiement', async () => {
    await setup();
    expect(pharmacy.listSuppliers).toHaveBeenCalledWith({}, 0, 25);
    const row = spaced(q('tr[data-test="PHARMADIS"]'));
    expect(row).toContain('Pharma Distrib SARL');
    expect(row).toContain('Mme Ngo');
    expect(row).toContain('+237 699 00 00 00');
    expect(row).toContain('commandes@pharmadistrib.example');
    expect(row).toContain('30 jours');
    expect(spaced(q('tr[data-test="MEDICAM"]'))).toContain('Comptant');
  });

  it('ne montre aucune action de gestion à qui ne fait que consulter', async () => {
    await setup(READ);
    for (const label of ['Nouveau fournisseur', 'Modifier Pharma Distrib SARL', 'Écarter Pharma Distrib SARL']) expect(buttonNamed(label)).toBeUndefined();
    expect(q('#pharmacy-suppliers-filter-inactive')).toBeNull();
  });

  it('crée un fournisseur : code normalisé, coordonnées vides absentes (null), délai en entier', async () => {
    await setup();
    await click(buttonNamed('Nouveau fournisseur'));
    expect(q('aside h2')?.textContent).toContain('Nouveau fournisseur');
    await submit('pharmacy-supplier-new');
    expect(root().textContent).toContain('Ce champ est obligatoire.');
    expect(pharmacy.createSupplier).not.toHaveBeenCalled();
    type('#pharmacy-supplier-new-code', 'labo-x');
    type('#pharmacy-supplier-new-name', ' Labo X ');
    type('#pharmacy-supplier-new-email', 'a@labox.cm');
    type('#pharmacy-supplier-new-paymentTermsDays', '45');
    await submit('pharmacy-supplier-new');
    expect(pharmacy.createSupplier).toHaveBeenCalledWith({
      code: 'LABO-X', name: 'Labo X', contactName: null, phone: null, email: 'a@labox.cm', address: null, paymentTermsDays: 45, notes: null,
    });
    expect(q('aside')).toBeNull();
    expect(pharmacy.listSuppliers).toHaveBeenCalledTimes(2);
    expect(toasts()).toEqual(['Labo X ajouté.']);
  });

  it('refuse une adresse e-mail mal formée avant tout envoi', async () => {
    await setup();
    await click(buttonNamed('Nouveau fournisseur'));
    type('#pharmacy-supplier-new-code', 'X1');
    type('#pharmacy-supplier-new-name', 'X');
    type('#pharmacy-supplier-new-email', 'pas-un-mail');
    await submit('pharmacy-supplier-new');
    expect(pharmacy.createSupplier).not.toHaveBeenCalled();
    expect(q('aside')).not.toBeNull();
  });

  it('modifie un fournisseur : champs préremplis, code figé, contact effacé quand on le vide', async () => {
    await setup();
    await click(buttonNamed('Modifier Pharma Distrib SARL'));
    expect(q('#pharmacy-supplier-s-1-code')).toBeNull();
    expect(q<HTMLInputElement>('#pharmacy-supplier-s-1-name')!.value).toBe('Pharma Distrib SARL');
    expect(q<HTMLInputElement>('#pharmacy-supplier-s-1-contactName')!.value).toBe('Mme Ngo');
    type('#pharmacy-supplier-s-1-contactName', '');
    type('#pharmacy-supplier-s-1-paymentTermsDays', '60');
    await submit('pharmacy-supplier-s-1');
    expect(pharmacy.updateSupplier).toHaveBeenCalledWith('s-1', {
      name: 'Pharma Distrib SARL', contactName: null, phone: '+237 699 00 00 00', email: 'commandes@pharmadistrib.example', address: 'Douala', paymentTermsDays: 60, notes: null,
    });
    expect(toasts()).toEqual(['Pharma Distrib SARL modifié.']);
  });

  it('affiche dans le panneau le refus du serveur (code déjà pris)', async () => {
    await setup(MANAGE, (g) => g.createSupplier.mockRejectedValue(new ApiError(409, 'PHARMACY_SUPPLIER_CODE_ALREADY_EXISTS', 'Un fournisseur utilise déjà ce code.')));
    await click(buttonNamed('Nouveau fournisseur'));
    type('#pharmacy-supplier-new-code', 'PHARMADIS');
    type('#pharmacy-supplier-new-name', 'X');
    await submit('pharmacy-supplier-new');
    expect(q('aside [role=alert]')?.textContent).toContain('utilise déjà ce code');
    expect(q('aside')).not.toBeNull();
  });

  it('écarte puis remet en service un fournisseur', async () => {
    await setup();
    await click(buttonNamed('Écarter Pharma Distrib SARL'));
    expect(pharmacy.setSupplierActive).toHaveBeenCalledWith('s-1', false);
    expect(toasts()).toEqual(['Pharma Distrib SARL écarté : on ne lui passe plus de commande.']);
    TestBed.resetTestingModule();
    await setup(MANAGE, (g) => g.listSuppliers.mockResolvedValue(page([supplier({ active: false })])));
    expect(spaced(q('tr[data-test="PHARMADIS"]'))).toContain('Écarté');
    await click(buttonNamed('Remettre Pharma Distrib SARL en service'));
    expect(pharmacy.setSupplierActive).toHaveBeenCalledWith('s-1', true);
  });

  it('transmet le texte cherché et les fournisseurs écartés', async () => {
    await setup();
    type('#pharmacy-suppliers-filter-q', ' pharma ');
    const box = q<HTMLInputElement>('#pharmacy-suppliers-filter-inactive')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    box.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await submit('pharmacy-suppliers-filter');
    expect(pharmacy.listSuppliers).toHaveBeenLastCalledWith({ search: 'pharma', includeInactive: true }, 0, 25);
  });

  it('dit qu\'aucun fournisseur ne correspond, et affiche le refus du serveur', async () => {
    await setup(MANAGE, (g) => g.listSuppliers.mockResolvedValue(page([])));
    expect(root().textContent).toContain('Aucun fournisseur ne correspond.');
    TestBed.resetTestingModule();
    await setup(MANAGE, (g) => g.listSuppliers.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')));
    expect(q('[role=alert]')?.textContent).toBeTruthy();
  });
});

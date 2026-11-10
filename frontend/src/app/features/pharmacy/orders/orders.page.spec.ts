import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, orderSummary, page } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { OrdersPage } from './orders.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function spaced(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('OrdersPage', () => {
  let fixture: ComponentFixture<OrdersPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

  async function setup(permissions: readonly string[] = ['pharmacy.procurement:read'], prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions, providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(OrdersPage);
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les bons avec fournisseur, statut, avancement de la réception, date attendue et valeur', async () => {
    await setup(undefined, (g) =>
      g.listOrders.mockResolvedValue({ ...page([orderSummary({ status: 'PARTIALLY_RECEIVED', receivedUnits: 200 }), orderSummary({ id: 'o-2', number: 'PO-0000002', status: 'DRAFT', expectedOn: null })]), currency: 'XAF' }),
    );
    expect(pharmacy.listOrders).toHaveBeenCalledWith({}, 0, 25);
    const row = spaced(q('tr[data-test="PO-0000001"]'));
    expect(row).toContain('Pharma Distrib SARL');
    expect(row).toContain('Reçu en partie');
    expect(row).toContain('200 / 500');
    expect(row).toContain('2026-11-20');
    expect(row).toContain('pharmacien');
    expect(row).toMatch(/6\s000/);
    expect(spaced(q('tr[data-test="PO-0000002"]'))).toContain('Brouillon');
    expect(q('tr[data-test="PO-0000001"] a')?.getAttribute('href')).toBe('/pharmacy/orders/o-1');
  });

  it('ne propose la création qu\'à qui peut établir un bon', async () => {
    await setup();
    expect(q('a[href="/pharmacy/orders/new"]')).toBeNull();
    TestBed.resetTestingModule();
    await setup(['pharmacy.procurement:read', 'pharmacy.procurement:manage']);
    expect(q('a[href="/pharmacy/orders/new"]')?.textContent).toContain('Nouveau bon de commande');
  });

  it('filtre par statut et par « mes bons »', async () => {
    await setup();
    const status = q<HTMLSelectElement>('#pharmacy-orders-filter-status')!;
    status.value = 'PENDING_APPROVAL';
    status.dispatchEvent(new Event('change'));
    const box = q<HTMLInputElement>('#pharmacy-orders-filter-mine')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    box.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    q<HTMLFormElement>('#pharmacy-orders-filter')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(pharmacy.listOrders).toHaveBeenLastCalledWith({ status: 'PENDING_APPROVAL', mine: true }, 0, 25);
  });

  it('pagine, dit qu\'il n\'y a aucun bon, et affiche le refus du serveur', async () => {
    await setup(undefined, (g) => g.listOrders.mockResolvedValue({ ...page([orderSummary()], { total: 60 }), currency: 'XAF' }));
    expect(norm(root().textContent ?? '')).toContain('1 – 25 sur 60');
    TestBed.resetTestingModule();
    await setup(undefined, (g) => g.listOrders.mockResolvedValue({ ...page([]), currency: 'XAF' }));
    expect(root().textContent).toContain('Aucun bon de commande.');
    TestBed.resetTestingModule();
    await setup(undefined, (g) => g.listOrders.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')));
    expect(q('[role=alert]')?.textContent).toBeTruthy();
  });
});

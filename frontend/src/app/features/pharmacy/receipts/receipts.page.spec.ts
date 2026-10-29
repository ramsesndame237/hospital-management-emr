import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, page, receipt, receiptSummary } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ReceiptPage } from './receipt.page';
import { ReceiptsPage } from './receipts.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function spaced(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('ReceiptsPage', () => {
  let fixture: ComponentFixture<ReceiptsPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

  async function setup(permissions: readonly string[] = ['pharmacy.stock:read'], prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions, providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ReceiptsPage);
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les réceptions avec leur valeur au coût d\'achat et renvoie à leur détail', async () => {
    await setup();
    const row = spaced(q('tr[data-test="GRN-0000001"]'));
    expect(row).toContain('BL-2026-0412');
    expect(row).toContain('Pharma Distrib');
    expect(row).toContain('pharmacien');
    expect(row).toMatch(/340/);
    expect(row).toMatch(/3\s400/);
    expect(q('tr[data-test="GRN-0000001"] a')?.getAttribute('href')).toBe('/pharmacy/receipts/r-1');
  });

  it('filtre par fournisseur et ne propose la saisie qu\'à qui peut recevoir', async () => {
    await setup();
    expect(q('a[href="/pharmacy/receipts/new"]')).toBeNull();
    const supplier = q<HTMLInputElement>('#pharmacy-receipts-filter-supplier')!;
    supplier.value = ' pharma ';
    supplier.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    q<HTMLFormElement>('#pharmacy-receipts-filter')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(pharmacy.listReceipts).toHaveBeenLastCalledWith({ supplier: 'pharma' }, 0, 25);
    TestBed.resetTestingModule();
    await setup(['pharmacy.stock:read', 'pharmacy.stock:receive']);
    expect(q('a[href="/pharmacy/receipts/new"]')?.textContent).toContain('Nouvelle réception');
  });

  it('dit qu\'il n\'y a aucune réception, et affiche le refus du serveur', async () => {
    await setup(undefined, (g) => g.listReceipts.mockResolvedValue({ ...page([]), currency: 'XAF' }));
    expect(root().textContent).toContain('Aucune réception.');
    TestBed.resetTestingModule();
    await setup(undefined, (g) => g.listReceipts.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')));
    expect(q('[role=alert]')?.textContent).toBeTruthy();
  });

  it('pagine quand la liste dépasse une page', async () => {
    await setup(undefined, (g) => g.listReceipts.mockResolvedValue({ ...page([receiptSummary()], { total: 60 }), currency: 'XAF' }));
    expect(norm(root().textContent ?? '')).toContain('1 – 25 sur 60');
  });
});

describe('ReceiptPage', () => {
  let fixture: ComponentFixture<ReceiptPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

  async function setup(prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions: ['pharmacy.stock:read'], providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ReceiptPage);
    fixture.componentRef.setInput('id', 'r-1');
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('affiche le fournisseur, le bon de livraison, chaque ligne et le total', async () => {
    await setup();
    expect(pharmacy.getReceipt).toHaveBeenCalledWith('r-1');
    expect(q('h1')?.textContent).toContain('GRN-0000001');
    const text = spaced(root());
    expect(text).toContain('Pharma Distrib');
    expect(text).toContain('reçue le');
    expect(text).toContain('par pharmacien');
    expect(text).toContain('Bon de livraison : BL-2026-0412');
    expect(spaced(q('tbody tr'))).toContain('Doliprane 500');
    expect(spaced(q('tbody tr'))).toContain('B2026-114');
    expect(spaced(q('tbody tr'))).toContain('2027-03-31');
    expect(spaced(q('tfoot'))).toMatch(/Total\s+340/);
    expect(q('tbody a')?.getAttribute('href')).toBe('/pharmacy/drugs/d-1');
  });

  it('signale une réception introuvable', async () => {
    await setup((g) => g.getReceipt.mockRejectedValue(new ApiError(404, 'PHARMACY_RECEIPT_NOT_FOUND', 'Réception introuvable.')));
    expect(q('[role=alert]')?.textContent).toContain('introuvable');
    expect(q('h1')).toBeNull();
  });

  it('montre une ligne dont le médicament a disparu sans planter', async () => {
    await setup((g) => g.getReceipt.mockResolvedValue(receipt({ lines: [{ ...receipt().lines[0], drug: null }] })));
    expect(q('tbody tr')).not.toBeNull();
    expect(q('tbody a')).toBeNull();
  });
});

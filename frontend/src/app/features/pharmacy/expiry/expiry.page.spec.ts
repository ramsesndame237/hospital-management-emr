import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, expiryRow, page } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ExpiryPage } from './expiry.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function spaced(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('ExpiryPage', () => {
  let fixture: ComponentFixture<ExpiryPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

  async function setup(prepare?: (g: FakePharmacyGateway) => void, quarantined?: string) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions: ['pharmacy.stock:read'], providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ExpiryPage);
    if (quarantined) fixture.componentRef.setInput('quarantined', quarantined);
    await settle(fixture);
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les lots qui périment bientôt, avec leur état, et renvoie à la fiche du médicament', async () => {
    await setup((g) =>
      g.listExpiry.mockResolvedValue({
        ...page([
          expiryRow({ id: 'b-9', batchNumber: 'OLD', expired: true, expiringSoon: false, daysToExpiry: -3, expiry: '2026-10-21', dispensable: false }),
          expiryRow({ id: 'b-8', batchNumber: 'SOON', daysToExpiry: 20 }),
          expiryRow({ id: 'b-7', batchNumber: 'HELD', status: 'QUARANTINED', quarantineReason: 'Rappel du fabricant', dispensable: false }),
        ]),
        expiryAlertDays: 90, currency: 'XAF',
      }),
    );
    expect(pharmacy.listExpiry).toHaveBeenCalledWith({}, 0, 25);
    expect(q('h1')?.textContent).toContain('Péremptions');
    expect(spaced(q('tr[data-test="OLD"]'))).toContain('Périmé depuis 3 jour(s)');
    expect(spaced(q('tr[data-test="OLD"]'))).toContain('Périmé');
    expect(spaced(q('tr[data-test="SOON"]'))).toContain('Dans 20 jours');
    expect(spaced(q('tr[data-test="SOON"]'))).toContain('Bientôt périmé');
    expect(spaced(q('tr[data-test="HELD"]'))).toContain('Quarantaine');
    expect(spaced(q('tr[data-test="HELD"]'))).toContain('Rappel du fabricant');
    expect(q('tr[data-test="SOON"] a')?.getAttribute('href')).toBe('/pharmacy/drugs/d-1');
  });

  it('arrive filtré sur les lots en quarantaine depuis le compteur du tableau de bord', async () => {
    await setup(undefined, '1');
    expect(pharmacy.listExpiry).toHaveBeenCalledWith({ quarantinedOnly: true }, 0, 25);
  });

  it('applique l\'horizon et la case « quarantaine » du formulaire', async () => {
    await setup();
    const days = q<HTMLSelectElement>('#pharmacy-expiry-filter-days')!;
    days.value = '30';
    days.dispatchEvent(new Event('change'));
    await submit('pharmacy-expiry-filter');
    expect(pharmacy.listExpiry).toHaveBeenLastCalledWith({ days: 30 }, 0, 25);
    days.value = '0';
    days.dispatchEvent(new Event('change'));
    const box = q<HTMLInputElement>('#pharmacy-expiry-filter-quarantinedOnly')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    box.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await submit('pharmacy-expiry-filter');
    expect(pharmacy.listExpiry).toHaveBeenLastCalledWith({ days: 0, quarantinedOnly: true }, 0, 25);
  });

  it('dit qu\'aucun lot ne correspond, et affiche le refus du serveur', async () => {
    await setup((g) => g.listExpiry.mockResolvedValue({ ...page([]), expiryAlertDays: 90, currency: 'XAF' }));
    expect(root().textContent).toContain('Aucun lot ne correspond.');
    TestBed.resetTestingModule();
    await setup((g) => g.listExpiry.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')));
    expect(q('[role=alert]')?.textContent).toBeTruthy();
  });
});

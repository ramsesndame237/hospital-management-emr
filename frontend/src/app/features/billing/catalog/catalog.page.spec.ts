import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { FakeBillingGateway, page } from '../../../core/billing/testing/fake-billing-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { BillingCatalogPage } from './catalog.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('BillingCatalogPage', () => {
  let fixture: ComponentFixture<BillingCatalogPage>;
  let billing: FakeBillingGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const rows = () => [...root().querySelectorAll('tbody tr')].map((tr) => norm(tr.textContent ?? ''));

  async function setup(prepare?: (g: FakeBillingGateway) => void) {
    billing = new FakeBillingGateway();
    prepare?.(billing);
    const { i18n } = configureApp({ roles: ['CASHIER'], permissions: ['billing.catalog:read'], providers: [{ provide: BillingGateway, useValue: billing }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(BillingCatalogPage);
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les actes avec leur catégorie et leur prix en FCFA', async () => {
    await setup();
    const list = rows();
    expect(list).toHaveLength(2);
    expect(list[0]).toContain('CONS-GEN');
    expect(list[0]).toContain('Consultation');
    expect(list[0]).toContain('5 000 FCFA');
    expect(list[1]).toContain('Radiologie');
    expect(list[1]).toContain('15 000 FCFA');
    expect(billing.listItems).toHaveBeenCalledWith({}, 0, 25);
  });

  it('filtre par texte et par catégorie', async () => {
    await setup();
    const input = q<HTMLInputElement>('#catalog-filter-q')!;
    input.value = ' écho ';
    input.dispatchEvent(new Event('input'));
    const select = q<HTMLSelectElement>('#catalog-filter-category')!;
    select.value = 'RADIOLOGY';
    select.dispatchEvent(new Event('change'));
    q<HTMLFormElement>('#catalog-filter')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(billing.listItems).toHaveBeenLastCalledWith({ search: 'écho', category: 'RADIOLOGY' }, 0, 25);
  });

  it('est en lecture seule : aucune action de modification', async () => {
    await setup();
    expect(q('tbody button')).toBeNull();
  });

  it('dit qu\'aucun acte ne correspond', async () => {
    await setup((g) => g.listItems.mockResolvedValue(page([])));
    expect(norm(root().textContent ?? '')).toContain('Aucun acte ne correspond.');
  });

  it('signale une lecture impossible', async () => {
    await setup((g) => g.listItems.mockRejectedValue(new ApiError(0, 'NETWORK', 'Http failure')));
    expect(q('[role=alert]')?.textContent).toContain('connexion réseau a été interrompue');
  });
});

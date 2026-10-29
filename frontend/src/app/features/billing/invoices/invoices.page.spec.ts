import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { FakeBillingGateway, page, summary } from '../../../core/billing/testing/fake-billing-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { InvoicesPage } from './invoices.page';

const READ = ['billing.invoices:read'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('InvoicesPage', () => {
  let fixture: ComponentFixture<InvoicesPage>;
  let billing: FakeBillingGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const rows = () => [...root().querySelectorAll('tbody tr')].map((tr) => norm(tr.textContent ?? ''));

  async function setup(permissions: readonly string[] = [...READ, 'billing.invoices:write'], prepare?: (g: FakeBillingGateway) => void) {
    billing = new FakeBillingGateway();
    prepare?.(billing);
    const { i18n } = configureApp({ roles: ['CASHIER'], permissions, providers: [{ provide: BillingGateway, useValue: billing }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(InvoicesPage);
    await settle(fixture);
  }

  async function submitFilter(number: string, status = '') {
    const n = q<HTMLInputElement>('#invoices-filter-number')!;
    n.value = number;
    n.dispatchEvent(new Event('input'));
    const s = q<HTMLSelectElement>('#invoices-filter-status')!;
    s.value = status;
    s.dispatchEvent(new Event('change'));
    q<HTMLFormElement>('#invoices-filter')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les factures : numéro, patient, statut en toutes lettres, total et reste à payer en FCFA', async () => {
    await setup();
    const list = rows();
    expect(list).toHaveLength(2);
    expect(list[0]).toContain('FAC-0000123');
    expect(list[0]).toContain('Mbarga Élisabeth');
    expect(list[0]).toContain('PAT-0000001');
    expect(list[0]).toContain('Émise');
    expect(list[0]).toContain('11 500 FCFA');
    expect(list[1]).toContain('Payée');
    expect(list[1]).toContain('0 FCFA'); // soldée : plus rien à payer
    expect(billing.listInvoices).toHaveBeenCalledWith({}, 0, 25);
  });

  it('ouvre le détail d\'une facture', async () => {
    await setup();
    const link = q<HTMLAnchorElement>('a[aria-label="Ouvrir la facture FAC-0000123"]')!;
    expect(link.getAttribute('href')).toBe('/billing/invoices/inv-1');
  });

  it('propose « Nouvelle facture » seulement avec le droit d\'écrire', async () => {
    await setup();
    expect(q('a[href="/billing/invoices/new"]')?.textContent).toContain('Nouvelle facture');
  });

  it('masque « Nouvelle facture » en lecture seule (comptabilité)', async () => {
    await setup(READ);
    expect(q('a[href="/billing/invoices/new"]')).toBeNull();
    expect(rows()).toHaveLength(2);
  });

  it('filtre par numéro (en majuscules) et par statut, et revient à la première page', async () => {
    await setup();
    await submitFilter('fac-0000123', 'ISSUED');
    expect(billing.listInvoices).toHaveBeenLastCalledWith({ number: 'FAC-0000123', status: 'ISSUED' }, 0, 25);
    await submitFilter('', '');
    expect(billing.listInvoices).toHaveBeenLastCalledWith({}, 0, 25);
  });

  it('dit qu\'aucune facture ne correspond', async () => {
    await setup(undefined, (g) => g.listInvoices.mockResolvedValue(page([])));
    expect(text()).toContain('Aucune facture ne correspond.');
  });

  it('pagine par 25', async () => {
    const many = Array.from({ length: 25 }, (_, i) => summary({ id: `i-${i}`, number: `FAC-${String(i + 1).padStart(7, '0')}` }));
    await setup(undefined, (g) => g.listInvoices.mockResolvedValue(page(many, { total: 60 })));
    expect(text()).toContain('1 à 25 sur 60');
    const button = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('nav button')].find((b) => b.textContent?.trim() === label)!;
    expect(button('Précédent').disabled).toBe(true);
    button('Suivant').click();
    await settle(fixture);
    expect(billing.listInvoices).toHaveBeenLastCalledWith({}, 25, 25);
    expect(text()).toContain('26 à 50 sur 60');
  });

  it('signale une lecture impossible sans détail technique', async () => {
    await setup(undefined, (g) => g.listInvoices.mockRejectedValue(new ApiError(503, 'UNKNOWN', 'SELECT * FROM billing_invoices failed')));
    expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
    expect(text()).not.toContain('SELECT');
  });
});

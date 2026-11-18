import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { FakeBillingGateway, billable, page } from '../../../core/billing/testing/fake-billing-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ToInvoicePage } from './to-invoice.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();
const UNPRICED = billable({
  id: 'src-2', reference: 'LAB-0000124', total: null, unpriced: ['TSH'],
  lines: [{ code: 'TSH', label: 'Thyréostimuline', quantity: 1, itemName: null, unitPrice: null }],
});

describe('ToInvoicePage (facturation reliée)', () => {
  let fixture: ComponentFixture<ToInvoicePage>;
  let billing: FakeBillingGateway;
  let missingKeys: () => string[];
  let navigate: ReturnType<typeof vi.fn>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => norm(b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label))!;

  async function setup(permissions: readonly string[] = ['billing.invoices:write'], prepare?: (g: FakeBillingGateway) => void) {
    billing = new FakeBillingGateway();
    prepare?.(billing);
    const { i18n } = configureApp({ roles: ['CASHIER'], permissions, providers: [{ provide: BillingGateway, useValue: billing }] });
    missingKeys = watchMissingKeys(i18n);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ToInvoicePage);
    await settle(fixture);
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it("liste d'abord les demandes d'analyses avec le patient, les actes et le prix du catalogue", async () => {
    await setup();
    expect(billing.listBillable).toHaveBeenCalledWith('LAB_REQUISITION', 0, 25);
    const content = text();
    expect(content).toContain('LAB-0000123');
    expect(content).toContain('Mbarga Élisabeth · PAT-0000001');
    expect(content).toContain('Numération formule sanguine');
    expect(content).toContain('3 500 FCFA');
  });

  it("change de type d'élément et relit la liste", async () => {
    await setup();
    await click(buttonNamed('Imagerie'));
    expect(billing.listBillable).toHaveBeenLastCalledWith('IMAGING_ORDER', 0, 25);
    await click(buttonNamed('Médicaments'));
    expect(billing.listBillable).toHaveBeenLastCalledWith('DISPENSATION', 0, 25);
  });

  it("établit la facture puis ouvre son brouillon", async () => {
    await setup();
    await click(buttonNamed('Établir la facture de LAB-0000123'));
    expect(billing.billFromSource).toHaveBeenCalledWith('LAB_REQUISITION', 'src-1');
    expect(navigate).toHaveBeenCalledWith(['/billing/invoices', 'inv-from-source']);
  });

  it("refuse l'envoi d'une demande dont un code n'a pas de prix, et le dit avec un lien vers le catalogue pour qui le gère", async () => {
    await setup(['billing.invoices:write', 'billing.catalog:manage'], (g) => g.listBillable.mockResolvedValue({ ...page([UNPRICED]), currency: 'XAF' }));
    const button = buttonNamed('Établir la facture de LAB-0000124');
    expect(button.disabled).toBe(true);
    expect(text()).toContain('aucun acte du catalogue ne tarifie TSH');
    expect(root().querySelector('a[href="/billing/catalog"]')).not.toBeNull();
  });

  it("n'offre pas le lien vers le catalogue à qui ne peut pas le gérer", async () => {
    await setup(['billing.invoices:write'], (g) => g.listBillable.mockResolvedValue({ ...page([UNPRICED]), currency: 'XAF' }));
    expect(root().querySelector('a[href="/billing/catalog"]')).toBeNull();
  });

  it("affiche le refus du serveur (déjà facturé) sans détail technique, et relit la liste", async () => {
    await setup(['billing.invoices:write'], (g) => g.billFromSource.mockRejectedValue(new ApiError(409, 'BILLING_SOURCE_ALREADY_BILLED', 'Cet élément est déjà facturé.')));
    await click(buttonNamed('Établir la facture de LAB-0000123'));
    expect(text()).toContain('Cet élément est déjà facturé.');
    expect(navigate).not.toHaveBeenCalled();
    expect(billing.listBillable).toHaveBeenCalledTimes(2);
  });

  it('dit que rien ne reste à facturer', async () => {
    await setup(['billing.invoices:write'], (g) => g.listBillable.mockResolvedValue({ ...page([]), currency: 'XAF' }));
    expect(text()).toContain('Rien à facturer pour le moment.');
  });
});

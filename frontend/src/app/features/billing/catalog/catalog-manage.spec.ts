import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { FakeBillingGateway, item, page } from '../../../core/billing/testing/fake-billing-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { BillingCatalogPage } from './catalog.page';

const MANAGER = ['billing.catalog:read', 'billing.catalog:manage'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('BillingCatalogPage : gestion du catalogue', () => {
  let fixture: ComponentFixture<BillingCatalogPage>;
  let billing: FakeBillingGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => norm(b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label));

  async function setup(permissions: readonly string[] = MANAGER, prepare?: (g: FakeBillingGateway) => void) {
    billing = new FakeBillingGateway();
    prepare?.(billing);
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions, providers: [{ provide: BillingGateway, useValue: billing }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(BillingCatalogPage);
    await settle(fixture);
  }

  async function click(button: HTMLElement | undefined) {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('sans le droit de gestion : aucune action, aucune colonne de code source', async () => {
    await setup(['billing.catalog:read']);
    expect(buttonNamed('Ajouter un acte')).toBeUndefined();
    expect(q('tbody button')).toBeNull();
    expect(text()).not.toContain('Code source');
  });

  it("signale les actes de laboratoire, de radiologie ou de pharmacie sans code source (la facture d'une demande réalisée serait impossible)", async () => {
    await setup(MANAGER, (g) => g.listItems.mockResolvedValue(page([
      item(), item({ id: 'i-2', code: 'NFS', name: 'NFS', category: 'LABORATORY', sourceCode: 'NFS' }), item({ id: 'i-3', code: 'ECHO', name: 'Échographie', category: 'RADIOLOGY' }),
    ])));
    const rows = [...root().querySelectorAll('tbody tr')].map((tr) => norm(tr.textContent ?? ''));
    expect(rows[0]).not.toContain('Sans code source'); // consultation : sans objet
    expect(rows[1]).toContain('NFS');
    expect(rows[2]).toContain('Sans code source');
  });

  it("ajoute un acte de laboratoire avec son code source en majuscules, et le prix en plus petite unité", async () => {
    await setup();
    await click(buttonNamed('Ajouter un acte'));
    type('#catalog-create-code', 'nfs-tarif');
    type('#catalog-create-name', 'NFS complète');
    choose('#catalog-create-category', 'LABORATORY');
    fixture.detectChanges();
    type('#catalog-create-unitPrice', '3 500');
    type('#catalog-create-sourceCode', 'nfs');
    await submit('catalog-create');
    expect(billing.createItem).toHaveBeenCalledWith({ code: 'NFS-TARIF', name: 'NFS complète', category: 'LABORATORY', unitPrice: 3500, sourceCode: 'NFS' });
  });

  it("n'envoie pas de code source pour une consultation, même si le champ avait été rempli avant de changer de catégorie", async () => {
    await setup();
    await click(buttonNamed('Ajouter un acte'));
    type('#catalog-create-code', 'CONS');
    type('#catalog-create-name', 'Consultation');
    choose('#catalog-create-category', 'CONSULTATION');
    type('#catalog-create-unitPrice', '5000');
    await submit('catalog-create');
    const input = billing.createItem.mock.calls[0][0];
    expect(input).toEqual({ code: 'CONS', name: 'Consultation', category: 'CONSULTATION', unitPrice: 5000 });
  });

  it('modifie un acte : le prix est renvoyé en entier, un code source vide le retire', async () => {
    await setup(MANAGER, (g) => g.listItems.mockResolvedValue(page([item({ id: 'i-2', code: 'NFS', name: 'NFS', category: 'LABORATORY', unitPrice: 3500, sourceCode: 'NFS' })])));
    await click(buttonNamed('Modifier NFS'));
    expect(q<HTMLInputElement>('#catalog-edit-i-2-unitPrice')!.value).toBe('3500');
    type('#catalog-edit-i-2-unitPrice', '4000');
    type('#catalog-edit-i-2-sourceCode', '');
    await submit('catalog-edit-i-2');
    expect(billing.updateItem).toHaveBeenCalledWith('i-2', { name: 'NFS', category: 'LABORATORY', unitPrice: 4000, sourceCode: null });
  });

  it("affiche le refus du serveur quand un autre acte tarifie déjà ce code", async () => {
    await setup(MANAGER, (g) => g.createItem.mockRejectedValue(new ApiError(409, 'BILLING_ITEM_SOURCE_ALREADY_MAPPED', 'Un autre acte actif tarifie déjà ce code.')));
    await click(buttonNamed('Ajouter un acte'));
    type('#catalog-create-code', 'X1');
    type('#catalog-create-name', 'Doublon');
    choose('#catalog-create-category', 'LABORATORY');
    type('#catalog-create-unitPrice', '100');
    type('#catalog-create-sourceCode', 'NFS');
    await submit('catalog-create');
    expect(q('aside [role=alert]')?.textContent).toContain('tarifie déjà ce code');
  });

  it('retire puis réactive un acte', async () => {
    await setup();
    await click(buttonNamed('Retirer Consultation générale du catalogue'));
    expect(billing.setItemActive).toHaveBeenCalledWith('i-1', false);
  });
});

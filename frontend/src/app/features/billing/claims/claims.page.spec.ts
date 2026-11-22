import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { FakeBillingGateway, page } from '../../../core/billing/testing/fake-billing-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ClaimsPage } from './claims.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('ClaimsPage (créances assureurs)', () => {
  let fixture: ComponentFixture<ClaimsPage>;
  let billing: FakeBillingGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const rows = () => [...root().querySelectorAll('tbody tr')].map((tr) => norm(tr.textContent ?? ''));
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => norm(b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label));

  async function setup(prepare?: (g: FakeBillingGateway) => void) {
    billing = new FakeBillingGateway();
    prepare?.(billing);
    const { i18n } = configureApp({ roles: ['ACCOUNTANT'], permissions: ['billing.payers:read', 'billing.payers:settle'], providers: [{ provide: BillingGateway, useValue: billing }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ClaimsPage);
    await settle(fixture);
  }

  async function click(button: HTMLElement | undefined) {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('affiche d’abord les créances à recouvrer : facture, patient, assureur, part et état', async () => {
    await setup();
    expect(billing.listClaims).toHaveBeenCalledWith({ settled: false }, 0, 25);
    const list = rows();
    expect(list[0]).toContain('FAC-0000199');
    expect(list[0]).toContain('Mbarga Élisabeth');
    expect(list[0]).toContain('Assurance Santé Plus');
    expect(list[0]).toContain('80 % pris en charge');
    expect(list[0]).toContain('7 200 FCFA');
    expect(list[0]).toContain('À recouvrer');
    expect(list[1]).toContain('Réglée le');
    expect(list[1]).toContain('VIR-1');
  });

  it('le bouton de règlement n’existe que pour une créance non réglée', async () => {
    await setup();
    expect(buttonNamed('Constater le règlement de FAC-0000199')).toBeDefined();
    expect(buttonNamed('Constater le règlement de FAC-0000188')).toBeUndefined();
  });

  it('change de filtre (réglées, toutes) et d’assureur', async () => {
    await setup();
    const state = q<HTMLSelectElement>('select')!;
    state.value = 'settled';
    state.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(billing.listClaims).toHaveBeenLastCalledWith({ settled: true }, 0, 25);
    state.value = 'all';
    state.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(billing.listClaims).toHaveBeenLastCalledWith({}, 0, 25);
    const payer = root().querySelectorAll<HTMLSelectElement>('select')[1];
    payer.value = 'py-1';
    payer.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(billing.listClaims).toHaveBeenLastCalledWith({ payerId: 'py-1' }, 0, 25);
  });

  it('constate un règlement avec sa référence obligatoire', async () => {
    await setup();
    await click(buttonNamed('Constater le règlement de FAC-0000199'));
    q<HTMLFormElement>('#claims-settle-inv-9')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(billing.settleClaim).not.toHaveBeenCalled(); // référence obligatoire
    const input = q<HTMLInputElement>('#claims-settle-inv-9-reference')!;
    input.value = 'VIR-2026-0042';
    input.dispatchEvent(new Event('input'));
    q<HTMLFormElement>('#claims-settle-inv-9')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(billing.settleClaim).toHaveBeenCalledWith('inv-9', 'VIR-2026-0042');
    expect(q('#claims-settle-inv-9')).toBeNull(); // le panneau se referme
  });

  it('affiche le refus du serveur (déjà réglée) sans détail technique', async () => {
    await setup((g) => g.settleClaim.mockRejectedValue(new ApiError(409, 'BILLING_ALREADY_SETTLED', "La part de l'assureur est déjà réglée.")));
    await click(buttonNamed('Constater le règlement de FAC-0000199'));
    const input = q<HTMLInputElement>('#claims-settle-inv-9-reference')!;
    input.value = 'VIR-1';
    input.dispatchEvent(new Event('input'));
    q<HTMLFormElement>('#claims-settle-inv-9')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(q('aside [role=alert]')?.textContent).toContain('déjà réglée');
  });

  it("dit qu'aucune créance ne correspond", async () => {
    await setup((g) => g.listClaims.mockResolvedValue(page([])));
    expect(text()).toContain('Aucune créance.');
  });
});

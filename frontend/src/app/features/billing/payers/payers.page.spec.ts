import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { FakeBillingGateway, page, payer } from '../../../core/billing/testing/fake-billing-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { PayersPage } from './payers.page';

const MANAGE = ['billing.payers:read', 'billing.payers:manage'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('PayersPage (assureurs)', () => {
  let fixture: ComponentFixture<PayersPage>;
  let billing: FakeBillingGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const rows = () => [...root().querySelectorAll('tbody tr')].map((tr) => norm(tr.textContent ?? ''));
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => norm(b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label));

  async function setup(permissions: readonly string[] = MANAGE, prepare?: (g: FakeBillingGateway) => void) {
    billing = new FakeBillingGateway();
    prepare?.(billing);
    const { i18n } = configureApp({ roles: ['ACCOUNTANT'], permissions, providers: [{ provide: BillingGateway, useValue: billing }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(PayersPage);
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

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les assureurs, actifs et retirés, avec leur code', async () => {
    await setup();
    const list = rows();
    expect(list).toHaveLength(2);
    expect(list[0]).toContain('ASP');
    expect(list[0]).toContain('Assurance Santé Plus');
    expect(list[0]).toContain('Actif');
    expect(list[1]).toContain('Retiré');
    expect(billing.listPayers).toHaveBeenCalledWith('', true, 0, 200);
  });

  it('en lecture seule : aucune action', async () => {
    await setup(['billing.payers:read']);
    expect(buttonNamed('Ajouter un assureur')).toBeUndefined();
    expect(q('tbody button')).toBeNull();
  });

  it('ajoute un assureur avec son code en majuscules', async () => {
    await setup();
    await click(buttonNamed('Ajouter un assureur'));
    type('#payers-create-code', 'mut-2');
    type('#payers-create-name', '  Mutuelle du Centre ');
    await submit('payers-create');
    expect(billing.createPayer).toHaveBeenCalledWith('MUT-2', 'Mutuelle du Centre');
  });

  it('renomme, puis retire et réactive un assureur', async () => {
    await setup();
    await click(buttonNamed('Renommer Assurance Santé Plus'));
    type('#payers-rename-py-1-name', 'Assurance Santé Plus SA');
    await submit('payers-rename-py-1');
    expect(billing.renamePayer).toHaveBeenCalledWith('py-1', 'Assurance Santé Plus SA');
    await click(buttonNamed('Retirer Assurance Santé Plus'));
    expect(billing.setPayerActive).toHaveBeenCalledWith('py-1', false);
    await click(buttonNamed('Réactiver Mutuelle Nationale'));
    expect(billing.setPayerActive).toHaveBeenLastCalledWith('py-2', true);
  });

  it('affiche le refus du serveur (code déjà pris)', async () => {
    await setup(MANAGE, (g) => g.createPayer.mockRejectedValue(new ApiError(409, 'BILLING_PAYER_CODE_ALREADY_EXISTS', 'Un assureur utilise déjà ce code.')));
    await click(buttonNamed('Ajouter un assureur'));
    type('#payers-create-code', 'ASP');
    type('#payers-create-name', 'Doublon');
    await submit('payers-create');
    expect(q('aside [role=alert]')?.textContent).toContain('utilise déjà ce code');
  });

  it("dit qu'il n'y a aucun assureur", async () => {
    await setup(MANAGE, (g) => g.listPayers.mockResolvedValue(page([payer()]).items.length ? page([]) : page([])));
    expect(text()).toContain('Aucun assureur.');
  });
});

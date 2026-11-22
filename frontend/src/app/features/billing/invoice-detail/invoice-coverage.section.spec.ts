import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { Invoice } from '../../../core/billing/billing.models';
import { FakeBillingGateway, coverage, invoice, page, payer } from '../../../core/billing/testing/fake-billing-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { InvoiceCoverageSection } from './invoice-coverage.section';

const WRITE = ['billing.invoices:write', 'billing.coverages:write', 'billing.payers:read'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

@Component({ imports: [InvoiceCoverageSection], template: '<app-invoice-coverage [invoice]="inv()" (updated)="updated($event)" />' })
class Host {
  readonly inv = signal<Invoice>(invoice({ status: 'DRAFT' }));
  readonly received: Invoice[] = [];
  updated(next: Invoice) {
    this.received.push(next);
    this.inv.set(next);
  }
}

describe('InvoiceCoverageSection (assurance d’une facture)', () => {
  let fixture: ComponentFixture<Host>;
  let billing: FakeBillingGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => norm(b.textContent ?? '').includes(label));

  async function setup(permissions: readonly string[] = WRITE, inv: Invoice = invoice({ status: 'DRAFT' }), prepare?: (g: FakeBillingGateway) => void) {
    billing = new FakeBillingGateway();
    prepare?.(billing);
    const { i18n } = configureApp({ roles: ['CASHIER'], permissions, providers: [{ provide: BillingGateway, useValue: billing }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.inv.set(inv);
    await settle(fixture);
  }

  async function click(button: HTMLElement | undefined) {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it("propose les couvertures valables du patient et applique celle qu'on choisit", async () => {
    await setup();
    expect(billing.listCoverages).toHaveBeenCalledWith('p-1');
    expect(q('select')?.textContent).toContain('Assurance Santé Plus · 80 % · AS-123456');
    await click(buttonNamed('Appliquer'));
    expect(billing.applyCoverage).toHaveBeenCalledWith('inv-1', 'cv-1');
    expect(fixture.componentInstance.received).toHaveLength(1);
  });

  it("n'offre pas une couverture expirée ou désactivée", async () => {
    await setup(WRITE, invoice({ status: 'DRAFT' }), (g) => g.listCoverages.mockResolvedValue([coverage({ validToday: false })]));
    expect(q('select')).toBeNull();
    expect(text()).toContain('aucune couverture valable aujourd’hui');
  });

  it('retire la couverture appliquée à un brouillon', async () => {
    const covered = invoice({ status: 'DRAFT', coverage: { payerId: 'py-1', payerName: 'Assurance Santé Plus', policyNumber: 'AS-123456', percent: 80, amount: 9200, settledAt: null, settlementReference: null } });
    await setup(WRITE, covered);
    expect(text()).toContain('Assurance Santé Plus · 80 % pris en charge');
    await click(buttonNamed('Retirer la couverture'));
    expect(billing.removeCoverage).toHaveBeenCalledWith('inv-1');
  });

  it('enregistre une nouvelle couverture pour le patient (assureurs actifs seulement), puis la propose', async () => {
    await setup(WRITE, invoice({ status: 'DRAFT' }), (g) => g.listCoverages.mockResolvedValue([]));
    await click(buttonNamed('Enregistrer une couverture'));
    expect(billing.listPayers).toHaveBeenCalledWith('', false, 0, 200);
    const select = q<HTMLSelectElement>('#coverage-new-payerId')!;
    expect([...select.options].map((o) => o.textContent?.trim())).toContain('Assurance Santé Plus');
    expect([...select.options].map((o) => o.textContent?.trim())).not.toContain('Mutuelle Nationale'); // retiré
    select.value = 'py-1';
    select.dispatchEvent(new Event('change'));
    for (const [id, value] of [['policyNumber', 'AS-999'], ['percent', '70']]) {
      const input = q<HTMLInputElement>(`#coverage-new-${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    q<HTMLFormElement>('#coverage-new')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(billing.recordCoverage).toHaveBeenCalledWith('p-1', { payerId: 'py-1', policyNumber: 'AS-999', percent: 70 });
    expect(q('select')?.textContent).toContain('70 %');
  });

  it("refuse un pourcentage hors limites avant tout envoi", async () => {
    await setup(WRITE, invoice({ status: 'DRAFT' }), (g) => g.listCoverages.mockResolvedValue([]));
    await click(buttonNamed('Enregistrer une couverture'));
    const select = q<HTMLSelectElement>('#coverage-new-payerId')!;
    select.value = 'py-1';
    select.dispatchEvent(new Event('change'));
    for (const [id, value] of [['policyNumber', 'AS-1'], ['percent', '150']]) {
      const input = q<HTMLInputElement>(`#coverage-new-${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    q<HTMLFormElement>('#coverage-new')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(billing.recordCoverage).not.toHaveBeenCalled();
    expect(q('#coverage-new-percent-error')).not.toBeNull();
  });

  it('après l’émission, la section ne fait que dire ce qui a été décidé (aucune action)', async () => {
    const issued = invoice({ status: 'ISSUED', coverage: { payerId: 'py-1', payerName: 'Assurance Santé Plus', policyNumber: null, percent: 80, amount: 9200, settledAt: '2026-11-02T10:00:00Z', settlementReference: 'VIR-1' } });
    await setup(WRITE, issued);
    expect(text()).toContain('Assurance Santé Plus · 80 % pris en charge');
    expect(text()).toContain('part réglée (réf. VIR-1)');
    expect(buttonNamed('Retirer la couverture')).toBeUndefined();
    expect(buttonNamed('Appliquer')).toBeUndefined();
    expect(billing.listCoverages).not.toHaveBeenCalled();
  });

  it('sans le droit d’écrire une facture, la section est en lecture seule', async () => {
    await setup(['billing.invoices:read']);
    expect(buttonNamed('Appliquer')).toBeUndefined();
    expect(text()).toContain('Aucune assurance sur cette facture.');
  });

  it("affiche le refus du serveur (couverture expirée) sans détail technique", async () => {
    await setup(WRITE, invoice({ status: 'DRAFT' }), (g) => g.applyCoverage.mockRejectedValue(new ApiError(409, 'BILLING_COVERAGE_NOT_VALID', 'Cette couverture n’est pas valable aujourd’hui.')));
    await click(buttonNamed('Appliquer'));
    expect(q('[role=alert]')?.textContent).toContain('pas valable aujourd’hui');
    expect(fixture.componentInstance.received).toHaveLength(0);
  });
});

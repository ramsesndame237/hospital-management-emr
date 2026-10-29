import { DOCUMENT } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApprovalGateway } from '../../../core/billing/approval.gateway';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { CashSessionGateway } from '../../../core/billing/cash-session.gateway';
import { FakeApprovalGateway, requester, summaryOf, supervisor } from '../../../core/billing/testing/fake-approval-gateway';
import { FakeCashSessionGateway } from '../../../core/billing/testing/fake-cash-session-gateway';
import { FakeBillingGateway, invoice, item, line, page, payment } from '../../../core/billing/testing/fake-billing-gateway';
import { ApiError } from '../../../core/http/api-error';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { InvoiceDetailPage } from './invoice-detail.page';

const CASHIER = ['billing.invoices:read', 'billing.invoices:write', 'billing.payments:collect', 'billing.catalog:read', 'billing.approvals:request'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Le texte d'un bloc, avec une espace entre chaque élément (comme à l'écran : un `<dt>` et son `<dd>` ne se touchent pas). */
function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('InvoiceDetailPage', () => {
  let fixture: ComponentFixture<InvoiceDetailPage>;
  let billing: FakeBillingGateway;
  let cash: FakeCashSessionGateway;
  let approvals: FakeApprovalGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(options: { permissions?: readonly string[]; invoice?: ReturnType<typeof invoice> | null; prepare?: (g: FakeBillingGateway) => void; noCash?: boolean } = {}) {
    billing = new FakeBillingGateway();
    cash = new FakeCashSessionGateway();
    approvals = new FakeApprovalGateway();
    if (options.noCash) cash.current.mockResolvedValue(null);
    if (options.invoice) billing.getInvoice.mockResolvedValue(options.invoice);
    options.prepare?.(billing);
    const { i18n } = configureApp({
      roles: ['CASHIER'], permissions: options.permissions ?? CASHIER, profile: { id: requester.id },
      providers: [{ provide: BillingGateway, useValue: billing }, { provide: CashSessionGateway, useValue: cash }, { provide: ApprovalGateway, useValue: approvals }],
    });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(InvoiceDetailPage);
    fixture.componentRef.setInput('id', 'inv-1');
    await settle(fixture);
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function choose(selector: string, value: string) {
    const select = q<HTMLSelectElement>(selector)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  const issued = (over: Partial<ReturnType<typeof invoice>> = {}) => invoice({ status: 'ISSUED', issuedAt: '2026-10-24T09:10:00Z', ...over });
  const partially = () => issued({ status: 'PARTIALLY_PAID', payments: [payment()] });

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('affichage', () => {
    it('montre l\'en-tête, les actes, les totaux et le reste à payer d\'un brouillon', async () => {
      await setup();
      expect(q('h1')?.textContent).toContain('FAC-0000123');
      expect(q('h1')?.textContent).toContain('Brouillon');
      expect(text()).toContain('Mbarga Élisabeth');
      const lines = [...root().querySelectorAll('section:first-of-type tbody tr')].map((tr) => norm(tr.textContent ?? ''));
      expect(lines[0]).toContain('Consultation générale');
      expect(lines[0]).toContain('5 000 FCFA');
      expect(lines[0]).toContain('10 000 FCFA');
      expect(text()).toContain('Sous-total 11 500 FCFA');
      expect(text()).toContain('Total à payer 11 500 FCFA');
      expect(text()).toContain('Reste à payer 11 500 FCFA');
    });

    it('montre une remise et son motif', async () => {
      await setup({ invoice: invoice({ discount: 1500 }) });
      expect(text()).toContain('Remise (Personnel) − 1 500 FCFA');
      expect(text()).toContain('Total à payer 10 000 FCFA');
    });

    it('montre les encaissements et le solde', async () => {
      await setup({ invoice: partially() });
      expect(text()).toContain('REC-0000001');
      expect(text()).toContain('Espèces');
      expect(text()).toContain('Déjà encaissé 4 000 FCFA');
      expect(text()).toContain('Reste à payer 7 500 FCFA');
    });

    it('affiche une facture annulée avec son motif, sans aucune action', async () => {
      await setup({ invoice: invoice({ status: 'CANCELLED', cancellationReason: 'Mauvais patient' }) });
      expect(text()).toContain('Facture annulée');
      expect(text()).toContain('Mauvais patient');
      expect(text()).toContain('Reste à payer 0 FCFA');
      expect(root().querySelector('header button')).toBeNull();
    });

    it('signale une facture introuvable sans détail technique', async () => {
      await setup({ prepare: (g) => g.getInvoice.mockRejectedValue(new ApiError(404, 'BILLING_INVOICE_NOT_FOUND', 'Facture introuvable.')) });
      expect(q('[role=alert]')?.textContent).toContain('Facture introuvable.');
      expect(q('table')).toBeNull();
    });

    it('relit la facture quand l\'adresse change', async () => {
      await setup();
      fixture.componentRef.setInput('id', 'inv-2');
      await settle(fixture);
      expect(billing.getInvoice).toHaveBeenLastCalledWith('inv-2');
    });
  });

  describe('caisse ouverte', () => {
    it('sans caisse ouverte, remplace « Encaisser » par un lien vers l\'ouverture de la caisse et dit pourquoi', async () => {
      await setup({ invoice: issued(), noCash: true });
      expect(buttonNamed('Encaisser')).toBeUndefined();
      expect(q('header a[href="/billing/session"]')?.textContent).toContain('Ouvrir ma caisse');
      expect(text()).toContain('Vous n’avez pas de caisse ouverte');
    });

    it('avec une caisse ouverte, propose d\'encaisser', async () => {
      await setup({ invoice: issued() });
      expect(cash.current).toHaveBeenCalled();
      expect(buttonNamed('Encaisser')).toBeDefined();
      expect(text()).not.toContain('Vous n’avez pas de caisse ouverte');
    });

    it('apprend qu\'il n\'y a plus de caisse quand le serveur refuse l\'encaissement, et propose de l\'ouvrir', async () => {
      await setup({ invoice: issued(), prepare: (g) => g.collect.mockRejectedValue(new ApiError(409, 'BILLING_NO_OPEN_SESSION', 'Ouvrez votre caisse avant d\'encaisser : aucune session de caisse ouverte à votre nom.')) });
      await click(buttonNamed('Encaisser'));
      await submit('invoice-collect');
      expect(q('aside [role=alert]')?.textContent).toContain('Ouvrez votre caisse');
      expect(q('header a[href="/billing/session"]')).not.toBeNull();
    });

    it('ne cherche pas la caisse de qui ne peut pas encaisser (comptabilité)', async () => {
      await setup({ permissions: ['billing.invoices:read'], invoice: issued() });
      expect(cash.current).not.toHaveBeenCalled();
    });

    it('continue de fonctionner quand la lecture de la caisse échoue', async () => {
      await setup({ invoice: issued(), prepare: () => undefined });
    });
  });

  describe('droits', () => {
    it('ne propose aucune action en lecture seule (comptabilité)', async () => {
      await setup({ permissions: ['billing.invoices:read'], invoice: issued() });
      expect(root().querySelector('header button')).toBeNull();
      expect(q('tbody button')).toBeNull();
    });

    it('ne laisse écrire que la caisse : pas d\'encaissement sans le droit de percevoir', async () => {
      await setup({ permissions: ['billing.invoices:read', 'billing.invoices:write'] });
      expect(buttonNamed('Encaisser')).toBeUndefined();
      expect(buttonNamed('Annuler la facture')).toBeDefined();
    });

    it.each([
      ['un brouillon (préparer)', () => invoice(), ['Ajouter un acte', 'Remise', 'Émettre la facture', 'Annuler la facture']],
      ['une facture émise (encaisser, demander l’annulation)', () => issued(), ['Encaisser', 'Demander l’annulation']],
      ['une facture payée en partie (encaisser seulement)', () => partially(), ['Encaisser']],
      ['une facture payée (rien)', () => issued({ status: 'PAID', payments: [payment({ amount: 11500 })] }), []],
    ])('propose pour %s les bonnes actions', async (_name, make, expected) => {
      await setup({ invoice: make() });
      expect([...root().querySelectorAll('header button')].map((b) => b.textContent?.trim())).toEqual(expected);
    });

    it('n\'autorise pas à émettre un brouillon vide', async () => {
      await setup({ invoice: invoice({ lines: [] }) });
      expect(buttonNamed('Émettre la facture').disabled).toBe(true);
      expect(text()).toContain('Aucun acte pour le moment');
    });
  });

  describe('préparation du brouillon', () => {
    it('cherche dans le catalogue et ajoute un acte avec la quantité choisie', async () => {
      await setup();
      await click(buttonNamed('Ajouter un acte'));
      expect(billing.listItems).toHaveBeenCalledWith({}, 0, 10);
      expect(q('aside h2')?.textContent).toContain('Ajouter un acte');
      expect(text()).toContain('Échographie');
      await type('#invoice-add-line-quantity', '3');
      await click(buttonNamed('Ajouter Consultation générale'));
      expect(billing.addLine).toHaveBeenCalledWith('inv-1', 'i-1', 3);
      expect(q('aside')).not.toBeNull(); // le panneau reste ouvert pour en ajouter d'autres
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('« Consultation générale » ajouté à la facture.');
    });

    it('utilise la quantité 1 par défaut et la ramène à 1 quand elle est invalide', async () => {
      await setup();
      await click(buttonNamed('Ajouter un acte'));
      await click(buttonNamed('Ajouter Échographie'));
      expect(billing.addLine).toHaveBeenLastCalledWith('inv-1', 'i-2', 1);
      await type('#invoice-add-line-quantity', '0');
      await click(buttonNamed('Ajouter Échographie'));
      expect(billing.addLine).toHaveBeenLastCalledWith('inv-1', 'i-2', 1);
    });

    it('recherche un acte par son libellé', async () => {
      await setup();
      await click(buttonNamed('Ajouter un acte'));
      billing.listItems.mockResolvedValue(page([item({ id: 'i-2', code: 'ECHO', name: 'Échographie', unitPrice: 15000 })]));
      await type('#invoice-add-line-q', 'écho');
      await submit('invoice-add-line');
      expect(billing.listItems).toHaveBeenLastCalledWith({ search: 'écho' }, 0, 10);
      expect(text()).toContain('ECHO · 15 000 FCFA');
    });

    it('dit qu\'aucun acte ne correspond', async () => {
      await setup();
      await click(buttonNamed('Ajouter un acte'));
      billing.listItems.mockResolvedValue(page([]));
      await submit('invoice-add-line');
      expect(text()).toContain('Aucun acte ne correspond.');
    });

    it('retire une ligne', async () => {
      await setup();
      await click(buttonNamed('Retirer Consultation générale'));
      expect(billing.removeLine).toHaveBeenCalledWith('inv-1', 'l-1');
    });

    it('applique une remise avec son motif, converti en entier', async () => {
      await setup();
      await click(buttonNamed('Remise'));
      await type('#invoice-discount-amount', '1 000');
      await type('#invoice-discount-reason', '  Personnel de l\'hôpital ');
      await submit('invoice-discount');
      expect(billing.setDiscount).toHaveBeenCalledWith('inv-1', 1000, 'Personnel de l\'hôpital');
      expect(q('aside')).toBeNull();
      expect(text()).toContain('Remise (Personnel) − 1 000 FCFA');
    });

    it('exige un montant valide et un motif avant tout appel', async () => {
      await setup();
      await click(buttonNamed('Remise'));
      await submit('invoice-discount');
      expect(text()).toContain('Saisissez un montant.');
      expect(text()).toContain('Le motif est obligatoire.');
      await type('#invoice-discount-amount', '12,5');
      await type('#invoice-discount-reason', 'x');
      await submit('invoice-discount');
      expect(text()).toContain('Montant invalide');
      expect(billing.setDiscount).not.toHaveBeenCalled();
    });

    it('retire une remise existante', async () => {
      await setup({ invoice: invoice({ discount: 1500 }) });
      await click(buttonNamed('Remise'));
      expect(q<HTMLInputElement>('#invoice-discount-amount')?.value).toBe('1500');
      await click(buttonNamed('Retirer la remise'));
      expect(billing.setDiscount).toHaveBeenCalledWith('inv-1', 0, null);
    });

    it('affiche le refus du serveur dans le panneau, saisie conservée', async () => {
      await setup({ prepare: (g) => g.setDiscount.mockRejectedValue(new ApiError(422, 'BILLING_DISCOUNT_TOO_HIGH', 'La remise ne peut pas dépasser le total de la facture (11500).')) });
      await click(buttonNamed('Remise'));
      await type('#invoice-discount-amount', '1000');
      await type('#invoice-discount-reason', 'Trop');
      await submit('invoice-discount');
      expect(q('aside [role=alert]')?.textContent).toContain('ne peut pas dépasser');
      expect(q<HTMLInputElement>('#invoice-discount-amount')?.value).toBe('1000');
    });
  });

  describe('émission et annulation', () => {
    it('demande confirmation avant d\'émettre, puis verrouille', async () => {
      await setup();
      await click(buttonNamed('Émettre la facture'));
      expect(text()).toContain('La facture sera verrouillée');
      expect(text()).toContain('journal d’audit');
      expect(billing.issue).not.toHaveBeenCalled();
      await submit('invoice-issue');
      expect(billing.issue).toHaveBeenCalledWith('inv-1');
      expect(q('h1')?.textContent).toContain('Émise');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Facture FAC-0000123 émise.');
    });

    it('renonce à émettre sans rien changer', async () => {
      await setup();
      await click(buttonNamed('Émettre la facture'));
      await click(buttonNamed('Continuer à la préparer'));
      expect(q('aside')).toBeNull();
      expect(billing.issue).not.toHaveBeenCalled();
    });

    it('annule directement un brouillon avec un motif obligatoire', async () => {
      await setup();
      await click(buttonNamed('Annuler la facture'));
      await submit('invoice-cancel');
      expect(text()).toContain('Le motif est obligatoire.');
      expect(billing.cancel).not.toHaveBeenCalled();
      await type('#invoice-cancel-reason', ' Mauvais patient ');
      await submit('invoice-cancel');
      expect(billing.cancel).toHaveBeenCalledWith('inv-1', 'Mauvais patient');
      expect(approvals.request).not.toHaveBeenCalled();
      expect(text()).toContain('Facture annulée');
      expect(q('h1')?.textContent).toContain('Annulée');
    });

    it('une facture émise ne s\'annule pas seule : le caissier envoie une demande motivée', async () => {
      await setup({ invoice: issued() });
      expect(buttonNamed('Annuler la facture')).toBeUndefined();
      await click(buttonNamed('Demander l’annulation'));
      expect(q('aside h2')?.textContent).toContain('Demander l’annulation');
      expect(text()).toContain('Un responsable doit donner son accord');
      await submit('invoice-cancel-request');
      expect(text()).toContain('Le motif est obligatoire.');
      expect(approvals.request).not.toHaveBeenCalled();
      billing.getInvoice.mockResolvedValue(issued({ approvals: [summaryOf({ kind: 'CANCEL', amount: null, reason: 'Mauvais patient' })] }));
      await type('#invoice-cancel-request-reason', ' Mauvais patient ');
      await submit('invoice-cancel-request');
      expect(approvals.request).toHaveBeenCalledWith({ invoiceId: 'inv-1', kind: 'CANCEL', reason: 'Mauvais patient' });
      expect(billing.cancel).not.toHaveBeenCalled();
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Demande envoyée à un responsable.');
      expect(text()).toContain('Annulation en attente de l’accord d’un responsable');
      expect(q('aside')).toBeNull();
    });

    it('ne propose pas d\'annuler une facture déjà encaissée', async () => {
      await setup({ invoice: partially() });
      expect(buttonNamed('Annuler la facture')).toBeUndefined();
    });
  });

  describe('encaissement', () => {
    it('propose le solde par défaut et les espèces, avec la monnaie à rendre en direct', async () => {
      await setup({ invoice: issued() });
      await click(buttonNamed('Encaisser'));
      expect(q<HTMLInputElement>('#invoice-collect-amount')?.value).toBe('11500');
      expect(q<HTMLSelectElement>('#invoice-collect-mode')?.value).toBe('CASH');
      expect(q('#invoice-collect-tendered')).not.toBeNull();
      expect(q('#invoice-collect-reference')).toBeNull();
      await type('#invoice-collect-amount', '4000');
      await type('#invoice-collect-tendered', '5000');
      expect(text()).toContain('Monnaie à rendre : 1 000 FCFA');
    });

    it('encaisse en espèces, rend la monnaie, et affiche le reçu à imprimer', async () => {
      await setup({ invoice: issued() });
      await click(buttonNamed('Encaisser'));
      await type('#invoice-collect-amount', '4000');
      await type('#invoice-collect-tendered', '5000');
      await submit('invoice-collect');
      expect(billing.collect).toHaveBeenCalledWith('inv-1', { mode: 'CASH', amount: 4000, tendered: 5000 });
      expect(q('aside h2')?.textContent).toContain('Reçu d’encaissement');
      const receipt = textOf(q('.print-area'));
      expect(receipt).toContain('REC-0000001');
      expect(receipt).toContain('FAC-0000123');
      expect(receipt).toContain('Mbarga Élisabeth');
      expect(receipt).toContain('Espèces');
      expect(receipt).toContain('4 000 FCFA');
      expect(receipt).toContain('Monnaie rendue 1 000 FCFA');
      expect(receipt).toContain('Reste à payer 7 500 FCFA');
      expect(receipt).not.toContain('Duplicata');
      expect(q('h1')?.textContent).toContain('Payée en partie');
    });

    it('imprime le reçu', async () => {
      await setup({ invoice: issued() });
      const print = vi.spyOn(TestBed.inject(DOCUMENT).defaultView!, 'print').mockImplementation(() => undefined);
      await click(buttonNamed('Encaisser'));
      await submit('invoice-collect');
      await click(buttonNamed('Imprimer le reçu'));
      expect(print).toHaveBeenCalledOnce();
      await click(buttonNamed('Fermer'));
      expect(q('aside')).toBeNull();
    });

    it('encaisse par mobile money avec sa référence, sans montant remis', async () => {
      await setup({ invoice: issued() });
      await click(buttonNamed('Encaisser'));
      await choose('#invoice-collect-mode', 'MOBILE_MONEY');
      expect(q('#invoice-collect-tendered')).toBeNull();
      await type('#invoice-collect-reference', ' MP240131.1234 ');
      await submit('invoice-collect');
      expect(billing.collect).toHaveBeenCalledWith('inv-1', { mode: 'MOBILE_MONEY', amount: 11500, reference: 'MP240131.1234' });
    });

    it('annonce le reste à payer d\'un paiement partiel hors espèces', async () => {
      await setup({ invoice: issued() });
      await click(buttonNamed('Encaisser'));
      await choose('#invoice-collect-mode', 'CARD');
      await type('#invoice-collect-amount', '5000');
      expect(text()).toContain('Il restera 6 500 FCFA à payer après cet encaissement.');
    });

    it('refuse un montant supérieur au solde, sans appeler le serveur', async () => {
      await setup({ invoice: issued() });
      await click(buttonNamed('Encaisser'));
      await type('#invoice-collect-amount', '12000');
      expect(text()).toContain('Le montant dépasse le solde (11 500 FCFA).');
      await submit('invoice-collect');
      expect(q('aside [role=alert]')?.textContent).toContain('dépasse le solde');
      expect(billing.collect).not.toHaveBeenCalled();
    });

    it('refuse des espèces remises inférieures au montant encaissé', async () => {
      await setup({ invoice: issued() });
      await click(buttonNamed('Encaisser'));
      await type('#invoice-collect-amount', '4000');
      await type('#invoice-collect-tendered', '3000');
      expect(text()).toContain('Le montant remis est inférieur au montant encaissé (4 000 FCFA).');
      await submit('invoice-collect');
      expect(billing.collect).not.toHaveBeenCalled();
    });

    it('refuse un montant nul ou mal saisi', async () => {
      await setup({ invoice: issued() });
      await click(buttonNamed('Encaisser'));
      await type('#invoice-collect-amount', '0');
      await submit('invoice-collect');
      expect(text()).toContain('Montant invalide');
      await type('#invoice-collect-amount', 'beaucoup');
      await submit('invoice-collect');
      expect(billing.collect).not.toHaveBeenCalled();
    });

    it('affiche le refus du serveur (solde changé entre-temps) et garde la saisie', async () => {
      await setup({ invoice: issued(), prepare: (g) => g.collect.mockRejectedValue(new ApiError(409, 'BILLING_OVERPAYMENT', 'Le montant dépasse le solde de la facture (3000).')) });
      await click(buttonNamed('Encaisser'));
      await type('#invoice-collect-amount', '5000');
      await submit('invoice-collect');
      expect(q('aside [role=alert]')?.textContent).toContain('dépasse le solde de la facture');
      expect(q<HTMLInputElement>('#invoice-collect-amount')?.value).toBe('5000');
    });
  });

  describe('réimpression d\'un reçu', () => {
    it('exige un motif, puis affiche une copie marquée « Duplicata »', async () => {
      await setup({ invoice: partially() });
      await click(buttonNamed('Réimprimer le reçu REC-0000001'));
      expect(text()).toContain('Une copie, pas un original');
      await submit('invoice-reprint-pay-1');
      expect(text()).toContain('Le motif est obligatoire.');
      expect(billing.reprintReceipt).not.toHaveBeenCalled();
      await type('#invoice-reprint-pay-1-reason', ' Reçu perdu par le patient ');
      await submit('invoice-reprint-pay-1');
      expect(billing.reprintReceipt).toHaveBeenCalledWith('pay-1', 'Reçu perdu par le patient');
      expect(q('aside h2')?.textContent).toContain('Reçu (copie)');
      const receipt = textOf(q('.print-area'));
      expect(receipt).toContain('Duplicata');
      expect(receipt).toContain('REC-0000001');
      expect(receipt).toContain('Reste à payer 7 500 FCFA');
    });

    it('n\'est proposée qu\'à qui peut encaisser', async () => {
      await setup({ permissions: ['billing.invoices:read', 'billing.invoices:write'], invoice: partially() });
      expect(buttonNamed('Réimprimer le reçu REC-0000001')).toBeUndefined();
    });
  });

  describe('modification simultanée', () => {
    it('explique que la facture a changé et propose de la recharger', async () => {
      await setup({ prepare: (g) => g.removeLine.mockRejectedValue(new ApiError(409, 'BILLING_INVOICE_CHANGED', 'Cette facture vient d\'être modifiée par quelqu\'un d\'autre : rechargez-la puis recommencez.')) });
      await click(buttonNamed('Retirer Consultation générale'));
      expect(q('[role=alert]')?.textContent).toContain('vient d\'être modifiée');
      const calls = billing.getInvoice.mock.calls.length;
      await click(buttonNamed('Recharger la facture'));
      expect(billing.getInvoice.mock.calls.length).toBe(calls + 1);
      expect(q('[role=alert]')).toBeNull();
    });

    it('affiche toute autre erreur sans proposer de recharger', async () => {
      await setup({ prepare: (g) => g.removeLine.mockRejectedValue(new ApiError(409, 'BILLING_INVOICE_NOT_DRAFT', 'Cette facture est émise : ses lignes et sa remise ne peuvent plus être modifiées.')) });
      await click(buttonNamed('Retirer Consultation générale'));
      expect(q('[role=alert]')?.textContent).toContain('est émise');
      expect(buttonNamed('Recharger la facture')).toBeUndefined();
    });
  });

  it('ne fait jamais de calcul d\'argent : tout vient de l\'API', async () => {
    await setup({ invoice: invoice({ lines: [line({ id: 'x', quantity: 3, unitPrice: 333, total: 999 })], discount: 0 }) });
    expect(text()).toContain('Total à payer 999 FCFA');
  });
  describe('circuit d\'approbation', () => {
    const pendingDiscount = (over: Parameters<typeof summaryOf>[0] = {}) => invoice({ approvals: [summaryOf(over)] });

    it('envoie une remise au-delà du seuil en demande d\'approbation, avec un bouton et un message explicites', async () => {
      await setup();
      await click(buttonNamed('Remise'));
      await type('#invoice-discount-amount', '1000');
      expect(text()).not.toContain('sera envoyée à un responsable');
      expect(buttonNamed('Appliquer la remise')).toBeDefined();
      await type('#invoice-discount-amount', '2000');
      expect(text()).toContain('Cette remise dépasse 10 % de la facture (1 150 FCFA) : elle sera envoyée à un responsable');
      expect(buttonNamed('Envoyer pour approbation')).toBeDefined();
      await type('#invoice-discount-reason', ' Patient indigent ');
      billing.getInvoice.mockResolvedValue(pendingDiscount());
      await submit('invoice-discount');
      expect(approvals.request).toHaveBeenCalledWith({ invoiceId: 'inv-1', kind: 'DISCOUNT', amount: 2000, reason: 'Patient indigent' });
      expect(billing.setDiscount).not.toHaveBeenCalled();
      expect(text()).toContain('Remise de 2 000 FCFA en attente de l’accord d’un responsable');
      expect(text()).toContain('Demande de caissier');
    });

    it('applique directement une remise dans le seuil', async () => {
      await setup();
      await click(buttonNamed('Remise'));
      await type('#invoice-discount-amount', '1000');
      await type('#invoice-discount-reason', 'Fidélité');
      await submit('invoice-discount');
      expect(billing.setDiscount).toHaveBeenCalledWith('inv-1', 1000, 'Fidélité');
      expect(approvals.request).not.toHaveBeenCalled();
    });

    it('gèle la facture pendant l\'attente : plus d\'ajout, de remise, d\'émission ni d\'annulation', async () => {
      await setup({ invoice: pendingDiscount() });
      for (const label of ['Ajouter un acte', 'Remise', 'Émettre la facture', 'Annuler la facture', 'Demander l’annulation']) expect(buttonNamed(label)).toBeUndefined();
      expect(text()).toContain('Tant qu’elle n’est pas décidée, la facture ne peut plus être modifiée.');
    });

    it('laisse l\'auteur retirer sa demande, puis libère la facture', async () => {
      await setup({ invoice: pendingDiscount() });
      billing.getInvoice.mockResolvedValue(invoice({ approvals: [summaryOf({ status: 'WITHDRAWN' })] }));
      await click(buttonNamed('Retirer ma demande'));
      expect(approvals.withdraw).toHaveBeenCalledWith('ap-1');
      expect(text()).not.toContain('en attente de l’accord');
      expect(buttonNamed('Remise')).toBeDefined();
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Demande retirée.');
    });

    it('ne propose pas à un autre de retirer la demande de quelqu\'un', async () => {
      await setup({ invoice: pendingDiscount({ requestedBy: supervisor }) });
      expect(buttonNamed('Retirer ma demande')).toBeUndefined();
    });

    it('prévient qu\'une demande est périmée', async () => {
      await setup({ invoice: pendingDiscount({ outdated: true }) });
      expect(text()).toContain('un responsable ne pourra que la refuser');
    });

    it('montre l\'historique des demandes, le refus et son explication', async () => {
      await setup({
        invoice: invoice({
          approvals: [
            summaryOf({ id: 'ap-2', status: 'REJECTED', decidedBy: supervisor, decidedAt: '2026-10-24T09:40:00Z', decisionComment: 'Hors barème' }),
            summaryOf({ id: 'ap-1', kind: 'CANCEL', amount: null, status: 'APPROVED', decidedBy: supervisor, decidedAt: '2026-10-24T09:30:00Z', decisionComment: 'Vu' }),
          ],
        }),
      });
      const history = textOf(q('section[class*="border"]:has(ul)'));
      expect(history).toContain('Demandes d’approbation');
      expect(history).toContain('Refusée');
      expect(history).toContain('Refusée par comptable : Hors barème');
      expect(history).toContain('Acceptée');
      expect(buttonNamed('Retirer ma demande')).toBeUndefined();
    });

    it('affiche le refus du serveur dans le panneau (demande déjà en cours)', async () => {
      await setup();
      approvals.request.mockRejectedValue(new ApiError(409, 'BILLING_APPROVAL_PENDING', 'Une demande d\'approbation attend déjà la décision d\'un responsable pour cette facture.'));
      await click(buttonNamed('Remise'));
      await type('#invoice-discount-amount', '2000');
      await type('#invoice-discount-reason', 'Indigent');
      await submit('invoice-discount');
      expect(q('aside [role=alert]')?.textContent).toContain('attend déjà la décision');
    });

    it('sans le droit de demander, une facture émise n\'offre pas d\'annulation', async () => {
      await setup({ invoice: issued(), permissions: ['billing.invoices:read', 'billing.invoices:write', 'billing.payments:collect'] });
      expect(buttonNamed('Annuler la facture')).toBeUndefined();
      expect(buttonNamed('Demander l’annulation')).toBeUndefined();
    });
  });
});

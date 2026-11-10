import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, colleague, order, pharmacist } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { OrderPage } from './order.page';

const READ = ['pharmacy.procurement:read'];
const ALL = [...READ, 'pharmacy.procurement:manage', 'pharmacy.procurement:approve', 'pharmacy.stock:receive'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function spaced(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('OrderPage', () => {
  let fixture: ComponentFixture<OrderPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const named = (label: string) => [...root().querySelectorAll<HTMLElement>('button, a')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label);

  /** L'utilisateur connecté est, par défaut, l'AUTEUR des fixtures (`pharmacist`) ; `userId` permet d'être un autre pharmacien. */
  async function setup(loaded = order(), permissions: readonly string[] = ALL, userId: string = pharmacist.id, prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    pharmacy.getOrder.mockResolvedValue(loaded);
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions, profile: { id: userId }, providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(OrderPage);
    fixture.componentRef.setInput('id', 'o-1');
    await settle(fixture);
  }

  async function click(el: HTMLElement | undefined) {
    el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => t.message);

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('affiche le bon : fournisseur, auteur, date attendue, lignes (commandé, reçu, reste) et total', async () => {
    await setup(order({ status: 'APPROVED', approvedBy: colleague, approvedAt: '2026-10-28T09:00:00Z' }));
    expect(pharmacy.getOrder).toHaveBeenCalledWith('o-1');
    expect(q('h1')?.textContent).toContain('PO-0000001');
    const text = spaced(root());
    expect(text).toContain('Pharma Distrib SARL');
    expect(text).toContain('Établi par pharmacien');
    expect(text).toContain('Approuvé par pharmacien2');
    expect(text).toContain('Livraison attendue le 2026-11-20');
    expect(text).toContain('Approuvé');
    const line = spaced(q('tr[data-test="PARA500"]'));
    expect(line).toContain('Doliprane 500');
    expect(line).toMatch(/500\s+0\s+500/);
    expect(spaced(q('tfoot'))).toMatch(/Total\s+500\s+0\s+500/);
    expect(q('tr[data-test="PARA500"] a')?.getAttribute('href')).toBe('/pharmacy/drugs/d-1');
  });

  describe('brouillon', () => {
    it('se corrige, se soumet ou s\'annule — par qui peut établir un bon', async () => {
      await setup();
      expect(named('Modifier le brouillon')?.getAttribute('href')).toBe('/pharmacy/orders/o-1/edit');
      expect(named('Soumettre à l’approbation')).toBeDefined();
      expect(named('Annuler le bon')).toBeDefined();
      expect(named('Approuver')).toBeUndefined();
    });

    it('ne propose rien sans le droit d\'établir un bon', async () => {
      await setup(order(), READ);
      for (const label of ['Modifier le brouillon', 'Soumettre à l’approbation', 'Annuler le bon']) expect(named(label)).toBeUndefined();
    });

    it('soumet à l\'approbation', async () => {
      await setup();
      await click(named('Soumettre à l’approbation'));
      expect(pharmacy.submitOrder).toHaveBeenCalledWith('o-1');
      expect(toasts()).toEqual(['Bon PO-0000001 soumis : un autre pharmacien doit l’approuver.']);
      expect(spaced(root())).toContain('À approuver');
    });

    it('rappelle le motif d\'un refus et invite à corriger', async () => {
      await setup(order({ rejectionReason: 'Quantité trop élevée' }));
      expect(q('[role=status]')?.textContent).toContain('Refusé : Quantité trop élevée. Corrigez le bon puis soumettez-le de nouveau.');
    });

    it('s\'annule avec un motif obligatoire', async () => {
      await setup();
      await click(named('Annuler le bon'));
      expect(q('aside h2')?.textContent).toContain('Annuler PO-0000001');
      await submit('order-cancel');
      expect(q('aside')?.textContent).toContain('Le motif est obligatoire.');
      expect(pharmacy.cancelOrder).not.toHaveBeenCalled();
      type('#order-cancel-reason', ' Plus besoin ');
      await submit('order-cancel');
      expect(pharmacy.cancelOrder).toHaveBeenCalledWith('o-1', 'Plus besoin');
      expect(toasts()).toEqual(['Bon PO-0000001 annulé.']);
      expect(q('aside')).toBeNull();
      expect(norm(root().textContent ?? '')).toContain('Annulé par pharmacien : Plus besoin');
    });
  });

  describe('à approuver', () => {
    const pending = () => order({ status: 'PENDING_APPROVAL', submittedAt: '2026-10-28T08:10:00Z' });

    it('un AUTRE pharmacien approuve ou refuse', async () => {
      await setup(pending(), ALL, colleague.id);
      expect(named('Approuver')).toBeDefined();
      expect(named('Refuser')).toBeDefined();
    });

    it('l\'auteur voit que son bon attend, sans bouton de décision', async () => {
      await setup(pending());
      expect(named('Approuver')).toBeUndefined();
      expect(named('Refuser')).toBeUndefined();
      expect(norm(root().textContent ?? '')).toContain('Votre bon : un autre pharmacien doit l’approuver.');
    });

    it('ne propose pas de décision sans le droit d\'approuver', async () => {
      await setup(pending(), [...READ, 'pharmacy.procurement:manage'], colleague.id);
      expect(named('Approuver')).toBeUndefined();
    });

    it('approuve', async () => {
      await setup(pending(), ALL, colleague.id);
      await click(named('Approuver'));
      expect(pharmacy.approveOrder).toHaveBeenCalledWith('o-1');
      expect(toasts()).toEqual(['Bon PO-0000001 approuvé : il peut recevoir ses livraisons.']);
      expect(named('Réceptionner une livraison')).toBeDefined();
    });

    it('refuse avec un motif obligatoire : le bon revient en brouillon', async () => {
      await setup(pending(), ALL, colleague.id);
      await click(named('Refuser'));
      await submit('order-reject');
      expect(q('aside')?.textContent).toContain('Le motif est obligatoire.');
      type('#order-reject-reason', ' Trop d\'amoxicilline ');
      await submit('order-reject');
      expect(pharmacy.rejectOrder).toHaveBeenCalledWith('o-1', 'Trop d\'amoxicilline');
      expect(toasts()).toEqual(['Bon PO-0000001 refusé : il est revenu en brouillon.']);
      expect(norm(root().textContent ?? '')).toContain('Refusé : Trop d\'amoxicilline');
    });

    it('affiche le refus du serveur (approbation de son propre bon) en haut de page', async () => {
      await setup(pending(), ALL, colleague.id, (g) => g.approveOrder.mockRejectedValue(new ApiError(409, 'PHARMACY_ORDER_SELF_APPROVAL', 'Vous ne pouvez pas décider un bon de commande que vous avez établi.')));
      await click(named('Approuver'));
      expect(q('[role=alert]')?.textContent).toContain('que vous avez établi');
    });
  });

  describe('approuvé', () => {
    const approved = (over = {}) => order({ status: 'APPROVED', approvedBy: colleague, approvedAt: '2026-10-28T09:00:00Z', ...over });

    it('renvoie vers la réception contre ce bon, et peut encore être annulé', async () => {
      await setup(approved());
      expect(named('Réceptionner une livraison')?.getAttribute('href')).toBe('/pharmacy/receipts/new?order=o-1');
      expect(named('Annuler le bon')).toBeDefined();
      expect(named('Clore le bon')).toBeUndefined();
    });

    it('ne propose pas de réception sans le droit de recevoir', async () => {
      await setup(approved(), [...READ, 'pharmacy.procurement:manage']);
      expect(named('Réceptionner une livraison')).toBeUndefined();
    });

    it('partiellement reçu : se clôt (motif obligatoire) mais ne s\'annule plus', async () => {
      await setup(approved({ status: 'PARTIALLY_RECEIVED', receivedUnits: 200, lines: [{ ...order().lines[0], received: 200, outstanding: 300 }] }));
      expect(named('Annuler le bon')).toBeUndefined();
      expect(named('Réceptionner une livraison')).toBeDefined();
      expect(spaced(q('tr[data-test="PARA500"]'))).toMatch(/500\s+200\s+300/);
      await click(named('Clore le bon'));
      expect(q('aside')?.textContent).toContain('Ce qui est déjà arrivé reste en stock');
      await submit('order-close');
      expect(pharmacy.closeOrder).not.toHaveBeenCalled();
      type('#order-close-reason', ' Solde non livré ');
      await submit('order-close');
      expect(pharmacy.closeOrder).toHaveBeenCalledWith('o-1', 'Solde non livré');
      expect(toasts()).toEqual(['Bon PO-0000001 clos.']);
    });

    it('un bon reçu ne propose plus aucune action', async () => {
      await setup(approved({ status: 'RECEIVED', receivedUnits: 500 }));
      for (const label of ['Réceptionner une livraison', 'Annuler le bon', 'Clore le bon']) expect(named(label)).toBeUndefined();
    });
  });

  it('signale un bon introuvable', async () => {
    await setup(order(), ALL, pharmacist.id, (g) => g.getOrder.mockRejectedValue(new ApiError(404, 'PHARMACY_ORDER_NOT_FOUND', 'Bon de commande introuvable.')));
    expect(q('[role=alert]')?.textContent).toContain('introuvable');
    expect(q('h1')).toBeNull();
  });
});

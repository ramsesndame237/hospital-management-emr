import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApprovalGateway } from '../../../core/billing/approval.gateway';
import { FakeApprovalGateway, approval, approvalPage, requester, supervisor } from '../../../core/billing/testing/fake-approval-gateway';
import { ApiError } from '../../../core/http/api-error';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ApprovalsPage } from './approvals.page';

const SUPERVISOR = ['billing.approvals:read:all', 'billing.approvals:decide'];
const CASHIER = ['billing.approvals:read:own', 'billing.approvals:request'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('ApprovalsPage', () => {
  let fixture: ComponentFixture<ApprovalsPage>;
  let gateway: FakeApprovalGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(permissions: readonly string[], userId: string, prepare?: (g: FakeApprovalGateway) => void) {
    gateway = new FakeApprovalGateway();
    prepare?.(gateway);
    const { i18n } = configureApp({ roles: ['ACCOUNTANT'], permissions, profile: { id: userId }, providers: [{ provide: ApprovalGateway, useValue: gateway }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ApprovalsPage);
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

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('responsable', () => {
    it('ouvre sur les demandes en attente, avec la facture, le patient, le motif et le demandeur', async () => {
      await setup(SUPERVISOR, supervisor.id);
      expect(gateway.list).toHaveBeenCalledWith({ status: 'PENDING' }, 0, 25);
      expect(q<HTMLSelectElement>('#approvals-filter-status')?.value).toBe('PENDING');
      expect(text()).toContain('FAC-0000123');
      expect(text()).toContain('Mbarga Élisabeth');
      expect(text()).toContain('Remise de 2 000 FCFA sur 11 500 FCFA');
      expect(text()).toContain('Motif : Patient indigent');
      expect(text()).toContain('Annulation de la facture (3 000 FCFA)');
      expect(text()).toContain('caissier');
      expect(text()).toContain('En attente');
    });

    it('accepte une demande avec un commentaire facultatif, puis recharge la liste', async () => {
      await setup(SUPERVISOR, supervisor.id);
      await click(buttonNamed('Accepter la demande sur FAC-0000123'));
      expect(q('aside h2')?.textContent).toContain('Accepter la demande');
      expect(text()).toContain('Vous autorisez cette opération');
      await type('#approval-decision-comment', '  Justificatif vu ');
      await submit('approval-decision');
      expect(gateway.approve).toHaveBeenCalledWith('ap-1', 'Justificatif vu');
      expect(gateway.list).toHaveBeenCalledTimes(2);
      expect(q('aside')).toBeNull();
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Demande acceptée.');
    });

    it('accepte sans commentaire', async () => {
      await setup(SUPERVISOR, supervisor.id);
      await click(buttonNamed('Accepter la demande sur FAC-0000123'));
      await submit('approval-decision');
      expect(gateway.approve).toHaveBeenCalledWith('ap-1', null);
    });

    it('exige une explication pour refuser, sans rien envoyer tant qu\'elle manque', async () => {
      await setup(SUPERVISOR, supervisor.id);
      await click(buttonNamed('Refuser la demande sur FAC-0000122'));
      expect(q('aside h2')?.textContent).toContain('Refuser la demande');
      await submit('approval-decision');
      expect(text()).toContain('Le motif est obligatoire.');
      expect(gateway.reject).not.toHaveBeenCalled();
      await type('#approval-decision-comment', ' Hors barème ');
      await submit('approval-decision');
      expect(gateway.reject).toHaveBeenCalledWith('ap-2', 'Hors barème');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Demande refusée.');
    });

    it('annule sans rien envoyer', async () => {
      await setup(SUPERVISOR, supervisor.id);
      await click(buttonNamed('Accepter la demande sur FAC-0000123'));
      await click(buttonNamed('Laisser en attente'));
      expect(q('aside')).toBeNull();
      expect(gateway.approve).not.toHaveBeenCalled();
    });

    it('affiche le refus du serveur dans le panneau (demande périmée)', async () => {
      await setup(SUPERVISOR, supervisor.id, (g) => g.approve.mockRejectedValue(new ApiError(409, 'BILLING_APPROVAL_STALE', 'La facture a changé depuis cette demande : elle ne peut plus être acceptée.')));
      await click(buttonNamed('Accepter la demande sur FAC-0000123'));
      await submit('approval-decision');
      expect(q('aside [role=alert]')?.textContent).toContain('ne peut plus être acceptée');
      expect(q('aside')).not.toBeNull();
    });

    it('désactive « Accepter » pour une demande périmée et l\'explique, mais permet de la refuser', async () => {
      await setup(SUPERVISOR, supervisor.id, (g) => g.list.mockResolvedValue(approvalPage([approval({ outdated: true })])));
      expect(buttonNamed('Accepter la demande sur FAC-0000123').disabled).toBe(true);
      expect(buttonNamed('Refuser la demande sur FAC-0000123').disabled).toBe(false);
      expect(text()).toContain('La facture a changé depuis cette demande');
    });

    it('ne laisse pas décider sa propre demande', async () => {
      await setup(SUPERVISOR, requester.id);
      expect(buttonNamed('Accepter la demande sur FAC-0000123')).toBeUndefined();
      expect(buttonNamed('Refuser la demande sur FAC-0000123')).toBeUndefined();
    });

    it('filtre par statut et par type, et revient à la première page', async () => {
      await setup(SUPERVISOR, supervisor.id);
      const status = q<HTMLSelectElement>('#approvals-filter-status')!;
      status.value = '';
      status.dispatchEvent(new Event('change'));
      const kind = q<HTMLSelectElement>('#approvals-filter-kind')!;
      kind.value = 'CANCEL';
      kind.dispatchEvent(new Event('change'));
      await submit('approvals-filter');
      expect(gateway.list).toHaveBeenLastCalledWith({ kind: 'CANCEL' }, 0, 25);
    });

    it('montre la décision déjà prise : qui, quand, son commentaire', async () => {
      await setup(SUPERVISOR, supervisor.id, (g) => g.list.mockResolvedValue(approvalPage([
        approval({ status: 'REJECTED', decidedBy: supervisor, decidedAt: '2026-10-24T09:40:00Z', decisionComment: 'Hors barème' }),
      ])));
      expect(text()).toContain('Refusée');
      expect(text()).toContain('comptable, le');
      expect(text()).toContain('Hors barème');
      expect(buttonNamed('Accepter la demande sur FAC-0000123')).toBeUndefined();
    });

    it('pagine au-delà de 25 demandes', async () => {
      await setup(SUPERVISOR, supervisor.id, (g) => g.list.mockResolvedValue(approvalPage([approval()], { total: 60 })));
      expect(q('nav')?.textContent).toContain('1 à 25 sur 60');
      await click(buttonNamed('Suivant'));
      expect(gateway.list).toHaveBeenLastCalledWith({ status: 'PENDING' }, 25, 25);
    });

    it('signale une liste vide', async () => {
      await setup(SUPERVISOR, supervisor.id, (g) => g.list.mockResolvedValue(approvalPage([])));
      expect(text()).toContain('Aucune demande.');
    });

    it('signale une erreur de chargement', async () => {
      await setup(SUPERVISOR, supervisor.id, (g) => g.list.mockRejectedValue(new ApiError(500, 'HTTP_500', 'Une erreur interne est survenue.')));
      expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
    });
  });

  describe('caissier', () => {
    it('voit toutes ses demandes (pas de filtre par défaut) et peut retirer celle qui attend', async () => {
      await setup(CASHIER, requester.id);
      expect(gateway.list).toHaveBeenCalledWith({}, 0, 25);
      expect(q<HTMLSelectElement>('#approvals-filter-status')?.value).toBe('');
      expect(buttonNamed('Accepter la demande sur FAC-0000123')).toBeUndefined();
      await click(buttonNamed('Retirer la demande sur FAC-0000123'));
      expect(gateway.withdraw).toHaveBeenCalledWith('ap-1');
      expect(gateway.list).toHaveBeenCalledTimes(2);
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Demande retirée.');
    });

    it('ne peut pas retirer la demande d\'un autre', async () => {
      await setup(CASHIER, 'u-other');
      expect(buttonNamed('Retirer la demande sur FAC-0000123')).toBeUndefined();
    });

    it('affiche le refus du serveur quand le retrait échoue', async () => {
      await setup(CASHIER, requester.id, (g) => g.withdraw.mockRejectedValue(new ApiError(409, 'BILLING_APPROVAL_NOT_PENDING', 'Cette demande a déjà été traitée.')));
      await click(buttonNamed('Retirer la demande sur FAC-0000123'));
      expect(q('[role=alert]')?.textContent).toContain('déjà été traitée');
    });
  });
});

import { DOCUMENT } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashSessionGateway } from '../../../core/billing/cash-session.gateway';
import { FakeCashSessionGateway, closed, session } from '../../../core/billing/testing/fake-cash-session-gateway';
import { ApiError } from '../../../core/http/api-error';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { SessionDetailPage } from './session-detail.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('SessionDetailPage', () => {
  let fixture: ComponentFixture<SessionDetailPage>;
  let cash: FakeCashSessionGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.textContent ?? '').trim() === label)!;
  const waiting = () => closed({ '10000': 1 }, 'Argent manquant, à vérifier');

  async function setup(permissions: readonly string[], loaded = waiting(), prepare?: (g: FakeCashSessionGateway) => void) {
    cash = new FakeCashSessionGateway();
    cash.get.mockResolvedValue(loaded);
    prepare?.(cash);
    const { i18n } = configureApp({ roles: ['ACCOUNTANT'], permissions, providers: [{ provide: CashSessionGateway, useValue: cash }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(SessionDetailPage);
    fixture.componentRef.setInput('id', 's-1');
    await settle(fixture);
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  const REVIEWER = ['billing.sessions:read:all', 'billing.sessions:cosign'];

  it('affiche le rapport complet d\'une clôture en attente : attendu, compté, écart, explication', async () => {
    await setup(REVIEWER);
    expect(cash.get).toHaveBeenCalledWith('s-1');
    expect(q('h1')?.textContent).toContain('Session de caisse');
    expect(text()).toContain('CAI-0000007');
    expect(text()).toContain('À valider');
    expect(text()).toContain('Espèces attendues 32 000 FCFA');
    expect(text()).toContain('Espèces comptées 10 000 FCFA');
    expect(text()).toContain('Écart − 22 000 FCFA');
    expect(text()).toContain('Explication : Argent manquant, à vérifier');
    expect(text()).toContain('En attente de la contre-signature d’un responsable');
    expect(q('.print-area')).not.toBeNull();
  });

  it('propose la contre-signature au responsable, et la valide avec un commentaire', async () => {
    await setup(REVIEWER);
    await click(buttonNamed('Contre-signer'));
    expect(q('aside h2')?.textContent).toContain('Contre-signer la clôture');
    expect(text()).toContain('vous ne pouvez pas valider votre propre caisse');
    const input = q<HTMLInputElement>('#cosign-session-comment')!;
    input.value = '  Écart vérifié avec le caissier ';
    input.dispatchEvent(new Event('input'));
    q<HTMLFormElement>('#cosign-session')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(cash.cosign).toHaveBeenCalledWith('s-1', 'Écart vérifié avec le caissier');
    expect(text()).toContain('Clôturée');
    expect(text()).toContain('Contre-signée par comptable');
    expect(text()).toContain('Écart vérifié avec le caissier');
    expect(q('aside')).toBeNull();
    expect(buttonNamed('Contre-signer')).toBeUndefined();
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Session CAI-0000007 contre-signée.');
  });

  it('accepte une contre-signature sans commentaire', async () => {
    await setup(REVIEWER);
    await click(buttonNamed('Contre-signer'));
    q<HTMLFormElement>('#cosign-session')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(cash.cosign).toHaveBeenCalledWith('s-1', null);
  });

  it('annule sans rien envoyer', async () => {
    await setup(REVIEWER);
    await click(buttonNamed('Contre-signer'));
    await click(buttonNamed('Annuler'));
    expect(q('aside')).toBeNull();
    expect(cash.cosign).not.toHaveBeenCalled();
  });

  it('affiche le refus du serveur (sa propre caisse) dans le panneau', async () => {
    await setup(REVIEWER, waiting(), (g) => g.cosign.mockRejectedValue(new ApiError(409, 'BILLING_COSIGN_SELF', 'Vous ne pouvez pas contre-signer votre propre caisse.')));
    await click(buttonNamed('Contre-signer'));
    q<HTMLFormElement>('#cosign-session')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(q('aside [role=alert]')?.textContent).toContain('propre caisse');
  });

  it('ne propose pas de contre-signer sans le droit (lecture seule, administrateur système)', async () => {
    await setup(['billing.sessions:read:all']);
    expect(buttonNamed('Contre-signer')).toBeUndefined();
    expect(text()).toContain('À valider');
  });

  it.each([
    ['ouverte', () => session()],
    ['déjà close', () => closed({ '10000': 3, '2000': 1 })],
  ])('ne propose pas de contre-signer une session %s', async (_name, make) => {
    await setup(REVIEWER, make());
    expect(buttonNamed('Contre-signer')).toBeUndefined();
  });

  it("n'affiche pas de rapprochement tant que la caisse n'est pas clôturée", async () => {
    await setup(REVIEWER, session());
    expect(text()).not.toContain('Rapprochement des espèces');
  });

  it('imprime la fiche de passation', async () => {
    await setup(REVIEWER);
    const print = vi.spyOn(TestBed.inject(DOCUMENT).defaultView!, 'print').mockImplementation(() => undefined);
    await click(buttonNamed('Imprimer la fiche de passation'));
    expect(print).toHaveBeenCalledOnce();
  });

  it('signale une session introuvable', async () => {
    await setup(REVIEWER, waiting(), (g) => g.get.mockRejectedValue(new ApiError(404, 'BILLING_SESSION_NOT_FOUND', 'Session de caisse introuvable.')));
    expect(q('[role=alert]')?.textContent).toContain('Session de caisse introuvable.');
    expect(q('.print-area')).toBeNull();
  });
});

import { DOCUMENT } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashSessionGateway } from '../../../core/billing/cash-session.gateway';
import { DENOMINATIONS, FakeCashSessionGateway, closed, session } from '../../../core/billing/testing/fake-cash-session-gateway';
import { ApiError } from '../../../core/http/api-error';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { MyCashPage } from './my-cash.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Le texte d'un bloc, avec une espace entre chaque élément (comme à l'écran). */
function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('MyCashPage (Ma caisse)', () => {
  let fixture: ComponentFixture<MyCashPage>;
  let cash: FakeCashSessionGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(prepare?: (g: FakeCashSessionGateway) => void) {
    cash = new FakeCashSessionGateway();
    prepare?.(cash);
    const { i18n } = configureApp({ roles: ['CASHIER'], permissions: ['billing.sessions:operate', 'billing.sessions:read:own'], providers: [{ provide: CashSessionGateway, useValue: cash }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(MyCashPage);
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('sans caisse ouverte', () => {
    const noSession = (g: FakeCashSessionGateway) => g.current.mockResolvedValue(null);

    it('propose d\'ouvrir la caisse avec une grille de comptage : une case par billet et pièce', async () => {
      await setup(noSession);
      expect(text()).toContain('Sans caisse ouverte, aucun encaissement n’est possible.');
      const labels = [...root().querySelectorAll('#open-session label')].map((l) => norm(l.textContent ?? ''));
      expect(labels).toContain('Poste de caisse *');
      for (const value of DENOMINATIONS.denominations) expect(q(`#open-session-d_${value}`)).not.toBeNull();
      expect(norm(q('label[for="open-session-d_10000"]')?.textContent ?? '')).toContain('10 000 FCFA');
      expect(norm(q('label[for="open-session-d_1"]')?.textContent ?? '')).toContain('1 FCFA');
    });

    it('calcule le fonds de caisse en direct à partir des quantités', async () => {
      await setup(noSession);
      expect(text()).toContain('Fonds de caisse : 0 FCFA');
      await type('#open-session-d_5000', '2');
      await type('#open-session-d_1000', '10');
      await type('#open-session-d_100', '3');
      expect(text()).toContain('Fonds de caisse : 20 300 FCFA');
    });

    it('ouvre la caisse avec le poste et le comptage (sans les valeurs à zéro)', async () => {
      await setup(noSession);
      await type('#open-session-counter', '  Caisse OPD 1 ');
      await type('#open-session-d_5000', '2');
      await type('#open-session-d_1000', '10');
      await submit('open-session');
      expect(cash.open).toHaveBeenCalledWith({ counter: 'Caisse OPD 1', openingCount: { '5000': 2, '1000': 10 } });
      expect(text()).toContain('CAI-0000007');
      expect(text()).toContain('Caisse OPD 1');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Caisse CAI-0000007 ouverte.');
    });

    it('exige un poste de caisse et refuse une quantité négative ou décimale', async () => {
      await setup(noSession);
      await submit('open-session');
      expect(text()).toContain('Saisissez le poste de caisse.');
      await type('#open-session-counter', 'Caisse');
      await type('#open-session-d_500', '-1');
      await submit('open-session');
      expect(text()).toContain('Saisissez une quantité entière positive.');
      await type('#open-session-d_500', '1.5');
      await submit('open-session');
      expect(cash.open).not.toHaveBeenCalled();
    });

    it('explique le refus du serveur (poste déjà tenu) et garde la saisie', async () => {
      await setup((g) => {
        noSession(g);
        g.open.mockRejectedValue(new ApiError(409, 'BILLING_COUNTER_IN_USE', 'Ce poste de caisse est déjà tenu par une session ouverte.'));
      });
      await type('#open-session-counter', 'Caisse 1');
      await submit('open-session');
      expect(q('[role=alert]')?.textContent).toContain('déjà tenu');
      expect(q<HTMLInputElement>('#open-session-counter')?.value).toBe('Caisse 1');
    });
  });

  describe('caisse ouverte', () => {
    it('affiche le rapport de la session : fonds, encaissé, attendu, par mode, encaissements', async () => {
      await setup();
      expect(text()).toContain('CAI-0000007');
      expect(text()).toContain('Ouverte');
      expect(text()).toContain('Caisse OPD 1');
      expect(text()).toContain('Fonds de caisse 20 000 FCFA');
      expect(text()).toContain('Encaissé 42 000 FCFA');
      expect(text()).toContain('Espèces attendues 32 000 FCFA');
      expect(text()).toContain('Espèces 12 000 FCFA');
      expect(text()).toContain('Carte bancaire 30 000 FCFA');
      expect(text()).toContain('REC-0000001');
      expect(text()).toContain('FAC-0000124');
      expect(q('#open-session')).toBeNull(); // pas de seconde ouverture
    });

    it('ouvre la clôture avec la grille de comptage', async () => {
      await setup();
      await click(buttonNamed('Clôturer la caisse'));
      expect(q('aside h2')?.textContent).toContain('Clôturer la caisse');
      expect(q('#close-session-d_10000')).not.toBeNull();
      expect(q('#close-session-reason')).not.toBeNull();
    });

    it('annonce en direct que la caisse est juste, ou ce qu\'il manque ou ce qu\'il y a en trop', async () => {
      await setup();
      await click(buttonNamed('Clôturer la caisse'));
      await type('#close-session-d_10000', '3');
      await type('#close-session-d_2000', '1');
      expect(text()).toContain('Comptées : 32 000 FCFA · attendues : 32 000 FCFA');
      expect(text()).toContain('La caisse est juste.');
      await type('#close-session-d_2000', '0');
      expect(text()).toContain('Il manque 2 000 FCFA.');
      await type('#close-session-d_2000', '2');
      expect(text()).toContain('Il y a 2 000 FCFA de trop.');
    });

    it('prévient qu\'une contre-signature sera nécessaire au-delà de la limite d\'écart', async () => {
      await setup();
      await click(buttonNamed('Clôturer la caisse'));
      await type('#close-session-d_10000', '2');
      expect(text()).toContain('L’écart dépasse 5 000 FCFA : un responsable devra contre-signer la clôture.');
      await type('#close-session-d_10000', '3');
      await type('#close-session-d_2000', '1');
      expect(text()).not.toContain('un responsable devra contre-signer');
    });

    it('clôt une caisse juste sans explication et affiche la fiche de passation', async () => {
      await setup();
      await click(buttonNamed('Clôturer la caisse'));
      await type('#close-session-d_10000', '3');
      await type('#close-session-d_2000', '1');
      await submit('close-session');
      expect(cash.close).toHaveBeenCalledWith('s-1', { count: { '10000': 3, '2000': 1 } });
      expect(text()).toContain('Caisse clôturée');
      expect(text()).toContain('Clôturée');
      expect(textOf(q('.print-area'))).toContain('Rapprochement des espèces');
      expect(textOf(q('.print-area'))).toContain('Espèces comptées 32 000 FCFA');
      expect(textOf(q('.print-area'))).toContain('Écart 0 FCFA');
      expect(buttonNamed('Clôturer la caisse')).toBeUndefined();
      expect(q('#open-session')).not.toBeNull(); // on peut en ouvrir une autre
    });

    it('exige une explication quand la caisse n\'est pas juste, avant tout appel', async () => {
      await setup();
      await click(buttonNamed('Clôturer la caisse'));
      await type('#close-session-d_10000', '3');
      await submit('close-session');
      expect(q('aside [role=alert]')?.textContent).toContain('La caisse n’est pas juste : expliquez l’écart.');
      expect(cash.close).not.toHaveBeenCalled();
      await type('#close-session-reason', '  Erreur de monnaie rendue ');
      await submit('close-session');
      expect(cash.close).toHaveBeenCalledWith('s-1', { count: { '10000': 3 }, reason: 'Erreur de monnaie rendue' });
      expect(textOf(q('.print-area'))).toContain('Écart − 2 000 FCFA');
      expect(textOf(q('.print-area'))).toContain('Explication : Erreur de monnaie rendue');
    });

    it('dit qu\'une clôture à écart élevé attend la contre-signature d\'un responsable', async () => {
      await setup();
      await click(buttonNamed('Clôturer la caisse'));
      await type('#close-session-d_10000', '1');
      await type('#close-session-reason', 'Argent manquant');
      await submit('close-session');
      expect(text()).toContain('Clôture en attente de contre-signature');
      expect(text()).toContain('À valider');
      expect(textOf(q('.print-area'))).toContain('En attente de la contre-signature d’un responsable (écart au-delà de 5 000 FCFA).');
    });

    it('imprime la fiche de passation', async () => {
      await setup();
      const print = vi.spyOn(TestBed.inject(DOCUMENT).defaultView!, 'print').mockImplementation(() => undefined);
      await click(buttonNamed('Clôturer la caisse'));
      await type('#close-session-d_10000', '3');
      await type('#close-session-d_2000', '1');
      await submit('close-session');
      await click(buttonNamed('Imprimer la fiche de passation'));
      expect(print).toHaveBeenCalledOnce();
    });

    it('annule la clôture sans rien envoyer', async () => {
      await setup();
      await click(buttonNamed('Clôturer la caisse'));
      await click(buttonNamed('Annuler'));
      expect(q('aside')).toBeNull();
      expect(cash.close).not.toHaveBeenCalled();
    });

    it('affiche le refus du serveur à la clôture', async () => {
      await setup((g) => g.close.mockRejectedValue(new ApiError(409, 'BILLING_SESSION_NOT_OPEN', 'Cette session de caisse est déjà clôturée.')));
      await click(buttonNamed('Clôturer la caisse'));
      await type('#close-session-d_10000', '3');
      await type('#close-session-d_2000', '1');
      await submit('close-session');
      expect(q('aside [role=alert]')?.textContent).toContain('déjà clôturée');
      expect(q('aside')).not.toBeNull();
    });
  });

  it('signale une lecture impossible sans détail technique', async () => {
    await setup((g) => g.denominations.mockRejectedValue(new ApiError(503, 'UNKNOWN', 'SELECT 1 failed')));
    expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
    expect(text()).not.toContain('SELECT');
  });

  it('une caisse déjà clôturée avec écart se présente avec son écart signé', async () => {
    const done = closed({ '10000': 3 }, 'Billet manquant');
    expect(done.variance).toBe(-2000);
    expect(session().expectedCash).toBe(32000);
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { FakeLabGateway, orderedTest, requisition, result, specimen, technician, version } from '../../../core/lab/testing/fake-lab-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { RequisitionDetailPage } from './requisition-detail.page';

const BENCH = [
  'lab.requisitions:read:all', 'lab.specimens:collect', 'lab.specimens:receive', 'lab.specimens:reject', 'lab.requisitions:cancel',
  'lab.results:enter', 'lab.results:verify', 'lab.results:release', 'lab.results:amend', 'lab.results:notify',
];
const PRESCRIBER = ['lab.requisitions:read:own', 'lab.requisitions:cancel'];
const OTHER = { id: 'u-lab2', username: 'labo2' };
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

/** Demande dont l'échantillon est reçu, avec le résultat donné (ou aucun). */
const withResult = (res: ReturnType<typeof result> | null, test: Partial<ReturnType<typeof orderedTest>> = {}, status: Parameters<typeof requisition>[0] = {}) =>
  requisition({ status: res ? 'RESULTED' : 'RECEIVED', specimens: [specimen({ status: 'RECEIVED', collectedBy: technician, collectedAt: '2026-10-24T08:30:00Z', receivedBy: technician, receivedAt: '2026-10-24T09:00:00Z' })], tests: [orderedTest({ result: res, ...test })], ...status });

describe('RequisitionDetailPage : résultats', () => {
  let fixture: ComponentFixture<RequisitionDetailPage>;
  let lab: FakeLabGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const row = () => textOf(q('tr[data-test="HGB"]'));
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(loaded: ReturnType<typeof requisition>, options: { permissions?: readonly string[]; userId?: string; prepare?: (g: FakeLabGateway) => void } = {}) {
    lab = new FakeLabGateway();
    lab.getRequisition.mockResolvedValue(loaded);
    options.prepare?.(lab);
    const { i18n } = configureApp({
      roles: ['LAB_TECHNICIAN'], permissions: options.permissions ?? BENCH, profile: { id: options.userId ?? OTHER.id }, providers: [{ provide: LabGateway, useValue: lab }],
    });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(RequisitionDetailPage);
    fixture.componentRef.setInput('id', 'r-1');
    await settle(fixture);
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('saisie', () => {
    it('masque la section tant qu\'aucun échantillon n\'est arrivé', async () => {
      await setup(requisition());
      expect(q('#results-title')).toBeNull();
    });

    it('propose de saisir dès que l\'échantillon est reçu', async () => {
      await setup(withResult(null));
      expect(q('#results-title')?.textContent).toContain('Résultats');
      expect(row()).toContain('Pas encore de résultat.');
      expect(buttonNamed('Saisir Hémoglobine')).toBeDefined();
    });

    it('dit que l\'échantillon n\'est pas encore reçu pour une analyse sur un autre tube', async () => {
      await setup(requisition({
        status: 'COLLECTED',
        specimens: [specimen({ status: 'RECEIVED' }), specimen({ id: 's-2', barcode: 'SPC-0000002', status: 'COLLECTED' })],
        tests: [orderedTest(), orderedTest({ testId: 't-2', code: 'GLU', name: 'Glycémie', specimenId: 's-2' })],
      }));
      expect(textOf(q('tr[data-test="GLU"]'))).toContain('En attente de la réception de l’échantillon.');
      expect(buttonNamed('Saisir Glycémie')).toBeUndefined();
    });

    it('saisit un nombre (virgule acceptée), l\'envoie tel quel et affiche la valeur du serveur', async () => {
      await setup(withResult(null));
      await click(buttonNamed('Saisir Hémoglobine'));
      expect(q('aside h2')?.textContent).toContain('Saisir : Hémoglobine');
      await type('#requisition-result-t-1-enter-value', ' 9,4 ');
      await type('#requisition-result-t-1-enter-comment', ' Second passage ');
      await submit('requisition-result-t-1-enter');
      expect(lab.enterResult).toHaveBeenCalledWith('r-1', 't-1', '9,4', 'Second passage');
      expect(q('aside')).toBeNull();
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Résultat de Hémoglobine enregistré.');
      expect(row()).toContain('9,4');
      expect(row()).toContain('À valider');
    });

    it('refuse une valeur non numérique ou vide sans rien envoyer', async () => {
      await setup(withResult(null));
      await click(buttonNamed('Saisir Hémoglobine'));
      await submit('requisition-result-t-1-enter');
      expect(text()).toContain('Saisissez le résultat.');
      await type('#requisition-result-t-1-enter-value', 'abc');
      await submit('requisition-result-t-1-enter');
      expect(text()).toContain('Saisissez un nombre (virgule ou point).');
      expect(lab.enterResult).not.toHaveBeenCalled();
    });

    it('une analyse à choix propose ses valeurs admises', async () => {
      await setup(withResult(null, { resultType: 'CHOICE', unit: null, choices: ['Positif', 'Négatif'] }));
      await click(buttonNamed('Saisir Hémoglobine'));
      const options = [...root().querySelectorAll<HTMLOptionElement>('#requisition-result-t-1-enter-value option')].map((o) => o.textContent?.trim());
      expect(options).toEqual(expect.arrayContaining(['Positif', 'Négatif']));
      const select = q<HTMLSelectElement>('#requisition-result-t-1-enter-value')!;
      select.value = 'Négatif';
      select.dispatchEvent(new Event('change'));
      await submit('requisition-result-t-1-enter');
      expect(lab.enterResult).toHaveBeenCalledWith('r-1', 't-1', 'Négatif', null);
    });

    it('affiche le refus du serveur dans le panneau, en gardant la saisie', async () => {
      await setup(withResult(null), { prepare: (g) => g.enterResult.mockRejectedValue(new ApiError(422, 'LAB_RESULT_VALUE_INVALID', 'Valeur invalide : saisissez un nombre.')) });
      await click(buttonNamed('Saisir Hémoglobine'));
      await type('#requisition-result-t-1-enter-value', '9');
      await submit('requisition-result-t-1-enter');
      expect(q('aside [role=alert]')?.textContent).toContain('Valeur invalide');
      expect(q<HTMLInputElement>('#requisition-result-t-1-enter-value')?.value).toBe('9');
    });

    it('corrige une saisie avant validation, en reprenant la valeur', async () => {
      await setup(withResult(result()));
      await click(buttonNamed('Corriger Hémoglobine'));
      expect(q('aside h2')?.textContent).toContain('Corriger : Hémoglobine');
      expect(q<HTMLInputElement>('#requisition-result-t-1-enter-value')?.value).toBe('13.5');
    });
  });

  describe('affichage', () => {
    it('montre la valeur, l\'unité, la position, les valeurs de référence et le précédent résultat', async () => {
      await setup(withResult(result({ versions: [version({ value: '9.4', flag: 'LOW', previousValue: 11.2 })] })));
      expect(row()).toContain('9.4 g/dL');
      expect(row()).toContain('Bas');
      expect(row()).toContain('Réf. 11.5 – 15.5 g/dL · critique < 7 ou > 20');
      expect(row()).toContain('Précédent : 11.2');
    });

    it('signale une valeur critique et une variation importante', async () => {
      await setup(withResult(result({ criticalRequired: true, versions: [version({ value: '5.1', flag: 'CRITICAL_LOW', previousValue: 12.8, deltaAlert: true })] })));
      expect(row()).toContain('Critique bas');
      expect(row()).toContain('Variation importante (précédent : 12.8)');
    });

    it('affiche le motif d\'un renvoi et propose de ressaisir', async () => {
      await setup(withResult(result({ status: 'RETURNED', returnReason: 'Valeur incohérente' })));
      expect(row()).toContain('Renvoyé : Valeur incohérente');
      expect(buttonNamed('Ressaisir Hémoglobine')).toBeDefined();
    });

    it('montre l\'historique des versions et des appels au laboratoire seulement', async () => {
      const critical = withResult(result({
        status: 'VERIFIED', criticalRequired: true, criticalNotified: true, currentVersion: 2, versions: [version({ value: '5.1', flag: 'CRITICAL_LOW' }), version({ version: 2, value: '5.4', flag: 'CRITICAL_LOW', amendmentReason: 'Correction' })],
        notifications: [{ version: 2, notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', at: '2026-10-24T10:12:00Z', by: technician }],
      }));
      await setup(critical);
      await click(buttonNamed('Historique de Hémoglobine'));
      expect(text()).toContain('Version 1 : 5.1 g/dL');
      expect(text()).toContain('Version 2 : 5.4 g/dL');
      expect(text()).toContain('Amendement : Correction');
      expect(text()).toContain('Appel : Dr Curie (Médecin de garde), téléphone');
      await click(buttonNamed('Historique de Hémoglobine'));
      expect(text()).not.toContain('Version 1 :');
    });
  });

  describe('validation et publication', () => {
    it('quatre yeux : l\'auteur ne valide pas son résultat et voit pourquoi', async () => {
      await setup(withResult(result()), { userId: technician.id });
      expect(buttonNamed('Valider Hémoglobine')).toBeUndefined();
      expect(row()).toContain('À valider par un autre technicien que labo.');
    });

    it('un autre technicien valide le résultat', async () => {
      await setup(withResult(result()), { userId: OTHER.id });
      await click(buttonNamed('Valider Hémoglobine'));
      expect(lab.verifyResult).toHaveBeenCalledWith('r-1', 't-1');
      expect(row()).toContain('Validé');
      expect(row()).toContain('Validé par labo2');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Résultat de Hémoglobine validé.');
    });

    const verified = () => withResult(result({ status: 'VERIFIED', verifiedBy: OTHER, verifiedAt: '2026-10-24T10:10:00Z' }));

    it('la publication n\'est pas offerte à l\'auteur de la saisie', async () => {
      await setup(verified(), { userId: technician.id });
      expect(buttonNamed('Publier Hémoglobine')).toBeUndefined();
      expect(row()).toContain('À publier par un autre technicien que labo.');
    });

    it('un autre technicien publie un résultat validé', async () => {
      await setup(verified(), { userId: OTHER.id });
      await click(buttonNamed('Publier Hémoglobine'));
      expect(lab.releaseResult).toHaveBeenCalledWith('r-1', 't-1');
      expect(row()).toContain('Publié');
      expect(row()).toContain('par labo2');
      expect(q('h1')?.textContent).toContain('Résultats publiés');
    });

    it('affiche le refus du serveur en haut de page (valider son propre résultat)', async () => {
      await setup(withResult(result()), { prepare: (g) => g.verifyResult.mockRejectedValue(new ApiError(409, 'LAB_VERIFY_SELF', 'Vous ne pouvez pas valider un résultat que vous avez saisi.')) });
      await click(buttonNamed('Valider Hémoglobine'));
      expect(q('[role=alert]')?.textContent).toContain('que vous avez saisi');
    });

    it('renvoie un résultat avec un motif obligatoire', async () => {
      await setup(withResult(result()));
      await click(buttonNamed('Renvoyer Hémoglobine'));
      await submit('requisition-return-t-1');
      expect(text()).toContain('Le motif est obligatoire.');
      expect(lab.returnResult).not.toHaveBeenCalled();
      await type('#requisition-return-t-1-reason', ' Incohérent avec le précédent ');
      await submit('requisition-return-t-1');
      expect(lab.returnResult).toHaveBeenCalledWith('r-1', 't-1', 'Incohérent avec le précédent');
      expect(row()).toContain('Renvoyé : Incohérent avec le précédent');
    });
  });

  describe('valeur critique', () => {
    const critical = (over: Parameters<typeof result>[0] = {}) => withResult(result({ status: 'VERIFIED', criticalRequired: true, versions: [version({ value: '5.1', flag: 'CRITICAL_LOW' })], verifiedBy: OTHER, ...over }));

    it('bloque la publication tant que l\'appel du clinicien n\'est pas documenté', async () => {
      await setup(critical());
      expect(buttonNamed('Publier Hémoglobine').disabled).toBe(true);
      expect(row()).toContain('Publication bloquée : appel du clinicien à documenter.');
      expect(buttonNamed('Appel du clinicien pour Hémoglobine')).toBeDefined();
    });

    it('documente l\'appel (personne, fonction, moyen, relecture confirmée) puis débloque la publication', async () => {
      await setup(critical());
      await click(buttonNamed('Appel du clinicien pour Hémoglobine'));
      expect(text()).toContain('Appelez le clinicien, faites relire la valeur à voix haute');
      await submit('requisition-notify-t-1');
      expect(text()).toContain('Ce champ est obligatoire.');
      expect(lab.notifyCritical).not.toHaveBeenCalled();
      await type('#requisition-notify-t-1-notifiedName', ' Dr Curie ');
      await type('#requisition-notify-t-1-notifiedRole', 'Médecin de garde');
      await submit('requisition-notify-t-1');
      expect(text()).toContain('Confirmez la relecture.');
      expect(lab.notifyCritical).not.toHaveBeenCalled();
      const box = q<HTMLInputElement>('#requisition-notify-t-1-readBack')!;
      box.checked = true;
      box.dispatchEvent(new Event('change'));
      box.dispatchEvent(new Event('click'));
      fixture.detectChanges();
      await submit('requisition-notify-t-1');
      expect(lab.notifyCritical).toHaveBeenCalledWith('r-1', 't-1', { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', readBackConfirmed: true });
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Appel du clinicien enregistré.');
      expect(buttonNamed('Publier Hémoglobine').disabled).toBe(false);
      expect(buttonNamed('Appel du clinicien pour Hémoglobine')).toBeUndefined();
    });
  });

  describe('amendement', () => {
    const released = () => withResult(result({ status: 'RELEASED', releasedVersion: 1, releasedBy: OTHER, releasedAt: '2026-10-24T10:20:00Z' }), {}, { status: 'RELEASED' });

    it('amende un résultat publié avec un motif obligatoire, et signale l\'amendement en cours', async () => {
      await setup(released());
      expect(buttonNamed('Corriger Hémoglobine')).toBeUndefined();
      await click(buttonNamed('Amender Hémoglobine'));
      expect(text()).toContain('Le résultat publié sera amendé');
      await type('#requisition-result-t-1-amend-value', '14');
      await submit('requisition-result-t-1-amend');
      expect(text()).toContain('Le motif est obligatoire.');
      expect(lab.amendResult).not.toHaveBeenCalled();
      await type('#requisition-result-t-1-amend-reason', ' Correction ');
      await submit('requisition-result-t-1-amend');
      expect(lab.amendResult).toHaveBeenCalledWith('r-1', 't-1', '14', 'Correction', null);
      expect(row()).toContain('Amendement en cours');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Résultat de Hémoglobine amendé : à valider puis publier.');
    });

    it('ne propose pas d\'amender un résultat non publié', async () => {
      await setup(withResult(result()));
      expect(buttonNamed('Amender Hémoglobine')).toBeUndefined();
    });
  });

  describe('droits', () => {
    it('un prescripteur ne voit que le résultat publié, sans action ni historique', async () => {
      await setup(withResult(result({ status: 'RELEASED', releasedVersion: 1, releasedBy: OTHER, releasedAt: '2026-10-24T10:20:00Z' }), {}, { status: 'RELEASED' }), { permissions: PRESCRIBER });
      expect(row()).toContain('13.5 g/dL');
      expect(row()).toContain('Publié');
      for (const label of ['Valider Hémoglobine', 'Publier Hémoglobine', 'Amender Hémoglobine', 'Renvoyer Hémoglobine', 'Historique de Hémoglobine']) expect(buttonNamed(label)).toBeUndefined();
    });

    it('un prescripteur lit « en cours » tant que rien n\'est publié', async () => {
      await setup(withResult(result({ status: 'IN_PROGRESS', currentVersion: null, versions: [] })), { permissions: PRESCRIBER });
      expect(row()).toContain('Résultat en cours de traitement au laboratoire.');
      expect(row()).toContain('En cours');
    });

    it('un prescripteur sait qu\'un amendement est en cours', async () => {
      await setup(withResult(result({ status: 'RELEASED', releasedVersion: 1, amendmentPending: true })), { permissions: PRESCRIBER });
      expect(row()).toContain('Amendement en cours');
    });

    it('une demande annulée n\'offre aucune action sur les résultats', async () => {
      await setup(withResult(result({ status: 'RETURNED', returnReason: 'x' }), {}, { status: 'CANCELLED' }));
      expect(q('#results-title')).toBeNull();
    });
  });
});

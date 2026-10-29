import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { FakeLabGateway, doctor, requisition, specimen, technician } from '../../../core/lab/testing/fake-lab-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { RequisitionDetailPage } from './requisition-detail.page';

const BENCH = ['lab.requisitions:read:all', 'lab.requisitions:cancel', 'lab.specimens:collect', 'lab.specimens:receive', 'lab.specimens:reject'];
const PRESCRIBER = ['lab.requisitions:read:own', 'lab.requisitions:cancel'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('RequisitionDetailPage', () => {
  let fixture: ComponentFixture<RequisitionDetailPage>;
  let lab: FakeLabGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(options: { permissions?: readonly string[]; loaded?: ReturnType<typeof requisition>; prepare?: (g: FakeLabGateway) => void; scanned?: string } = {}) {
    lab = new FakeLabGateway();
    if (options.loaded) lab.getRequisition.mockResolvedValue(options.loaded);
    options.prepare?.(lab);
    const { i18n } = configureApp({ roles: ['LAB_TECHNICIAN'], permissions: options.permissions ?? BENCH, providers: [{ provide: LabGateway, useValue: lab }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(RequisitionDetailPage);
    fixture.componentRef.setInput('id', 'r-1');
    if (options.scanned) fixture.componentRef.setInput('specimen', options.scanned);
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

  const collected = () => requisition({ status: 'COLLECTED', specimens: [specimen({ status: 'COLLECTED', collectedBy: technician, collectedAt: '2026-10-24T08:30:00Z' })] });

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('affichage', () => {
    it('montre l\'en-tête, le patient, les analyses et chaque échantillon avec son code-barres et sa traçabilité', async () => {
      await setup({ loaded: requisition({ priority: 'STAT', clinicalNotes: 'Fièvre depuis 3 jours' }) });
      expect(lab.getRequisition).toHaveBeenCalledWith('r-1');
      expect(q('h1')?.textContent).toContain('LAB-0000123');
      expect(q('h1')?.textContent).toContain('STAT');
      expect(q('h1')?.textContent).toContain('À prélever');
      expect(text()).toContain('Mbarga Élisabeth');
      expect(text()).toContain('PAT-0000001');
      expect(text()).toContain('Femme');
      expect(text()).toContain('Né(e) le 1990-03-14');
      expect(text()).toContain('Demandée le');
      expect(text()).toContain('par medecin');
      expect(text()).toContain('Fièvre depuis 3 jours');
      expect(text()).toContain('Hémoglobine');
      expect(text()).toContain('Hématologie');
      expect(textOf(q('article[aria-label="SPC-0000001"]'))).toContain('Tube violet');
      expect(textOf(q('article[aria-label="SPC-0000001"]'))).toContain('Prévu');
    });

    it('met en évidence l\'échantillon scanné', async () => {
      await setup({ scanned: 's-1' });
      expect(q('article[aria-label="SPC-0000001"]')?.classList).toContain('ring-2');
    });

    it('signale une demande introuvable', async () => {
      await setup({ prepare: (g) => g.getRequisition.mockRejectedValue(new ApiError(404, 'LAB_REQUISITION_NOT_FOUND', 'Demande d’analyses introuvable.')) });
      expect(q('[role=alert]')?.textContent).toContain('introuvable');
      expect(q('h1')).toBeNull();
    });

    it('affiche une demande annulée avec son motif, sans aucune action', async () => {
      await setup({ loaded: requisition({ status: 'CANCELLED', cancellationReason: 'Prescrit par erreur', cancelledBy: doctor, cancelledAt: '2026-10-24T09:00:00Z' }) });
      expect(text()).toContain('Demande annulée');
      expect(text()).toContain('Annulée par medecin : Prescrit par erreur');
      for (const label of ['Prélever SPC-0000001', 'Rejeter SPC-0000001', 'Annuler la demande']) expect(buttonNamed(label)).toBeUndefined();
    });
  });

  describe('prélèvement', () => {
    it('contrôle deux identifiants, prélève, remplace la demande par celle du serveur et ferme le panneau', async () => {
      await setup();
      await click(buttonNamed('Prélever SPC-0000001'));
      expect(q('aside h2')?.textContent).toContain('Prélever SPC-0000001');
      expect(text()).toContain('Vérifiez l’identité du patient');
      await type('#requisition-collect-s-1-patientNumber', ' pat-0000001 ');
      await type('#requisition-collect-s-1-birthDate', '1990-03-14');
      await submit('requisition-collect-s-1');
      expect(lab.collect).toHaveBeenCalledWith('s-1', { patientNumber: 'PAT-0000001', birthDate: '1990-03-14' });
      expect(q('aside')).toBeNull();
      expect(q('h1')?.textContent).toContain('Prélevée');
      expect(text()).toContain('Prélevé le');
      expect(text()).toContain('par labo');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Échantillon SPC-0000001 prélevé.');
    });

    it('exige les deux identifiants et une date au bon format, sans rien envoyer', async () => {
      await setup();
      await click(buttonNamed('Prélever SPC-0000001'));
      await submit('requisition-collect-s-1');
      expect(text()).toContain('Ce champ est obligatoire.');
      await type('#requisition-collect-s-1-patientNumber', 'PAT-0000001');
      await type('#requisition-collect-s-1-birthDate', '14/03/1990');
      await submit('requisition-collect-s-1');
      expect(text()).toContain('Saisissez la date au format AAAA-MM-JJ.');
      expect(lab.collect).not.toHaveBeenCalled();
    });

    it('affiche le blocage quand le bracelet ne correspond pas, et garde la saisie', async () => {
      await setup({ prepare: (g) => g.collect.mockRejectedValue(new ApiError(409, 'LAB_IDENTITY_MISMATCH', 'Le patient ne correspond pas à la demande : vérifiez le bracelet et la date de naissance avant de prélever.')) });
      await click(buttonNamed('Prélever SPC-0000001'));
      await type('#requisition-collect-s-1-patientNumber', 'PAT-0000099');
      await type('#requisition-collect-s-1-birthDate', '1990-03-14');
      await submit('requisition-collect-s-1');
      expect(q('aside [role=alert]')?.textContent).toContain('ne correspond pas');
      expect(q<HTMLInputElement>('#requisition-collect-s-1-patientNumber')?.value).toBe('PAT-0000099');
      expect(q('h1')?.textContent).toContain('À prélever');
    });

    it('annule sans rien envoyer', async () => {
      await setup();
      await click(buttonNamed('Prélever SPC-0000001'));
      await click(buttonNamed('Annuler'));
      expect(q('aside')).toBeNull();
      expect(lab.collect).not.toHaveBeenCalled();
    });
  });

  describe('réception', () => {
    it('reçoit un échantillon prélevé, en un clic', async () => {
      await setup({ loaded: collected() });
      expect(buttonNamed('Prélever SPC-0000001')).toBeUndefined();
      await click(buttonNamed('Recevoir SPC-0000001'));
      expect(lab.receive).toHaveBeenCalledWith('s-1');
      expect(q('h1')?.textContent).toContain('Reçue au laboratoire');
      expect(text()).toContain('Reçu le');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Échantillon SPC-0000001 reçu au laboratoire.');
      expect(buttonNamed('Rejeter SPC-0000001')).toBeUndefined();
    });

    it('ne propose pas de recevoir un échantillon pas encore prélevé', async () => {
      await setup();
      expect(buttonNamed('Recevoir SPC-0000001')).toBeUndefined();
    });

    it('affiche le refus du serveur en haut de page', async () => {
      await setup({ loaded: collected(), prepare: (g) => g.receive.mockRejectedValue(new ApiError(409, 'LAB_SPECIMEN_NOT_COLLECTED', 'Seul un échantillon prélevé peut être reçu.')) });
      await click(buttonNamed('Recevoir SPC-0000001'));
      expect(q('[role=alert]')?.textContent).toContain('Seul un échantillon prélevé');
    });
  });

  describe('rejet', () => {
    it('rejette avec un motif, affiche l\'échantillon rejeté et son remplaçant', async () => {
      await setup({ loaded: collected() });
      await click(buttonNamed('Rejeter SPC-0000001'));
      expect(q('aside h2')?.textContent).toContain('Rejeter SPC-0000001');
      expect(text()).toContain('Un nouveau prélèvement sera demandé');
      await submit('requisition-reject-s-1');
      expect(text()).toContain('Choisissez un motif.');
      expect(lab.reject).not.toHaveBeenCalled();
      const select = q<HTMLSelectElement>('#requisition-reject-s-1-reason')!;
      select.value = 'HEMOLYSED';
      select.dispatchEvent(new Event('change'));
      await submit('requisition-reject-s-1');
      expect(lab.reject).toHaveBeenCalledWith('s-1', { reason: 'HEMOLYSED' });
      expect(q('aside')).toBeNull();
      expect(text()).toContain('Rejeté');
      expect(text()).toContain('Hémolysé');
      expect(text()).toContain('SPC-0000002');
      expect(text()).toContain('Nouveau prélèvement de SPC-0000001');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Échantillon SPC-0000001 rejeté : un nouveau prélèvement est prévu.');
    });

    it('« Autre » exige une précision, qui part avec le motif', async () => {
      await setup();
      await click(buttonNamed('Rejeter SPC-0000001'));
      const select = q<HTMLSelectElement>('#requisition-reject-s-1-reason')!;
      select.value = 'OTHER';
      select.dispatchEvent(new Event('change'));
      await submit('requisition-reject-s-1');
      expect(text()).toContain('Précisez le motif.');
      expect(lab.reject).not.toHaveBeenCalled();
      await type('#requisition-reject-s-1-note', ' Tube fissuré ');
      await submit('requisition-reject-s-1');
      expect(lab.reject).toHaveBeenCalledWith('s-1', { reason: 'OTHER', note: 'Tube fissuré' });
    });
  });

  describe('annulation', () => {
    it('annule avec un motif obligatoire', async () => {
      await setup({ permissions: PRESCRIBER });
      await click(buttonNamed('Annuler la demande'));
      await submit('requisition-cancel');
      expect(text()).toContain('Le motif est obligatoire.');
      expect(lab.cancel).not.toHaveBeenCalled();
      await type('#requisition-cancel-reason', ' Prescrit par erreur ');
      await submit('requisition-cancel');
      expect(lab.cancel).toHaveBeenCalledWith('r-1', 'Prescrit par erreur');
      expect(q('h1')?.textContent).toContain('Annulée');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Demande LAB-0000123 annulée.');
    });

    it('ne propose plus d\'annuler une fois un échantillon reçu', async () => {
      await setup({ loaded: requisition({ status: 'COLLECTED', specimens: [specimen({ status: 'RECEIVED', collectedBy: technician, collectedAt: '2026-10-24T08:30:00Z', receivedBy: technician, receivedAt: '2026-10-24T09:00:00Z' })] }) });
      expect(buttonNamed('Annuler la demande')).toBeUndefined();
    });
  });

  describe('droits', () => {
    it('un prescripteur suit sa demande mais ne prélève, ne reçoit ni ne rejette', async () => {
      await setup({ permissions: PRESCRIBER, loaded: collected() });
      for (const label of ['Prélever SPC-0000001', 'Recevoir SPC-0000001', 'Rejeter SPC-0000001']) expect(buttonNamed(label)).toBeUndefined();
      expect(buttonNamed('Annuler la demande')).toBeDefined();
      expect(text()).toContain('SPC-0000001');
    });
  });
});

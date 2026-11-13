import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import {
  FakeImagingGateway, communication, doctor, draft, emptyReport, order, performedOrder, radiologist, reportVersion, reportedOrder,
} from '../../../core/imaging/testing/fake-imaging-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { toInstantIso } from '../../reception/agenda/agenda-time';
import { ImagingOrderDetailPage } from './order-detail.page';

const SERVICE = [
  'imaging.orders:read:all', 'imaging.orders:cancel', 'imaging.orders:schedule', 'imaging.exams:perform', 'imaging.reports:write', 'imaging.reports:notify', 'imaging.reports:sign',
];
const PRESCRIBER = ['imaging.orders:read:own', 'imaging.orders:cancel'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('ImagingOrderDetailPage', () => {
  let fixture: ComponentFixture<ImagingOrderDetailPage>;
  let imaging: FakeImagingGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(options: { permissions?: readonly string[]; loaded?: ReturnType<typeof order>; prepare?: (g: FakeImagingGateway) => void } = {}) {
    imaging = new FakeImagingGateway();
    if (options.loaded) imaging.getOrder.mockResolvedValue(options.loaded);
    options.prepare?.(imaging);
    const { i18n } = configureApp({ roles: ['RADIOLOGIST'], permissions: options.permissions ?? SERVICE, providers: [{ provide: ImagingGateway, useValue: imaging }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ImagingOrderDetailPage);
    fixture.componentRef.setInput('id', 'o-1');
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

  async function check(selector: string) {
    const box = q<HTMLInputElement>(selector)!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    box.dispatchEvent(new Event('click'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('affichage', () => {
    it('montre l\'en-tête, le patient, l\'examen et la question clinique', async () => {
      await setup({ loaded: order({ priority: 'STAT', source: 'ER' }) });
      expect(imaging.getOrder).toHaveBeenCalledWith('o-1');
      expect(q('h1')?.textContent).toContain('IMG-0000123');
      expect(q('h1')?.textContent).toContain('STAT');
      expect(q('h1')?.textContent).toContain('Demandé');
      expect(text()).toContain('Mbarga Élisabeth');
      expect(text()).toContain('PAT-0000001');
      expect(text()).toContain('Femme');
      expect(text()).toContain('né(e) le 1990-03-14');
      expect(text()).toContain('par medecin');
      expect(text()).toContain('Urgences');
      expect(text()).toContain('Radiographie du thorax de face');
      expect(text()).toContain('Radiographie');
      expect(q('[data-test=question]')?.textContent).toContain('Toux persistante depuis 3 semaines.');
    });

    it('rappelle la préparation du patient tant que l\'examen n\'est pas réalisé', async () => {
      await setup({ loaded: order({ preparation: 'À jeun depuis 6 heures.' }) });
      expect(q('[data-test=preparation]')?.textContent).toContain('À jeun depuis 6 heures.');
    });

    it('signale une demande introuvable', async () => {
      await setup({ prepare: (g) => g.getOrder.mockRejectedValue(new ApiError(404, 'IMG_ORDER_NOT_FOUND', 'Demande d’examen introuvable.')) });
      expect(q('[role=alert]')?.textContent).toContain('introuvable');
      expect(q('h1')).toBeNull();
    });

    it('affiche une demande annulée avec son motif, sans aucune action', async () => {
      await setup({ loaded: order({ status: 'CANCELLED', cancellationReason: 'Examen en double', cancelledBy: doctor, cancelledAt: '2026-11-02T09:00:00Z' }) });
      expect(text()).toContain('Demande annulée');
      expect(text()).toContain('Annulée par medecin : Examen en double');
      for (const label of ['Planifier', 'Réaliser l’examen', 'Annuler la demande']) expect(buttonNamed(label)).toBeUndefined();
    });
  });

  describe('planification', () => {
    it('planifie au jour et à l\'heure saisis', async () => {
      await setup();
      await click(buttonNamed('Planifier'));
      expect(q('aside h2')?.textContent).toContain('Planifier l’examen');
      await type('#imaging-schedule-date', '2026-11-20');
      await type('#imaging-schedule-time', '09:30');
      await submit('imaging-schedule');
      expect(imaging.schedule).toHaveBeenCalledWith('o-1', toInstantIso('2026-11-20', '09:30'));
      expect(q('aside')).toBeNull();
      expect(q('h1')?.textContent).toContain('Planifié');
      expect(text()).toContain('Planifié le');
      expect(text()).toContain('par radio');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Examen planifié.');
      expect(buttonNamed('Replanifier')).toBeDefined();
    });

    it('refuse un jour ou une heure mal écrits, sans rien envoyer', async () => {
      await setup();
      await click(buttonNamed('Planifier'));
      await type('#imaging-schedule-date', '20/11/2026');
      await type('#imaging-schedule-time', '9h30');
      await submit('imaging-schedule');
      expect(text()).toContain('Saisissez le jour au format AAAA-MM-JJ.');
      expect(text()).toContain('Saisissez l’heure au format HH:MM.');
      expect(imaging.schedule).not.toHaveBeenCalled();
    });

    it('affiche le refus du serveur (créneau passé) dans le panneau', async () => {
      await setup({ prepare: (g) => g.schedule.mockRejectedValue(new ApiError(409, 'IMG_SCHEDULE_IN_PAST', 'Le créneau choisi est déjà passé.')) });
      await click(buttonNamed('Planifier'));
      await type('#imaging-schedule-date', '2026-11-01');
      await type('#imaging-schedule-time', '09:00');
      await submit('imaging-schedule');
      expect(q('#imaging-schedule [role=alert]')?.textContent).toContain('déjà passé');
      expect(q('aside')).not.toBeNull();
    });

    it('sans le droit de planifier, pas de bouton', async () => {
      await setup({ permissions: ['imaging.orders:read:all'] });
      expect(buttonNamed('Planifier')).toBeUndefined();
      expect(buttonNamed('Réaliser l’examen')).toBeUndefined();
    });
  });

  describe('réalisation et dépistage de sécurité', () => {
    it('réalise l\'examen sans contre-indication : dépistage envoyé, compte rendu à rédiger', async () => {
      await setup();
      await click(buttonNamed('Réaliser l’examen'));
      expect(text()).toContain('Dépistage de sécurité');
      await type('#imaging-perform-techniqueNote', ' Debout, inspiration profonde. ');
      await submit('imaging-perform');
      expect(imaging.perform).toHaveBeenCalledWith('o-1', { pregnant: false, contrastAllergy: false, techniqueNote: 'Debout, inspiration profonde.' });
      expect(q('aside')).toBeNull();
      expect(q('h1')?.textContent).toContain('Réalisé');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Examen réalisé : le compte rendu peut être rédigé.');
      expect(q('#imaging-draft')).not.toBeNull();
      expect(q('[data-test=screening]')?.textContent).toContain('Pas de grossesse déclarée');
    });

    it('une contre-indication refusée par le serveur reste dans le panneau ; avec un motif elle passe', async () => {
      await setup({ prepare: (g) => g.perform.mockRejectedValueOnce(new ApiError(409, 'IMG_PREGNANCY_RISK', 'Patiente enceinte et examen irradiant : précisez le motif de la dérogation pour poursuivre.')) });
      await click(buttonNamed('Réaliser l’examen'));
      await check('#imaging-perform-pregnant');
      await submit('imaging-perform');
      expect(q('#imaging-perform [role=alert]')?.textContent).toContain('précisez le motif de la dérogation');
      expect(q('h1')?.textContent).toContain('Demandé');
      await type('#imaging-perform-overrideReason', 'Urgence vitale.');
      await submit('imaging-perform');
      expect(imaging.perform).toHaveBeenLastCalledWith('o-1', { pregnant: true, contrastAllergy: false, overrideReason: 'Urgence vitale.' });
      expect(q('h1')?.textContent).toContain('Réalisé');
    });

    it('nomme la contre-indication selon l\'examen : irradiant, ou avec produit de contraste', async () => {
      await setup({ loaded: order({ modality: 'CT', usesContrast: true }) });
      await click(buttonNamed('Réaliser l’examen'));
      expect(text()).toContain('examen irradiant : contre-indication');
      expect(text()).toContain('examen avec injection : contre-indication');
    });

    it('montre le dépistage et la dérogation au service d\'imagerie', async () => {
      await setup({ loaded: performedOrder({ screening: { pregnant: true, contrastAllergy: false, overrideReason: 'Urgence vitale.' } }) });
      expect(q('[data-test=screening]')?.textContent).toContain('Grossesse déclarée ou possible');
      expect(q('[data-test=screening]')?.textContent).toContain('Dérogation : Urgence vitale.');
    });
  });

  describe('annulation', () => {
    it('annule avec un motif obligatoire', async () => {
      await setup({ permissions: PRESCRIBER });
      await click(buttonNamed('Annuler la demande'));
      await submit('imaging-cancel');
      expect(text()).toContain('Le motif est obligatoire.');
      expect(imaging.cancel).not.toHaveBeenCalled();
      await type('#imaging-cancel-reason', ' Examen en double ');
      await submit('imaging-cancel');
      expect(imaging.cancel).toHaveBeenCalledWith('o-1', 'Examen en double');
      expect(q('h1')?.textContent).toContain('Annulé');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Demande IMG-0000123 annulée.');
    });

    it('une demande réalisée ne s\'annule plus', async () => {
      await setup({ loaded: performedOrder() });
      expect(buttonNamed('Annuler la demande')).toBeUndefined();
    });
  });

  describe('compte rendu', () => {
    it('avant la réalisation : pas de brouillon, une explication', async () => {
      await setup();
      expect(q('#imaging-draft')).toBeNull();
      expect(q('[data-test=not-performed]')?.textContent).toContain('après la réalisation');
    });

    it('enregistre le brouillon ; la signature reste refusée tant qu\'il est incomplet', async () => {
      await setup({ loaded: performedOrder() });
      expect(buttonNamed('Signer le compte rendu').disabled).toBe(true);
      expect(q('[data-test=sign-blocked]')?.textContent).toContain('Enregistrez d’abord un brouillon');
      await type('#imaging-draft-findings', ' Opacité du lobe inférieur droit. ');
      await type('#imaging-draft-impression', 'Pneumopathie.');
      await submit('imaging-draft');
      expect(imaging.saveDraft).toHaveBeenCalledWith('o-1', { technique: null, findings: 'Opacité du lobe inférieur droit.', impression: 'Pneumopathie.', critical: false });
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Brouillon enregistré.');
      expect(buttonNamed('Signer le compte rendu').disabled).toBe(false);
      expect(q('[data-test=sign-blocked]')).toBeNull();
    });

    it('signe : le compte rendu devient lisible et le brouillon disparaît', async () => {
      await setup({ loaded: performedOrder({ report: emptyReport({ draft: draft() }) }) });
      await click(buttonNamed('Signer le compte rendu'));
      expect(imaging.sign).toHaveBeenCalledWith('o-1');
      expect(q('h1')?.textContent).toContain('Compte rendu signé');
      expect(q('#imaging-draft')).toBeNull();
      expect(q('[data-test="version-1"]')?.textContent).toContain('Opacité alvéolaire du lobe inférieur droit.');
      expect(q('[data-test="version-1"]')?.textContent).toContain('Signé le');
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Compte rendu signé.');
    });

    it('affiche le refus de signature (409) en haut de page', async () => {
      await setup({
        loaded: performedOrder({ report: emptyReport({ draft: draft() }) }),
        prepare: (g) => g.sign.mockRejectedValue(new ApiError(409, 'IMG_REPORT_INCOMPLETE', 'Les constatations et l’impression sont obligatoires pour signer.')),
      });
      await click(buttonNamed('Signer le compte rendu'));
      expect(q('#imaging-order-action-error [role=alert]')?.textContent).toContain('obligatoires pour signer');
      expect(buttonNamed('Recharger la demande')).toBeDefined();
    });

    describe('découverte critique', () => {
      const criticalDraft = () => performedOrder({ report: emptyReport({ draft: draft({ critical: true }), criticalRequired: true, criticalCommunicated: false }) });

      it('bloque la signature tant que l\'appel du clinicien n\'est pas documenté', async () => {
        await setup({ loaded: criticalDraft() });
        expect(q('[data-test=critical-block]')?.textContent).toContain('Documentez l’appel du clinicien');
        expect(buttonNamed('Signer le compte rendu').disabled).toBe(true);
        expect(q('[data-test=sign-blocked]')?.textContent).toContain('Documentez d’abord l’appel du clinicien');
      });

      it('exige le nom, la fonction et la relecture, puis documente l\'appel et débloque la signature', async () => {
        await setup({ loaded: criticalDraft() });
        await click(buttonNamed('Documenter l’appel'));
        expect(q('aside h2')?.textContent).toContain('Documenter l’appel du clinicien');
        await submit('imaging-communicate');
        expect(text()).toContain('Ce champ est obligatoire.');
        expect(imaging.communicate).not.toHaveBeenCalled();
        await type('#imaging-communicate-notifiedName', ' Dr Curie ');
        await type('#imaging-communicate-notifiedRole', 'Médecin de garde');
        await submit('imaging-communicate');
        expect(text()).toContain('La relecture doit être confirmée.');
        expect(imaging.communicate).not.toHaveBeenCalled();
        await check('#imaging-communicate-readBack');
        await submit('imaging-communicate');
        expect(imaging.communicate).toHaveBeenCalledWith('o-1', { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', readBackConfirmed: true });
        expect(q('aside')).toBeNull();
        expect(q('[data-test=critical-block]')?.textContent).toContain('L’appel du clinicien est documenté');
        expect(buttonNamed('Signer le compte rendu').disabled).toBe(false);
      });

      it('sans le droit de documenter l\'appel, pas de bouton', async () => {
        await setup({ loaded: criticalDraft(), permissions: SERVICE.filter((p) => p !== 'imaging.reports:notify') });
        expect(buttonNamed('Documenter l’appel')).toBeUndefined();
      });
    });

    describe('addendum', () => {
      it('complète un compte rendu signé : motif obligatoire, nouvelle version, la première reste lisible', async () => {
        await setup({ loaded: reportedOrder() });
        await click(buttonNamed('Ajouter un addendum'));
        expect(q<HTMLTextAreaElement>('#imaging-addendum-findings')?.value).toContain('Opacité alvéolaire');
        await submit('imaging-addendum');
        expect(text()).toContain('Le motif est obligatoire.');
        expect(imaging.addendum).not.toHaveBeenCalled();
        await type('#imaging-addendum-reason', 'Nodule vu à la relecture.');
        await type('#imaging-addendum-findings', 'Opacité du lobe inférieur droit et nodule du lobe supérieur gauche.');
        await submit('imaging-addendum');
        expect(imaging.addendum).toHaveBeenCalledWith('o-1', {
          reason: 'Nodule vu à la relecture.', technique: 'Face, debout.', findings: 'Opacité du lobe inférieur droit et nodule du lobe supérieur gauche.', impression: 'Pneumopathie.', critical: false,
        });
        expect(q('aside')).toBeNull();
        expect(q('[data-test="version-1"]')?.textContent).toContain('Opacité alvéolaire');
        expect(q('[data-test="version-2"]')?.textContent).toContain('Addendum n°1');
        expect(q('[data-test="version-2"]')?.textContent).toContain('Motif : Nodule vu à la relecture.');
      });

      it('un addendum critique demande l\'appel du clinicien et l\'envoie avec lui', async () => {
        await setup({ loaded: reportedOrder() });
        await click(buttonNamed('Ajouter un addendum'));
        expect(q('#imaging-addendum-notifiedName')).toBeNull();
        await type('#imaging-addendum-reason', 'Embolie découverte.');
        await check('#imaging-addendum-critical');
        fixture.detectChanges();
        await type('#imaging-addendum-notifiedName', 'Dr Curie');
        await type('#imaging-addendum-notifiedRole', 'Médecin de garde');
        await check('#imaging-addendum-readBack');
        await submit('imaging-addendum');
        expect(imaging.addendum).toHaveBeenCalledWith('o-1', expect.objectContaining({
          critical: true, communication: { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', readBackConfirmed: true },
        }));
      });
    });
  });

  describe('prescripteur', () => {
    it('lit sa demande et attend le compte rendu : ni brouillon, ni dépistage, ni actions du service', async () => {
      // Le serveur ne donne jamais le dépistage à un prescripteur.
      await setup({ permissions: PRESCRIBER, loaded: performedOrder({ screening: null }) });
      expect(q('#imaging-draft')).toBeNull();
      expect(q('[data-test=screening]')).toBeNull();
      expect(q('[data-test=pending]')?.textContent).toContain('pas encore signé');
      for (const label of ['Planifier', 'Réaliser l’examen', 'Signer le compte rendu', 'Ajouter un addendum']) expect(buttonNamed(label)).toBeUndefined();
    });

    it('lit le compte rendu signé, avec l\'appel documenté d\'une découverte critique', async () => {
      await setup({
        permissions: PRESCRIBER,
        loaded: reportedOrder({
          report: emptyReport({ versions: [reportVersion({ critical: true })], communications: [communication()] }),
        }),
      });
      expect(q('[data-test="version-1"]')?.textContent).toContain('Pneumopathie.');
      expect(q('[data-test="version-1"]')?.textContent).toContain('Découverte critique');
      expect(q('[data-test=communication]')?.textContent).toContain('Dr Curie');
      expect(q('[data-test=communication]')?.textContent).toContain('Médecin de garde');
      expect(q('[data-test=communication]')?.textContent).toContain('Téléphone');
      expect(q('[data-test=communication]')?.textContent).toContain('Relecture confirmée');
      expect(buttonNamed('Ajouter un addendum')).toBeUndefined();
      expect(radiologist.username).toBe('radio');
    });
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClinicalGateway } from '../../../core/clinical/clinical.gateway';
import { FakeClinicalGateway, addendum, allergy, colleague, diagnosis, doctor, encounter } from '../../../core/clinical/testing/fake-clinical-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { EncounterPage } from './encounter.page';

const DOCTOR = ['clinical.encounters:read:department', 'clinical.encounters:write:department', 'clinical.vitals:record:department', 'clinical.allergies:read', 'clinical.allergies:write'];
const NURSE = ['clinical.encounters:read:department', 'clinical.vitals:record:department', 'clinical.allergies:read', 'clinical.allergies:write'];

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('EncounterPage', () => {
  let fixture: ComponentFixture<EncounterPage>;
  let clinical: FakeClinicalGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label);

  async function setup(options: { permissions?: readonly string[]; userId?: string; loaded?: ReturnType<typeof encounter>; prepare?: (g: FakeClinicalGateway) => void } = {}) {
    clinical = new FakeClinicalGateway();
    if (options.loaded) clinical.getEncounter.mockResolvedValue(options.loaded);
    options.prepare?.(clinical);
    const { i18n } = configureApp({ roles: ['DOCTOR'], permissions: options.permissions ?? DOCTOR, profile: { id: options.userId ?? doctor.id }, providers: [{ provide: ClinicalGateway, useValue: clinical }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(EncounterPage);
    fixture.componentRef.setInput('id', 'e-1');
    await settle(fixture);
  }

  async function click(button: HTMLElement | undefined) {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function type(selector: string, value: string, event = 'input') {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event(event, { bubbles: true }));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('bandeau du patient', () => {
    it('montre le patient, l\'âge, le statut et les allergies actives avec leur gravité', async () => {
      await setup({ loaded: encounter({ allergies: [allergy(), allergy({ id: 'al-2', substance: 'Arachide', severity: 'MILD', reaction: null })] }) });
      expect(clinical.getEncounter).toHaveBeenCalledWith('e-1');
      const banner = textOf(q('[data-test=banner]'));
      expect(banner).toContain('Mbarga Élisabeth');
      expect(banner).toContain('PAT-0000001');
      expect(banner).toContain('Femme');
      expect(banner).toContain('36 ans');
      expect(banner).toContain('CON-0000001');
      expect(banner).toContain('En cours');
      expect(textOf(q('[data-test=allergy-al-1]'))).toContain('Pénicilline · Sévère · Urticaire généralisée');
      expect(textOf(q('[data-test=allergy-al-2]'))).toContain('Arachide · Légère');
    });

    it('dit qu\'aucune allergie n\'est connue', async () => {
      await setup();
      expect(textOf(q('[data-test=banner]'))).toContain('Aucune allergie connue');
    });

    it('signale une consultation introuvable', async () => {
      await setup({ prepare: (g) => g.getEncounter.mockRejectedValue(new ApiError(404, 'CLINICAL_ENCOUNTER_NOT_FOUND', 'Consultation introuvable.')) });
      expect(q('[role=alert]')?.textContent).toContain('introuvable');
      expect(q('[data-test=banner]')).toBeNull();
    });
  });

  describe('rédaction par le médecin', () => {
    it('relève les constantes : les virgules sont acceptées et le serveur reçoit des nombres', async () => {
      await setup();
      await type('#encounter-vitals-temperature', '38,5');
      await type('#encounter-vitals-pulse', '92');
      await submit('encounter-vitals');
      expect(clinical.recordVitals).toHaveBeenCalledWith('e-1', { temperature: 38.5, pulse: 92 });
      expect(textOf(q('[data-test=vitals]'))).toContain('38.5');
      expect(textOf(q('[data-test=vitals]'))).toContain('92');
    });

    it('refuse une valeur non entière pour le pouls sans appeler le serveur', async () => {
      await setup();
      await type('#encounter-vitals-pulse', '92,5');
      await submit('encounter-vitals');
      expect(clinical.recordVitals).not.toHaveBeenCalled();
      expect(text()).toContain('Saisissez un nombre entier.');
    });

    it('enregistre la note SOAP', async () => {
      await setup();
      await type('#encounter-note-chiefComplaint', '  Toux et fièvre  ');
      await type('#encounter-note-assessment', 'Pneumopathie probable');
      await submit('encounter-note');
      expect(clinical.updateNote).toHaveBeenCalledWith('e-1', expect.objectContaining({ chiefComplaint: 'Toux et fièvre', assessment: 'Pneumopathie probable' }));
    });

    it('ajoute un diagnostic (le premier est principal), le met en majuscules et enregistre le bloc', async () => {
      await setup();
      await click(buttonNamed('Ajouter un diagnostic'));
      await type('#dx-0-code', 'j18.9');
      await type('#dx-0-label', 'Pneumopathie, sans précision');
      await click(buttonNamed('Enregistrer les diagnostics'));
      expect(clinical.setDiagnoses).toHaveBeenCalledWith('e-1', [{ code: 'J18.9', label: 'Pneumopathie, sans précision', kind: 'PRIMARY', certainty: 'PROVISIONAL' }]);
    });

    it('le deuxième diagnostic est secondaire par défaut et peut être retiré', async () => {
      await setup({ loaded: encounter({ diagnoses: [diagnosis()] }) });
      await click(buttonNamed('Ajouter un diagnostic'));
      expect((q<HTMLSelectElement>('#dx-1-kind')!).value).toBe('SECONDARY');
      await click(buttonNamed('Retirer le diagnostic 2'));
      expect(q('#dx-1-code')).toBeNull();
      expect(q<HTMLInputElement>('#dx-0-code')!.value).toBe('J18.9');
    });

    it('refuse un code CIM-10 invalide ou un libellé vide sans appeler le serveur', async () => {
      await setup();
      await click(buttonNamed('Ajouter un diagnostic'));
      await type('#dx-0-code', 'pneumonie');
      await type('#dx-0-label', 'Pneumopathie');
      await click(buttonNamed('Enregistrer les diagnostics'));
      expect(text()).toContain('Diagnostic 1 : code CIM-10 invalide');
      await type('#dx-0-code', 'J18.9');
      await type('#dx-0-label', '   ');
      await click(buttonNamed('Enregistrer les diagnostics'));
      expect(text()).toContain('Diagnostic 1 : le libellé est obligatoire.');
      expect(clinical.setDiagnoses).not.toHaveBeenCalled();
    });

    it('affiche le refus du serveur près des diagnostics', async () => {
      await setup({ prepare: (g) => g.setDiagnoses.mockRejectedValue(new ApiError(422, 'CLINICAL_DIAGNOSES_INVALID', 'Un seul diagnostic principal est permis.')) });
      await click(buttonNamed('Ajouter un diagnostic'));
      await type('#dx-0-code', 'J18.9');
      await type('#dx-0-label', 'Pneumopathie');
      await click(buttonNamed('Enregistrer les diagnostics'));
      expect(q('#dx-title')!.closest('section')!.querySelector('[role=alert]')?.textContent).toContain('Un seul diagnostic principal');
    });
  });

  describe('signature', () => {
    it('liste ce qui manque et empêche de signer', async () => {
      await setup();
      expect(textOf(q('[data-test=missing]'))).toContain('Un diagnostic principal est requis.');
      expect(textOf(q('[data-test=missing]'))).toContain('L’évaluation de la note est requise.');
      expect(buttonNamed('Signer la consultation')!.disabled).toBe(true);
    });

    it('signe une consultation complète et la verrouille', async () => {
      await setup({ loaded: encounter({ missingForSignature: [], diagnoses: [diagnosis()], note: { chiefComplaint: null, history: null, examination: null, assessment: 'Pneumopathie', plan: null } }) });
      expect(buttonNamed('Signer la consultation')!.disabled).toBe(false);
      await click(buttonNamed('Signer la consultation'));
      expect(clinical.signEncounter).toHaveBeenCalledWith('e-1');
      expect(text()).toContain('Consultation signée par medecin');
      expect(q('#encounter-note')).toBeNull();
      expect(buttonNamed('Signer la consultation')).toBeUndefined();
    });

    it('annule une consultation ouverte par erreur avec un motif obligatoire', async () => {
      await setup();
      await click(buttonNamed('Annuler la consultation'));
      expect(q('aside h2')?.textContent).toContain('Annuler la consultation');
      await submit('encounter-cancel');
      expect(clinical.cancelEncounter).not.toHaveBeenCalled();
      expect(text()).toContain('Le motif est obligatoire.');
      await type('#encounter-cancel-reason', 'Ouverte par erreur');
      await submit('encounter-cancel');
      expect(clinical.cancelEncounter).toHaveBeenCalledWith('e-1', 'Ouverte par erreur');
      expect(text()).toContain('Consultation annulée par medecin : Ouverte par erreur');
      expect(q('aside')).toBeNull();
    });
  });

  describe('consultation signée', () => {
    const signed = (over = {}) => encounter({ status: 'SIGNED', signedBy: doctor, signedAt: '2026-10-24T08:40:00Z', missingForSignature: [], diagnoses: [diagnosis()], note: { chiefComplaint: 'Toux', history: null, examination: null, assessment: 'Pneumopathie', plan: null }, ...over });

    it('affiche la note et les diagnostics en lecture seule, sans formulaire de rédaction', async () => {
      await setup({ loaded: signed() });
      expect(textOf(q('[data-test=note]'))).toContain('Toux');
      expect(textOf(q('[data-test=note]'))).toContain('Pneumopathie');
      expect(textOf(q('[data-test=diagnoses]'))).toContain('J18.9');
      expect(textOf(q('[data-test=diagnoses]'))).toContain('Principal');
      expect(q('#encounter-note')).toBeNull();
      expect(q('#encounter-vitals')).toBeNull();
      expect(buttonNamed('Enregistrer les diagnostics')).toBeUndefined();
    });

    it('permet à l\'auteur d\'ajouter un addendum et le liste', async () => {
      await setup({ loaded: signed({ addenda: [addendum()] }) });
      expect(textOf(q('[data-test=addenda]'))).toContain('Radiographie reçue');
      await type('#encounter-addendum-text', 'Culture : germe sensible à l’amoxicilline.');
      await submit('encounter-addendum');
      expect(clinical.addAddendum).toHaveBeenCalledWith('e-1', 'Culture : germe sensible à l’amoxicilline.');
      expect(textOf(q('[data-test=addenda]'))).toContain('Culture : germe sensible');
    });

    it('n\'offre pas d\'addendum à un autre médecin', async () => {
      await setup({ loaded: signed(), userId: colleague.id });
      expect(q('#encounter-addendum')).toBeNull();
      expect(q('[data-test=addenda]')).not.toBeNull();
    });
  });

  describe('lecture par un autre professionnel', () => {
    it('un confrère voit la consultation en lecture seule avec le nom de l\'auteur', async () => {
      await setup({ userId: colleague.id });
      expect(text()).toContain('conduite par medecin : vous la consultez en lecture seule');
      expect(q('#encounter-note')).toBeNull();
      expect(buttonNamed('Signer la consultation')).toBeUndefined();
      expect(buttonNamed('Annuler la consultation')).toBeUndefined();
    });

    it('un infirmier peut relever les constantes mais pas rédiger la note', async () => {
      await setup({ permissions: NURSE, userId: 'u-nur' });
      expect(q('#encounter-vitals')).not.toBeNull();
      expect(q('#encounter-note')).toBeNull();
      expect(q('#dx-title')!.closest('section')!.querySelector('button')).toBeNull();
    });
  });

  describe('allergies', () => {
    it('enregistre une nouvelle allergie puis recharge la consultation', async () => {
      await setup();
      await click(buttonNamed('Ajouter une allergie'));
      expect(q('aside h2')?.textContent).toContain('Nouvelle allergie');
      await type('#encounter-allergy-substance', 'Latex');
      const severity = q<HTMLSelectElement>('#encounter-allergy-severity')!;
      severity.value = 'MODERATE';
      severity.dispatchEvent(new Event('change', { bubbles: true }));
      await submit('encounter-allergy');
      expect(clinical.recordAllergy).toHaveBeenCalledWith('p-1', { substance: 'Latex', severity: 'MODERATE' });
      expect(clinical.getEncounter).toHaveBeenCalledTimes(2);
      expect(q('aside')).toBeNull();
    });

    it('déclare une allergie saisie par erreur avec un motif', async () => {
      await setup({ loaded: encounter({ allergies: [allergy()] }) });
      await click(buttonNamed('Déclarer Pénicilline saisie par erreur'));
      expect(q('aside h2')?.textContent).toContain('Saisie erronée : Pénicilline');
      await type('#encounter-void-reason', 'Mauvais dossier');
      await submit('encounter-void');
      expect(clinical.voidAllergy).toHaveBeenCalledWith('al-1', 'Mauvais dossier');
      expect(clinical.getEncounter).toHaveBeenCalledTimes(2);
    });

    it('n\'offre pas de modifier les allergies sans la permission d\'écriture', async () => {
      await setup({ permissions: ['clinical.encounters:read:department', 'clinical.allergies:read'], loaded: encounter({ allergies: [allergy()] }) });
      expect(buttonNamed('Ajouter une allergie')).toBeUndefined();
      expect(buttonNamed('Déclarer Pénicilline saisie par erreur')).toBeUndefined();
    });
  });
});

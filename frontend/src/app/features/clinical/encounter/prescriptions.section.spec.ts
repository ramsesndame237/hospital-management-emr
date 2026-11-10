import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClinicalGateway } from '../../../core/clinical/clinical.gateway';
import { DrugSuggestion } from '../../../core/clinical/clinical.models';
import { FakeClinicalGateway, colleague, doctor, drug, prescription, suggestion } from '../../../core/clinical/testing/fake-clinical-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { PrescriptionsSection } from './prescriptions.section';

const RX = ['clinical.prescriptions:read:department', 'clinical.prescriptions:write:department'];

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('PrescriptionsSection', () => {
  let fixture: ComponentFixture<PrescriptionsSection>;
  let clinical: FakeClinicalGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label);

  async function setup(options: { canIssue?: boolean; userId?: string; permissions?: readonly string[]; prepare?: (g: FakeClinicalGateway) => void } = {}) {
    clinical = new FakeClinicalGateway();
    options.prepare?.(clinical);
    const { i18n } = configureApp({ roles: ['DOCTOR'], permissions: options.permissions ?? RX, profile: { id: options.userId ?? doctor.id }, providers: [{ provide: ClinicalGateway, useValue: clinical }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(PrescriptionsSection);
    fixture.componentRef.setInput('encounterId', 'e-1');
    fixture.componentRef.setInput('canIssue', options.canIssue ?? true);
    await settle(fixture);
  }

  async function click(button: HTMLElement | undefined) {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(fixture);
  }

  /** Ouvre le composeur, cherche et choisit un médicament. */
  async function pick(d: DrugSuggestion = suggestion()) {
    clinical.searchDrugs.mockResolvedValue([d]);
    await click(buttonNamed('Nouvelle ordonnance'));
    await type('#rx-search', d.name.slice(0, 4));
    await click(q(`[data-test="result-${d.code}"]`)!);
  }

  async function fillLine(index = 0, over: Partial<Record<'dose' | 'frequency' | 'days' | 'quantity' | 'instructions' | 'override', string>> = {}) {
    const values = { dose: '1 gélule', frequency: '3 fois par jour', days: '7', quantity: '21', ...over };
    for (const [key, value] of Object.entries(values)) await type(`#rx-${index}-${key}`, value);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('liste', () => {
    it('affiche les ordonnances avec leurs lignes, leur statut et leur prescripteur', async () => {
      await setup({ prepare: (g) => g.listPrescriptions.mockResolvedValue([prescription({ notes: 'Revoir à 7 jours' })]) });
      expect(clinical.listPrescriptions).toHaveBeenCalledWith('e-1');
      const rx = textOf(q('[data-test="RX-0000001"]'));
      expect(rx).toContain('RX-0000001');
      expect(rx).toContain('En cours');
      expect(rx).toContain('Émise par medecin');
      expect(rx).toContain('Amoxicilline Biogaran · 500 mg');
      expect(rx).toContain('1 gélule · 3 fois par jour · 7 jours · quantité : 21 gélule');
      expect(rx).toContain('Revoir à 7 jours');
    });

    it('montre le motif d\'une prescription malgré allergie et celui d\'une annulation', async () => {
      await setup({
        prepare: (g) => g.listPrescriptions.mockResolvedValue([
          prescription({ lines: [{ position: 0, drug: drug(), dose: '1', frequency: '1/j', durationDays: null, quantity: 5, instructions: 'Au coucher', allergyOverride: 'Bénéfice supérieur au risque' }] }),
          prescription({ id: 'rx-2', number: 'RX-0000002', status: 'CANCELLED', cancelledBy: doctor, cancellationReason: 'Posologie erronée' }),
        ]),
      });
      expect(textOf(q('[data-test="RX-0000001"]'))).toContain('Prescrit malgré une allergie connue : Bénéfice supérieur au risque');
      expect(textOf(q('[data-test="RX-0000001"]'))).toContain('Au coucher');
      expect(textOf(q('[data-test="RX-0000002"]'))).toContain('Annulée');
      expect(textOf(q('[data-test="RX-0000002"]'))).toContain('Annulée par medecin : Posologie erronée');
      expect(buttonNamed('Annuler l’ordonnance RX-0000002')).toBeUndefined();
    });

    it('dit qu\'il n\'y a pas d\'ordonnance', async () => {
      await setup();
      expect(text()).toContain('Aucune ordonnance pour cette consultation.');
    });

    it('signale une erreur de chargement', async () => {
      await setup({ prepare: (g) => g.listPrescriptions.mockRejectedValue(new ApiError(404, 'CLINICAL_ENCOUNTER_NOT_FOUND', 'Consultation introuvable.')) });
      expect(q('[role=alert]')?.textContent).toContain('introuvable');
    });

    it('n\'offre pas d\'émettre quand la consultation n\'est plus ouverte à l\'auteur', async () => {
      await setup({ canIssue: false });
      expect(buttonNamed('Nouvelle ordonnance')).toBeUndefined();
    });
  });

  describe('émission', () => {
    it('cherche, choisit un médicament, saisit la ligne et émet : le serveur reçoit des nombres et la liste s\'enrichit', async () => {
      await setup();
      await pick();
      expect(clinical.searchDrugs).toHaveBeenCalledWith('e-1', 'Amox');
      expect(q('#rx-search')).not.toBeNull();
      await fillLine(0, { instructions: 'Pendant les repas' });
      await type('#rx-notes', 'Revoir à 7 jours');
      await click(buttonNamed('Émettre l’ordonnance'));
      expect(clinical.issuePrescription).toHaveBeenCalledWith('e-1', {
        notes: 'Revoir à 7 jours',
        lines: [{ drugId: 'd-1', dose: '1 gélule', frequency: '3 fois par jour', durationDays: 7, quantity: 21, instructions: 'Pendant les repas' }],
      });
      expect(q('[data-test=composer]')).toBeNull();
      expect(textOf(q('[data-test="RX-0000001"]'))).toContain('Amoxicilline Biogaran');
    });

    it('n\'envoie ni durée ni consigne ni remarque laissées vides', async () => {
      await setup();
      await pick();
      await fillLine(0, { days: '' });
      await click(buttonNamed('Émettre l’ordonnance'));
      expect(clinical.issuePrescription).toHaveBeenCalledWith('e-1', { lines: [{ drugId: 'd-1', dose: '1 gélule', frequency: '3 fois par jour', quantity: 21 }] });
    });

    it('ne cherche pas sous deux caractères, dit quand rien ne correspond, et ne duplique pas un médicament déjà choisi', async () => {
      await setup();
      await click(buttonNamed('Nouvelle ordonnance'));
      await type('#rx-search', 'a');
      expect(clinical.searchDrugs).not.toHaveBeenCalled();
      clinical.searchDrugs.mockResolvedValue([]);
      await type('#rx-search', 'zzz');
      expect(text()).toContain('Aucun médicament ne correspond.');
      clinical.searchDrugs.mockResolvedValue([suggestion()]);
      await type('#rx-search', 'amox');
      await click(q('[data-test="result-AMOX500"]')!);
      await type('#rx-search', 'amox');
      await click(q('[data-test="result-AMOX500"]')!);
      expect(root().querySelectorAll('[data-test="draft-AMOX500"]')).toHaveLength(1);
    });

    it('ignore la réponse tardive d\'une recherche périmée', async () => {
      await setup();
      await click(buttonNamed('Nouvelle ordonnance'));
      let releaseSlow!: (v: DrugSuggestion[]) => void;
      clinical.searchDrugs.mockImplementationOnce(() => new Promise((resolve) => { releaseSlow = resolve; }));
      clinical.searchDrugs.mockResolvedValueOnce([suggestion({ id: 'd-2', code: 'PARA', name: 'Paracétamol' })]);
      await type('#rx-search', 'amox');
      await type('#rx-search', 'para');
      releaseSlow([suggestion()]);
      await settle(fixture);
      expect(q('[data-test="result-PARA"]')).not.toBeNull();
      expect(q('[data-test="result-AMOX500"]')).toBeNull();
    });

    it('retire une ligne et ferme le composeur sans rien émettre', async () => {
      await setup();
      await pick();
      await click(buttonNamed('Retirer Amoxicilline Biogaran de l’ordonnance'));
      expect(q('[data-test="draft-AMOX500"]')).toBeNull();
      expect(buttonNamed('Émettre l’ordonnance')!.disabled).toBe(true);
      await click(buttonNamed('Annuler'));
      expect(q('[data-test=composer]')).toBeNull();
      expect(clinical.issuePrescription).not.toHaveBeenCalled();
    });

    it.each([
      [{ dose: ' ' }, 'Ligne 1 : indiquez la dose.'],
      [{ frequency: '' }, 'Ligne 1 : indiquez le rythme.'],
      [{ quantity: '0' }, 'Ligne 1 : la quantité doit être un entier de 1 à 10 000.'],
      [{ quantity: '1,5' }, 'Ligne 1 : la quantité doit être un entier de 1 à 10 000.'],
      [{ quantity: '10001' }, 'Ligne 1 : la quantité doit être un entier de 1 à 10 000.'],
      [{ days: '366' }, 'Ligne 1 : la durée doit être un entier de 1 à 365 jours.'],
      [{ days: 'sept' }, 'Ligne 1 : la durée doit être un entier de 1 à 365 jours.'],
    ])('refuse une saisie invalide (%#) sans appeler le serveur', async (over, message) => {
      await setup();
      await pick();
      await fillLine(0, over);
      await click(buttonNamed('Émettre l’ordonnance'));
      expect(q('[data-test=compose-error]')?.textContent).toContain(message);
      expect(clinical.issuePrescription).not.toHaveBeenCalled();
    });

    it('affiche le refus du serveur sans fermer le composeur', async () => {
      await setup({ prepare: (g) => g.issuePrescription.mockRejectedValue(new ApiError(409, 'CLINICAL_ENCOUNTER_LOCKED', 'Cette consultation est signée : on ne prescrit plus.')) });
      await pick();
      await fillLine();
      await click(buttonNamed('Émettre l’ordonnance'));
      expect(q('[data-test=compose-error]')?.textContent).toContain('signée');
      expect(q('[data-test=composer]')).not.toBeNull();
    });
  });

  describe('alerte d\'allergie', () => {
    const alerting = () => suggestion({ allergyAlerts: [{ allergyId: 'al-1', substance: 'Amoxicilline', severity: 'SEVERE' }] });

    it('signale l\'allergie dans les résultats et sur la ligne choisie', async () => {
      await setup();
      clinical.searchDrugs.mockResolvedValue([alerting()]);
      await click(buttonNamed('Nouvelle ordonnance'));
      await type('#rx-search', 'amox');
      expect(textOf(q('[data-test="result-AMOX500"]'))).toContain('Allergie connue');
      await click(q('[data-test="result-AMOX500"]')!);
      expect(textOf(q('[data-test="alert-AMOX500"]'))).toContain('Allergie connue : Amoxicilline (gravité Sévère).');
    });

    it('exige un motif pour prescrire malgré l\'allergie, puis l\'envoie', async () => {
      await setup();
      await pick(alerting());
      await fillLine();
      await click(buttonNamed('Émettre l’ordonnance'));
      expect(q('[data-test=compose-error]')?.textContent).toContain('une allergie est connue');
      expect(clinical.issuePrescription).not.toHaveBeenCalled();
      await type('#rx-0-override', 'ab');
      await click(buttonNamed('Émettre l’ordonnance'));
      expect(clinical.issuePrescription).not.toHaveBeenCalled();
      await type('#rx-0-override', 'Bénéfice supérieur au risque');
      await click(buttonNamed('Émettre l’ordonnance'));
      expect(clinical.issuePrescription).toHaveBeenCalledWith('e-1', { lines: [expect.objectContaining({ drugId: 'd-1', allergyOverride: 'Bénéfice supérieur au risque' })] });
    });

    it('n\'envoie pas de motif pour un médicament sans alerte', async () => {
      await setup();
      await pick();
      await fillLine();
      await click(buttonNamed('Émettre l’ordonnance'));
      expect(clinical.issuePrescription.mock.calls[0][1].lines[0]).not.toHaveProperty('allergyOverride');
    });
  });

  describe('annulation', () => {
    it('annule l\'ordonnance de son auteur avec un motif obligatoire', async () => {
      await setup({ prepare: (g) => g.listPrescriptions.mockResolvedValue([prescription()]) });
      await click(buttonNamed('Annuler l’ordonnance RX-0000001'));
      await q<HTMLFormElement>('#rx-cancel')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(clinical.cancelPrescription).not.toHaveBeenCalled();
      expect(text()).toContain('Le motif est obligatoire.');
      await type('#rx-cancel-reason', 'Posologie erronée');
      q<HTMLFormElement>('#rx-cancel')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(clinical.cancelPrescription).toHaveBeenCalledWith('rx-1', 'Posologie erronée');
      expect(textOf(q('[data-test="RX-0000001"]'))).toContain('Annulée par medecin : Posologie erronée');
      expect(q('#rx-cancel')).toBeNull();
    });

    it('n\'offre pas d\'annuler l\'ordonnance d\'un confrère, ni sans le droit d\'écrire', async () => {
      await setup({ userId: colleague.id, prepare: (g) => g.listPrescriptions.mockResolvedValue([prescription()]) });
      expect(buttonNamed('Annuler l’ordonnance RX-0000001')).toBeUndefined();
    });

    it('n\'offre pas d\'annuler sans le droit d\'écrire', async () => {
      await setup({ permissions: ['clinical.prescriptions:read:department'], prepare: (g) => g.listPrescriptions.mockResolvedValue([prescription()]) });
      expect(buttonNamed('Annuler l’ordonnance RX-0000001')).toBeUndefined();
    });

    it('affiche le refus du serveur près du formulaire', async () => {
      await setup({ prepare: (g) => { g.listPrescriptions.mockResolvedValue([prescription()]); g.cancelPrescription.mockRejectedValue(new ApiError(409, 'CLINICAL_PRESCRIPTION_CANCELLED', 'Cette ordonnance est déjà annulée.')); } });
      await click(buttonNamed('Annuler l’ordonnance RX-0000001'));
      await type('#rx-cancel-reason', 'Erreur');
      q<HTMLFormElement>('#rx-cancel')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(textOf(q('#rx-cancel')!.parentElement)).toContain('déjà annulée');
    });

    it('garde l\'ordonnance quand on renonce', async () => {
      await setup({ prepare: (g) => g.listPrescriptions.mockResolvedValue([prescription()]) });
      await click(buttonNamed('Annuler l’ordonnance RX-0000001'));
      await click(buttonNamed('Garder l’ordonnance'));
      expect(q('#rx-cancel')).toBeNull();
      expect(clinical.cancelPrescription).not.toHaveBeenCalled();
    });
  });
});

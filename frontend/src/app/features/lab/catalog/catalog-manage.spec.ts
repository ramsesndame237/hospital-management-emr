import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { FakeLabGateway, labTest, page } from '../../../core/lab/testing/fake-lab-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { LabCatalogPage } from './catalog.page';

const MANAGER = ['lab.catalog:read', 'lab.catalog:manage'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('LabCatalogPage : gestion du catalogue', () => {
  let fixture: ComponentFixture<LabCatalogPage>;
  let lab: FakeLabGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(permissions: readonly string[] = MANAGER, prepare?: (g: FakeLabGateway) => void) {
    lab = new FakeLabGateway();
    prepare?.(lab);
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions, providers: [{ provide: LabGateway, useValue: lab }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(LabCatalogPage);
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

  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => t.message);

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('ne montre aucune action de gestion à qui ne fait que consulter', async () => {
    await setup(['lab.catalog:read']);
    for (const label of ['Nouvelle analyse', 'Modifier Hémoglobine', 'Retirer Hémoglobine du catalogue']) expect(buttonNamed(label)).toBeUndefined();
    expect(q('#lab-catalog-filter-inactive')).toBeNull();
  });

  it('offre la gestion au DSI : créer, modifier, valeurs de référence, retirer', async () => {
    await setup();
    expect(buttonNamed('Nouvelle analyse')).toBeDefined();
    expect(buttonNamed('Modifier Hémoglobine')).toBeDefined();
    expect(buttonNamed('Modifier les valeurs de référence de Hémoglobine')).toBeDefined();
    expect(buttonNamed('Retirer Hémoglobine du catalogue')).toBeDefined();
    expect(q('#lab-catalog-filter-inactive')).not.toBeNull();
  });

  it('propose les valeurs de référence seulement pour une analyse numérique', async () => {
    await setup(MANAGER, (g) => g.listTests.mockResolvedValue(page([labTest({ resultType: 'TEXT', unit: null, ranges: [] })])));
    expect(buttonNamed('Modifier les valeurs de référence de Hémoglobine')).toBeUndefined();
  });

  it('crée une analyse numérique : code normalisé, unité, décimales, délai, et recharge la liste', async () => {
    await setup();
    await click(buttonNamed('Nouvelle analyse'));
    expect(q('aside h2')?.textContent).toContain('Nouvelle analyse');
    await submit('lab-test-new');
    expect(text()).toContain('Ce champ est obligatoire.');
    expect(lab.createTest).not.toHaveBeenCalled();
    await type('#lab-test-new-code', 'na');
    await type('#lab-test-new-name', ' Sodium ');
    await choose('#lab-test-new-section', 'BIOCHEMISTRY');
    await choose('#lab-test-new-specimenType', 'SERUM');
    await choose('#lab-test-new-container', 'YELLOW');
    await type('#lab-test-new-unit', 'mmol/L');
    await type('#lab-test-new-decimals', '0');
    await type('#lab-test-new-tatMinutes', '90');
    await submit('lab-test-new');
    expect(lab.createTest).toHaveBeenCalledWith({
      code: 'NA', name: 'Sodium', section: 'BIOCHEMISTRY', specimenType: 'SERUM', container: 'YELLOW', resultType: 'NUMERIC', unit: 'mmol/L', decimals: 0, choices: [], tatMinutes: 90, instructions: null,
    });
    expect(q('aside')).toBeNull();
    expect(lab.listTests).toHaveBeenCalledTimes(2);
    expect(toasts()).toEqual(['Analyse Sodium créée.']);
  });

  it('une analyse à choix exige de 2 à 20 valeurs distinctes, une par ligne', async () => {
    await setup();
    await click(buttonNamed('Nouvelle analyse'));
    await type('#lab-test-new-code', 'PALU');
    await type('#lab-test-new-name', 'Paludisme');
    await choose('#lab-test-new-resultType', 'CHOICE');
    await type('#lab-test-new-choices', 'Positif');
    await submit('lab-test-new');
    expect(text()).toContain('Indiquez de 2 à 20 valeurs distinctes.');
    expect(lab.createTest).not.toHaveBeenCalled();
    await type('#lab-test-new-choices', ' Positif \n\nnégatif ');
    await submit('lab-test-new');
    expect(lab.createTest).toHaveBeenCalledWith(expect.objectContaining({ code: 'PALU', resultType: 'CHOICE', unit: null, decimals: 0, choices: ['Positif', 'négatif'] }));
  });

  it('affiche le refus du serveur (code déjà pris) dans le panneau, en gardant la saisie', async () => {
    await setup(MANAGER, (g) => g.createTest.mockRejectedValue(new ApiError(409, 'LAB_TEST_CODE_ALREADY_EXISTS', 'Une analyse utilise déjà ce code.')));
    await click(buttonNamed('Nouvelle analyse'));
    await type('#lab-test-new-code', 'HGB');
    await type('#lab-test-new-name', 'Doublon');
    await submit('lab-test-new');
    expect(q('aside [role=alert]')?.textContent).toContain('déjà ce code');
    expect(q<HTMLInputElement>('#lab-test-new-name')?.value).toBe('Doublon');
    expect(q('aside')).not.toBeNull();
  });

  it('modifie une analyse sans pouvoir toucher à son code ni à son type de résultat', async () => {
    await setup();
    await click(buttonNamed('Modifier Hémoglobine'));
    expect(q('aside h2')?.textContent).toContain('Modifier : Hémoglobine');
    expect(q('#lab-test-t-1-code')).toBeNull();
    expect(q('#lab-test-t-1-resultType')).toBeNull();
    expect(q<HTMLInputElement>('#lab-test-t-1-name')?.value).toBe('Hémoglobine');
    expect(q<HTMLInputElement>('#lab-test-t-1-unit')?.value).toBe('g/dL');
    await type('#lab-test-t-1-name', 'Hémoglobine totale');
    await type('#lab-test-t-1-tatMinutes', '60');
    await submit('lab-test-t-1');
    expect(lab.updateTest).toHaveBeenCalledWith('t-1', expect.objectContaining({ name: 'Hémoglobine totale', tatMinutes: 60, unit: 'g/dL', decimals: 1, choices: [], instructions: null }));
    expect(toasts()).toEqual(['Analyse Hémoglobine totale mise à jour.']);
  });

  it('retire une analyse du catalogue, puis la remet', async () => {
    await setup();
    await click(buttonNamed('Retirer Hémoglobine du catalogue'));
    expect(lab.setTestActive).toHaveBeenCalledWith('t-1', false);
    expect(toasts()).toEqual(['Analyse Hémoglobine retirée du catalogue.']);
  });

  it('remet au catalogue une analyse retirée, signalée comme telle', async () => {
    await setup(MANAGER, (g) => g.listTests.mockResolvedValue(page([labTest({ active: false })])));
    expect(text()).toContain('Retirée');
    await click(buttonNamed('Remettre Hémoglobine au catalogue'));
    expect(lab.setTestActive).toHaveBeenCalledWith('t-1', true);
  });

  it('affiche le refus du serveur en haut de page quand le retrait échoue', async () => {
    await setup(MANAGER, (g) => g.setTestActive.mockRejectedValue(new ApiError(404, 'LAB_TEST_NOT_FOUND', 'Analyse introuvable.')));
    await click(buttonNamed('Retirer Hémoglobine du catalogue'));
    expect(q('[role=alert]')?.textContent).toContain('introuvable');
  });

  it('demande les analyses retirées quand on le coche', async () => {
    await setup();
    const box = q<HTMLInputElement>('#lab-catalog-filter-inactive')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    box.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await submit('lab-catalog-filter');
    expect(lab.listTests).toHaveBeenLastCalledWith({ includeInactive: true }, 0, 25);
  });

  describe('valeurs de référence', () => {
    const cell = (i: number, f: string) => q<HTMLInputElement>(`#range-${i}-${f}`)!;

    it('édite les tranches existantes et les enregistre en jours, sexe et seuils compris', async () => {
      await setup();
      await click(buttonNamed('Modifier les valeurs de référence de Hémoglobine'));
      expect(q('aside h2')?.textContent).toContain('Valeurs de référence : Hémoglobine');
      expect(cell(0, 'ageMin').value).toBe('6574');
      expect(cell(0, 'low').value).toBe('11.5');
      await type('#range-0-low', '12,0');
      await type('#range-0-critHigh', '');
      await click(buttonNamed('Enregistrer les valeurs de référence'));
      expect(lab.setRanges).toHaveBeenCalledWith('t-1', [{ sex: 'FEMALE', ageMinDays: 6574, ageMaxDays: null, low: 12, high: 15.5, criticalLow: 7, criticalHigh: null }]);
      expect(toasts()).toEqual(['Valeurs de référence de Hémoglobine enregistrées.']);
      expect(q('aside')).toBeNull();
    });

    it('ajoute et retire des tranches', async () => {
      await setup();
      await click(buttonNamed('Modifier les valeurs de référence de Hémoglobine'));
      await click(buttonNamed('Ajouter une tranche'));
      expect(cell(1, 'ageMin').value).toBe('0');
      await choose('#range-1-sex', 'MALE');
      await type('#range-1-ageMax', '365');
      await type('#range-1-low', '10');
      await type('#range-1-high', '14');
      await click(buttonNamed('Retirer la tranche 1'));
      await click(buttonNamed('Enregistrer les valeurs de référence'));
      expect(lab.setRanges).toHaveBeenCalledWith('t-1', [{ sex: 'MALE', ageMinDays: 0, ageMaxDays: 365, low: 10, high: 14, criticalLow: null, criticalHigh: null }]);
    });

    it('refuse une tranche invalide sans rien envoyer : âge non entier, nombre invalide, aucune limite', async () => {
      await setup();
      await click(buttonNamed('Modifier les valeurs de référence de Hémoglobine'));
      await type('#range-0-ageMin', '1.5');
      await click(buttonNamed('Enregistrer les valeurs de référence'));
      expect(text()).toContain('Tranche 1 : saisissez des nombres valides');
      await type('#range-0-ageMin', '6574');
      await type('#range-0-low', 'abc');
      await click(buttonNamed('Enregistrer les valeurs de référence'));
      expect(text()).toContain('Tranche 1 : saisissez des nombres valides');
      await type('#range-0-low', '');
      await type('#range-0-high', '');
      await click(buttonNamed('Enregistrer les valeurs de référence'));
      expect(text()).toContain('Tranche 1 : saisissez des nombres valides');
      expect(lab.setRanges).not.toHaveBeenCalled();
    });

    it('enregistre un jeu vide de tranches, et affiche le refus du serveur', async () => {
      await setup(MANAGER, (g) => g.setRanges.mockRejectedValue(new ApiError(422, 'LAB_RANGE_INVALID', 'Valeurs de référence invalides : deux tranches du même sexe ne peuvent pas se chevaucher.')));
      await click(buttonNamed('Modifier les valeurs de référence de Hémoglobine'));
      await click(buttonNamed('Retirer la tranche 1'));
      expect(text()).toContain('Aucune tranche : les résultats ne recevront pas de position');
      await click(buttonNamed('Enregistrer les valeurs de référence'));
      expect(lab.setRanges).toHaveBeenCalledWith('t-1', []);
      expect(q('aside [role=alert]')?.textContent).toContain('se chevaucher');
    });

    it('annule sans rien envoyer', async () => {
      await setup();
      await click(buttonNamed('Modifier les valeurs de référence de Hémoglobine'));
      await click(buttonNamed('Annuler'));
      expect(q('aside')).toBeNull();
      expect(lab.setRanges).not.toHaveBeenCalled();
    });
  });
});

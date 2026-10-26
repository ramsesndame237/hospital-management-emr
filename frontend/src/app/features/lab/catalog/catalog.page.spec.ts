import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { FakeLabGateway, labTest, page } from '../../../core/lab/testing/fake-lab-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { LabCatalogPage } from './catalog.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('LabCatalogPage', () => {
  let fixture: ComponentFixture<LabCatalogPage>;
  let lab: FakeLabGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(prepare?: (g: FakeLabGateway) => void) {
    lab = new FakeLabGateway();
    prepare?.(lab);
    const { i18n } = configureApp({ roles: ['DOCTOR'], permissions: ['lab.catalog:read'], providers: [{ provide: LabGateway, useValue: lab }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(LabCatalogPage);
    await settle(fixture);
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les analyses avec leur section, leur échantillon, leur contenant et leur délai', async () => {
    await setup();
    expect(lab.listTests).toHaveBeenCalledWith({}, 0, 25);
    expect(q('h1')?.textContent).toContain('Catalogue des analyses');
    expect(text()).toContain('HGB');
    expect(text()).toContain('Hémoglobine');
    expect(text()).toContain('Hématologie');
    expect(text()).toContain('Sang total');
    expect(text()).toContain('Tube violet');
    expect(text()).toContain('120 min');
    expect(text()).toContain('Tube jaune');
  });

  it('déplie les valeurs de référence d\'une analyse numérique : sexe, âge, normales et seuils critiques', async () => {
    await setup();
    expect(text()).not.toContain('Valeurs de référence');
    await click(buttonNamed('Valeurs de référence de Hémoglobine'));
    expect(text()).toContain('Femmes, ≥ 18 ans : normal 11.5 – 15.5 g/dL');
    expect(text()).toContain('critique < 7.0 ou > 20.0');
    await click(buttonNamed('Valeurs de référence de Hémoglobine'));
    expect(text()).not.toContain('Femmes, ≥ 18 ans');
  });

  it('dit les âges en jours, mois ou années, et les tranches fermées', async () => {
    await setup((g) => g.listTests.mockResolvedValue(page([
      labTest({ ranges: [
        { sex: 'ANY', ageMinDays: 0, ageMaxDays: 28, low: 14, high: 22, criticalLow: null, criticalHigh: null },
        { sex: 'ANY', ageMinDays: 28, ageMaxDays: 365, low: 10, high: 14, criticalLow: null, criticalHigh: null },
        { sex: 'MALE', ageMinDays: 6574, ageMaxDays: null, low: 13, high: null, criticalLow: null, criticalHigh: 20 },
      ] }),
    ])));
    await click(buttonNamed('Valeurs de référence de Hémoglobine'));
    expect(text()).toContain('Tous, 0 j – 28 j : normal 14.0 – 22.0 g/dL');
    expect(text()).toContain('Tous, 28 j – 12 mois : normal 10.0 – 14.0 g/dL');
    expect(text()).toContain('Hommes, ≥ 18 ans : normal 13.0 – … g/dL');
    expect(text()).toContain('critique < … ou > 20.0');
  });

  it('montre les valeurs admises d\'une analyse à choix, le texte libre, les consignes et l\'absence de valeurs de référence', async () => {
    await setup((g) => g.listTests.mockResolvedValue(page([
      labTest({ id: 'c', code: 'MAL', name: 'Paludisme', resultType: 'CHOICE', unit: null, choices: ['Positif', 'Négatif'], ranges: [], instructions: 'Avant tout traitement' }),
      labTest({ id: 't', code: 'CULT', name: 'Culture', resultType: 'TEXT', unit: null, ranges: [] }),
      labTest({ id: 'n', code: 'NA', name: 'Sodium', ranges: [] }),
    ])));
    await click(buttonNamed('Valeurs de référence de Paludisme'));
    expect(text()).toContain('Valeurs admises : Positif, Négatif');
    expect(text()).toContain('Consignes : Avant tout traitement');
    await click(buttonNamed('Valeurs de référence de Culture'));
    expect(text()).toContain('Résultat en texte libre.');
    await click(buttonNamed('Valeurs de référence de Sodium'));
    expect(text()).toContain('Aucune valeur de référence.');
  });

  it('filtre par texte et par section, et revient à la première page', async () => {
    await setup();
    const input = q<HTMLInputElement>('#lab-catalog-filter-q')!;
    input.value = ' gly ';
    input.dispatchEvent(new Event('input'));
    const select = q<HTMLSelectElement>('#lab-catalog-filter-section')!;
    select.value = 'BIOCHEMISTRY';
    select.dispatchEvent(new Event('change'));
    q<HTMLFormElement>('#lab-catalog-filter')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(lab.listTests).toHaveBeenLastCalledWith({ search: 'gly', section: 'BIOCHEMISTRY' }, 0, 25);
  });

  it('pagine au-delà de 25 analyses', async () => {
    await setup((g) => g.listTests.mockResolvedValue(page([labTest()], { total: 80 })));
    expect(q('nav')?.textContent).toContain('1 à 25 sur 80');
    await click(buttonNamed('Suivant'));
    expect(lab.listTests).toHaveBeenLastCalledWith({}, 25, 25);
  });

  it('signale une liste vide et une erreur de chargement', async () => {
    await setup((g) => g.listTests.mockResolvedValue(page([])));
    expect(text()).toContain('Aucune analyse.');
  });

  it('signale une erreur de chargement', async () => {
    await setup((g) => g.listTests.mockRejectedValue(new ApiError(500, 'HTTP_500', 'Une erreur interne est survenue.')));
    expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
  });
});

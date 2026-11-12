import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { FakeReceptionGateway, page, summary } from '../../../core/reception/testing/fake-reception-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { PatientsPage } from './patients.page';

const RECEPTION = ['patients:read', 'patients:write'];

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('PatientsPage', () => {
  let fixture: ComponentFixture<PatientsPage>;
  let reception: FakeReceptionGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label);

  async function setup(options: { permissions?: readonly string[]; prepare?: (g: FakeReceptionGateway) => void } = {}) {
    reception = new FakeReceptionGateway();
    options.prepare?.(reception);
    const { i18n } = configureApp({ roles: ['RECEPTIONIST'], permissions: options.permissions ?? RECEPTION, providers: [{ provide: ReceptionGateway, useValue: reception }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(PatientsPage);
    await settle(fixture);
  }

  async function search(value: string) {
    const input = q<HTMLInputElement>('#patient-search-q')!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    q<HTMLFormElement>('#patient-search')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('n\'affiche aucun dossier avant la recherche : la liste complète n\'est jamais montrée', async () => {
    await setup();
    expect(reception.searchPatients).not.toHaveBeenCalled();
    expect(q('table')).toBeNull();
    expect(text()).toContain('Cherchez toujours avant d’ouvrir un dossier');
  });

  it('cherche avec les critères saisis et liste les dossiers trouvés', async () => {
    await setup({ prepare: (g) => g.searchPatients.mockResolvedValue(page([summary(), summary({ id: 'p-2', number: 'PAT-0000002', lastName: 'Ndongo', firstName: 'Paul', sex: 'MALE', ageYears: 41, birthDate: '1985-06-02' })])) });
    await search('mbarga');
    expect(reception.searchPatients).toHaveBeenCalledWith({ q: 'mbarga', birthDate: '', phone: '', identityNumber: '' }, 0, 20);
    expect(textOf(q('[data-test="PAT-0000001"]'))).toContain('Mbarga Élisabeth');
    expect(textOf(q('[data-test="PAT-0000001"]'))).toContain('1990-03-14');
    expect(textOf(q('[data-test="PAT-0000001"]'))).toContain('36 ans');
    expect(textOf(q('[data-test="PAT-0000001"]'))).toContain('Actif');
    expect(textOf(q('[data-test="PAT-0000002"]'))).toContain('Homme');
    expect(q('[data-test="PAT-0000001"] a')?.getAttribute('href')).toBe('/patients/p-1');
  });

  it('signale un dossier provisoire, un décès et une date estimée', async () => {
    await setup({ prepare: (g) => g.searchPatients.mockResolvedValue(page([summary({ identityStatus: 'PROVISIONAL', birthDateEstimated: true }), summary({ id: 'p-2', number: 'PAT-0000002', status: 'DECEASED' })])) });
    await search('x');
    expect(textOf(q('[data-test="PAT-0000001"]'))).toContain('Identité provisoire');
    expect(textOf(q('[data-test="PAT-0000001"]'))).toContain('date estimée');
    expect(textOf(q('[data-test="PAT-0000002"]'))).toContain('Décédé(e)');
  });

  it('propose d\'ouvrir un nouveau dossier quand rien ne correspond', async () => {
    await setup({ prepare: (g) => g.searchPatients.mockResolvedValue(page([])) });
    await search('inconnu');
    expect(text()).toContain('Aucun dossier ne correspond.');
    expect(q('table a[href="/patients/new"]')).not.toBeNull();
  });

  it('cache l\'ouverture de dossier à qui ne peut pas écrire', async () => {
    await setup({ permissions: ['patients:read'], prepare: (g) => g.searchPatients.mockResolvedValue(page([])) });
    expect(q('a[href="/patients/new"]')).toBeNull();
    await search('inconnu');
    expect(q('a[href="/patients/new"]')).toBeNull();
  });

  it('affiche le refus du serveur pour une recherche trop large', async () => {
    await setup({ prepare: (g) => g.searchPatients.mockRejectedValue(new ApiError(422, 'PATIENT_SEARCH_CRITERIA_REQUIRED', 'Indiquez au moins un critère de recherche.')) });
    await search('');
    expect(q('[role=alert]')?.textContent).toContain('au moins un critère');
    expect(q('table')).toBeNull();
  });

  it('pagine les résultats', async () => {
    await setup({ prepare: (g) => g.searchPatients.mockResolvedValue(page([summary()], { total: 45, limit: 20 })) });
    await search('mbarga');
    expect(text()).toContain('1 à 1 sur 45');
    expect(buttonNamed('Précédent')!.disabled).toBe(true);
    reception.searchPatients.mockResolvedValue(page([summary()], { total: 45, offset: 20 }));
    buttonNamed('Suivant')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(reception.searchPatients).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'mbarga' }), 20, 20);
    expect(text()).toContain('21 à 21 sur 45');
    expect(buttonNamed('Précédent')!.disabled).toBe(false);
  });
});

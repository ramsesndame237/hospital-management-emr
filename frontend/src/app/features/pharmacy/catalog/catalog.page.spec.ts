import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, drug, page } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { PharmacyCatalogPage } from './catalog.page';

const READ = ['pharmacy.catalog:read'];
const MANAGE = [...READ, 'pharmacy.catalog:manage', 'pharmacy.stock:read'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function spaced(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('PharmacyCatalogPage', () => {
  let fixture: ComponentFixture<PharmacyCatalogPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(permissions: readonly string[] = MANAGE, prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions, providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(PharmacyCatalogPage);
    await settle(fixture);
  }

  async function click(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  function type(selector: string, value: string) {
    const input = q<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function choose(selector: string, value: string) {
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

  it('liste les médicaments avec leur forme, leur classe, leur prix et leur seuil', async () => {
    await setup();
    expect(pharmacy.listDrugs).toHaveBeenCalledWith({}, 0, 25);
    const row = spaced(q('tr[data-test="PARA500"]'));
    expect(row).toContain('Doliprane 500');
    expect(row).toContain('Paracétamol');
    expect(row).toContain('500 mg');
    expect(row).toContain('N02BE01');
    expect(row).toContain('Comprimé');
    expect(row).toContain('Sur ordonnance');
    expect(row).toContain('Température ambiante');
    expect(row).toContain('par comprimé');
    expect(row).toContain('200');
    expect(row).toMatch(/25/);
  });

  it('ne montre aucune action de gestion à qui ne fait que consulter, ni le lien vers le stock sans le droit', async () => {
    await setup(READ);
    for (const label of ['Nouveau médicament', 'Modifier Doliprane 500', 'Retirer Doliprane 500 du formulaire']) expect(buttonNamed(label)).toBeUndefined();
    expect(q('#pharmacy-catalog-filter-inactive')).toBeNull();
    expect(q('tr[data-test="PARA500"] a')).toBeNull();
  });

  it('offre la gestion au pharmacien et le lien vers le stock du médicament', async () => {
    await setup();
    expect(buttonNamed('Nouveau médicament')).toBeDefined();
    expect(buttonNamed('Modifier Doliprane 500')).toBeDefined();
    expect(buttonNamed('Retirer Doliprane 500 du formulaire')).toBeDefined();
    expect(q('tr[data-test="PARA500"] a')?.getAttribute('href')).toBe('/pharmacy/drugs/d-1');
    expect(q('#pharmacy-catalog-filter-inactive')).not.toBeNull();
  });

  it('crée un médicament : code normalisé, prix converti en entier, champs facultatifs absents', async () => {
    await setup();
    await click(buttonNamed('Nouveau médicament'));
    expect(q('aside h2')?.textContent).toContain('Nouveau médicament');
    await submit('pharmacy-drug-new');
    expect(text()).toContain('Ce champ est obligatoire.');
    expect(pharmacy.createDrug).not.toHaveBeenCalled();
    type('#pharmacy-drug-new-code', 'ibu-400');
    type('#pharmacy-drug-new-name', ' Brufen 400 ');
    type('#pharmacy-drug-new-genericName', 'Ibuprofène');
    type('#pharmacy-drug-new-strength', '400 mg');
    type('#pharmacy-drug-new-unit', 'comprimé');
    choose('#pharmacy-drug-new-form', 'TABLET');
    choose('#pharmacy-drug-new-schedule', 'OTC');
    choose('#pharmacy-drug-new-storage', 'COOL');
    type('#pharmacy-drug-new-atcCode', 'm01ae01');
    type('#pharmacy-drug-new-price', '1 250');
    type('#pharmacy-drug-new-reorderLevel', '300');
    await submit('pharmacy-drug-new');
    expect(pharmacy.createDrug).toHaveBeenCalledWith({
      code: 'IBU-400', name: 'Brufen 400', genericName: 'Ibuprofène', strength: '400 mg', form: 'TABLET', schedule: 'OTC', storage: 'COOL', atcCode: 'M01AE01', unit: 'comprimé', unitPrice: 1250,
      reorderLevel: 300, notes: null,
    });
    expect(q('aside')).toBeNull();
    expect(pharmacy.listDrugs).toHaveBeenCalledTimes(2);
    expect(toasts()).toEqual(['Brufen 400 ajouté au formulaire.']);
  });

  it('refuse un prix décimal pour une devise sans décimales, et un code ATC mal formé', async () => {
    await setup();
    await click(buttonNamed('Nouveau médicament'));
    type('#pharmacy-drug-new-code', 'X1');
    type('#pharmacy-drug-new-name', 'X');
    type('#pharmacy-drug-new-genericName', 'X');
    type('#pharmacy-drug-new-unit', 'cp');
    type('#pharmacy-drug-new-price', '12,5');
    type('#pharmacy-drug-new-atcCode', 'N02');
    await submit('pharmacy-drug-new');
    expect(text()).toContain('Saisissez un montant valide');
    expect(text()).toContain('7 caractères (par exemple N02BE01), facultatif.');
    expect(pharmacy.createDrug).not.toHaveBeenCalled();
  });

  it('modifie un médicament : champs préremplis, code figé, ancien prix remplacé', async () => {
    await setup();
    await click(buttonNamed('Modifier Doliprane 500'));
    expect(q('aside h2')?.textContent).toContain('Modifier Doliprane 500');
    expect(q('#pharmacy-drug-d-1-code')).toBeNull();
    expect(q<HTMLInputElement>('#pharmacy-drug-d-1-name')!.value).toBe('Doliprane 500');
    expect(q<HTMLInputElement>('#pharmacy-drug-d-1-price')!.value).toBe('25');
    expect(q<HTMLInputElement>('#pharmacy-drug-d-1-strength')!.value).toBe('500 mg');
    type('#pharmacy-drug-d-1-price', '30');
    type('#pharmacy-drug-d-1-strength', '');
    await submit('pharmacy-drug-d-1');
    expect(pharmacy.updateDrug).toHaveBeenCalledWith('d-1', {
      name: 'Doliprane 500', genericName: 'Paracétamol', strength: null, form: 'TABLET', schedule: 'PRESCRIPTION', storage: 'ROOM', atcCode: 'N02BE01', unit: 'comprimé', unitPrice: 30, reorderLevel: 200, notes: null,
    });
    expect(toasts()).toEqual(['Doliprane 500 modifié.']);
  });

  it('affiche dans le panneau le refus du serveur (code déjà pris)', async () => {
    await setup(MANAGE, (g) => g.createDrug.mockRejectedValue(new ApiError(409, 'PHARMACY_DRUG_CODE_ALREADY_EXISTS', 'Un médicament utilise déjà ce code.')));
    await click(buttonNamed('Nouveau médicament'));
    type('#pharmacy-drug-new-code', 'PARA500');
    type('#pharmacy-drug-new-name', 'X');
    type('#pharmacy-drug-new-genericName', 'X');
    type('#pharmacy-drug-new-unit', 'cp');
    type('#pharmacy-drug-new-price', '0');
    await submit('pharmacy-drug-new');
    expect(q('aside [role=alert]')?.textContent).toContain('utilise déjà ce code');
    expect(q('aside')).not.toBeNull();
  });

  it('retire puis remet un médicament', async () => {
    await setup();
    await click(buttonNamed('Retirer Doliprane 500 du formulaire'));
    expect(pharmacy.setDrugActive).toHaveBeenCalledWith('d-1', false);
    expect(toasts()).toEqual(['Doliprane 500 retiré du formulaire.']);
    TestBed.resetTestingModule();
    await setup(MANAGE, (g) => g.listDrugs.mockResolvedValue({ ...page([drug({ active: false })]), currency: 'XAF' }));
    expect(spaced(q('tr[data-test="PARA500"]'))).toContain('Retiré');
    await click(buttonNamed('Remettre Doliprane 500 au formulaire'));
    expect(pharmacy.setDrugActive).toHaveBeenCalledWith('d-1', true);
  });

  it('transmet les filtres : texte, forme, classe, médicaments retirés', async () => {
    await setup();
    type('#pharmacy-catalog-filter-q', ' para ');
    choose('#pharmacy-catalog-filter-form', 'SYRUP');
    choose('#pharmacy-catalog-filter-schedule', 'OTC');
    const box = q<HTMLInputElement>('#pharmacy-catalog-filter-inactive')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    box.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await submit('pharmacy-catalog-filter');
    expect(pharmacy.listDrugs).toHaveBeenLastCalledWith({ search: 'para', form: 'SYRUP', schedule: 'OTC', includeInactive: true }, 0, 25);
  });

  it('dit qu\'aucun médicament ne correspond, et affiche le refus du serveur', async () => {
    await setup(MANAGE, (g) => g.listDrugs.mockResolvedValue({ ...page([]), currency: 'XAF' }));
    expect(text()).toContain('Aucun médicament ne correspond.');
    TestBed.resetTestingModule();
    await setup(MANAGE, (g) => g.listDrugs.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')));
    expect(q('[role=alert]')?.textContent).toBeTruthy();
  });
});

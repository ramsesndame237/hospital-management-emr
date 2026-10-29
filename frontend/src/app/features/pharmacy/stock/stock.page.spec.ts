import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, page, stockRow, summary } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { PharmacyStockPage } from './stock.page';

const READ = ['pharmacy.stock:read'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Texte d'un élément avec une espace entre ses blocs (les blocs CSS n'en mettent pas dans `textContent`). */
function spaced(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('PharmacyStockPage', () => {
  let fixture: ComponentFixture<PharmacyStockPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');

  async function setup(permissions: readonly string[] = READ, prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions, providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(PharmacyStockPage);
    await settle(fixture);
  }

  async function click(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const tick = (selector: string) => {
    const box = q<HTMLInputElement>(selector)!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    box.dispatchEvent(new Event('click'));
    fixture.detectChanges();
  };

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('affiche les compteurs, la valeur du stock et les médicaments avec les ruptures en tête', async () => {
    await setup();
    expect(q('h1')?.textContent).toContain('Stock de la pharmacie');
    expect(spaced(q('[data-test="tile-out"]')!)).toBe('En rupture 4');
    expect(spaced(q('[data-test="tile-low"]')!)).toBe('Stock bas 9');
    expect(spaced(q('[data-test="tile-expiring"]')!)).toContain('Péremption sous 90 jours');
    expect(spaced(q('[data-test="tile-expired"]')!)).toBe('Périmés en rayon 1');
    expect(spaced(q('[data-test="tile-quarantinedBatches"]')!)).toBe('Lots en quarantaine 2');
    expect(spaced(q('[data-test="tile-pendingAdjustments"]')!)).toBe('Ajustements à décider 3');
    expect(spaced(q('[data-test="tile-value"]')!)).toMatch(/1\s250\s000/);
    expect([...root().querySelectorAll('tbody tr')].map((tr) => tr.getAttribute('data-test'))).toEqual(['AMOX500', 'PARA500']);
    expect(spaced(q('tr[data-test="AMOX500"]')!)).toContain('Rupture');
    expect(spaced(q('tr[data-test="PARA500"]')!)).toContain('Stock correct');
  });

  it('dit ce qui est à surveiller sur un médicament : périmé, en quarantaine, bientôt périmé', async () => {
    await setup(READ, (g) => g.listStock.mockResolvedValue({ ...page([stockRow({ expired: 5, quarantined: 20, expiringSoon: 30, level: 'LOW' })]), expiryAlertDays: 90, currency: 'XAF' }));
    const row = spaced(q('tr[data-test="PARA500"]')!);
    expect(row).toContain('5 périmé(s) en rayon');
    expect(row).toContain('20 en quarantaine');
    expect(row).toContain('30 bientôt périmé(s)');
    expect(row).toContain('Stock bas');
    expect(row).toContain('2027-03-31');
  });

  it('un compteur filtre la liste, un second clic enlève le filtre', async () => {
    await setup();
    await click(q('[data-test="tile-out"]')!);
    expect(pharmacy.listStock).toHaveBeenLastCalledWith({ level: 'OUT' }, 0, 25);
    expect(text()).toContain('Filtre actif : ruptures.');
    await click(q('[data-test="tile-out"]')!);
    expect(pharmacy.listStock).toHaveBeenLastCalledWith({}, 0, 25);
    expect(text()).not.toContain('Filtre actif');
    await click(q('[data-test="tile-expiring"]')!);
    expect(pharmacy.listStock).toHaveBeenLastCalledWith({ expiring: true }, 0, 25);
    expect(text()).toContain('Filtre actif : péremption sous 90 jours.');
    await click(q('[data-test="tile-expired"]')!);
    expect(pharmacy.listStock).toHaveBeenLastCalledWith({ hasExpired: true }, 0, 25);
  });

  it('les compteurs de quarantaine et d\'ajustements ouvrent leur écran', async () => {
    await setup();
    expect(q('a[data-test="tile-quarantinedBatches"]')?.getAttribute('href')).toBe('/pharmacy/expiry?quarantined=1');
    expect(q('a[data-test="tile-pendingAdjustments"]')?.getAttribute('href')).toBe('/pharmacy/adjustments');
  });

  it('transmet le texte, le niveau et les cases du formulaire de filtre', async () => {
    await setup();
    await type('#pharmacy-stock-filter-q', ' para ');
    const level = q<HTMLSelectElement>('#pharmacy-stock-filter-level')!;
    level.value = 'LOW';
    level.dispatchEvent(new Event('change'));
    tick('#pharmacy-stock-filter-expiring');
    tick('#pharmacy-stock-filter-inactive');
    await submit('pharmacy-stock-filter');
    expect(pharmacy.listStock).toHaveBeenLastCalledWith({ search: 'para', level: 'LOW', expiring: true, includeInactive: true }, 0, 25);
  });

  it('ouvre la fiche du médicament, et ne propose la réception qu\'à qui peut recevoir', async () => {
    await setup();
    expect(q('tr[data-test="PARA500"] a')?.getAttribute('href')).toBe('/pharmacy/drugs/d-1');
    expect(q('a[href="/pharmacy/receipts/new"]')).toBeNull();
    TestBed.resetTestingModule();
    await setup([...READ, 'pharmacy.stock:receive']);
    expect(q('a[href="/pharmacy/receipts/new"]')?.textContent).toContain('Nouvelle réception');
  });

  it('pagine quand la liste dépasse une page', async () => {
    await setup(READ, (g) => g.listStock.mockResolvedValue({ ...page([stockRow()], { total: 60 }), expiryAlertDays: 90, currency: 'XAF' }));
    expect(text()).toContain('1 – 25 sur 60');
    const next = [...root().querySelectorAll<HTMLButtonElement>('nav button')].find((b) => b.textContent?.trim() === 'Suivant')!;
    await click(next);
    expect(pharmacy.listStock).toHaveBeenLastCalledWith({}, 25, 25);
  });

  it('affiche le refus du serveur', async () => {
    await setup(READ, (g) => g.listStock.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')));
    expect(q('[role=alert]')?.textContent).toBeTruthy();
  });
});

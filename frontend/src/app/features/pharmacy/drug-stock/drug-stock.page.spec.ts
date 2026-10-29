import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, batch, drugStock, movement, page, pharmacist } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { DrugStockPage } from './drug-stock.page';

const READ = ['pharmacy.stock:read'];
const ALL = [...READ, 'pharmacy.stock:quarantine', 'pharmacy.stock:adjust'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Texte d'un élément avec une espace entre ses blocs (les blocs CSS n'en mettent pas dans `textContent`). */
function spaced(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('DrugStockPage', () => {
  let fixture: ComponentFixture<DrugStockPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(permissions: readonly string[] = ALL, prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions, providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(DrugStockPage);
    fixture.componentRef.setInput('id', 'd-1');
    await settle(fixture);
  }

  async function click(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
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

  it('affiche le médicament, ses totaux, ses lots et son grand livre', async () => {
    await setup();
    expect(pharmacy.getDrugStock).toHaveBeenCalledWith('d-1');
    expect(pharmacy.listMovements).toHaveBeenCalledWith({ drugId: 'd-1' }, 0, 10);
    expect(q('h1')?.textContent).toContain('Doliprane 500');
    expect(text()).toContain('Paracétamol · 500 mg · Comprimé · PARA500');
    expect(spaced(q('[data-test="total-dispensable"]')!)).toBe('Délivrable 340 comprimé');
    expect(spaced(q('[data-test="total-value"]')!)).toMatch(/3\s400/);
    const lot = spaced(q('tr[data-test="B2026-114"]')!);
    expect(lot).toContain('2027-03-31');
    expect(lot).toContain('Dans 150 jours');
    expect(lot).toContain('340');
    expect(lot).toContain('Délivrable');
    expect(text()).toContain('Réception');
    expect(text()).toContain('GRN-0000001');
    expect(text()).toContain('+340');
  });

  it('dit l\'état de chaque lot : périmé, bientôt périmé, quarantaine, épuisé', async () => {
    await setup(ALL, (g) =>
      g.getDrugStock.mockResolvedValue(drugStock({
        batches: [
          batch({ id: 'b-1', batchNumber: 'OLD', expired: true, daysToExpiry: -3, dispensable: false }),
          batch({ id: 'b-2', batchNumber: 'SOON', expiringSoon: true, daysToExpiry: 12 }),
          batch({ id: 'b-3', batchNumber: 'HELD', status: 'QUARANTINED', dispensable: false, quarantineReason: 'Rappel du fabricant', quarantinedBy: pharmacist }),
          batch({ id: 'b-4', batchNumber: 'NONE', quantity: 0, dispensable: false }),
        ],
      })),
    );
    expect(spaced(q('tr[data-test="OLD"]')!)).toContain('Périmé');
    expect(spaced(q('tr[data-test="OLD"]')!)).toContain('Périmé depuis 3 jour(s)');
    expect(spaced(q('tr[data-test="SOON"]')!)).toContain('Bientôt périmé');
    expect(spaced(q('tr[data-test="SOON"]')!)).toContain('Dans 12 jours');
    expect(spaced(q('tr[data-test="HELD"]')!)).toContain('Quarantaine');
    expect(spaced(q('tr[data-test="HELD"]')!)).toContain('Motif : Rappel du fabricant (pharmacien)');
    expect(spaced(q('tr[data-test="NONE"]')!)).toContain('Épuisé');
  });

  it('ne propose aucune action sans les droits', async () => {
    await setup(READ);
    for (const label of ['Mettre le lot B2026-114 en quarantaine', 'Demander un ajout de stock sur le lot B2026-114', 'Demander un retrait de stock sur le lot B2026-114']) expect(buttonNamed(label)).toBeUndefined();
  });

  it('met un lot en quarantaine avec un motif obligatoire', async () => {
    await setup();
    await click(buttonNamed('Mettre le lot B2026-114 en quarantaine'));
    expect(q('aside h2')?.textContent).toContain('Mettre un lot en quarantaine');
    expect(q('aside')?.textContent).toContain('Lot B2026-114 · péremption 2027-03-31 · 340 en stock');
    await submit('drug-panel-quarantine');
    expect(text()).toContain('Le motif est obligatoire.');
    expect(pharmacy.quarantine).not.toHaveBeenCalled();
    type('#drug-panel-quarantine-reason', ' Rappel de lot ');
    await submit('drug-panel-quarantine');
    expect(pharmacy.quarantine).toHaveBeenCalledWith('b-1', 'Rappel de lot');
    expect(toasts()).toEqual(['Lot B2026-114 mis en quarantaine.']);
    expect(q('aside')).toBeNull();
    expect(pharmacy.getDrugStock).toHaveBeenCalledTimes(2);
  });

  it('libère un lot en quarantaine', async () => {
    await setup(ALL, (g) => g.getDrugStock.mockResolvedValue(drugStock({ batches: [batch({ status: 'QUARANTINED', dispensable: false, quarantineReason: 'Rappel', quarantinedBy: pharmacist })] })));
    expect(buttonNamed('Mettre le lot B2026-114 en quarantaine')).toBeUndefined();
    await click(buttonNamed('Libérer le lot B2026-114'));
    expect(pharmacy.release).toHaveBeenCalledWith('b-1');
    expect(toasts()).toEqual(['Lot B2026-114 libéré : il est de nouveau délivrable.']);
  });

  it('demande un retrait : motifs de sortie seulement, quantité bornée par le lot, et rien ne change avant approbation', async () => {
    await setup();
    await click(buttonNamed('Demander un retrait de stock sur le lot B2026-114'));
    expect(q('aside h2')?.textContent).toContain('Demander un retrait de stock');
    expect(q('aside')?.textContent).toContain('Un autre pharmacien doit approuver');
    const reasons = [...q<HTMLSelectElement>('#drug-panel-adjust-reason')!.options].map((o) => o.value).filter((v) => v !== '');
    expect(reasons).toEqual(['COUNT_CORRECTION', 'DAMAGED', 'EXPIRED', 'LOST', 'OTHER']);
    type('#drug-panel-adjust-quantity', '341');
    choose('#drug-panel-adjust-reason', 'DAMAGED');
    await submit('drug-panel-adjust');
    expect(text()).toContain('Le lot ne contient pas autant d’unités.');
    expect(pharmacy.requestAdjustment).not.toHaveBeenCalled();
    type('#drug-panel-adjust-quantity', '4');
    type('#drug-panel-adjust-note', ' Flacons tombés ');
    await submit('drug-panel-adjust');
    expect(pharmacy.requestAdjustment).toHaveBeenCalledWith({ batchId: 'b-1', direction: 'OUT', quantity: 4, reason: 'DAMAGED', note: 'Flacons tombés' });
    expect(toasts()).toEqual(['Demande ADJ-0000001 envoyée : un autre pharmacien doit l’approuver.']);
    expect(q('aside')).toBeNull();
  });

  it('demande un ajout : motifs d\'entrée seulement', async () => {
    await setup();
    await click(buttonNamed('Demander un ajout de stock sur le lot B2026-114'));
    const reasons = [...q<HTMLSelectElement>('#drug-panel-adjust-reason')!.options].map((o) => o.value).filter((v) => v !== '');
    expect(reasons).toEqual(['COUNT_CORRECTION', 'FOUND', 'OTHER']);
    type('#drug-panel-adjust-quantity', '3');
    choose('#drug-panel-adjust-reason', 'FOUND');
    await submit('drug-panel-adjust');
    expect(pharmacy.requestAdjustment).toHaveBeenCalledWith({ batchId: 'b-1', direction: 'IN', quantity: 3, reason: 'FOUND' });
  });

  it('affiche dans le panneau le refus du serveur (une demande est déjà en attente sur le lot)', async () => {
    await setup(ALL, (g) => g.requestAdjustment.mockRejectedValue(new ApiError(409, 'PHARMACY_ADJUSTMENT_PENDING_EXISTS', 'Une demande est déjà en attente.')));
    await click(buttonNamed('Demander un retrait de stock sur le lot B2026-114'));
    type('#drug-panel-adjust-quantity', '1');
    choose('#drug-panel-adjust-reason', 'LOST');
    await submit('drug-panel-adjust');
    expect(q('aside [role=alert]')?.textContent).toContain('déjà en attente');
    expect(q('aside')).not.toBeNull();
  });

  it('pagine le grand livre', async () => {
    await setup(ALL, (g) => g.listMovements.mockResolvedValue(page([movement()], { total: 25 })));
    expect(text()).toContain('1 – 10 sur 25');
    const next = [...root().querySelectorAll<HTMLButtonElement>('nav button')].find((b) => b.textContent?.trim() === 'Suivant')!;
    await click(next);
    expect(pharmacy.listMovements).toHaveBeenLastCalledWith({ drugId: 'd-1' }, 10, 10);
  });

  it('signale un médicament introuvable', async () => {
    await setup(ALL, (g) => g.getDrugStock.mockRejectedValue(new ApiError(404, 'PHARMACY_DRUG_NOT_FOUND', 'Médicament introuvable.')));
    expect(q('[role=alert]')?.textContent).toContain('introuvable');
    expect(q('h1')).toBeNull();
  });
});

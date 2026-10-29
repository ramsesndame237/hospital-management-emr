import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { FakeLabGateway, page, summary } from '../../../core/lab/testing/fake-lab-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { WorklistPage } from './worklist.page';

const BENCH = ['lab.requisitions:read:all', 'lab.specimens:collect'];
const PRESCRIBER = ['lab.requisitions:read:own'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('WorklistPage', () => {
  let fixture: ComponentFixture<WorklistPage>;
  let gateway: FakeLabGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');

  async function setup(permissions: readonly string[], prepare?: (g: FakeLabGateway) => void) {
    gateway = new FakeLabGateway();
    prepare?.(gateway);
    const { i18n } = configureApp({ roles: ['LAB_TECHNICIAN'], permissions, providers: [{ provide: LabGateway, useValue: gateway }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(WorklistPage);
    await settle(fixture);
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.textContent ?? '').trim() === label)!;

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les demandes avec leur priorité, leur patient, leurs analyses, leur statut et le temps écoulé', async () => {
    await setup(BENCH);
    expect(gateway.listRequisitions).toHaveBeenCalledWith({}, 0, 25);
    expect(text()).toContain('LAB-0000124');
    expect(text()).toContain('STAT');
    expect(text()).toContain('Urgences');
    expect(text()).toContain('Mbarga Élisabeth');
    expect(text()).toContain('PAT-0000001');
    expect(text()).toContain('HGB');
    expect(text()).toContain('À prélever');
    // L'horloge de test est à 12 h ; la demande a été faite à 8 h.
    expect(text()).toContain('depuis 4 h 0 min');
    expect(q('a[href="/lab/requisitions/r-2"]')).not.toBeNull();
  });

  it('ne donne pas de temps écoulé à une demande terminée', async () => {
    await setup(BENCH, (g) => g.listRequisitions.mockResolvedValue(page([summary({ status: 'RECEIVED' }), summary({ id: 'r-9', number: 'LAB-0000009', status: 'CANCELLED' })])));
    expect(text()).not.toContain('depuis');
    expect(text()).toContain('Reçue au laboratoire');
    expect(text()).toContain('Annulée');
  });

  it('filtre par statut, priorité, section et numéro, et revient à la première page', async () => {
    await setup(BENCH);
    for (const [id, value] of [['status', 'ORDERED'], ['priority', 'STAT'], ['section', 'BIOCHEMISTRY']] as const) {
      const select = q<HTMLSelectElement>(`#worklist-filter-${id}`)!;
      select.value = value;
      select.dispatchEvent(new Event('change'));
    }
    await type('#worklist-filter-number', 'lab-0000124');
    await submit('worklist-filter');
    expect(gateway.listRequisitions).toHaveBeenLastCalledWith({ status: 'ORDERED', priority: 'STAT', section: 'BIOCHEMISTRY', number: 'LAB-0000124' }, 0, 25);
  });

  it('pagine au-delà de 25 demandes', async () => {
    await setup(BENCH, (g) => g.listRequisitions.mockResolvedValue(page([summary()], { total: 60 })));
    expect(q('nav')?.textContent).toContain('1 à 25 sur 60');
    buttonNamed('Suivant').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(gateway.listRequisitions).toHaveBeenLastCalledWith({}, 25, 25);
  });

  it('signale une liste vide et une erreur de chargement', async () => {
    await setup(BENCH, (g) => g.listRequisitions.mockResolvedValue(page([])));
    expect(text()).toContain('Aucune demande.');
  });

  it('signale une erreur de chargement', async () => {
    await setup(BENCH, (g) => g.listRequisitions.mockRejectedValue(new ApiError(500, 'HTTP_500', 'Une erreur interne est survenue.')));
    expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
  });

  it('offre le scan d\'un échantillon au laboratoire seulement, et ouvre la demande qui le porte', async () => {
    await setup(BENCH);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await type('#worklist-scan-barcode', 'spc-0000001');
    await submit('worklist-scan');
    expect(gateway.findByBarcode).toHaveBeenCalledWith('SPC-0000001');
    expect(navigate).toHaveBeenCalledWith(['/lab/requisitions', 'r-1'], { queryParams: { specimen: 's-1' } });
  });

  it('explique qu\'aucun échantillon ne porte le code-barres scanné', async () => {
    await setup(BENCH, (g) => g.findByBarcode.mockRejectedValue(new ApiError(404, 'LAB_SPECIMEN_NOT_FOUND', 'Échantillon introuvable.')));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await type('#worklist-scan-barcode', 'SPC-0000999');
    await submit('worklist-scan');
    expect(q('#worklist-scan [role=alert]')?.textContent).toContain('Échantillon introuvable.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('un prescripteur voit ses demandes, sans champ de scan', async () => {
    await setup(PRESCRIBER);
    expect(q('#worklist-scan')).toBeNull();
    expect(text()).toContain('Vos demandes d’analyses');
  });
});

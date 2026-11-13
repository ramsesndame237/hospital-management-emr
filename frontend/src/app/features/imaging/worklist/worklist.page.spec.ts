import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import { FakeImagingGateway, page, summary } from '../../../core/imaging/testing/fake-imaging-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ImagingWorklistPage } from './worklist.page';

const SERVICE = ['imaging.orders:read:all', 'imaging.orders:schedule'];
const PRESCRIBER = ['imaging.orders:read:own'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('ImagingWorklistPage', () => {
  let fixture: ComponentFixture<ImagingWorklistPage>;
  let gateway: FakeImagingGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');

  async function setup(permissions: readonly string[], prepare?: (g: FakeImagingGateway) => void) {
    gateway = new FakeImagingGateway();
    prepare?.(gateway);
    const { i18n } = configureApp({ roles: ['RADIOLOGIST'], permissions, providers: [{ provide: ImagingGateway, useValue: gateway }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ImagingWorklistPage);
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

  it('liste les demandes avec leur priorité, leur patient, leur examen, leur statut et le temps écoulé', async () => {
    await setup(SERVICE);
    expect(gateway.listOrders).toHaveBeenCalledWith({}, 0, 25);
    const row = norm(q('[data-test="IMG-0000124"]')?.textContent ?? '');
    expect(row).toContain('STAT');
    expect(row).toContain('Urgences');
    expect(row).toContain('Mbarga Élisabeth');
    expect(row).toContain('PAT-0000001');
    expect(row).toContain('RX-THORAX');
    expect(row).toContain('Radiographie');
    expect(row).toContain('Demandé');
    // L'horloge de test est à 12 h ; la demande a été faite à 8 h.
    expect(row).toContain('Il y a 4 h 0 min');
    expect(q('a[href="/imaging/orders/o-2"]')).not.toBeNull();
  });

  it('un examen planifié montre son créneau, un compte rendu signé ou une demande annulée aucun temps écoulé', async () => {
    await setup(SERVICE, (g) => g.listOrders.mockResolvedValue(page([
      summary({ status: 'SCHEDULED', scheduledFor: '2026-11-03T09:30:00Z' }),
      summary({ id: 'o-8', number: 'IMG-0000008', status: 'REPORTED' }),
      summary({ id: 'o-9', number: 'IMG-0000009', status: 'CANCELLED' }),
    ])));
    expect(norm(q('[data-test="IMG-0000123"]')?.textContent ?? '')).toContain('Prévu le');
    expect(norm(q('[data-test="IMG-0000123"]')?.textContent ?? '')).not.toContain('Il y a');
    expect(norm(q('[data-test="IMG-0000008"]')?.textContent ?? '')).not.toContain('Il y a');
    expect(text()).toContain('Compte rendu signé');
    expect(text()).toContain('Annulé');
  });

  it('signale une découverte critique d\'un compte rendu signé', async () => {
    await setup(SERVICE, (g) => g.listOrders.mockResolvedValue(page([summary({ status: 'REPORTED', critical: true })])));
    expect(norm(q('[data-test="IMG-0000123"]')?.textContent ?? '')).toContain('Découverte critique');
  });

  it('filtre par statut, priorité, modalité et numéro, et revient à la première page', async () => {
    await setup(SERVICE);
    for (const [id, value] of [['status', 'ORDERED'], ['priority', 'STAT'], ['modality', 'CT']] as const) {
      const select = q<HTMLSelectElement>(`#imaging-worklist-filter-${id}`)!;
      select.value = value;
      select.dispatchEvent(new Event('change'));
    }
    await type('#imaging-worklist-filter-number', 'img-0000124');
    await submit('imaging-worklist-filter');
    expect(gateway.listOrders).toHaveBeenLastCalledWith({ status: 'ORDERED', priority: 'STAT', modality: 'CT', number: 'IMG-0000124' }, 0, 25);
  });

  it('pagine au-delà de 25 demandes', async () => {
    await setup(SERVICE, (g) => g.listOrders.mockResolvedValue(page([summary()], { total: 60 })));
    expect(q('nav')?.textContent).toContain('1 à 25 sur 60');
    buttonNamed('Suivant').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(gateway.listOrders).toHaveBeenLastCalledWith({}, 25, 25);
  });

  it('signale une liste vide', async () => {
    await setup(SERVICE, (g) => g.listOrders.mockResolvedValue(page([])));
    expect(text()).toContain('Aucune demande d’examen.');
  });

  it('signale une erreur de chargement', async () => {
    await setup(SERVICE, (g) => g.listOrders.mockRejectedValue(new ApiError(500, 'HTTP_500', 'Une erreur interne est survenue.')));
    expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
  });

  it('un prescripteur voit ses demandes, avec la phrase qui lui est destinée', async () => {
    await setup(PRESCRIBER);
    expect(text()).toContain('Les examens que vous avez demandés');
  });

  it('le service d\'imagerie voit toutes les demandes', async () => {
    await setup(SERVICE);
    expect(text()).toContain('Toutes les demandes d’examens');
  });
});

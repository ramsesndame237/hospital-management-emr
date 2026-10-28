import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { FakeLabGateway, orderedTest, requisition, result, specimen, technician, version } from '../../../core/lab/testing/fake-lab-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { RequisitionDetailPage } from './requisition-detail.page';

const BENCH = ['lab.requisitions:read:all', 'lab.results:enter', 'lab.results:verify', 'lab.results:release', 'lab.results:amend', 'lab.results:notify'];
const OTHER = { id: 'u-lab2', username: 'labo2' };

/** Demande de deux analyses dont les échantillons sont reçus, avec les résultats donnés. */
const two = (a: ReturnType<typeof result> | null, b: ReturnType<typeof result> | null) =>
  requisition({
    status: 'RESULTED',
    specimens: [specimen({ status: 'RECEIVED', collectedBy: technician, collectedAt: '2026-10-24T08:30:00Z', receivedBy: technician, receivedAt: '2026-10-24T09:00:00Z' })],
    tests: [orderedTest({ result: a }), orderedTest({ testId: 't-2', code: 'GLU', name: 'Glycémie', result: b })],
  });

describe('RequisitionDetailPage : lots et rapport', () => {
  let fixture: ComponentFixture<RequisitionDetailPage>;
  let lab: FakeLabGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(loaded: ReturnType<typeof requisition>, userId = OTHER.id, permissions: readonly string[] = BENCH) {
    lab = new FakeLabGateway();
    lab.getRequisition.mockResolvedValue(loaded);
    const { i18n } = configureApp({ roles: ['LAB_TECHNICIAN'], permissions, profile: { id: userId }, providers: [{ provide: LabGateway, useValue: lab }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(RequisitionDetailPage);
    fixture.componentRef.setInput('id', 'r-1');
    await settle(fixture);
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => t.message);

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('propose « Tout valider » quand un résultat saisi par un autre attend, et l\'envoie', async () => {
    await setup(two(result(), result()));
    await click(buttonNamed('Tout valider'));
    expect(lab.verifyAll).toHaveBeenCalledWith('r-1');
    expect(toasts()).toEqual(['2 résultat(s) validé(s).']);
  });

  it('dit ce qui a été écarté, avec la raison', async () => {
    await setup(two(result(), result()));
    lab.verifyAll.mockResolvedValue({ requisition: two(result(), result()), processed: 1, skipped: [{ code: 'GLU', reason: 'LAB_VERIFY_SELF' }] });
    await click(buttonNamed('Tout valider'));
    expect(toasts()).toEqual(['1 résultat(s) validé(s).', 'Écartés : GLU (saisi par vous).']);
  });

  it('dit qu\'il n\'y avait rien à traiter', async () => {
    await setup(two(result(), result()));
    lab.verifyAll.mockResolvedValue({ requisition: two(result(), result()), processed: 0, skipped: [] });
    await click(buttonNamed('Tout valider'));
    expect(toasts()).toEqual(['Aucun résultat à traiter par vous.']);
  });

  it('ne propose pas « Tout valider » à l\'auteur de tous les résultats', async () => {
    await setup(two(result(), result()), technician.id);
    expect(buttonNamed('Tout valider')).toBeUndefined();
  });

  it('propose « Tout publier » pour des résultats validés par un autre, et l\'envoie', async () => {
    const verified = () => result({ status: 'VERIFIED', verifiedBy: OTHER, verifiedAt: '2026-10-24T10:10:00Z' });
    await setup(two(verified(), verified()));
    expect(buttonNamed('Tout valider')).toBeUndefined();
    await click(buttonNamed('Tout publier'));
    expect(lab.releaseAll).toHaveBeenCalledWith('r-1');
    expect(toasts()).toEqual(['2 résultat(s) publié(s).']);
  });

  it('explique qu\'une valeur critique sans appel est écartée de la publication', async () => {
    const verified = () => result({ status: 'VERIFIED', verifiedBy: OTHER, criticalRequired: true, versions: [version({ flag: 'CRITICAL_LOW' })] });
    await setup(two(verified(), verified()));
    lab.releaseAll.mockResolvedValue({ requisition: two(verified(), verified()), processed: 0, skipped: [{ code: 'HGB', reason: 'LAB_CRITICAL_NOT_NOTIFIED' }] });
    await click(buttonNamed('Tout publier'));
    expect(toasts()).toEqual(['Aucun résultat à traiter par vous.', 'Écartés : HGB (appel du clinicien à documenter).']);
  });

  it('affiche le refus du serveur en haut de page', async () => {
    await setup(two(result(), result()));
    lab.verifyAll.mockRejectedValue(new ApiError(404, 'LAB_REQUISITION_NOT_FOUND', 'Demande d’analyses introuvable.'));
    await click(buttonNamed('Tout valider'));
    expect(q('[role=alert]')?.textContent).toContain('introuvable');
  });

  it('ne propose aucune action en lot sans les droits, ni sur une demande annulée', async () => {
    await setup(two(result(), result()), OTHER.id, ['lab.requisitions:read:own']);
    expect(buttonNamed('Tout valider')).toBeUndefined();
    expect(buttonNamed('Tout publier')).toBeUndefined();
  });

  it('ne donne pas accès au rapport tant que rien n\'est publié', async () => {
    await setup(two(result(), result()));
    expect(q('a[href="/lab/requisitions/r-1/report"]')).toBeNull();
  });

  it('donne accès au rapport dès qu\'un résultat est publié', async () => {
    await setup(two(result({ status: 'RELEASED', releasedVersion: 1, releasedBy: OTHER, releasedAt: '2026-10-24T10:20:00Z' }), result()));
    expect(q('a[href="/lab/requisitions/r-1/report"]')?.textContent).toContain('Rapport');
  });
});

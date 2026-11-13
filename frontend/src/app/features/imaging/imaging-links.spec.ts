import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClinicalGateway } from '../../core/clinical/clinical.gateway';
import { FakeClinicalGateway } from '../../core/clinical/testing/fake-clinical-gateway';
import { ApiError } from '../../core/http/api-error';
import { ImagingGateway } from '../../core/imaging/imaging.gateway';
import { FakeImagingGateway, page, summary } from '../../core/imaging/testing/fake-imaging-gateway';
import { LabGateway } from '../../core/lab/lab.gateway';
import { FakeLabGateway } from '../../core/lab/testing/fake-lab-gateway';
import { NAVIGATION, visibleNavigation } from '../../core/navigation/navigation';
import { configureApp, settle, watchMissingKeys } from '../../testing/app-testing';
import { EncounterPage } from '../clinical/encounter/encounter.page';
import { ResultsPage } from '../lab/results/results.page';

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('liens de l\'imagerie avec la consultation et les résultats', () => {
  let missingKeys: () => string[];
  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('imagerie de la consultation (espace de consultation)', () => {
    let fixture: ComponentFixture<EncounterPage>;
    let imaging: FakeImagingGateway;
    const root = () => fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

    async function setup(permissions: readonly string[], arrange?: (g: FakeImagingGateway) => void) {
      imaging = new FakeImagingGateway();
      arrange?.(imaging);
      const { i18n } = configureApp({
        roles: ['DOCTOR'], permissions: ['clinical.encounters:read:department', ...permissions], profile: { id: 'u-doc' },
        providers: [{ provide: ClinicalGateway, useValue: new FakeClinicalGateway() }, { provide: ImagingGateway, useValue: imaging }, { provide: LabGateway, useValue: new FakeLabGateway() }],
      });
      missingKeys = watchMissingKeys(i18n);
      fixture = TestBed.createComponent(EncounterPage);
      fixture.componentRef.setInput('id', 'e-1');
      await settle(fixture);
    }

    it('liste les examens de la consultation avec leur avancement, et offre d\'en demander d\'autres avec le patient et la consultation déjà renseignés', async () => {
      await setup(['imaging.orders:read:own', 'imaging.orders:order'], (g) => g.listOrders.mockResolvedValue(page([summary({ priority: 'URGENT', status: 'SCHEDULED' })])));
      expect(imaging.listOrders).toHaveBeenCalledWith({ encounterId: 'e-1' }, 0, 50);
      const row = textOf(q('[data-test="IMG-0000123"]'));
      expect(row).toContain('Planifié');
      expect(row).toContain('Urgent');
      expect(row).toContain('Radiographie du thorax de face');
      expect(q('[data-test="IMG-0000123"] a')?.getAttribute('href')).toBe('/imaging/orders/o-1');
      const link = q<HTMLAnchorElement>('a[href^="/imaging/orders/new"]')!;
      expect(link.getAttribute('href')).toContain('patientNumber=PAT-0000001');
      expect(link.getAttribute('href')).toContain('encounterId=e-1');
    });

    it('signale une découverte critique d\'un compte rendu signé', async () => {
      await setup(['imaging.orders:read:own'], (g) => g.listOrders.mockResolvedValue(page([summary({ status: 'REPORTED', critical: true })])));
      expect(textOf(q('[data-test="IMG-0000123"]'))).toContain('Découverte critique');
    });

    it('dit qu\'aucun examen n\'a été demandé', async () => {
      await setup(['imaging.orders:read:own', 'imaging.orders:order'], (g) => g.listOrders.mockResolvedValue(page([])));
      expect(textOf(root())).toContain('Aucun examen demandé pendant cette consultation.');
    });

    it('n\'offre pas de demander sans le droit de prescrire', async () => {
      await setup(['imaging.orders:read:own']);
      expect(q('a[href^="/imaging/orders/new"]')).toBeNull();
      expect(textOf(root())).toContain('Imagerie');
    });

    it('n\'affiche pas la section sans le droit de lire les demandes', async () => {
      await setup([]);
      expect(imaging.listOrders).not.toHaveBeenCalled();
    });

    it('signale une erreur de chargement sans masquer le reste de la consultation', async () => {
      await setup(['imaging.orders:read:own'], (g) => g.listOrders.mockRejectedValue(new ApiError(500, 'HTTP_500', 'Une erreur interne est survenue.')));
      expect(textOf(q('[data-test=orders]')?.parentElement ?? null)).toContain('momentanément indisponible');
      expect(textOf(root())).toContain('Mbarga');
    });
  });

  describe('comptes rendus d\'imagerie parmi les résultats du médecin', () => {
    let fixture: ComponentFixture<ResultsPage>;
    let imaging: FakeImagingGateway;
    const root = () => fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

    async function setup(permissions: readonly string[], arrange?: (g: FakeImagingGateway) => void) {
      imaging = new FakeImagingGateway();
      arrange?.(imaging);
      const { i18n } = configureApp({
        roles: ['DOCTOR'], permissions, providers: [{ provide: LabGateway, useValue: new FakeLabGateway() }, { provide: ImagingGateway, useValue: imaging }],
      });
      missingKeys = watchMissingKeys(i18n);
      fixture = TestBed.createComponent(ResultsPage);
      await settle(fixture);
    }

    it('liste les comptes rendus signés avec un lien vers chacun, et signale une découverte critique', async () => {
      await setup(['lab.requisitions:read:own', 'imaging.orders:read:own'], (g) => g.listOrders.mockResolvedValue(page([summary({ status: 'REPORTED', critical: true })])));
      expect(imaging.listOrders).toHaveBeenCalledWith({ status: 'REPORTED' }, 0, 25);
      const row = textOf(q('[data-test="IMG-0000123"]'));
      expect(row).toContain('Mbarga Élisabeth');
      expect(row).toContain('RX-THORAX');
      expect(row).toContain('Découverte critique');
      expect(q('[data-test="IMG-0000123"] a')?.getAttribute('href')).toBe('/imaging/orders/o-1');
      expect(textOf(root())).toContain('Comptes rendus d’imagerie');
    });

    it('dit qu\'aucun compte rendu n\'est signé', async () => {
      await setup(['lab.requisitions:read:own', 'imaging.orders:read:own'], (g) => g.listOrders.mockResolvedValue(page([])));
      expect(textOf(root())).toContain('Aucun compte rendu signé pour le moment.');
    });

    it('sans le droit de lire l\'imagerie, la section n\'apparaît pas et rien n\'est chargé', async () => {
      await setup(['lab.requisitions:read:own']);
      expect(imaging.listOrders).not.toHaveBeenCalled();
      expect(textOf(root())).not.toContain('Comptes rendus d’imagerie');
    });

    it('une erreur d\'imagerie ne masque pas les résultats du laboratoire', async () => {
      await setup(['lab.requisitions:read:own', 'imaging.orders:read:own'], (g) => g.listOrders.mockRejectedValue(new ApiError(500, 'HTTP_500', 'Une erreur interne est survenue.')));
      expect(textOf(root())).toContain('momentanément indisponible');
      expect(textOf(root())).toContain('LAB-0000123');
    });
  });

  describe('navigation', () => {
    const labels = (roles: string[], permissions: string[]) => {
      const group = visibleNavigation(NAVIGATION, roles, permissions).find((i) => i.id === 'imaging');
      return group?.children?.map((c) => c.id) ?? [];
    };

    it('le radiologue voit la liste de travail, la nouvelle demande et le catalogue', () => {
      expect(labels(['RADIOLOGIST'], ['imaging.orders:read:all', 'imaging.orders:order', 'imaging.catalog:read'])).toEqual(['imaging-worklist', 'imaging-new', 'imaging-catalog']);
    });

    it('le médecin voit les mêmes entrées, selon ses droits ; qui n\'a aucun droit d\'imagerie ne voit pas le groupe', () => {
      expect(labels(['DOCTOR'], ['imaging.orders:read:own', 'imaging.orders:order', 'imaging.catalog:read'])).toEqual(['imaging-worklist', 'imaging-new', 'imaging-catalog']);
      expect(labels(['DOCTOR'], ['imaging.orders:read:own'])).toEqual(['imaging-worklist']);
      expect(labels(['NURSE'], [])).toEqual([]);
    });
  });
});

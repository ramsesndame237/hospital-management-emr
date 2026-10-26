import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AdministrationGateway } from '../../../core/administration/administration.gateway';
import { StructureNode, StructureTree } from '../../../core/administration/administration.models';
import { FakeAdministrationGateway, node, sampleTree } from '../../../core/administration/testing/fake-administration-gateway';
import { ApiError } from '../../../core/http/api-error';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { StructurePage } from './structure.page';

const MANAGE = ['administration.structure:read', 'administration.structure:manage', 'administration.facilities:read'];

/** L'arbre d'exemple dont la salle ne contient que les lits donnés. */
function treeWithBeds(beds: StructureNode[]): StructureTree {
  const tree = sampleTree();
  const service = tree.services[0];
  const unit = service.children[0];
  const room = unit.children[0];
  return { ...tree, services: [{ ...service, children: [{ ...unit, children: [{ ...room, children: beds }] }] }] };
}

describe('StructurePage (ADM-33 / ADM-34)', () => {
  let fixture: ComponentFixture<StructurePage>;
  let admin: FakeAdministrationGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => root().textContent ?? '';
  const names = () => [...root().querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent?.replace(/[+−]/g, '').trim());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label))!;

  async function setup(options: { permissions?: readonly string[]; facilityId?: string | null; tree?: StructureTree } = {}) {
    admin = new FakeAdministrationGateway();
    if (options.tree) admin.structure.mockResolvedValue(options.tree);
    const { i18n } = configureApp({
      roles: ['SYSTEM_ADMIN'],
      permissions: options.permissions ?? MANAGE,
      providers: [{ provide: AdministrationGateway, useValue: admin }],
    });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(StructurePage);
    if (options.facilityId !== null) fixture.componentRef.setInput('facilityId', options.facilityId ?? 'f-1');
    await settle(fixture);
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('affiche les totaux et l’arbre ouvert : service, unité, salle, lits', async () => {
    await setup();
    expect(admin.structure).toHaveBeenCalledWith('f-1', false);
    expect([...root().querySelectorAll('dl dd')].map((d) => d.textContent)).toEqual(['1', '1', '1', '2']);
    expect(names()).toEqual(['Pédiatrie', 'Néonatologie', 'Salle 1', 'Lit 1', 'Lit 2']);
    const service = root().querySelector('tbody tr')!.textContent!;
    expect(service).toContain('Service');
    expect(service).toContain('Soins · Pédiatrie');
    expect(text()).toContain('Étage RDC');
  });

  it('propose un onglet par site et marque le site courant', async () => {
    await setup();
    const tabs = [...root().querySelectorAll('nav a')];
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Hôpital Central de Yaoundé', 'Clinique Annexe de Douala']);
    expect(tabs[0].getAttribute('aria-current')).toBe('page');
    expect(tabs[1].getAttribute('aria-current')).toBeNull();
  });

  it('ouvre le premier site quand l’adresse n’en indique aucun', async () => {
    admin = new FakeAdministrationGateway();
    configureApp({ roles: ['SYSTEM_ADMIN'], permissions: MANAGE, providers: [{ provide: AdministrationGateway, useValue: admin }] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(StructurePage);
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith(['/admin/structure', 'f-1'], { replaceUrl: true });
  });

  it('replie et déplie une branche', async () => {
    await setup();
    await click(buttonNamed('Replier Pédiatrie'));
    expect(names()).toEqual(['Pédiatrie']);
    await click(buttonNamed('Déplier Pédiatrie'));
    expect(names()).toHaveLength(5); // chaque branche garde son propre état
    await click(buttonNamed('Replier Néonatologie'));
    expect(names()).toEqual(['Pédiatrie', 'Néonatologie']);
    await click(buttonNamed('Tout déplier'));
    expect(names()).toHaveLength(5);
    await click(buttonNamed('Tout replier'));
    expect(names()).toEqual(['Pédiatrie']);
  });

  it('relit l’arbre avec les éléments désactivés quand on le demande', async () => {
    await setup();
    const box = q<HTMLInputElement>('#structure-filter-inactive')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(admin.structure).toHaveBeenLastCalledWith('f-1', true);
  });

  describe('ajout', () => {
    it('ajoute un service avec sa nature et sa spécialité', async () => {
      await setup();
      await click(buttonNamed('Ajouter un service'));
      await type('#structure-service-code', 'chir');
      await type('#structure-service-name', 'Chirurgie');
      const specialty = q<HTMLSelectElement>('#structure-service-specialtyCode')!;
      specialty.value = 'GENERAL_SURGERY';
      specialty.dispatchEvent(new Event('change'));
      await submit('structure-service');
      expect(admin.createService).toHaveBeenCalledWith('f-1', { code: 'CHIR', name: 'Chirurgie', serviceType: 'CLINICAL', specialtyCode: 'GENERAL_SURGERY' });
      expect(admin.structure).toHaveBeenCalledTimes(2); // relecture après l’ajout
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('« Chirurgie » ajouté.');
      expect(q('aside')).toBeNull();
    });

    it('n’envoie pas de spécialité quand aucune n’est choisie', async () => {
      await setup();
      await click(buttonNamed('Ajouter un service'));
      await type('#structure-service-code', 'ADM');
      await type('#structure-service-name', 'Administration');
      await submit('structure-service');
      expect(admin.createService).toHaveBeenCalledWith('f-1', { code: 'ADM', name: 'Administration', serviceType: 'CLINICAL' });
    });

    it('ajoute une salle avec son étage sous une unité', async () => {
      await setup();
      await click(buttonNamed('Ajouter une salle'));
      expect(q('aside h2')?.textContent).toContain('Néonatologie');
      await type('#structure-child-u-1-code', 's2');
      await type('#structure-child-u-1-name', 'Salle 2');
      await type('#structure-child-u-1-floor', '1');
      await submit('structure-child-u-1');
      expect(admin.createChild).toHaveBeenCalledWith('u-1', { code: 'S2', name: 'Salle 2', floor: '1' });
    });

    it('ne propose pas d’étage pour un lit, et rien sous un lit', async () => {
      await setup();
      await click(buttonNamed('Ajouter un lit'));
      expect(q('#structure-child-r-1-floor')).toBeNull();
      const bed = root().querySelectorAll('tbody tr')[3];
      expect(bed.textContent).not.toContain('Ajouter');
    });

    it('exige un code et un nom avant tout appel', async () => {
      await setup();
      await click(buttonNamed('Ajouter un service'));
      await submit('structure-service');
      expect(text()).toContain('Saisissez un code.');
      expect(text()).toContain('Saisissez un nom.');
      expect(admin.createService).not.toHaveBeenCalled();
    });

    it('explique le refus d’un code déjà utilisé et garde la saisie', async () => {
      await setup();
      admin.createService.mockRejectedValue(new ApiError(409, 'STRUCTURE_CODE_ALREADY_EXISTS', 'Un élément de même niveau utilise déjà ce code à cet endroit.'));
      await click(buttonNamed('Ajouter un service'));
      await type('#structure-service-code', 'PED');
      await type('#structure-service-name', 'Doublon');
      await submit('structure-service');
      expect(q('aside [role=alert]')?.textContent).toContain('utilise déjà ce code');
      expect(q<HTMLInputElement>('#structure-service-name')?.value).toBe('Doublon');
    });
  });

  describe('modification', () => {
    it('ne laisse pas modifier le code d’un élément existant', async () => {
      await setup();
      await click(buttonNamed('Modifier Pédiatrie'));
      expect(q('#structure-edit-s-1-code')).toBeNull();
      expect(q<HTMLInputElement>('#structure-edit-s-1-name')?.value).toBe('Pédiatrie');
    });

    it('modifie un service, et retire sa spécialité quand on la vide', async () => {
      await setup();
      await click(buttonNamed('Modifier Pédiatrie'));
      await type('#structure-edit-s-1-name', 'Pédiatrie générale');
      const specialty = q<HTMLSelectElement>('#structure-edit-s-1-specialtyCode')!;
      specialty.value = '';
      specialty.dispatchEvent(new Event('change'));
      await submit('structure-edit-s-1');
      expect(admin.updateNode).toHaveBeenCalledWith('s-1', { name: 'Pédiatrie générale', serviceType: 'CLINICAL', specialtyCode: null });
    });

    it('modifie l’étage d’une salle et le retire quand on le vide', async () => {
      await setup();
      await click(buttonNamed('Modifier Salle 1'));
      expect(q<HTMLInputElement>('#structure-edit-r-1-floor')?.value).toBe('RDC');
      await type('#structure-edit-r-1-floor', '');
      await submit('structure-edit-r-1');
      expect(admin.updateNode).toHaveBeenCalledWith('r-1', { name: 'Salle 1', floor: null });
    });

    it('ne change que le nom d’un lit', async () => {
      await setup();
      await click(buttonNamed('Modifier Lit 1'));
      await submit('structure-edit-b-1');
      expect(admin.updateNode).toHaveBeenCalledWith('b-1', { name: 'Lit 1' });
    });
  });

  describe('désactivation', () => {
    it('demande confirmation puis désactive un lit', async () => {
      await setup();
      await click(buttonNamed('Désactiver Lit 1'));
      expect(text()).toContain('Cet élément n’accueillera plus personne');
      expect(text()).toContain('journal d’audit');
      expect(admin.setNodeActive).not.toHaveBeenCalled();
      await submit('structure-deactivate-b-1');
      expect(admin.setNodeActive).toHaveBeenCalledWith('b-1', false);
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('« Lit 1 » désactivé.');
    });

    it('explique pourquoi un élément qui contient des éléments actifs ne peut pas être désactivé', async () => {
      await setup();
      await click(buttonNamed('Désactiver Pédiatrie'));
      expect(text()).toContain('Désactivation impossible pour le moment');
      expect(q('#structure-deactivate-s-1 button[type=submit]')).toBeNull();
    });

    it('affiche le refus du serveur', async () => {
      await setup();
      admin.setNodeActive.mockRejectedValue(new ApiError(409, 'STRUCTURE_HAS_ACTIVE_CHILDREN', 'Cet élément contient des éléments actifs : désactivez-les d’abord.'));
      await click(buttonNamed('Désactiver Lit 1'));
      await submit('structure-deactivate-b-1');
      expect(q('aside [role=alert]')?.textContent).toContain('désactivez-les d’abord');
    });

    it('réactive un élément désactivé en un clic', async () => {
      const [bed1, bed2] = sampleTree().services[0].children[0].children[0].children;
      await setup({ tree: treeWithBeds([{ ...bed1, active: false }, bed2]) });
      expect(text()).toContain('Désactivé');
      await click(buttonNamed('Réactiver Lit 1'));
      expect(admin.setNodeActive).toHaveBeenCalledWith('b-1', true);
    });

    it('signale un parent désactivé quand on tente de réactiver un lit', async () => {
      const inactiveBed = node({ id: 'b-9', kind: 'BED', code: 'B9', name: 'Lit 9', parentId: 'r-1', active: false });
      await setup({ tree: treeWithBeds([inactiveBed]) });
      admin.setNodeActive.mockRejectedValue(new ApiError(409, 'STRUCTURE_PARENT_INACTIVE', 'L’élément parent est désactivé : on ne peut rien y ajouter ni y réactiver.'));
      await click(buttonNamed('Réactiver Lit 9'));
      expect(q('[role=alert]')?.textContent).toContain('parent est désactivé');
    });
  });

  it('masque toutes les actions sans le droit de gérer la structure', async () => {
    await setup({ permissions: ['administration.structure:read', 'administration.facilities:read'] });
    expect(names()).toHaveLength(5);
    expect(buttonNamed('Ajouter un service')).toBeUndefined();
    expect(buttonNamed('Modifier')).toBeUndefined();
    expect(buttonNamed('Désactiver')).toBeUndefined();
  });

  it('renvoie vers les sites quand aucun n’est enregistré', async () => {
    admin = new FakeAdministrationGateway();
    admin.listFacilities.mockResolvedValue([]);
    configureApp({ roles: ['SYSTEM_ADMIN'], permissions: MANAGE, providers: [{ provide: AdministrationGateway, useValue: admin }] });
    fixture = TestBed.createComponent(StructurePage);
    await settle(fixture);
    expect(text()).toContain('Aucun site n’est enregistré');
    expect(q('a[href="/admin/sites"]')).not.toBeNull();
  });

  it('signale un site introuvable sans détail technique', async () => {
    await setup();
    admin.structure.mockRejectedValue(new ApiError(404, 'FACILITY_NOT_FOUND', 'Établissement introuvable.'));
    fixture.componentRef.setInput('facilityId', 'f-404');
    await settle(fixture);
    expect(q('[role=alert]')?.textContent).toContain('Établissement introuvable.');
    expect(root().querySelector('table')).toBeNull();
  });
});

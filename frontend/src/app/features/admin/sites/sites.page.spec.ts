import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdministrationGateway } from '../../../core/administration/administration.gateway';
import { FakeAdministrationGateway } from '../../../core/administration/testing/fake-administration-gateway';
import { ApiError } from '../../../core/http/api-error';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { SitesPage } from './sites.page';

const MANAGE = ['administration.facilities:read', 'administration.facilities:manage'];

describe('SitesPage (ADM-32)', () => {
  let fixture: ComponentFixture<SitesPage>;
  let admin: FakeAdministrationGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => root().textContent ?? '';
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label))!;

  async function setup(permissions: readonly string[] = MANAGE) {
    admin = new FakeAdministrationGateway();
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions, providers: [{ provide: AdministrationGateway, useValue: admin }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(SitesPage);
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

  it('liste les sites avec leur code et leur statut en toutes lettres', async () => {
    await setup();
    const rows = [...root().querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('YDE1-hcy-01');
    expect(rows[0]).toContain('Hôpital Central de Yaoundé');
    expect(rows[0]).toContain('Ouvert');
    expect(rows[1]).toContain('En projet');
    expect(q('a[href="/admin/structure/f-1"]')).not.toBeNull();
  });

  it('enregistre un site « en projet » par défaut et l’ajoute à la liste, triée par nom', async () => {
    await setup();
    await click(buttonNamed('Ajouter un site'));
    expect(q('aside h2')?.textContent).toContain('Nouveau site');
    await type('#sites-create-name', '  Annexe de Bafoussam ');
    await type('#sites-create-code', 'BFM1-ann-03');
    await submit('sites-create');
    expect(admin.registerFacility).toHaveBeenCalledWith({ name: 'Annexe de Bafoussam', code: 'BFM1-ann-03', status: 'OPERATIONAL_UNDER_CONSTRUCTION' });
    expect(q('aside')).toBeNull();
    expect([...root().querySelectorAll('tbody tr td:nth-child(2)')].map((td) => td.textContent?.trim())).toEqual([
      'Annexe de Bafoussam', 'Clinique Annexe de Douala', 'Hôpital Central de Yaoundé',
    ]);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Site « Annexe de Bafoussam » enregistré.');
  });

  it('refuse un code mal formé sans appeler le serveur', async () => {
    await setup();
    await click(buttonNamed('Ajouter un site'));
    await type('#sites-create-name', 'Annexe');
    await type('#sites-create-code', 'abc');
    await submit('sites-create');
    expect(text()).toContain('Le code ne respecte pas le format attendu');
    expect(admin.registerFacility).not.toHaveBeenCalled();
  });

  it('garde le panneau ouvert et explique le refus quand le code existe déjà', async () => {
    await setup();
    admin.registerFacility.mockRejectedValue(new ApiError(409, 'FACILITY_CODE_ALREADY_EXISTS', 'Un établissement utilise déjà ce code.'));
    await click(buttonNamed('Ajouter un site'));
    await type('#sites-create-name', 'Doublon');
    await type('#sites-create-code', 'YDE1-hcy-01');
    await submit('sites-create');
    expect(q('aside [role=alert]')?.textContent).toContain('Un établissement utilise déjà ce code.');
    expect(q<HTMLInputElement>('#sites-create-name')?.value).toBe('Doublon');
    expect(root().querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('modifie le nom et le code d’un site', async () => {
    await setup();
    await click(buttonNamed('Modifier Hôpital Central de Yaoundé'));
    expect(q<HTMLInputElement>('#sites-edit-f-1-name')?.value).toBe('Hôpital Central de Yaoundé');
    await type('#sites-edit-f-1-name', 'Hôpital Central');
    await submit('sites-edit-f-1');
    expect(admin.updateFacility).toHaveBeenCalledWith('f-1', { name: 'Hôpital Central', code: 'YDE1-hcy-01' });
    expect(text()).toContain('Hôpital Central');
  });

  describe('changement de statut', () => {
    async function openStatus() {
      await click(buttonNamed('Changer le statut de Hôpital Central de Yaoundé'));
    }

    async function choose(status: string) {
      const select = q<HTMLSelectElement>('#sites-status-f-1-status')!;
      select.value = status;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    it('applique directement un statut sans conséquence sur l’accueil', async () => {
      await setup();
      await openStatus();
      expect(q('#sites-status-f-1-confirm')).toBeNull();
      await choose('QUALITY_CERTIFIED');
      await submit('sites-status-f-1');
      expect(admin.changeFacilityStatus).toHaveBeenCalledWith('f-1', 'QUALITY_CERTIFIED');
      expect(text()).toContain('Certifié');
    });

    it('exige une confirmation explicite quand le statut interrompt l’activité', async () => {
      await setup();
      await openStatus();
      await choose('ADMIN_SUSPENDED');
      expect(text()).toContain('Ce statut interrompt l’activité du site');
      await submit('sites-status-f-1');
      expect(text()).toContain('Cochez la case pour confirmer.');
      expect(admin.changeFacilityStatus).not.toHaveBeenCalled();

      const confirm = q<HTMLInputElement>('#sites-status-f-1-confirm')!;
      confirm.checked = true;
      confirm.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await submit('sites-status-f-1');
      expect(admin.changeFacilityStatus).toHaveBeenCalledWith('f-1', 'ADMIN_SUSPENDED');
    });

    it('rappelle que le changement est inscrit au journal d’audit', async () => {
      await setup();
      await openStatus();
      expect(text()).toContain('journal d’audit');
    });
  });

  it('annule sans rien enregistrer', async () => {
    await setup();
    await click(buttonNamed('Ajouter un site'));
    await click(buttonNamed('Annuler'));
    expect(q('aside')).toBeNull();
    expect(admin.registerFacility).not.toHaveBeenCalled();
  });

  it('masque les actions de modification sans le droit de gérer les sites', async () => {
    await setup(['administration.facilities:read']);
    expect(buttonNamed('Ajouter un site')).toBeUndefined();
    expect(root().querySelectorAll('tbody button')).toHaveLength(0);
    expect(q('a[href="/admin/structure/f-1"]')).not.toBeNull();
  });

  it('dit qu’aucun site n’est enregistré', async () => {
    admin = new FakeAdministrationGateway();
    admin.listFacilities.mockResolvedValue([]);
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions: MANAGE, providers: [{ provide: AdministrationGateway, useValue: admin }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(SitesPage);
    await settle(fixture);
    expect(text()).toContain('Aucun site enregistré pour le moment.');
  });
});

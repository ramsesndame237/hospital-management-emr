import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdministrationGateway } from '../../../core/administration/administration.gateway';
import { FakeAdministrationGateway } from '../../../core/administration/testing/fake-administration-gateway';
import { ApiError } from '../../../core/http/api-error';
import { Geocoder } from '../../../core/geo/geocoder';
import { MAP_FACTORY } from '../../../shared/location-picker/location-picker';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { SitesPage } from './sites.page';

const MANAGE = ['administration.facilities:read', 'administration.facilities:manage'];

const noMap = async () => ({ setView: () => undefined, setMarker: () => undefined, onClick: () => undefined, destroy: () => undefined });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SitesPage (ADM-32)', () => {
  let fixture: ComponentFixture<SitesPage>;
  let admin: FakeAdministrationGateway;
  let missingKeys: () => string[];
  const PROVIDERS = () => [
    { provide: AdministrationGateway, useValue: admin },
    { provide: Geocoder, useValue: { search: vi.fn().mockResolvedValue([]), reverse: vi.fn().mockResolvedValue(null) } },
    { provide: MAP_FACTORY, useValue: noMap },
  ];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => root().textContent ?? '';
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label))!;

  async function setup(permissions: readonly string[] = MANAGE) {
    admin = new FakeAdministrationGateway();
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions, providers: PROVIDERS() });
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

  async function chooseCountry(code: string) {
    const select = q<HTMLSelectElement>('app-location-picker select')!;
    select.value = code;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await wait(450); // pause de saisie avant la demande du code proposé
    await settle(fixture);
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

  it('compose le code d’après la localisation et le nom, le montre avant l’enregistrement, puis enregistre le site', async () => {
    await setup();
    await click(buttonNamed('Ajouter un site'));
    expect(q('aside h2')?.textContent).toContain('Nouveau site');
    expect(q('#sites-create-code')).toBeNull(); // plus de saisie du code
    expect(text()).toContain('sera composé automatiquement');
    await type('#sites-create-name', '  Annexe de Bafoussam ');
    await chooseCountry('CM');
    expect(admin.previewFacilityCode).toHaveBeenCalledWith('Annexe de Bafoussam', expect.objectContaining({ countryCode: 'CM' }));
    expect(text()).toContain('CMYA-hcy-01');
    await submit('sites-create');
    expect(admin.registerFacility).toHaveBeenCalledWith({
      name: 'Annexe de Bafoussam',
      location: { countryCode: 'CM', region: null, commune: null, street: null, latitude: null, longitude: null },
      status: 'OPERATIONAL_UNDER_CONSTRUCTION',
    });
    expect(q('aside')).toBeNull();
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Site « Annexe de Bafoussam » enregistré.');
  });

  it('exige le pays avant d’enregistrer, sans appeler le serveur', async () => {
    await setup();
    await click(buttonNamed('Ajouter un site'));
    await type('#sites-create-name', 'Annexe');
    await submit('sites-create');
    expect(text()).toContain('Choisissez au moins le pays du site');
    expect(admin.registerFacility).not.toHaveBeenCalled();
  });

  it('garde le panneau ouvert et explique le refus renvoyé par le serveur', async () => {
    await setup();
    admin.registerFacility.mockRejectedValue(new ApiError(409, 'FACILITY_CODE_ALREADY_EXISTS', 'Un établissement utilise déjà ce code.'));
    await click(buttonNamed('Ajouter un site'));
    await type('#sites-create-name', 'Doublon');
    await chooseCountry('CM');
    await submit('sites-create');
    expect(q('aside [role=alert]')?.textContent).toContain('Un établissement utilise déjà ce code.');
    expect(q<HTMLInputElement>('#sites-create-name')?.value).toBe('Doublon');
    expect(root().querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('modifie le nom d’un site sans toucher au code ni à la localisation', async () => {
    await setup();
    await click(buttonNamed('Modifier Hôpital Central de Yaoundé'));
    expect(q<HTMLInputElement>('#sites-edit-f-1-name')?.value).toBe('Hôpital Central de Yaoundé');
    expect(text()).toContain('YDE1-hcy-01');
    await type('#sites-edit-f-1-name', 'Hôpital Central');
    await submit('sites-edit-f-1');
    expect(admin.updateFacility).toHaveBeenCalledWith('f-1', { name: 'Hôpital Central' });
    expect(text()).toContain('Hôpital Central');
  });

  it('envoie la nouvelle localisation quand on la change en modifiant un site', async () => {
    await setup();
    await click(buttonNamed('Modifier Hôpital Central de Yaoundé'));
    await chooseCountry('SN');
    await submit('sites-edit-f-1');
    expect(admin.updateFacility).toHaveBeenCalledWith('f-1', { name: 'Hôpital Central de Yaoundé', location: expect.objectContaining({ countryCode: 'SN' }) });
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
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions: MANAGE, providers: PROVIDERS() });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(SitesPage);
    await settle(fixture);
    expect(text()).toContain('Aucun site enregistré pour le moment.');
  });
});

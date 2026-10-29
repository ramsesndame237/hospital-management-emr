import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdministrationGateway } from '../../../core/administration/administration.gateway';
import { FakeAdministrationGateway } from '../../../core/administration/testing/fake-administration-gateway';
import { ApiError } from '../../../core/http/api-error';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { OrganizationPage } from './organization.page';

const MANAGE = ['administration.organization:read', 'administration.organization:manage', 'administration.facilities:read'];

describe('OrganizationPage (ADM-31)', () => {
  let fixture: ComponentFixture<OrganizationPage>;
  let admin: FakeAdministrationGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => root().textContent ?? '';

  async function setup(permissions: readonly string[] = MANAGE) {
    admin = new FakeAdministrationGateway();
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions, providers: [{ provide: AdministrationGateway, useValue: admin }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(OrganizationPage);
    await settle(fixture);
  }

  async function typeName(value: string) {
    const input = q<HTMLInputElement>('#organization-name')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit() {
    q<HTMLFormElement>('#organization')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it("affiche le nom de l'organisation et le résumé de ses sites", async () => {
    await setup();
    expect(q('h1')?.textContent).toContain('Organisation');
    expect(q<HTMLInputElement>('#organization-name')?.value).toBe('Groupe Hospitalier Sanjeevani');
    expect(text()).toContain('Sites enregistrés');
    expect(root().querySelectorAll('dd')[0].textContent).toBe('2');
    expect(root().querySelectorAll('dd')[1].textContent).toBe('1'); // un seul site est ouvert
    expect(q('a[href="/admin/sites"]')).not.toBeNull();
  });

  it("renomme l'organisation avec le nom nettoyé et le confirme", async () => {
    await setup();
    await typeName('  Hôpital Central  ');
    await submit();
    expect(admin.saveOrganization).toHaveBeenCalledWith('Hôpital Central');
    expect(TestBed.inject(ToastService).toasts().map((t) => t.message)).toEqual(['Organisation mise à jour.']);
  });

  it('refuse un nom vide sans appeler le serveur', async () => {
    await setup();
    await typeName('   ');
    await submit();
    expect(text()).toContain("Saisissez le nom de l’organisation.");
    expect(admin.saveOrganization).not.toHaveBeenCalled();
  });

  it("propose de créer l'organisation tant qu'elle n'existe pas", async () => {
    await setup();
    admin.getOrganization.mockResolvedValue(null);
    fixture = TestBed.createComponent(OrganizationPage);
    await settle(fixture);
    expect(text()).toContain("L’organisation n’est pas encore configurée");
    expect(q('button[type=submit]')?.textContent).toContain("Créer l’organisation");
    await typeName('Clinique du Lac');
    await submit();
    expect(admin.saveOrganization).toHaveBeenCalledWith('Clinique du Lac');
    expect(TestBed.inject(ToastService).toasts().map((t) => t.message)).toEqual(['Organisation créée.']);
  });

  it("affiche le refus du serveur dans un bandeau, sans perdre la saisie", async () => {
    await setup();
    admin.saveOrganization.mockRejectedValue(new ApiError(422, 'ORGANIZATION_NAME_INVALID', "Le nom de l'organisation est incorrect."));
    await typeName('X');
    await submit();
    expect(q('[role=alert]')?.textContent).toContain("Le nom de l'organisation est incorrect.");
    expect(q<HTMLInputElement>('#organization-name')?.value).toBe('X');
  });

  it("ne dévoile aucun détail technique lors d'une panne serveur", async () => {
    await setup();
    admin.saveOrganization.mockRejectedValue(new ApiError(503, 'UNKNOWN', 'SELECT * FROM organizations failed'));
    await typeName('Nouveau nom');
    await submit();
    expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
    expect(text()).not.toContain('SELECT');
  });

  it("n'offre pas de formulaire sans le droit de gérer l'organisation", async () => {
    await setup(['administration.organization:read']);
    expect(q('#organization')).toBeNull();
    expect(text()).toContain('Groupe Hospitalier Sanjeevani');
    expect(text()).toContain("Seul l’administrateur système peut modifier l’organisation.");
  });

  it('signale une lecture impossible', async () => {
    admin = new FakeAdministrationGateway();
    admin.getOrganization.mockRejectedValue(new ApiError(0, 'NETWORK', 'Http failure'));
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions: MANAGE, providers: [{ provide: AdministrationGateway, useValue: admin }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(OrganizationPage);
    await settle(fixture);
    expect(q('[role=alert]')?.textContent).toContain('connexion réseau a été interrompue');
  });
});

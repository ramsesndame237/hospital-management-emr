import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { IdentityAdminGateway } from '../../../core/iam/identity-admin.gateway';
import { groupPermissions } from '../../../core/iam/identity-admin.models';
import { FakeIdentityAdminGateway } from '../../../core/iam/testing/fake-identity-admin-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { RolesPage } from './roles.page';

describe('groupPermissions', () => {
  it('regroupe par ressource, trie, et lit une permission sans portée comme « tous »', () => {
    expect(groupPermissions(['files:upload', 'appointments:write:department', 'appointments:read:own', 'appointments:read:all'])).toEqual([
      { resource: 'appointments', grants: [{ action: 'read', scope: 'own' }, { action: 'read', scope: 'all' }, { action: 'write', scope: 'department' }] },
      { resource: 'files', grants: [{ action: 'upload', scope: 'all' }] },
    ]);
  });

  it('ignore une permission mal formée', () => {
    expect(groupPermissions(['', 'seul', 'a:b:inconnue', 'a:b:own:extra'])).toEqual([]);
  });
});

describe('RolesPage', () => {
  let fixture: ComponentFixture<RolesPage>;
  let admin: FakeIdentityAdminGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => root().textContent ?? '';
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.getAttribute('aria-label') === label)!;

  async function setup(prepare?: (gateway: FakeIdentityAdminGateway) => void) {
    admin = new FakeIdentityAdminGateway();
    prepare?.(admin);
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions: ['iam.roles:read'], providers: [{ provide: IdentityAdminGateway, useValue: admin }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(RolesPage);
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les rôles avec leur code, leur type, leur double authentification et le nombre de permissions', async () => {
    await setup();
    const rows = [...root().querySelectorAll('tbody tr')].map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows).toHaveLength(4);
    expect(rows[1]).toContain('Médecin');
    expect(rows[1]).toContain('DOCTOR');
    expect(rows[1]).toContain('Système');
    expect(rows[1]).toContain('Exigée');
    expect(rows[2]).toContain('Facultative');
    expect(rows[3]).toContain('Chef de laboratoire');
    expect(rows[3]).toContain('Ajouté');
  });

  it('annonce que la page est en consultation seule', async () => {
    await setup();
    expect(text()).toContain('Consultation seulement');
    expect(q('button[type=submit]')).toBeNull();
  });

  it('déplie les droits d’un rôle, groupés par ressource, puis les masque', async () => {
    await setup();
    const show = buttonNamed('Voir les droits du rôle Médecin');
    expect(show.getAttribute('aria-expanded')).toBe('false');
    show.click();
    await settle(fixture);
    expect(text()).toContain('files.clinical');
    expect(text()).toContain('read (son service), write (son service)');
    expect(text()).toContain('read (les siens)');
    const hide = buttonNamed('Masquer les droits du rôle Médecin');
    expect(hide.getAttribute('aria-expanded')).toBe('true');
    hide.click();
    await settle(fixture);
    expect(text()).not.toContain('files.clinical');
  });

  it('dit qu’un rôle sans permission n’en accorde aucune', async () => {
    await setup();
    buttonNamed('Voir les droits du rôle Chef de laboratoire').click();
    await settle(fixture);
    expect(text()).toContain('Ce rôle n’accorde aucune permission.');
  });

  it('signale une lecture refusée', async () => {
    await setup((g) => g.roles.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Vous n’avez pas le droit d’effectuer cette action.')));
    expect(q('[role=alert]')?.textContent).toContain('Vous n’avez pas le droit');
    expect(root().querySelector('table')).toBeNull();
  });
});

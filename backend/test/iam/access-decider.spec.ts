import { AccessDecider } from '../../src/modules/iam/application/access-decider';
import { PermissionResolver } from '../../src/modules/iam/application/permission-resolver';
import { GetUserAccessUseCase } from '../../src/modules/iam/application/use-cases/user-access';
import { DepartmentDirectory } from '../../src/modules/iam/domain/ports';
import { AccessPolicy, Role } from '../../src/modules/iam/domain/role';
import { Permission } from '../../src/modules/iam/domain/value-objects/permission';
import { RoleCode } from '../../src/modules/iam/domain/value-objects/role-code';
import { UserId } from '../../src/modules/iam/domain/value-objects/user-id';
import { InMemoryRoles, MapCache, must, buildWorld } from './fakes';

const perm = (...p: string[]) => p.map((x) => must(Permission.create(x)));
const role = (code: string, ...permissions: string[]) => new Role(must(RoleCode.create(code)), code, perm(...permissions), false, false);

const PED = '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001';
const CARDIO = '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d002';
const SURGERY = '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d003';

/** Rôles de test : un par portée, plus des combinaisons. */
const ROLES = [
  role('GLOBAL', 'files.clinical:read:all'),
  role('SERVICE', 'files.clinical:read:department'),
  role('PERSONAL', 'files.clinical:read:own'),
  role('SERVICE_AND_OWN', 'files.clinical:read:department', 'files.clinical:read:own'),
  role('OTHER_ACTION', 'files.clinical:upload:all'),
  role('NOTHING', 'billing:write'),
];

async function setup() {
  const w = buildWorld();
  const roles = new InMemoryRoles(ROLES);
  const resolver = new PermissionResolver(w.users, roles, new MapCache());
  const departments = new Map<string, string[]>();
  const directory: DepartmentDirectory = { departmentsOf: async (id) => departments.get(id) ?? [] };
  const decider = new AccessDecider(resolver, directory);
  const user = async (name: string, ...roleCodes: string[]) => (await w.addUser({ username: name, password: 'x'.repeat(14), roles: roleCodes })).id.value;
  return { w, roles, resolver, decider, departments, directory, user };
}

const decide = async (s: Awaited<ReturnType<typeof setup>>, userId: string, permission: string, ctx = {}) => must(await s.decider.decide(userId, permission, ctx));

describe('politique d\'accès : portées accordées', () => {
  it('relève les portées accordées explicitement pour une action, de la plus étroite à la plus large', () => {
    const granted = perm('a.b:read:own', 'a.b:read:all', 'a.b:write:department', 'c.d:read:department');
    expect(AccessPolicy.scopesOf(granted, 'a.b', 'read')).toEqual(['own', 'all']);
    expect(AccessPolicy.scopesOf(granted, 'a.b', 'write')).toEqual(['department']);
    expect(AccessPolicy.scopesOf(granted, 'a.b', 'delete')).toEqual([]);
    expect(AccessPolicy.scopesOf(granted, 'c.d', 'write')).toEqual([]);
  });
});

describe('décision d\'accès avec portée', () => {
  it('« all » donne accès à toute ressource, même sans contexte', async () => {
    const s = await setup();
    const u = await s.user('global', 'GLOBAL');
    expect(await decide(s, u, 'files.clinical:read')).toEqual({ allowed: true, grantedScope: 'all', reason: 'ALL' });
  });

  it('« department » : accès seulement aux ressources de ses services', async () => {
    const s = await setup();
    const u = await s.user('infirmier', 'SERVICE');
    s.departments.set(u, [PED, CARDIO]);
    expect(await decide(s, u, 'files.clinical:read', { departmentId: PED })).toEqual({ allowed: true, grantedScope: 'department', reason: 'DEPARTMENT' });
    expect(await decide(s, u, 'files.clinical:read', { departmentId: CARDIO })).toMatchObject({ allowed: true });
    expect(await decide(s, u, 'files.clinical:read', { departmentId: SURGERY })).toEqual({ allowed: false, grantedScope: 'department', reason: 'OUT_OF_SCOPE' });
  });

  it('« department » : échec fermé sans service sur la ressource, sans service de rattachement, ou sans annuaire', async () => {
    const s = await setup();
    const u = await s.user('infirmier', 'SERVICE');
    s.departments.set(u, [PED]);
    expect(await decide(s, u, 'files.clinical:read')).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
    expect(await decide(s, u, 'files.clinical:read', { departmentId: '' })).toMatchObject({ allowed: false });
    const lonely = await s.user('sans.fiche', 'SERVICE');
    expect(await decide(s, lonely, 'files.clinical:read', { departmentId: PED })).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
    const withoutDirectory = new AccessDecider(s.resolver, null);
    expect(must(await withoutDirectory.decide(u, 'files.clinical:read', { departmentId: PED }))).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
  });

  it('« own » : accès seulement aux ressources dont on est le titulaire', async () => {
    const s = await setup();
    const u = await s.user('patient', 'PERSONAL');
    const other = await s.user('autre', 'PERSONAL');
    expect(await decide(s, u, 'files.clinical:read', { ownerId: u })).toEqual({ allowed: true, grantedScope: 'own', reason: 'OWN' });
    expect(await decide(s, u, 'files.clinical:read', { ownerId: other })).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
    expect(await decide(s, u, 'files.clinical:read')).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
  });

  it('cumule les portées : son service OU ses propres ressources', async () => {
    const s = await setup();
    const u = await s.user('medecin', 'SERVICE_AND_OWN');
    s.departments.set(u, [PED]);
    expect(await decide(s, u, 'files.clinical:read', { departmentId: PED, ownerId: 'autre' })).toMatchObject({ allowed: true, reason: 'DEPARTMENT', grantedScope: 'department' });
    expect(await decide(s, u, 'files.clinical:read', { departmentId: SURGERY, ownerId: u })).toMatchObject({ allowed: true, reason: 'OWN' });
    expect(await decide(s, u, 'files.clinical:read', { departmentId: SURGERY, ownerId: 'autre' })).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
  });

  it('distingue « aucune permission » d\'« hors portée », et une autre action n\'ouvre rien', async () => {
    const s = await setup();
    const u = await s.user('caissier', 'NOTHING');
    expect(await decide(s, u, 'files.clinical:read', { departmentId: PED })).toEqual({ allowed: false, grantedScope: null, reason: 'NO_PERMISSION' });
    const uploader = await s.user('televerseur', 'OTHER_ACTION');
    expect(await decide(s, uploader, 'files.clinical:read')).toMatchObject({ allowed: false, reason: 'NO_PERMISSION' });
    expect(await decide(s, uploader, 'files.clinical:upload')).toMatchObject({ allowed: true });
  });

  it('refuse un compte inconnu ou désactivé, immédiatement', async () => {
    const s = await setup();
    const u = await s.user('global', 'GLOBAL');
    expect(await decide(s, '99999999-9999-4999-8999-999999999999', 'files.clinical:read')).toMatchObject({ allowed: false, reason: 'INACTIVE' });
    expect(await decide(s, 'pas-un-uuid', 'files.clinical:read')).toMatchObject({ allowed: false, reason: 'INACTIVE' });
    (await s.w.users.findById(must(UserId.create(u))))!.disable();
    await s.resolver.invalidate(u);
    expect(await decide(s, u, 'files.clinical:read')).toMatchObject({ allowed: false, reason: 'INACTIVE' });
  });

  it('relit les services à chaque décision : une affectation terminée ne donne plus rien aussitôt', async () => {
    const s = await setup();
    const u = await s.user('infirmier', 'SERVICE');
    s.departments.set(u, [PED]);
    expect(await decide(s, u, 'files.clinical:read', { departmentId: PED })).toMatchObject({ allowed: true });
    s.departments.set(u, []);
    expect(await decide(s, u, 'files.clinical:read', { departmentId: PED })).toMatchObject({ allowed: false });
  });

  it('refuse une permission mal formée ou portant déjà une portée', async () => {
    const s = await setup();
    const u = await s.user('global', 'GLOBAL');
    for (const bad of ['', 'files', 'files.clinical:read:all', 'FILES:READ', 'a:b:c:d']) {
      const r = await s.decider.decide(u, bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('PERMISSION_INVALID');
    }
  });
});

describe('droits effectifs d\'un compte', () => {
  it('rassemble rôles, permissions et services, et explique une décision sans rien exécuter', async () => {
    const s = await setup();
    const u = await s.user('medecin', 'SERVICE', 'OTHER_ACTION');
    s.departments.set(u, [PED]);
    const view = new GetUserAccessUseCase(s.w.users, s.roles, s.resolver, s.decider, s.directory);
    const access = must(await view.execute(u));
    expect(access).toMatchObject({ userId: u, username: 'medecin', active: true, departments: [PED] });
    expect(access.roles.map((r) => r.code)).toEqual(['SERVICE', 'OTHER_ACTION']);
    expect([...access.permissions].sort()).toEqual(['files.clinical:read:department', 'files.clinical:upload:all']);
    expect(must(await view.explain(u, 'files.clinical:read', { departmentId: SURGERY }))).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
    expect(must(await view.explain(u, 'files.clinical:read', { departmentId: PED }))).toMatchObject({ allowed: true });
  });

  it('répond « introuvable » pour un compte inconnu, et n\'a aucun service sans annuaire', async () => {
    const s = await setup();
    const view = new GetUserAccessUseCase(s.w.users, s.roles, s.resolver, s.decider, null);
    for (const r of [await view.execute('99999999-9999-4999-8999-999999999999'), await view.execute('nope'), await view.explain('nope', 'a:b', {})]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('USER_NOT_FOUND');
    }
    const u = await s.user('medecin', 'SERVICE');
    expect(must(await view.execute(u)).departments).toEqual([]);
  });
});

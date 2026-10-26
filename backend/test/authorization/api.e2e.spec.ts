import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';

const PWD = 'une phrase de passe solide';
const api = (path: string) => `/api/v1${path}`;

describe('autorisations : droits effectifs, portée « service », inventaire (HTTP réel, PostgreSQL réel)', () => {
  let w: TestWorld;
  let admin: string;
  let auditor: string;
  let nurseToken: string;
  let patient: string;
  let nurseId: string;
  let outsiderId: string;
  let serviceA: string;
  let serviceB: string;
  let unitA: string;
  let nurseStaff: string;
  let assignment: string;
  const http = () => request(w.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, mfa = false): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ username, password: PWD, ...(mfa ? { totpCode: generateSync({ secret: TOTP_SECRET }) } : {}) }).expect(200);
    return res.body.accessToken as string;
  };
  const explain = (userId: string, permission: string, query: Record<string, string> = {}, token = () => auditor) =>
    http().get(api(`/users/${userId}/access/explain`)).query({ permission, ...query }).set(bearer(token()));

  beforeAll(async () => {
    w = await createTestWorld();
    await w.seed({ username: 'admin', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
    await w.seed({ username: 'auditeur', password: PWD, roles: ['DPO_AUDITOR'], mfa: true });
    nurseId = (await w.seed({ username: 'infirmier', password: PWD, roles: ['NURSE'], mfa: true })).id.value;
    outsiderId = (await w.seed({ username: 'sans.fiche', password: PWD, roles: ['NURSE'], mfa: true })).id.value;
    await w.seed({ username: 'patient', password: PWD, roles: ['PATIENT'] });
    [admin, auditor, nurseToken, patient] = [await login('admin', true), await login('auditeur', true), await login('infirmier', true), await login('patient')];

    await http().put(api('/organization')).set(bearer(admin)).send({ name: 'Hôpital' }).expect(200);
    const facilityId = (await http().post(api('/facilities')).set(bearer(admin)).send({ name: 'Site', code: 'A1B2-abc-01' }).expect(201)).body.id;
    serviceA = (await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'PED', name: 'Pédiatrie', serviceType: 'CLINICAL' }).expect(201)).body.id;
    serviceB = (await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'CHI', name: 'Chirurgie', serviceType: 'CLINICAL' }).expect(201)).body.id;
    unitA = (await http().post(api(`/structure/${serviceA}/children`)).set(bearer(admin)).send({ code: 'U1', name: 'Néonatologie' }).expect(201)).body.id;
    nurseStaff = (await http().post(api('/staff')).set(bearer(admin)).send({ staffNumber: 'MAT-1', firstName: 'Anna', lastName: 'Abel', professionCode: 'NURSE' }).expect(201)).body.id;
    await http().put(api(`/staff/${nurseStaff}/account`)).set(bearer(admin)).send({ userId: nurseId }).expect(200);
  });
  afterAll(() => w.close());

  describe('contrôle d\'accès des routes', () => {
    it.each([
      ['GET', `/users/5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73/access`],
      ['GET', `/users/5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73/access/explain`],
      ['GET', '/permissions'],
    ])('%s %s : sans jeton → 401 ; infirmier et patient → 403', async (method, url) => {
      const call = (token?: string) => {
        const req = (http() as unknown as Record<string, (u: string) => request.Test>)[method.toLowerCase()](api(url));
        return token ? req.set(bearer(token)) : req;
      };
      expect((await call()).status).toBe(401);
      expect((await call(nurseToken)).status).toBe(403);
      expect((await call(patient)).status).toBe(403);
    });
  });

  describe('droits effectifs', () => {
    it('affiche rôles, permissions avec portée et — sans affectation — aucun service', async () => {
      const res = await http().get(api(`/users/${nurseId}/access`)).set(bearer(auditor)).expect(200);
      expect(res.body).toMatchObject({ userId: nurseId, username: 'infirmier', active: true, roles: [{ code: 'NURSE', requiresMfa: true }], departments: [] });
      expect(res.body.permissions).toEqual(expect.arrayContaining(['files:read:department', 'files.clinical:upload:all', 'staff:read:own:all'.replace(':all', '')]));
      expect(JSON.stringify(res.body)).not.toMatch(/password|secret|hash/i);
      await http().get(api('/users/99999999-9999-4999-8999-999999999999/access')).set(bearer(auditor)).expect(404);
      await http().get(api('/users/pas-un-uuid/access')).set(bearer(auditor)).expect(400);
    });

    it('rattache le compte au SERVICE de son affectation, y compris quand elle vise une unité de ce service', async () => {
      const res = await http().post(api(`/staff/${nurseStaff}/assignments`)).set(bearer(admin)).send({ nodeId: unitA, startDate: '2020-01-01' }).expect(201);
      assignment = res.body.id;
      expect((await http().get(api(`/users/${nurseId}/access`)).set(bearer(auditor)).expect(200)).body.departments).toEqual([serviceA]);
      expect((await http().get(api(`/users/${outsiderId}/access`)).set(bearer(auditor)).expect(200)).body.departments).toEqual([]);
    });

    it('explique les décisions : son service accordé, un autre service refusé, sans contexte refusé', async () => {
      const own = await explain(nurseId, 'files:read', { departmentId: serviceA }).expect(200);
      expect(own.body).toEqual({ allowed: true, grantedScope: 'department', reason: 'DEPARTMENT' });
      expect((await explain(nurseId, 'files:read', { departmentId: serviceB }).expect(200)).body).toEqual({ allowed: false, grantedScope: 'department', reason: 'OUT_OF_SCOPE' });
      expect((await explain(nurseId, 'files:read').expect(200)).body).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
      expect((await explain(nurseId, 'files:upload').expect(200)).body).toMatchObject({ allowed: true, reason: 'ALL' }); // upload : portée « all »
      expect((await explain(nurseId, 'iam.users:manage').expect(200)).body).toEqual({ allowed: false, grantedScope: null, reason: 'NO_PERMISSION' });
      expect((await explain(outsiderId, 'files:read', { departmentId: serviceA }).expect(200)).body).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
    });

    it('rejette une permission mal formée (422) et un compte inconnu (404)', async () => {
      await explain(nurseId, 'files:read:all').expect(422);
      await explain(nurseId, '').expect(422);
      await explain('99999999-9999-4999-8999-999999999999', 'files:read').expect(404);
    });

    it('retire le service dès la fin de l\'affectation, sans délai de cache', async () => {
      await http().post(api(`/assignments/${assignment}/end`)).set(bearer(admin)).send({ endDate: '2020-06-30' }).expect(200);
      expect((await http().get(api(`/users/${nurseId}/access`)).set(bearer(auditor))).body.departments).toEqual([]);
      expect((await explain(nurseId, 'files:read', { departmentId: serviceA })).body).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
    });

    it('ignore une affectation à venir et une unité désactivée', async () => {
      await http().post(api(`/staff/${nurseStaff}/assignments`)).set(bearer(admin)).send({ nodeId: unitA, startDate: '2999-01-01' }).expect(201);
      expect((await http().get(api(`/users/${nurseId}/access`)).set(bearer(auditor))).body.departments).toEqual([]);

      const unit = (await http().post(api(`/structure/${serviceB}/children`)).set(bearer(admin)).send({ code: 'U9', name: 'Bloc' }).expect(201)).body.id;
      await http().post(api(`/staff/${nurseStaff}/assignments`)).set(bearer(admin)).send({ nodeId: unit, startDate: '2021-01-01' }).expect(201);
      expect((await http().get(api(`/users/${nurseId}/access`)).set(bearer(auditor))).body.departments).toEqual([serviceB]);
      await http().post(api(`/structure/${unit}/deactivate`)).set(bearer(admin)).expect(200);
      expect((await http().get(api(`/users/${nurseId}/access`)).set(bearer(auditor))).body.departments).toEqual([]);
    });

    it("ne donne plus aucun service à la fiche d'un membre parti", async () => {
      const staff = (await http().post(api('/staff')).set(bearer(admin)).send({ staffNumber: 'MAT-2', firstName: 'Paul', lastName: 'Noir', professionCode: 'NURSE' }).expect(201)).body.id;
      await http().put(api(`/staff/${staff}/account`)).set(bearer(admin)).send({ userId: outsiderId }).expect(200);
      await http().post(api(`/staff/${staff}/assignments`)).set(bearer(admin)).send({ nodeId: serviceB, startDate: '2021-01-01' }).expect(201);
      expect((await http().get(api(`/users/${outsiderId}/access`)).set(bearer(auditor))).body.departments).toEqual([serviceB]);
      await http().post(api(`/staff/${staff}/depart`)).set(bearer(admin)).send({ departedOn: '2022-01-01' }).expect(200);
      expect((await http().get(api(`/users/${outsiderId}/access`)).set(bearer(auditor))).body.departments).toEqual([]);
      expect((await explain(outsiderId, 'files:read', { departmentId: serviceB })).body).toMatchObject({ allowed: false, reason: 'OUT_OF_SCOPE' });
    });
  });

  describe('inventaire des permissions', () => {
    it('relève les permissions exigées par les routes, croisées avec les rôles qui les accordent', async () => {
      const res = await http().get(api('/permissions')).set(bearer(auditor)).expect(200);
      const byName = new Map((res.body as { permission: string; routes: { method: string; path: string; requires: string }[]; grantedTo: { role: string; scope: string }[] }[]).map((e) => [e.permission, e]));
      expect([...byName.keys()]).toEqual([...byName.keys()].sort((a, b) => a.localeCompare(b)));

      const manage = byName.get('iam.users:manage')!;
      expect(manage.routes).toEqual(expect.arrayContaining([{ method: 'POST', path: '/api/v1/users', requires: 'iam.users:manage:all' }, { method: 'PUT', path: '/api/v1/users/:id/roles', requires: 'iam.users:manage:all' }]));
      expect(manage.grantedTo).toEqual([{ role: 'SYSTEM_ADMIN', scope: 'all' }]);

      expect(byName.get('audit:read')!.routes.map((r) => r.path)).toEqual(['/api/v1/audit/events', '/api/v1/audit/verify']);
      expect(byName.get('audit:read')!.grantedTo.map((g) => g.role)).toEqual(['DPO_AUDITOR', 'SYSTEM_ADMIN']);
      expect(byName.get('staff:read')!.routes.length).toBeGreaterThan(2);
      const staffRead = byName.get('staff:read')!.grantedTo;
      expect(staffRead.filter((g) => g.scope === 'all').map((g) => g.role)).toEqual(['DPO_AUDITOR', 'SYSTEM_ADMIN']);
      expect(staffRead.filter((g) => g.scope === 'own').map((g) => g.role)).toEqual(expect.arrayContaining(['NURSE', 'DOCTOR', 'CASHIER']));
      expect(staffRead.some((g) => g.role === 'PATIENT')).toBe(false);
    });

    it('signale les permissions accordées mais exigées par aucune route (module à venir ou obsolète)', async () => {
      const res = await http().get(api('/permissions')).set(bearer(auditor)).expect(200);
      const unused = (res.body as { permission: string; routes: unknown[] }[]).filter((e) => e.routes.length === 0).map((e) => e.permission);
      expect(unused).toEqual(expect.arrayContaining(['files:read', 'files.clinical:read']));
      expect(unused).not.toContain('iam.users:manage');
    });
  });
});

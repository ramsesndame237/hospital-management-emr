import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';

const PWD = 'une phrase de passe solide';

describe('API structure /api/v1 (HTTP réel, PostgreSQL réel)', () => {
  let w: TestWorld;
  let admin: string;
  let nurse: string;
  let patient: string;
  let facilityId: string;
  const http = () => request(w.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, mfa = false): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ username, password: PWD, ...(mfa ? { totpCode: generateSync({ secret: TOTP_SECRET }) } : {}) }).expect(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    w = await createTestWorld();
    await w.seed({ username: 'admin', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
    await w.seed({ username: 'infirmier', password: PWD, roles: ['NURSE'], mfa: true });
    await w.seed({ username: 'patient', password: PWD, roles: ['PATIENT'] });
    admin = await login('admin', true);
    nurse = await login('infirmier', true);
    patient = await login('patient');
    await http().put('/api/v1/organization').set(bearer(admin)).send({ name: 'Hôpital' }).expect(200);
    facilityId = (await http().post('/api/v1/facilities').set(bearer(admin)).send({ name: 'Site', code: 'A1B2-abc-01' }).expect(201)).body.id;
  });
  afterAll(() => w.close());

  const ID = '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001';
  it.each([
    ['GET', '/api/v1/facilities/:f/structure'],
    ['POST', '/api/v1/facilities/:f/services'],
    ['GET', `/api/v1/structure/${ID}`],
    ['POST', `/api/v1/structure/${ID}/children`],
    ['PATCH', `/api/v1/structure/${ID}`],
    ['POST', `/api/v1/structure/${ID}/deactivate`],
    ['POST', `/api/v1/structure/${ID}/activate`],
  ])('%s %s sans jeton → 401 ; patient → 403', async (method, rawUrl) => {
    const url = rawUrl.replace(':f', '7c1e0c1e-6f2a-4f55-8c61-0b6f3e0d9a21');
    const call = (token?: string) => {
      const req = (http() as unknown as Record<string, (u: string) => request.Test>)[method.toLowerCase()](url);
      return token ? req.set(bearer(token)) : req;
    };
    expect((await call()).status).toBe(401);
    expect((await call(patient)).status).toBe(403);
  });

  describe("construction d'une structure", () => {
    let service: string;
    let unit: string;
    let room: string;
    let bed: string;
    const api = (path: string) => `/api/v1${path}`;

    it('crée un service (spécialité vérifiée dans les référentiels), puis unité, salle et lit', async () => {
      const s = await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'ped', name: 'Pédiatrie', serviceType: 'CLINICAL', specialtyCode: 'pediatrics' }).expect(201);
      expect(s.body).toMatchObject({ kind: 'SERVICE', code: 'PED', serviceType: 'CLINICAL', specialtyCode: 'PEDIATRICS', parentId: null, facilityId });
      service = s.body.id;
      unit = (await http().post(api(`/structure/${service}/children`)).set(bearer(admin)).send({ code: 'U1', name: 'Néonatologie' }).expect(201)).body.id;
      const r = await http().post(api(`/structure/${unit}/children`)).set(bearer(admin)).send({ code: 'R1', name: 'Salle 1', floor: 'RDC' }).expect(201);
      expect(r.body).toMatchObject({ kind: 'ROOM', floor: 'RDC' });
      room = r.body.id;
      const b = await http().post(api(`/structure/${room}/children`)).set(bearer(admin)).send({ code: 'B1', name: 'Lit 1' }).expect(201);
      expect(b.body).toMatchObject({ kind: 'BED', parentId: room });
      bed = b.body.id;
    });

    it('applique les règles du métier : doublon 409, spécialité inconnue 422, lit sans enfant 422, étage hors salle 422', async () => {
      const dup = await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'PED', name: 'Autre', serviceType: 'CLINICAL' }).expect(409);
      expect(dup.body.code ?? dup.body.error?.code).toBe('STRUCTURE_CODE_ALREADY_EXISTS');
      await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'CAR', name: 'Cardio', serviceType: 'CLINICAL', specialtyCode: 'ASTROLOGY' }).expect(422);
      await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'CAR', name: 'Cardio', serviceType: 'HOTEL' }).expect(422);
      await http().post(api(`/structure/${bed}/children`)).set(bearer(admin)).send({ code: 'X', name: 'X' }).expect(422);
      await http().post(api(`/structure/${service}/children`)).set(bearer(admin)).send({ code: 'U2', name: 'U2', floor: '2' }).expect(422);
      await http().post(api(`/facilities/99999999-9999-4999-8999-999999999999/services`)).set(bearer(admin)).send({ code: 'X', name: 'X', serviceType: 'SUPPORT' }).expect(404);
      await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'X' }).expect(400);
    });

    it("le personnel lit l'arbre et ses totaux, mais ne peut rien modifier", async () => {
      const tree = await http().get(api(`/facilities/${facilityId}/structure`)).set(bearer(nurse)).expect(200);
      expect(tree.body.totals).toEqual({ services: 1, units: 1, rooms: 1, beds: 1 });
      expect(tree.body.services[0].children[0].children[0].children[0]).toMatchObject({ code: 'B1', kind: 'BED', children: [] });
      await http().get(api(`/structure/${room}`)).set(bearer(nurse)).expect(200);
      await http().post(api(`/structure/${unit}/children`)).set(bearer(nurse)).send({ code: 'R9', name: 'x' }).expect(403);
      await http().patch(api(`/structure/${room}`)).set(bearer(nurse)).send({ name: 'x' }).expect(403);
    });

    it('modifie un élément (attribut étranger au niveau refusé) sans toucher au code', async () => {
      const patched = await http().patch(api(`/structure/${service}`)).set(bearer(admin)).send({ name: 'Pédiatrie générale', specialtyCode: null, code: 'AUTRE' }).expect(200);
      expect(patched.body).toMatchObject({ name: 'Pédiatrie générale', specialtyCode: null, code: 'PED' });
      await http().patch(api(`/structure/${room}`)).set(bearer(admin)).send({ floor: '1' }).expect(200);
      const bad = await http().patch(api(`/structure/${unit}`)).set(bearer(admin)).set('Accept-Language', 'en').send({ serviceType: 'CLINICAL' }).expect(422);
      expect(JSON.stringify(bad.body)).toContain('does not apply to this level');
      await http().patch(api(`/structure/${ID}`)).set(bearer(admin)).send({ name: 'x' }).expect(404);
      await http().patch(api('/structure/pas-un-uuid')).set(bearer(admin)).send({ name: 'x' }).expect(400);
    });

    it('désactive de bas en haut (409 sinon) et réactive de haut en bas (409 sinon)', async () => {
      await http().post(api(`/structure/${service}/deactivate`)).set(bearer(admin)).expect(409);
      for (const id of [bed, room, unit, service]) await http().post(api(`/structure/${id}/deactivate`)).set(bearer(admin)).expect(200);
      const hidden = await http().get(api(`/facilities/${facilityId}/structure`)).set(bearer(nurse)).expect(200);
      expect(hidden.body).toMatchObject({ totals: { services: 0, beds: 0 }, services: [] });
      const all = await http().get(api(`/facilities/${facilityId}/structure?includeInactive=true`)).set(bearer(nurse)).expect(200);
      expect(all.body.services[0]).toMatchObject({ code: 'PED', active: false });

      await http().post(api(`/structure/${bed}/activate`)).set(bearer(admin)).expect(409);
      for (const id of [service, unit, room, bed]) await http().post(api(`/structure/${id}/activate`)).set(bearer(admin)).expect(200);
      expect((await http().get(api(`/facilities/${facilityId}/structure`)).set(bearer(nurse))).body.totals.beds).toBe(1);
    });

    it("refuse une spécialité désactivée dans les référentiels", async () => {
      const pediatrics = (await http().get('/api/v1/referentials/SPECIALTY/entries?search=PEDIATRICS').set(bearer(admin))).body.items[0];
      await http().post(`/api/v1/referentials/SPECIALTY/entries/${pediatrics.id}/deactivate`).set(bearer(admin)).expect(200);
      await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'PED2', name: 'Pédiatrie 2', serviceType: 'CLINICAL', specialtyCode: 'PEDIATRICS' }).expect(422);
      await http().post(`/api/v1/referentials/SPECIALTY/entries/${pediatrics.id}/activate`).set(bearer(admin)).expect(200);
      await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'PED2', name: 'Pédiatrie 2', serviceType: 'CLINICAL', specialtyCode: 'PEDIATRICS' }).expect(201);
    });
  });

  it("journalise chaque changement avec l'acteur, sans casser la chaîne d'audit", async () => {
    const rows = await w.sql.query<{ action: string; actor_id: string }>("SELECT action, actor_id FROM audit_log WHERE action LIKE 'administration.structure.%'");
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ['create', 'update', 'deactivate', 'activate']) expect(actions).toContain(`administration.structure.${a}`);
    expect(rows.every((r) => !!r.actor_id)).toBe(true);
    expect(await w.audit.verifyChain()).toMatchObject({ valid: true });
  });
});

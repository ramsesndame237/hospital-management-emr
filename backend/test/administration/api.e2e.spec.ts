import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';

const PWD = 'une phrase de passe solide';
const CODE = 'A1B2-abc-01';

describe('API administration /api/v1 (HTTP réel, PostgreSQL réel)', () => {
  let w: TestWorld;
  let admin: string;
  let auditor: string;
  let cashier: string;
  const http = () => request(w.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, mfa = false): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ username, password: PWD, ...(mfa ? { totpCode: generateSync({ secret: TOTP_SECRET }) } : {}) }).expect(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    w = await createTestWorld();
    await w.seed({ username: 'admin', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
    await w.seed({ username: 'auditeur', password: PWD, roles: ['DPO_AUDITOR'], mfa: true });
    await w.seed({ username: 'caissier', password: PWD, roles: ['CASHIER'] });
    admin = await login('admin', true);
    auditor = await login('auditeur', true);
    cashier = await login('caissier');
  });
  afterAll(() => w.close());

  it.each([
    ['GET', '/api/v1/organization'],
    ['PUT', '/api/v1/organization'],
    ['GET', '/api/v1/facilities'],
    ['POST', '/api/v1/facilities'],
    ['PATCH', '/api/v1/facilities/7c1e0c1e-6f2a-4f55-8c61-0b6f3e0d9a21'],
    ['POST', '/api/v1/facilities/7c1e0c1e-6f2a-4f55-8c61-0b6f3e0d9a21/status'],
  ])('%s %s sans jeton → 401 ; sans la permission → 403', async (method, url) => {
    const call = (token?: string) => {
      const req = (http() as unknown as Record<string, (u: string) => request.Test>)[method.toLowerCase()](url);
      return token ? req.set(bearer(token)) : req;
    };
    expect((await call()).status).toBe(401);
    expect((await call(cashier)).status).toBe(403);
  });

  describe('organisation', () => {
    it("répond 404 tant qu'elle n'est pas configurée, et refuse d'enregistrer un établissement", async () => {
      const res = await http().get('/api/v1/organization').set(bearer(admin)).expect(404);
      expect(res.body.code ?? res.body.error?.code).toBe('ORGANIZATION_NOT_FOUND');
      await http().post('/api/v1/facilities').set(bearer(admin)).send({ name: 'Site', code: CODE }).expect(404);
    });

    it('se configure, se relit et se renomme (administrateur) ; le DPO ne peut que lire', async () => {
      const created = await http().put('/api/v1/organization').set(bearer(admin)).send({ name: 'Hôpital Central' }).expect(200);
      expect(created.body).toMatchObject({ name: 'Hôpital Central', id: expect.any(String) });
      await http().get('/api/v1/organization').set(bearer(auditor)).expect(200);
      await http().put('/api/v1/organization').set(bearer(auditor)).send({ name: 'Piraté' }).expect(403);
      const renamed = await http().put('/api/v1/organization').set(bearer(admin)).send({ name: 'Groupe Hospitalier' }).expect(200);
      expect(renamed.body.id).toBe(created.body.id);
    });

    it('rejette un corps invalide (400) en nommant le champ', async () => {
      const res = await http().put('/api/v1/organization').set(bearer(admin)).send({ name: 42 }).expect(400);
      expect(JSON.stringify(res.body)).toContain('name');
      await http().put('/api/v1/organization').set(bearer(admin)).send({ name: 'x'.repeat(201) }).expect(400);
      // Champ inconnu : ignoré par le tuyau de validation global (liste blanche), jamais transmis aux cas d'usage.
      const res2 = await http().put('/api/v1/organization').set(bearer(admin)).send({ name: 'Groupe Hospitalier', id: 'imposé' }).expect(200);
      expect(res2.body.id).not.toBe('imposé');
    });
  });

  describe('établissements', () => {
    let id: string;

    it('enregistre un établissement « en construction », visible du DPO', async () => {
      const res = await http().post('/api/v1/facilities').set(bearer(admin)).send({ name: 'Site principal', code: CODE }).expect(201);
      expect(res.body).toMatchObject({ code: CODE, name: 'Site principal', status: 'OPERATIONAL_UNDER_CONSTRUCTION', operational: false });
      id = res.body.id;
      const read = await http().get(`/api/v1/facilities/${id}`).set(bearer(auditor)).expect(200);
      expect(read.body.id).toBe(id);
      await http().post('/api/v1/facilities').set(bearer(auditor)).send({ name: 'Autre', code: 'B2C3-def-02' }).expect(403);
    });

    it('refuse un code déjà pris (409) et un code mal formé (422), avec un message traduit', async () => {
      const dup = await http().post('/api/v1/facilities').set(bearer(admin)).send({ name: 'Doublon', code: CODE }).expect(409);
      expect(dup.body.code ?? dup.body.error?.code).toBe('FACILITY_CODE_ALREADY_EXISTS');
      const bad = await http().post('/api/v1/facilities').set(bearer(admin)).set('Accept-Language', 'en').send({ name: 'X', code: 'nope' }).expect(422);
      expect(JSON.stringify(bad.body)).toContain('The facility code is incorrect.');
    });

    it('modifie le nom, change le statut, et refuse un statut inconnu', async () => {
      const patched = await http().patch(`/api/v1/facilities/${id}`).set(bearer(admin)).send({ name: 'Site nord' }).expect(200);
      expect(patched.body).toMatchObject({ name: 'Site nord', code: CODE });
      const open = await http().post(`/api/v1/facilities/${id}/status`).set(bearer(admin)).send({ status: 'OPERATIONAL_OPEN' }).expect(200);
      expect(open.body).toMatchObject({ status: 'OPERATIONAL_OPEN', operational: true });
      await http().post(`/api/v1/facilities/${id}/status`).set(bearer(admin)).send({ status: 'OUVERT' }).expect(400);
    });

    it('répond 404 pour un établissement inconnu et 400 pour un identifiant mal formé', async () => {
      await http().get('/api/v1/facilities/00000000-0000-4000-8000-0000000000ff').set(bearer(admin)).expect(404);
      await http().get('/api/v1/facilities/pas-un-uuid').set(bearer(admin)).expect(400);
    });

    it('liste avec pagination', async () => {
      await http().post('/api/v1/facilities').set(bearer(admin)).send({ name: 'Annexe', code: 'B2C3-def-02' }).expect(201);
      const page = await http().get('/api/v1/facilities?offset=0&limit=1').set(bearer(auditor)).expect(200);
      expect(page.body).toMatchObject({ total: 2, offset: 0, limit: 1 });
      expect(page.body.items.map((f: { name: string }) => f.name)).toEqual(['Annexe']);
    });
  });

  it("journalise chaque changement avec l'acteur, sans erreur de chaîne", async () => {
    const rows = await w.sql.query<{ action: string; actor_id: string }>("SELECT action, actor_id FROM audit_log WHERE action LIKE 'administration.%' ORDER BY id");
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining([
      'administration.organization.create', 'administration.organization.rename',
      'administration.facility.register', 'administration.facility.update', 'administration.facility.status.change',
    ]));
    expect(rows.every((r) => !!r.actor_id)).toBe(true);
    expect(await w.audit.verifyChain()).toMatchObject({ valid: true });
  });
});

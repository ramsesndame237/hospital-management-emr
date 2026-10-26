import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';

const PWD = 'une phrase de passe solide';
const BASE = '/api/v1/referentials';

describe('API référentiels /api/v1/referentials (HTTP réel, PostgreSQL réel)', () => {
  let w: TestWorld;
  let admin: string;
  let doctor: string;
  let patient: string;
  const http = () => request(w.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, mfa = false): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ username, password: PWD, ...(mfa ? { totpCode: generateSync({ secret: TOTP_SECRET }) } : {}) }).expect(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    w = await createTestWorld();
    await w.seed({ username: 'admin', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
    await w.seed({ username: 'medecin', password: PWD, roles: ['DOCTOR'], mfa: true });
    await w.seed({ username: 'patient', password: PWD, roles: ['PATIENT'] });
    admin = await login('admin', true);
    doctor = await login('medecin', true);
    patient = await login('patient');
  });
  afterAll(() => w.close());

  const ENTRY = '2f6d1f6e-9a0c-4b5e-8f2e-6a1d4c9b7e10';
  it.each([
    ['GET', BASE],
    ['GET', `${BASE}/SPECIALTY/entries`],
    ['POST', `${BASE}/SPECIALTY/entries`],
    ['PATCH', `${BASE}/SPECIALTY/entries/${ENTRY}`],
    ['POST', `${BASE}/SPECIALTY/entries/${ENTRY}/deactivate`],
    ['POST', `${BASE}/SPECIALTY/entries/${ENTRY}/activate`],
  ])('%s %s sans jeton → 401 ; patient → 403', async (method, url) => {
    const call = (token?: string) => {
      const req = (http() as unknown as Record<string, (u: string) => request.Test>)[method.toLowerCase()](url);
      return token ? req.set(bearer(token)) : req;
    };
    expect((await call()).status).toBe(401);
    expect((await call(patient)).status).toBe(403);
  });

  it('le personnel lit les catalogues et leurs valeurs de départ ; il ne peut pas les modifier', async () => {
    const catalogs = await http().get(BASE).set(bearer(doctor)).expect(200);
    expect(catalogs.body.map((c: { code: string }) => c.code)).toEqual(['MEASUREMENT_UNIT', 'PROFESSION', 'SPECIALTY', 'VISIT_REASON']);
    expect(catalogs.body[2]).toMatchObject({ labels: { fr: 'Spécialités médicales', en: 'Medical specialties' }, entryCount: 12, activeEntryCount: 12 });

    const page = await http().get(`${BASE}/specialty/entries?limit=3`).set(bearer(doctor)).expect(200);
    expect(page.body).toMatchObject({ total: 12, offset: 0, limit: 3 });
    expect(page.body.items.map((e: { code: string }) => e.code)).toEqual(['GENERAL_MEDICINE', 'INTERNAL_MEDICINE', 'PEDIATRICS']);

    await http().post(`${BASE}/SPECIALTY/entries`).set(bearer(doctor)).send({ code: 'X', labels: { fr: 'X' } }).expect(403);
  });

  it('répond 404 pour un catalogue ou une entrée inconnus, 400 pour un identifiant mal formé', async () => {
    const res = await http().get(`${BASE}/NOPE/entries`).set(bearer(doctor)).expect(404);
    expect(res.body.code ?? res.body.error?.code).toBe('REFERENTIAL_CATALOG_NOT_FOUND');
    await http().patch(`${BASE}/SPECIALTY/entries/${ENTRY}`).set(bearer(admin)).send({ sortOrder: 1 }).expect(404);
    await http().patch(`${BASE}/SPECIALTY/entries/pas-un-uuid`).set(bearer(admin)).send({ sortOrder: 1 }).expect(400);
    // Le tuyau de validation global convertit d'abord les paramètres : un nombre illisible retombe sur la valeur par défaut.
    expect((await http().get(`${BASE}/SPECIALTY/entries?limit=abc`).set(bearer(doctor)).expect(200)).body.limit).toBe(50);
  });

  describe("cycle de vie d'une entrée (administrateur)", () => {
    let id: string;

    it('ajoute une entrée, refuse un doublon (409) et des données invalides', async () => {
      const created = await http().post(`${BASE}/SPECIALTY/entries`).set(bearer(admin)).send({ code: 'nephrology', labels: { fr: 'Néphrologie', en: 'Nephrology' }, sortOrder: 15 }).expect(201);
      expect(created.body).toMatchObject({ catalog: 'SPECIALTY', code: 'NEPHROLOGY', active: true, sortOrder: 15, labels: { fr: 'Néphrologie', en: 'Nephrology' } });
      id = created.body.id;

      const dup = await http().post(`${BASE}/SPECIALTY/entries`).set(bearer(admin)).send({ code: 'NEPHROLOGY', labels: { fr: 'Autre' } }).expect(409);
      expect(dup.body.code ?? dup.body.error?.code).toBe('REFERENTIAL_ENTRY_CODE_ALREADY_EXISTS');
      await http().post(`${BASE}/SPECIALTY/entries`).set(bearer(admin)).send({ code: 'MAUVAIS CODE', labels: { fr: 'x' } }).expect(422);
      await http().post(`${BASE}/SPECIALTY/entries`).set(bearer(admin)).send({ code: 'OK_CODE', labels: {} }).expect(422);
      await http().post(`${BASE}/SPECIALTY/entries`).set(bearer(admin)).send({ code: 'OK_CODE', labels: 'Néphrologie' }).expect(400);
      await http().post(`${BASE}/SPECIALTY/entries`).set(bearer(admin)).send({ code: 'OK_CODE', labels: { fr: 'x' }, sortOrder: 1.5 }).expect(400);
    });

    it('traduit les erreurs selon la langue demandée', async () => {
      const res = await http().post(`${BASE}/SPECIALTY/entries`).set(bearer(admin)).set('Accept-Language', 'en').send({ code: 'MAUVAIS CODE', labels: { fr: 'x' } }).expect(422);
      expect(JSON.stringify(res.body)).toContain('Invalid entry code');
    });

    it('modifie les libellés sans toucher au code', async () => {
      const res = await http().patch(`${BASE}/SPECIALTY/entries/${id}`).set(bearer(admin)).send({ labels: { fr: 'Néphrologie adulte' }, code: 'AUTRE' }).expect(200);
      expect(res.body).toMatchObject({ code: 'NEPHROLOGY', labels: { fr: 'Néphrologie adulte' }, sortOrder: 15 });
    });

    it('désactive : absente de la liste par défaut, présente avec includeInactive, réactivable', async () => {
      await http().post(`${BASE}/SPECIALTY/entries/${id}/deactivate`).set(bearer(admin)).expect(200);
      const defaults = await http().get(`${BASE}/SPECIALTY/entries?search=nephro`).set(bearer(doctor)).expect(200);
      expect(defaults.body.total).toBe(0);
      const all = await http().get(`${BASE}/SPECIALTY/entries?search=nephro&includeInactive=true`).set(bearer(doctor)).expect(200);
      expect(all.body.items).toMatchObject([{ code: 'NEPHROLOGY', active: false }]);
      const counts = (await http().get(BASE).set(bearer(doctor))).body.find((c: { code: string }) => c.code === 'SPECIALTY');
      expect(counts).toMatchObject({ entryCount: 13, activeEntryCount: 12 });
      await http().post(`${BASE}/SPECIALTY/entries/${id}/activate`).set(bearer(admin)).expect(200);
    });

    it("n'atteint pas l'entrée par un autre catalogue", async () => {
      await http().patch(`${BASE}/MEASUREMENT_UNIT/entries/${id}`).set(bearer(admin)).send({ sortOrder: 1 }).expect(404);
    });
  });

  it("journalise chaque changement avec l'acteur, sans casser la chaîne d'audit", async () => {
    const rows = await w.sql.query<{ action: string; actor_id: string }>("SELECT action, actor_id FROM audit_log WHERE action LIKE 'referentials.%' ORDER BY id");
    expect(rows.map((r) => r.action)).toEqual([
      'referentials.entry.create', 'referentials.entry.update', 'referentials.entry.deactivate', 'referentials.entry.activate',
    ]);
    expect(rows.every((r) => !!r.actor_id)).toBe(true);
    expect(await w.audit.verifyChain()).toMatchObject({ valid: true });
  });
});

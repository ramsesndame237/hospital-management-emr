import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';

const PWD = 'une phrase de passe solide';
const api = (path: string) => `/api/v1${path}`;

describe('API personnel et affectations /api/v1 (HTTP réel, PostgreSQL réel)', () => {
  let w: TestWorld;
  let admin: string;
  let auditor: string;
  let nurse: string;
  let patient: string;
  let nurseUserId: string;
  let facilityId: string;
  let serviceId: string;
  let unitId: string;
  let roomId: string;
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
    nurseUserId = (await w.seed({ username: 'infirmier', password: PWD, roles: ['NURSE'], mfa: true })).id.value;
    await w.seed({ username: 'patient', password: PWD, roles: ['PATIENT'] });
    [admin, auditor, nurse, patient] = [await login('admin', true), await login('auditeur', true), await login('infirmier', true), await login('patient')];

    await http().put(api('/organization')).set(bearer(admin)).send({ name: 'Hôpital' }).expect(200);
    facilityId = (await http().post(api('/facilities')).set(bearer(admin)).send({ name: 'Site', code: 'A1B2-abc-01' }).expect(201)).body.id;
    serviceId = (await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'PED', name: 'Pédiatrie', serviceType: 'CLINICAL' }).expect(201)).body.id;
    unitId = (await http().post(api(`/structure/${serviceId}/children`)).set(bearer(admin)).send({ code: 'U1', name: 'Néonatologie' }).expect(201)).body.id;
    roomId = (await http().post(api(`/structure/${unitId}/children`)).set(bearer(admin)).send({ code: 'R1', name: 'Salle 1' }).expect(201)).body.id;
  });
  afterAll(() => w.close());

  const ID = 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11';
  it.each([
    ['GET', '/staff'], ['POST', '/staff'], ['GET', '/staff/me'], ['GET', `/staff/${ID}`], ['PATCH', `/staff/${ID}`], ['POST', `/staff/${ID}/depart`],
    ['PUT', `/staff/${ID}/account`], ['DELETE', `/staff/${ID}/account`], ['GET', `/staff/${ID}/assignments`], ['POST', `/staff/${ID}/assignments`],
    ['GET', `/structure/${ID}/staff`], ['POST', `/assignments/${ID}/end`], ['PATCH', `/assignments/${ID}`],
  ])('%s %s sans jeton → 401 ; patient → 403', async (method, url) => {
    const call = (token?: string) => {
      const req = (http() as unknown as Record<string, (u: string) => request.Test>)[method.toLowerCase()](api(url));
      return token ? req.set(bearer(token)) : req;
    };
    expect((await call()).status).toBe(401);
    expect((await call(patient)).status).toBe(403);
  });

  describe('fiches', () => {
    let staffId: string;
    const CURIE = { staffNumber: 'mat-001', firstName: 'Marie', lastName: 'Curie', professionCode: 'doctor', specialtyCode: 'pediatrics', email: 'm.curie@hopital.example', hiredOn: '2024-09-01' };

    it('enregistre une fiche (profession et spécialité vérifiées dans les référentiels)', async () => {
      const res = await http().post(api('/staff')).set(bearer(admin)).send(CURIE).expect(201);
      expect(res.body).toMatchObject({ staffNumber: 'MAT-001', professionCode: 'DOCTOR', specialtyCode: 'PEDIATRICS', status: 'ACTIVE', userId: null, hiredOn: '2024-09-01' });
      staffId = res.body.id;
    });

    it('applique les règles : doublon 409, référentiel inconnu 422, date invalide 422, corps invalide 400, langue demandée respectée', async () => {
      const dup = await http().post(api('/staff')).set(bearer(admin)).send(CURIE).expect(409);
      expect(dup.body.code ?? dup.body.error?.code).toBe('STAFF_NUMBER_ALREADY_EXISTS');
      const other = { ...CURIE, staffNumber: 'MAT-002' };
      await http().post(api('/staff')).set(bearer(admin)).send({ ...other, professionCode: 'WIZARD' }).expect(422);
      await http().post(api('/staff')).set(bearer(admin)).send({ ...other, specialtyCode: 'ASTROLOGY' }).expect(422);
      await http().post(api('/staff')).set(bearer(admin)).send({ ...other, hiredOn: '2024-02-30' }).expect(422);
      await http().post(api('/staff')).set(bearer(admin)).send({ staffNumber: 'MAT-009' }).expect(400);
      const en = await http().post(api('/staff')).set(bearer(admin)).set('Accept-Language', 'en').send({ ...other, email: 'pas-un-email' }).expect(422);
      expect(JSON.stringify(en.body)).toContain('Invalid email address');
    });

    it("l'auditeur lit mais ne modifie pas ; l'infirmier n'a pas accès à l'annuaire", async () => {
      expect((await http().get(api(`/staff/${staffId}`)).set(bearer(auditor)).expect(200)).body.id).toBe(staffId);
      await http().patch(api(`/staff/${staffId}`)).set(bearer(auditor)).send({ lastName: 'X' }).expect(403);
      await http().get(api('/staff')).set(bearer(nurse)).expect(403);
      await http().get(api(`/staff/${staffId}`)).set(bearer(nurse)).expect(403);
    });

    it('modifie sans toucher au matricule, liste, filtre et pagine', async () => {
      const patched = await http().patch(api(`/staff/${staffId}`)).set(bearer(admin)).send({ lastName: 'Skłodowska-Curie', specialtyCode: null, staffNumber: 'AUTRE' }).expect(200);
      expect(patched.body).toMatchObject({ lastName: 'Skłodowska-Curie', specialtyCode: null, staffNumber: 'MAT-001' });
      await http().post(api('/staff')).set(bearer(admin)).send({ staffNumber: 'MAT-002', firstName: 'Anna', lastName: 'Abel', professionCode: 'NURSE' }).expect(201);
      const page = await http().get(api('/staff?limit=1')).set(bearer(auditor)).expect(200);
      expect(page.body).toMatchObject({ total: 2, offset: 0, limit: 1 });
      expect(page.body.items[0].lastName).toBe('Abel');
      expect((await http().get(api('/staff?search=skło&status=ACTIVE&professionCode=doctor')).set(bearer(auditor))).body.total).toBe(1);
      await http().get(api('/staff?status=RETIRED')).set(bearer(auditor)).expect(422);
      await http().get(api('/staff/pas-un-uuid')).set(bearer(admin)).expect(400);
      await http().get(api(`/staff/${ID}`)).set(bearer(admin)).expect(404);
    });

    it("relie le compte de l'infirmier : « mon profil » l'expose avec ses affectations, et personne d'autre ne peut le lire", async () => {
      await http().get(api('/staff/me')).set(bearer(nurse)).expect(404);
      const nurseStaff = (await http().get(api('/staff?search=MAT-002')).set(bearer(admin))).body.items[0].id;
      const linked = await http().put(api(`/staff/${nurseStaff}/account`)).set(bearer(admin)).send({ userId: nurseUserId }).expect(200);
      expect(linked.body.userId).toBe(nurseUserId);
      await http().put(api(`/staff/${staffId}/account`)).set(bearer(admin)).send({ userId: nurseUserId }).expect(409);
      await http().put(api(`/staff/${staffId}/account`)).set(bearer(admin)).send({ userId: '99999999-9999-4999-8999-999999999999' }).expect(422);
      await http().put(api(`/staff/${staffId}/account`)).set(bearer(admin)).send({ userId: 'nope' }).expect(400);

      await http().post(api(`/staff/${nurseStaff}/assignments`)).set(bearer(admin)).send({ nodeId: unitId, startDate: '2025-01-01', primary: true }).expect(201);
      const me = await http().get(api('/staff/me')).set(bearer(nurse)).expect(200);
      expect(me.body.staff).toMatchObject({ id: nurseStaff, lastName: 'Abel' });
      expect(me.body.assignments).toMatchObject([{ nodeId: unitId, primary: true, current: true }]);
      await http().get(api('/staff/me')).set(bearer(admin)).expect(404); // l'administrateur n'a pas de fiche
    });
  });

  describe('affectations', () => {
    let staffId: string;
    let assignmentId: string;

    beforeAll(async () => {
      staffId = (await http().post(api('/staff')).set(bearer(admin)).send({ staffNumber: 'MAT-100', firstName: 'Léa', lastName: 'Martin', professionCode: 'DOCTOR', hiredOn: '2025-01-01' }).expect(201)).body.id;
    });

    it('affecte à un service ou une unité ; refuse une salle (422), un élément inconnu (404) et une période hors emploi (422)', async () => {
      const res = await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ nodeId: serviceId, startDate: '2025-02-01', primary: true }).expect(201);
      expect(res.body).toMatchObject({ staffId, nodeId: serviceId, facilityId, startDate: '2025-02-01', endDate: null, primary: true, current: true });
      assignmentId = res.body.id;
      await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ nodeId: roomId }).expect(422);
      await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ nodeId: '99999999-9999-4999-8999-999999999999' }).expect(404);
      await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ nodeId: unitId, startDate: '2024-12-31' }).expect(422);
      await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ nodeId: 'nope' }).expect(400);
      await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ startDate: '2025-03-01' }).expect(400);
    });

    it('refuse un chevauchement (409) et une seconde affectation principale (409)', async () => {
      await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ nodeId: serviceId, startDate: '2026-01-01' }).expect(409);
      await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ nodeId: unitId, startDate: '2026-01-01', primary: true }).expect(409);
      const second = await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ nodeId: unitId, startDate: '2026-01-01' }).expect(201);
      await http().patch(api(`/assignments/${second.body.id}`)).set(bearer(admin)).send({ primary: true }).expect(409);
      await http().patch(api(`/assignments/${assignmentId}`)).set(bearer(admin)).send({ primary: 'oui' }).expect(400);
    });

    it("liste par personne et par service (avec la personne) ; l'auditeur lit, l'infirmier non", async () => {
      const mine = await http().get(api(`/staff/${staffId}/assignments`)).set(bearer(auditor)).expect(200);
      expect(mine.body).toHaveLength(2);
      const node = await http().get(api(`/structure/${serviceId}/staff`)).set(bearer(auditor)).expect(200);
      expect(node.body).toMatchObject([{ id: assignmentId, staff: { staffNumber: 'MAT-100', lastName: 'Martin', professionCode: 'DOCTOR' } }]);
      await http().get(api(`/structure/${serviceId}/staff`)).set(bearer(nurse)).expect(403);
      await http().get(api(`/structure/${ID}/staff`)).set(bearer(auditor)).expect(404);
      await http().get(api(`/staff/${ID}/assignments`)).set(bearer(auditor)).expect(404);
    });

    it('termine une affectation une seule fois, puis la masque de la liste par défaut', async () => {
      const ended = await http().post(api(`/assignments/${assignmentId}/end`)).set(bearer(admin)).send({ endDate: '2025-06-30' }).expect(200);
      expect(ended.body).toMatchObject({ endDate: '2025-06-30', current: false });
      await http().post(api(`/assignments/${assignmentId}/end`)).set(bearer(admin)).send({}).expect(409);
      await http().post(api(`/assignments/${ID}/end`)).set(bearer(admin)).send({}).expect(404);
      expect((await http().get(api(`/structure/${serviceId}/staff`)).set(bearer(auditor))).body).toHaveLength(0);
      expect((await http().get(api(`/structure/${serviceId}/staff?includeEnded=true`)).set(bearer(auditor))).body).toHaveLength(1);
    });

    it("enregistre un départ qui termine les affectations restantes, puis refuse toute nouvelle affectation", async () => {
      const departed = await http().post(api(`/staff/${staffId}/depart`)).set(bearer(admin)).send({ departedOn: '2026-12-31' }).expect(200);
      expect(departed.body).toMatchObject({ departedOn: '2026-12-31' });
      const list = (await http().get(api(`/staff/${staffId}/assignments`)).set(bearer(auditor))).body as { nodeId: string; endDate: string }[];
      expect(list.find((a) => a.nodeId === unitId)?.endDate).toBe('2026-12-31');
      await http().post(api(`/staff/${staffId}/depart`)).set(bearer(admin)).send({}).expect(409);
      await http().post(api(`/staff/${staffId}/assignments`)).set(bearer(admin)).send({ nodeId: serviceId, startDate: '2026-12-31' }).expect(422);
    });

    it("refuse d'affecter à un service désactivé", async () => {
      const other = (await http().post(api(`/facilities/${facilityId}/services`)).set(bearer(admin)).send({ code: 'ARC', name: 'Archives', serviceType: 'ADMINISTRATIVE' }).expect(201)).body.id;
      await http().post(api(`/structure/${other}/deactivate`)).set(bearer(admin)).expect(200);
      const fresh = (await http().post(api('/staff')).set(bearer(admin)).send({ staffNumber: 'MAT-200', firstName: 'Paul', lastName: 'Noir', professionCode: 'NURSE' }).expect(201)).body.id;
      await http().post(api(`/staff/${fresh}/assignments`)).set(bearer(admin)).send({ nodeId: other }).expect(409);
    });
  });

  it("journalise chaque changement avec l'acteur, sans donnée personnelle, et sans casser la chaîne d'audit", async () => {
    const rows = await w.sql.query<{ action: string; actor_id: string; metadata: unknown }>("SELECT action, actor_id, metadata FROM audit_log WHERE action LIKE 'staff.%'");
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ['register', 'update', 'depart', 'link-account', 'assignment.create', 'assignment.end']) expect(actions).toContain(`staff.${a.includes('.') ? a : `member.${a}`}`);
    expect(rows.every((r) => !!r.actor_id)).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/Curie|Skłodowska|Martin|hopital\.example/);
    expect(await w.audit.verifyChain()).toMatchObject({ valid: true });
  });
});

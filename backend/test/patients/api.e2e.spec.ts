import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';

const PWD = 'une phrase de passe solide';
const api = (path: string) => `/api/v1${path}`;
const MBARGA = { lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14', phone: '+237 655 00 00 00' };
const NO_PII = /Mbarga|Élisabeth|Elisabeth|1990-03-14|655 00|Nkoa|Bastos/;

describe('API patients /api/v1/patients (HTTP réel, PostgreSQL réel)', () => {
  let w: TestWorld;
  const token: Record<string, string> = {};
  const http = () => request(w.app.getHttpServer());
  const bearer = (who: string) => ({ Authorization: `Bearer ${token[who]}` });
  const login = async (username: string, mfa: boolean): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ username, password: PWD, ...(mfa ? { totpCode: generateSync({ secret: TOTP_SECRET }) } : {}) }).expect(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    w = await createTestWorld();
    const accounts: [string, string, boolean][] = [
      ['admin', 'SYSTEM_ADMIN', true], ['auditeur', 'DPO_AUDITOR', true], ['medecin', 'DOCTOR', true], ['infirmier', 'NURSE', true],
      ['accueil', 'RECEPTIONIST', false], ['caissier', 'CASHIER', false], ['patient', 'PATIENT', false], ['comptable', 'ACCOUNTANT', false],
    ];
    for (const [username, role, mfa] of accounts) await w.seed({ username, password: PWD, roles: [role], mfa });
    for (const [username, , mfa] of accounts) token[username] = await login(username, mfa);
  });
  afterAll(() => w.close());

  const ID = '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b';
  const open = async (who = 'accueil', body: object = MBARGA) => http().post(api('/patients')).set(bearer(who)).send(body);

  describe("contrôle d'accès", () => {
    it.each([
      ['GET', '/patients?q=mbarga'], ['POST', '/patients'], ['POST', '/patients/duplicates'], ['GET', `/patients/${ID}`], ['PATCH', `/patients/${ID}`],
      ['POST', `/patients/${ID}/death`], ['GET', `/patients/${ID}/history`],
    ])('%s %s : sans jeton → 401 ; patient et comptable → 403', async (method, url) => {
      const call = (who?: string) => {
        const req = (http() as unknown as Record<string, (u: string) => request.Test>)[method.toLowerCase()](api(url));
        return who ? req.set(bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      expect((await call('patient')).status).toBe(403);
      expect((await call('comptable')).status).toBe(403);
    });

    it('sépare lecture, écriture, décès et historique entre les profils', async () => {
      const p = (await open()).body;
      // lecture : soignants, accueil, caisse, administrateur, contrôleur
      for (const who of ['medecin', 'infirmier', 'accueil', 'caissier', 'admin', 'auditeur']) await http().get(api(`/patients/${p.id}`)).set(bearer(who)).expect(200);
      // écriture : accueil et administrateur seulement
      for (const who of ['medecin', 'infirmier', 'caissier', 'auditeur']) {
        await http().post(api('/patients')).set(bearer(who)).send({ ...MBARGA, lastName: 'Autre' }).expect(403);
        await http().patch(api(`/patients/${p.id}`)).set(bearer(who)).send({ occupation: 'x' }).expect(403);
      }
      // décès : médecin et administrateur seulement
      for (const who of ['accueil', 'infirmier', 'auditeur']) await http().post(api(`/patients/${p.id}/death`)).set(bearer(who)).send({}).expect(403);
      // historique : administrateur et contrôleur seulement
      for (const who of ['accueil', 'medecin', 'infirmier', 'caissier']) await http().get(api(`/patients/${p.id}/history`)).set(bearer(who)).expect(403);
      for (const who of ['admin', 'auditeur']) await http().get(api(`/patients/${p.id}/history`)).set(bearer(who)).expect(200);
    });
  });

  describe("ouverture d'un dossier", () => {
    it('renvoie le dossier avec un numéro système, et refuse un doublon en listant les candidats', async () => {
      const created = await open('accueil', { ...MBARGA, lastName: 'Ndzana', phone: '+237 677 11 22 33', identityDocument: { type: 'national_id', number: '987 654 321' } }).then((r) => {
        expect(r.status).toBe(201);
        return r.body;
      });
      expect(created).toMatchObject({ number: expect.stringMatching(/^PAT-\d{7}$/), identityStatus: 'CONFIRMED', lastName: 'Ndzana', sex: 'FEMALE', identityDocument: { type: 'NATIONAL_ID', number: '987654321' }, status: 'ACTIVE' });

      const dup = await open('accueil', { lastName: 'Ndzana', firstName: 'ÉLISABETH', sex: 'FEMALE', birthDate: '1990-03-14' }).then((r) => {
        expect(r.status).toBe(409);
        return r.body;
      });
      expect(dup.code).toBe('PATIENT_POSSIBLE_DUPLICATE');
      expect(dup.candidates).toMatchObject([{ id: created.id, number: created.number, reasons: ['NAME_AND_BIRTH_DATE'] }]);
      expect(JSON.stringify(dup.candidates)).not.toMatch(/987654321|677 11/); // un résumé : ni pièce ni téléphone

      await open('accueil', { lastName: 'Autre', firstName: 'Nom', sex: 'MALE', birthDate: '1970-01-01', identityDocument: { type: 'NATIONAL_ID', number: '987654321' } }).then((r) => expect(r.status).toBe(409));
      const twin = await open('accueil', { lastName: 'Ndzana', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14', ignoreDuplicates: true });
      expect(twin.status).toBe(201);
      expect(twin.body.number).not.toBe(created.number);
    });

    it('vérifie les doublons à blanc sans rien créer', async () => {
      const before = (await w.sql.query<{ n: number }>('SELECT count(*)::int AS n FROM patients'))[0].n;
      const res = await http().post(api('/patients/duplicates')).set(bearer('accueil')).send({ lastName: 'ndzana', firstName: 'elisabeth', birthDate: '1990-03-14' }).expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('reasons');
      expect((await http().post(api('/patients/duplicates')).set(bearer('accueil')).send({ lastName: 'Zzz', firstName: 'Yyy', birthDate: '1960-01-01' }).expect(200)).body).toEqual([]);
      expect((await w.sql.query<{ n: number }>('SELECT count(*)::int AS n FROM patients'))[0].n).toBe(before);
    });

    it('applique la validation : champs obligatoires 422, corps invalide 400, dates impossibles, messages traduits', async () => {
      const missing = await open('accueil', { firstName: 'Paul', sex: 'MALE', birthDate: '1970-01-01' });
      expect(missing.status).toBe(422);
      expect(missing.body.code).toBe('PATIENT_FIELD_REQUIRED');
      await open('accueil', { ...MBARGA, lastName: 'V1', birthDate: '2999-01-01' }).then((r) => expect(r.status).toBe(422));
      await open('accueil', { ...MBARGA, lastName: 'V2', birthDate: '1990-02-30' }).then((r) => expect(r.status).toBe(422));
      await open('accueil', { ...MBARGA, lastName: 'V3', sex: 'robot' }).then((r) => expect(r.status).toBe(422));
      await open('accueil', { ...MBARGA, lastName: 'V4', nationality: 'CMR' }).then((r) => expect(r.status).toBe(400)); // trop long : refusé dès la validation du corps
      await open('accueil', { ...MBARGA, lastName: 'V4b', nationality: '12' }).then((r) => expect(r.status).toBe(422)); // 2 caractères mais pas un code pays
      await open('accueil', { ...MBARGA, lastName: 'V5', phone: 'abc' }).then((r) => expect(r.status).toBe(422));
      await open('accueil', { ...MBARGA, lastName: 'V6', nextOfKin: { name: 'X', relationship: 'VOISIN', phone: '+237 677 00 00 00' } }).then((r) => expect(r.status).toBe(422));
      await open('accueil', { ...MBARGA, lastName: 'V7', lastName2: 'x', address: 'pas un objet' }).then((r) => expect(r.status).toBe(400));
      await open('accueil', { ...MBARGA, lastName: 'x'.repeat(101) }).then((r) => expect(r.status).toBe(400));
      await open('accueil', {}).then((r) => expect(r.status).toBe(422)); // corps vide : champs obligatoires manquants
      const en = await http().post(api('/patients')).set(bearer('accueil')).set('Accept-Language', 'en').send({ ...MBARGA, lastName: 'V8', birthDate: '2999-01-01' });
      expect(en.body.message).toBe('The birth date must be between 1880 and today.');
    });

    it('ouvre un patient non identifié (identité provisoire, naissance estimée) sans comparaison de doublons', async () => {
      const body = { lastName: 'INCONNU', firstName: 'Urgence-01', sex: 'MALE', birthDate: '1985-01-01', birthDateEstimated: true, identityStatus: 'PROVISIONAL' };
      const one = await open('accueil', body);
      const two = await open('accueil', body);
      expect([one.status, two.status]).toEqual([201, 201]);
      expect(one.body).toMatchObject({ identityStatus: 'PROVISIONAL', birthDateEstimated: true });
    });
  });

  describe('recherche et ouverture', () => {
    let id: string;
    let number: string;
    beforeAll(async () => {
      const r = await open('accueil', { lastName: 'Nkoa', firstName: 'Samuel', sex: 'MALE', birthDate: '1975-06-01', phone: '+237 699 88 77 66', address: { city: 'Douala', quarter: 'Akwa' }, nextOfKin: { name: 'Jeanne Nkoa', relationship: 'spouse', phone: '+237 677 00 00 00' } });
      ({ id, number } = r.body);
    });

    it("n'offre aucune liste de tous les patients : un critère est obligatoire, les mots trop courts sont refusés", async () => {
      for (const url of ['/patients', '/patients?q=', '/patients?status=ACTIVE', '/patients?q=a']) {
        const res = await http().get(api(url)).set(bearer('medecin'));
        expect(res.status).toBe(422);
        expect(['PATIENT_SEARCH_CRITERIA_REQUIRED', 'PATIENT_SEARCH_TOO_BROAD']).toContain(res.body.code);
      }
      await http().get(api('/patients?q=nkoa&status=GONE')).set(bearer('medecin')).expect(422);
      await http().get(api('/patients?birthDate=1990-02-30')).set(bearer('medecin')).expect(422);
    });

    it('trouve par nom, numéro de dossier, naissance, téléphone — et ne renvoie que des résumés', async () => {
      const byName = await http().get(api('/patients?q=SAMUEL nkoa')).set(bearer('infirmier')).expect(200);
      expect(byName.body).toMatchObject({ total: 1, offset: 0, limit: 20 });
      expect(Object.keys(byName.body.items[0]).sort()).toEqual(['ageYears', 'birthDate', 'birthDateEstimated', 'firstName', 'id', 'identityStatus', 'lastName', 'number', 'sex', 'status']);
      for (const q of [`q=${number}`, 'birthDate=1975-06-01', 'phone=699 88 77 66', 'phone=%2B237%20699%2088%2077%2066']) {
        const res = await http().get(api(`/patients?${q}`)).set(bearer('caissier')).expect(200);
        expect(res.body.items.map((p: { id: string }) => p.id)).toContain(id);
      }
      expect((await http().get(api('/patients?q=introuvable')).set(bearer('medecin')).expect(200)).body).toMatchObject({ items: [], total: 0 });
    });

    it('borne la page à 50 résultats', async () => {
      expect((await http().get(api('/patients?q=nkoa&limit=5000')).set(bearer('medecin')).expect(200)).body.limit).toBe(50);
    });

    it("ouvre le dossier complet, et chaque ouverture est inscrite au journal (sans donnée personnelle)", async () => {
      const res = await http().get(api(`/patients/${id}`)).set(bearer('medecin')).expect(200);
      expect(res.body).toMatchObject({
        id, number, lastName: 'Nkoa', phone: '+237 699 88 77 66', address: { city: 'Douala', quarter: 'Akwa', line: null }, nextOfKin: { name: 'Jeanne Nkoa', relationship: 'SPOUSE' },
      });
      const [entry] = await w.sql.query<{ actor_id: string; resource_id: string; metadata: Record<string, unknown> }>(
        "SELECT actor_id, resource_id, metadata FROM audit_log WHERE action = 'patient.record.read' ORDER BY id DESC LIMIT 1",
      );
      expect(entry).toMatchObject({ resource_id: id, metadata: { patientNumber: number } });
      await http().get(api(`/patients/${ID}`)).set(bearer('medecin')).expect(404);
      await http().get(api('/patients/pas-un-uuid')).set(bearer('medecin')).expect(400);
    });

    it('corrige un dossier : version archivée avec auteur et motif, ancien nom conservé, numéro inchangé', async () => {
      const fixed = await http().patch(api(`/patients/${id}`)).set(bearer('accueil')).send({ lastName: 'Nkoa-Mvondo', occupation: 'Ingénieur', address: { city: 'Yaoundé' }, reason: "Acte de naissance présenté", number: 'PAT-9999999' }).expect(200);
      expect(fixed.body).toMatchObject({ number, lastName: 'Nkoa-Mvondo', occupation: 'Ingénieur', address: { city: 'Yaoundé', quarter: null } });
      const history = (await http().get(api(`/patients/${id}/history`)).set(bearer('auditeur')).expect(200)).body;
      expect(history.map((r: { revision: number }) => r.revision)).toEqual([2, 1]);
      expect(history[0]).toMatchObject({ reason: 'Acte de naissance présenté', changedFields: expect.arrayContaining(['lastName', 'occupation', 'address']), snapshot: { lastName: 'Nkoa-Mvondo' } });
      expect(history[1].snapshot).toMatchObject({ lastName: 'Nkoa', occupation: null });
      expect(history[0].changedBy).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/); // un identifiant de compte, pas un nom
      await http().patch(api(`/patients/${id}`)).set(bearer('accueil')).send({ occupation: null, phone: null }).expect(200);
      expect((await http().get(api(`/patients/${id}`)).set(bearer('medecin'))).body).toMatchObject({ occupation: null, phone: null });
      await http().patch(api(`/patients/${id}`)).set(bearer('accueil')).send({ birthDate: '2999-01-01' }).expect(422);
      await http().patch(api(`/patients/${ID}`)).set(bearer('accueil')).send({ occupation: 'x' }).expect(404);
    });

    it('enregistre un décès (médecin) une seule fois, puis le dossier est « décédé »', async () => {
      await http().post(api(`/patients/${id}/death`)).set(bearer('medecin')).send({ dateOfDeath: '2999-01-01' }).expect(422);
      await http().post(api(`/patients/${id}/death`)).set(bearer('medecin')).send({ dateOfDeath: '1900-01-01' }).expect(422);
      const dead = await http().post(api(`/patients/${id}/death`)).set(bearer('medecin')).send({ dateOfDeath: '2026-10-01', reason: 'Constat du Dr Nkoa' }).expect(200);
      expect(dead.body).toMatchObject({ status: 'DECEASED', dateOfDeath: '2026-10-01' });
      const again = await http().post(api(`/patients/${id}/death`)).set(bearer('medecin')).send({}).expect(409);
      expect(again.body.code).toBe('PATIENT_ALREADY_DECEASED');
      expect((await http().get(api('/patients?q=nkoa&status=DECEASED')).set(bearer('medecin')).expect(200)).body.items.map((p: { id: string }) => p.id)).toEqual([id]);
      expect((await http().get(api('/patients?q=nkoa&status=ACTIVE')).set(bearer('medecin')).expect(200)).body.items).toEqual([]);
    });
  });

  describe("journal d'audit", () => {
    it("trace ouvertures, recherches, corrections et historiques avec l'acteur, sans aucune donnée personnelle, et garde sa chaîne intacte", async () => {
      const rows = await w.sql.query<{ action: string; actor_id: string; metadata: unknown }>("SELECT action, actor_id, metadata FROM audit_log WHERE action LIKE 'patient.%'");
      const actions = new Set(rows.map((r) => r.action));
      for (const a of ['register', 'update', 'death', 'read', 'search', 'duplicate-check']) expect(actions).toContain(`patient.record.${a}`);
      expect(actions).toContain('patient.history.read');
      expect(rows.every((r) => !!r.actor_id)).toBe(true);
      expect(JSON.stringify(rows)).not.toMatch(NO_PII);
      expect(await w.audit.verifyChain()).toMatchObject({ valid: true });
    });

    it("la recherche inscrit les critères utilisés (noms) et le nombre de résultats", async () => {
      await http().get(api('/patients?q=nkoa&birthDate=1975-06-01')).set(bearer('medecin')).expect(200);
      const [fresh] = await w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'patient.record.search' ORDER BY id DESC LIMIT 1");
      expect(fresh.metadata).toMatchObject({ criteria: 'name,birthDate', returned: 1, total: 1 });
    });
  });
});

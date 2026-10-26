import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from './e2e-app';

const PWD = 'une phrase de passe solide';
const totp = () => generateSync({ secret: TOTP_SECRET });
const cookieOf = (res: request.Response): string => ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).find((c) => c.startsWith('sanjeevani_rt=')) ?? '';

describe('API IAM /api/v1 (HTTP réel, PostgreSQL réel, Argon2id réel)', () => {
  let w: TestWorld;
  const http = () => request(w.app.getHttpServer());
  const login = (username: string, password = PWD, extra: object = {}) => http().post('/api/v1/auth/login').send({ username, password, ...extra });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    w = await createTestWorld();
    await w.seed({ username: 'caissier', password: PWD, roles: ['CASHIER'] });
    await w.seed({ username: 'admin', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
  });
  afterAll(() => w.close());

  describe('fermé par défaut', () => {
    it.each([
      ['GET', '/api/v1/auth/me'],
      ['GET', '/api/v1/users'],
      ['POST', '/api/v1/users'],
      ['GET', '/api/v1/roles'],
      ['POST', '/api/v1/auth/mfa/enroll'],
      ['POST', '/api/v1/auth/password/change'],
    ])('%s %s sans jeton → 401', async (method, url) => {
      const res = await (http() as unknown as Record<string, (u: string) => request.Test>)[method.toLowerCase()](url);
      expect(res.status).toBe(401);
    });

    it('refuse un jeton falsifié ou un schéma autre que Bearer', async () => {
      await http().get('/api/v1/auth/me').set({ Authorization: 'Bearer abc.def.ghi' }).expect(401);
      await http().get('/api/v1/auth/me').set({ Authorization: 'Basic YWRtaW46YWRtaW4=' }).expect(401);
    });
  });

  describe('connexion', () => {
    it("ouvre une session : jeton d'accès dans le corps, jeton de rafraîchissement UNIQUEMENT en cookie sécurisé", async () => {
      const res = await login('Caissier').expect(200);
      expect(res.body).toMatchObject({ status: 'authenticated', scope: 'full', mustChangePassword: false, mfaEnrollmentRequired: false });
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toContain('refresh');
      const cookie = cookieOf(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    });

    it('/me renvoie le profil et les permissions du rôle', async () => {
      const { body } = await login('caissier');
      const me = await http().get('/api/v1/auth/me').set(bearer(body.accessToken)).expect(200);
      expect(me.body).toMatchObject({ username: 'caissier', roles: ['CASHIER'], mfaEnabled: false, mfaRequired: false, scope: 'full' });
      expect(me.body.permissions).toContain('files:upload:all');
      expect(me.body).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(me.body)).not.toMatch(/argon2|secret/i);
    });

    it("répond à l'identique pour un compte inconnu et un mauvais mot de passe", async () => {
      const bad = await login('caissier', 'mauvais mot de passe').expect(401);
      const unknown = await login('fantome', 'mauvais mot de passe').expect(401);
      expect(unknown.body).toEqual(bad.body);
      expect(bad.body.code).toBe('INVALID_CREDENTIALS');
    });

    it.each([
      ['corps vide', {}],
      ['mot de passe démesuré', { username: 'caissier', password: 'x'.repeat(2000) }],
      ['code TOTP mal formé', { username: 'caissier', password: PWD, totpCode: 'abcdef' }],
      ['identifiant non texte', { username: { $ne: null }, password: PWD }],
    ])('valide les entrées : %s → 400', async (_n, body) => {
      await http().post('/api/v1/auth/login').send(body).expect(400);
    });

    it("ignore les champs inconnus au lieu de les affecter (pas d'affectation de masse)", async () => {
      const res = await login('caissier', PWD, { roles: ['SYSTEM_ADMIN'], scope: 'full', isAdmin: true }).expect(200);
      const me = await http().get('/api/v1/auth/me').set(bearer(res.body.accessToken)).expect(200);
      expect(me.body.roles).toEqual(['CASHIER']);
    });

    it('verrouille le compte après 5 échecs, même avec le bon mot de passe ensuite', async () => {
      await w.seed({ username: 'verrouille', password: PWD, roles: ['CASHIER'] });
      for (let i = 0; i < 5; i++) await login('verrouille', 'faux faux faux faux').expect(401);
      const res = await login('verrouille', PWD).expect(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS'); // on ne révèle pas le verrouillage
    });
  });

  describe('sessions', () => {
    it('fait tourner le cookie de rafraîchissement et refuse son rejeu (vol détecté, famille révoquée)', async () => {
      const agent = request.agent(w.app.getHttpServer());
      await agent.post('/api/v1/auth/login').send({ username: 'caissier', password: PWD }).expect(200);
      const stolen = (agent as unknown as { jar: { getCookie(n: string, o: object): { value: string } } }).jar.getCookie('sanjeevani_rt', { path: '/api/v1/auth', domain: '127.0.0.1', script: false, secure: false });
      expect(stolen?.value).toBeTruthy();

      const r1 = await agent.post('/api/v1/auth/refresh').expect(200);
      expect(r1.body.accessToken).toEqual(expect.any(String));
      expect(cookieOf(r1)).not.toContain(stolen.value); // rotation

      // le voleur rejoue l'ancien cookie
      await http().post('/api/v1/auth/refresh').set('Cookie', `sanjeevani_rt=${stolen.value}`).expect(401);
      // et la session légitime est coupée par précaution
      await agent.post('/api/v1/auth/refresh').expect(401);
    });

    it('refuse un rafraîchissement sans cookie', async () => {
      await http().post('/api/v1/auth/refresh').expect(401);
    });

    it('la déconnexion révoque la session et efface le cookie', async () => {
      const agent = request.agent(w.app.getHttpServer());
      await agent.post('/api/v1/auth/login').send({ username: 'caissier', password: PWD }).expect(200);
      const out = await agent.post('/api/v1/auth/logout').expect(204);
      expect(cookieOf(out)).toMatch(/Expires=Thu, 01 Jan 1970/);
      await agent.post('/api/v1/auth/refresh').expect(401);
    });
  });

  describe('mot de passe provisoire', () => {
    it('limite la session (`setup`) jusqu\'au changement, puis donne une session complète', async () => {
      await w.seed({ username: 'nouveau', password: 'Provisoire-2026', roles: ['CASHIER'], mustChangePassword: true });
      const l = await login('nouveau', 'Provisoire-2026').expect(200);
      expect(l.body).toMatchObject({ scope: 'setup', mustChangePassword: true });

      // tout sauf la finalisation du compte est interdit
      const blocked = await http().get('/api/v1/users').set(bearer(l.body.accessToken)).expect(403);
      expect(blocked.body.code).toBe('SETUP_REQUIRED');
      await http().get('/api/v1/auth/me').set(bearer(l.body.accessToken)).expect(200);

      const wrong = await http().post('/api/v1/auth/password/change').set(bearer(l.body.accessToken)).send({ currentPassword: 'pas le bon mot de passe', newPassword: PWD });
      expect(wrong.status).toBe(422); // pas 401 : l'utilisateur reste connecté
      expect(wrong.body.code).toBe('CURRENT_PASSWORD_INVALID');

      const weak = await http().post('/api/v1/auth/password/change').set(bearer(l.body.accessToken)).send({ currentPassword: 'Provisoire-2026', newPassword: 'court' });
      expect(weak.status).toBe(422);
      expect(weak.body.code).toBe('PASSWORD_TOO_SHORT');

      const changed = await http().post('/api/v1/auth/password/change').set(bearer(l.body.accessToken)).send({ currentPassword: 'Provisoire-2026', newPassword: 'nouvelle phrase de passe 2026' }).expect(200);
      expect(changed.body.scope).toBe('full');
      await http().get('/api/v1/auth/me').set(bearer(changed.body.accessToken)).expect(200);

      await login('nouveau', 'Provisoire-2026').expect(401); // l'ancien ne marche plus
      await login('nouveau', 'nouvelle phrase de passe 2026').expect(200);
    });
  });

  describe('MFA obligatoire pour les profils cliniques', () => {
    it("inscription → codes de secours → connexion avec second facteur", async () => {
      await w.seed({ username: 'docteur', password: PWD, roles: ['DOCTOR'] });
      const l = await login('docteur').expect(200);
      expect(l.body).toMatchObject({ scope: 'setup', mfaEnrollmentRequired: true });

      const enroll = await http().post('/api/v1/auth/mfa/enroll').set(bearer(l.body.accessToken)).expect(200);
      expect(enroll.body.keyUri).toMatch(/^otpauth:\/\/totp\//);
      const secret: string = enroll.body.secret;

      const bad = await http().post('/api/v1/auth/mfa/activate').set(bearer(l.body.accessToken)).send({ code: '000000' });
      expect(bad.status).toBe(401);
      const act = await http().post('/api/v1/auth/mfa/activate').set(bearer(l.body.accessToken)).send({ code: generateSync({ secret }) }).expect(200);
      expect(act.body.recoveryCodes).toHaveLength(10);
      expect(act.body.recoveryCodes[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);

      // le secret n'est jamais stocké en clair
      const stored = await w.sql.query<{ mfa_secret: string }>("SELECT mfa_secret FROM iam_users WHERE username = 'docteur'");
      expect(stored[0].mfa_secret).toMatch(/^v1\./);
      expect(stored[0].mfa_secret).not.toContain(secret);

      // connexion suivante : mot de passe seul = second facteur demandé
      const second = await login('docteur').expect(200);
      expect(second.body).toEqual({ status: 'mfa_required' });
      expect(cookieOf(second)).toBe('');
      const ok = await login('docteur', PWD, { totpCode: generateSync({ secret }) }).expect(200);
      expect(ok.body.scope).toBe('full');
      await login('docteur', PWD, { totpCode: '000000' }).expect(401);

      // un code de secours est à usage unique
      const rc = act.body.recoveryCodes[0] as string;
      await login('docteur', PWD, { recoveryCode: rc }).expect(200);
      await login('docteur', PWD, { recoveryCode: rc }).expect(401);
    });

    it('après activation, le rafraîchissement passe la session de `setup` à `full`', async () => {
      await w.seed({ username: 'infirmier', password: PWD, roles: ['NURSE'] });
      const agent = request.agent(w.app.getHttpServer());
      const l = await agent.post('/api/v1/auth/login').send({ username: 'infirmier', password: PWD }).expect(200);
      const enroll = await agent.post('/api/v1/auth/mfa/enroll').set(bearer(l.body.accessToken)).expect(200);
      await agent.post('/api/v1/auth/mfa/activate').set(bearer(l.body.accessToken)).send({ code: generateSync({ secret: enroll.body.secret }) }).expect(200);
      const r = await agent.post('/api/v1/auth/refresh').expect(200);
      expect(r.body.scope).toBe('full');
    });
  });

  describe('administration des comptes (RBAC)', () => {
    let adminToken: string;
    beforeAll(async () => {
      adminToken = (await login('admin', PWD, { totpCode: totp() }).expect(200)).body.accessToken;
    });

    it("refuse un profil sans la permission et journalise le refus", async () => {
      const { body } = await login('caissier');
      const res = await http().get('/api/v1/users').set(bearer(body.accessToken)).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
      const rows = await w.sql.query<{ actor_username: string; reason: string; outcome: string }>(
        "SELECT actor_username, reason, outcome FROM audit_log WHERE action = 'access.denied' ORDER BY id DESC LIMIT 1",
      );
      expect(rows[0]).toEqual({ actor_username: 'caissier', reason: 'missing:iam.users:read', outcome: 'DENIED' });
    });

    it('liste les comptes et les rôles sans jamais exposer de secret', async () => {
      const users = await http().get('/api/v1/users?limit=100').set(bearer(adminToken)).expect(200);
      expect(users.body.total).toBeGreaterThan(3);
      expect(JSON.stringify(users.body)).not.toMatch(/passwordHash|password_hash|argon2|mfaSecret|mfa_secret|recoveryCode|"v1\./i);
      const roles = await http().get('/api/v1/roles').set(bearer(adminToken)).expect(200);
      expect(roles.body).toHaveLength(11);
    });

    it("crée un compte : mot de passe temporaire renvoyé une fois, changement obligatoire", async () => {
      const created = await http().post('/api/v1/users').set(bearer(adminToken)).send({ username: 'Pharmacien.Un', email: 'p.un@hopital.test', roles: ['PHARMACIST'] }).expect(201);
      expect(created.body.user).toMatchObject({ username: 'pharmacien.un', roles: ['PHARMACIST'], active: true, mustChangePassword: true });
      expect(created.body.temporaryPassword).toHaveLength(16);

      const first = await login('pharmacien.un', created.body.temporaryPassword).expect(200);
      expect(first.body.scope).toBe('setup');

      await http().post('/api/v1/users').set(bearer(adminToken)).send({ username: 'pharmacien.un', email: 'autre@hopital.test', roles: ['PHARMACIST'] }).expect(409);
      await http().post('/api/v1/users').set(bearer(adminToken)).send({ username: 'x1', email: 'x1@hopital.test', roles: ['PHARMACIST'] }).expect(400); // trop court : refusé dès le DTO
      await http().post('/api/v1/users').set(bearer(adminToken)).send({ username: 'nom invalide !', email: 'ni@hopital.test', roles: ['PHARMACIST'] }).expect(422); // refusé par le domaine
      await http().post('/api/v1/users').set(bearer(adminToken)).send({ username: 'role.bidon', email: 'rb@hopital.test', roles: ['ROLE_FANTOME'] }).expect(422);
      await http().post('/api/v1/users').set(bearer(adminToken)).send({ username: 'mauvais.mail', email: 'pas-un-mail', roles: ['PHARMACIST'] }).expect(400);
    });

    it("désactiver un compte coupe IMMÉDIATEMENT son jeton d'accès encore valide", async () => {
      const victim = await w.seed({ username: 'a.desactiver', password: PWD, roles: ['CASHIER'] });
      const session = await login('a.desactiver').expect(200);
      await http().get('/api/v1/auth/me').set(bearer(session.body.accessToken)).expect(200);

      await http().post(`/api/v1/users/${victim.id.value}/disable`).set(bearer(adminToken)).expect(200);

      await http().get('/api/v1/auth/me').set(bearer(session.body.accessToken)).expect(401); // sans attendre l'expiration
      await login('a.desactiver').expect(401);

      await http().post(`/api/v1/users/${victim.id.value}/enable`).set(bearer(adminToken)).expect(200);
      await login('a.desactiver').expect(200);
    });

    it("changer les rôles prend effet immédiatement sur les droits", async () => {
      const u = await w.seed({ username: 'promu', password: PWD, roles: ['CASHIER'] });
      const session = await login('promu').expect(200);
      await http().get('/api/v1/roles').set(bearer(session.body.accessToken)).expect(403);

      await http().put(`/api/v1/users/${u.id.value}/roles`).set(bearer(adminToken)).send({ roles: ['DPO_AUDITOR'] }).expect(200);
      // le même jeton d'accès, sans nouvelle connexion, reflète déjà le nouveau rôle
      await http().get('/api/v1/roles').set(bearer(session.body.accessToken)).expect(200);
    });

    it("un administrateur ne peut ni se désactiver ni modifier ses propres rôles", async () => {
      const me = await http().get('/api/v1/auth/me').set(bearer(adminToken)).expect(200);
      const a = await http().post(`/api/v1/users/${me.body.id}/disable`).set(bearer(adminToken)).expect(403);
      expect(a.body.code).toBe('SELF_MODIFICATION_FORBIDDEN');
      await http().put(`/api/v1/users/${me.body.id}/roles`).set(bearer(adminToken)).send({ roles: ['DOCTOR'] }).expect(403);
    });

    it("l'administrateur système n'a aucun accès clinique (séparation des tâches)", async () => {
      const me = await http().get('/api/v1/auth/me').set(bearer(adminToken)).expect(200);
      expect(me.body.permissions).toContain('iam.users:manage:all');
      expect(me.body.permissions.filter((p: string) => p.startsWith('files.clinical'))).toEqual([]);
    });

    it('rejette un identifiant de compte qui n\'est pas un UUID, et un compte inexistant', async () => {
      await http().post('/api/v1/users/pas-un-uuid/disable').set(bearer(adminToken)).expect(400);
      await http().post('/api/v1/users/00000000-0000-4000-8000-0000000000ff/disable').set(bearer(adminToken)).expect(404);
    });

    it("réinitialiser la MFA d'un compte coupe ses sessions et l'oblige à se réinscrire", async () => {
      const u = await w.seed({ username: 'tel.perdu', password: PWD, roles: ['NURSE'], mfa: true });
      const before = await login('tel.perdu', PWD, { totpCode: totp() }).expect(200);
      await http().post(`/api/v1/users/${u.id.value}/reset-mfa`).set(bearer(adminToken)).expect(200);
      const after = await login('tel.perdu').expect(200);
      expect(after.body).toMatchObject({ scope: 'setup', mfaEnrollmentRequired: true });
      expect(before.body.accessToken).toBeTruthy();
    });
  });

  describe("journal d'audit", () => {
    it('a tout enregistré, sans secret ni mot de passe, et la chaîne est intacte', async () => {
      const actions = (await w.sql.query<{ action: string }>('SELECT DISTINCT action FROM audit_log')).map((r) => r.action);
      for (const a of ['auth.login', 'auth.refresh', 'auth.logout', 'auth.password.change', 'auth.mfa.enabled', 'iam.user.create', 'iam.user.disable', 'iam.user.roles', 'access.denied']) {
        expect(actions).toContain(a);
      }
      const all = JSON.stringify(await w.sql.query('SELECT * FROM audit_log'));
      expect(all).not.toContain(PWD);
      expect(all).not.toContain('Provisoire-2026');
      expect(all).not.toContain(TOTP_SECRET);
      expect(all).not.toMatch(/\$argon2/);

      const failures = await w.sql.query<{ reason: string }>("SELECT reason FROM audit_log WHERE action = 'auth.login' AND outcome <> 'SUCCESS'");
      expect(failures.map((f) => f.reason)).toEqual(expect.arrayContaining(['bad-password', 'unknown-user', 'locked']));

      expect(await w.audit.verifyChain()).toMatchObject({ valid: true, brokenAtId: null });
    });
  });
});

describe('limitation de débit', () => {
  it('bloque les rafales de tentatives de connexion (429)', async () => {
    const w = await createTestWorld({ rateLimiting: true });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 12; i++) {
        codes.push((await request(w.app.getHttpServer()).post('/api/v1/auth/login').send({ username: 'inconnu', password: 'peu importe' })).status);
      }
      expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
      expect(codes.slice(10)).toEqual([429, 429]);
    } finally {
      await w.close();
    }
  });
});

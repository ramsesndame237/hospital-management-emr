import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { generateSync } from 'otplib';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { buildApiDocsOptions } from '../../src/config/api-docs.config';
import { createTestWorld, TOTP_SECRET, TestWorld } from './e2e-app';

const PWD = 'une phrase de passe solide';
const totp = () => generateSync({ secret: TOTP_SECRET });
const setCookies = (res: request.Response): string[] => (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
const docsCookie = (res: request.Response) => setCookies(res).find((c) => c.startsWith('sanjeevani_docs=')) ?? '';

describe("portail d'accès à la documentation", () => {
  let w: TestWorld;
  const http = () => request(w.app.getHttpServer());
  const login = (username: string, extra: object = {}) => http().post('/api/v1/auth/login').send({ username, password: PWD, ...extra });

  /** Parcours complet d'un utilisateur : connexion (avec MFA si besoin) puis échange du jeton contre le cookie de documentation. */
  async function openSession(username: string): Promise<{ cookie: string; token: string }> {
    const first = await login(username);
    const res = first.body.status === 'mfa_required' ? await login(username, { totpCode: totp() }) : first;
    const token = res.body.accessToken as string;
    const session = await http().post('/api-docs/_portal/session').set('Authorization', `Bearer ${token}`).expect(200);
    return { cookie: docsCookie(session).split(';')[0], token };
  }

  beforeAll(async () => {
    w = await createTestWorld({ docs: true });
    await w.seed({ username: 'docs.admin', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
    await w.seed({ username: 'caissier', password: PWD, roles: ['CASHIER'] });
    await w.seed({ username: 'nouveau', password: PWD, roles: ['SYSTEM_ADMIN'], mustChangePassword: true });
  });
  afterAll(() => w.close());

  describe('page d\'accueil (sans connexion)', () => {
    it('est servie à la place de la documentation, sans rien révéler de l\'API', async () => {
      const res = await http().get('/api-docs').expect(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['x-robots-tag']).toContain('noindex');
      expect(res.text).toContain('<html lang="fr">');
      expect(res.text).toContain('id="login-form"');
      expect(res.text).toContain('id="mfa-form"');
      expect(res.text).toContain('/api-docs/_portal/portal.js');
      expect(res.text).not.toMatch(/swagger-ui|\/api\/v1\/users|openapi/i);
    });

    it("n'embarque aucun script en ligne (la CSP les interdit) et reste fonctionnelle sous CSP", async () => {
      const res = await http().get('/api-docs').expect(200);
      expect(res.text).not.toMatch(/<script(?![^>]*(src=|type="application\/json"))[^>]*>/);
      expect(res.text).not.toMatch(/\son\w+=/i); // pas de gestionnaire d'événement en attribut
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain('upgrade-insecure-requests');
    });

    it('suit la langue demandée et propose le choix de langue', async () => {
      const en = await http().get('/api-docs').set('Accept-Language', 'en-US,en;q=0.9').expect(200);
      expect(en.text).toContain('<html lang="en">');
      expect(en.text).toContain('API documentation — Sanjeevani EMR');
      expect(en.text).toContain('hreflang="fr"');
      expect(en.text).toContain('hreflang="en"');
      const forced = await http().get('/api-docs?lang=fr').set('Accept-Language', 'en').expect(200);
      expect(forced.text).toContain('Documentation de l&#39;API');
    });

    it("n'injecte jamais une valeur de la requête dans la page (XSS)", async () => {
      const attack = '"><script>alert(1)</script>';
      const res = await http().get('/api-docs').query({ lang: attack }).expect(200);
      expect(res.text).not.toContain('<script>alert(1)');
      expect(res.text).not.toContain(attack);
    });

    it("embarque des textes sûrs dans le bloc JSON (aucune balise ne peut le refermer)", async () => {
      const res = await http().get('/api-docs').expect(200);
      const json = /<script id="portal-config" type="application\/json">([\s\S]*?)<\/script>/.exec(res.text)?.[1] ?? '';
      expect(json).not.toContain('</');
      const config = JSON.parse(json);
      expect(config.docsPath).toBe('/api-docs');
      expect(config.texts.signIn).toBe('Se connecter');
      expect(Object.keys(config.texts).length).toBeGreaterThan(35);
    });

    it('sert les fichiers publics de la page, avec revalidation à chaque chargement', async () => {
      for (const [file, type] of [['portal.css', 'text/css'], ['portal.js', 'application/javascript'], ['toolbar.js', 'application/javascript']] as const) {
        const res = await http().get(`/api-docs/_portal/${file}`).expect(200);
        expect(res.headers['content-type']).toContain(type);
        expect(res.headers['cache-control']).toBe('no-cache');
        expect(res.headers.etag).toBeDefined();
        expect(res.text).not.toMatch(/secret|password_hash|argon2/i);
        await http().head(`/api-docs/_portal/${file}`).expect(200);
      }
      await http().get('/api-docs/_portal/inconnu.js').expect(404);
    });
  });

  describe('barrière : rien d\'autre sans connexion', () => {
    it.each(['/api-docs/json', '/api-docs/yaml', '/api-docs/swagger-ui-init.js', '/api-docs/swagger-ui-bundle.js', '/api-docs/n-importe-quoi', '/api-docs/_portal/me'])(
      '%s → 401, sans aucune information sur l\'API',
      async (url) => {
        const res = await http().get(url).expect(401);
        expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' });
        expect(res.text).not.toMatch(/paths|openapi|swagger/i);
      },
    );

    it('rejette un cookie falsifié, signé avec une autre clé, ou sans signature (alg=none)', async () => {
      const forged = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: 'x', scope: 'full' })).toString('base64url') + '.';
      for (const value of ['abc.def.ghi', forged, 'x'.repeat(300), '']) {
        await http().get('/api-docs/json').set('Cookie', `sanjeevani_docs=${value}`).expect(401);
      }
      const page = await http().get('/api-docs').set('Cookie', 'sanjeevani_docs=abc.def.ghi').expect(200);
      expect(page.text).toContain('id="login-form"'); // retour à la page d'accueil, pas de Swagger
    });

    it("un jeton d'accès envoyé en en-tête (au lieu du cookie) n'ouvre pas la documentation", async () => {
      const { token } = await openSession('docs.admin');
      await http().get('/api-docs/json').set('Authorization', `Bearer ${token}`).expect(401);
    });
  });

  describe('ouverture de la session de documentation', () => {
    it('refuse sans jeton ou avec un jeton invalide, sans poser de cookie', async () => {
      for (const header of [undefined, 'Bearer abc', 'Basic xyz', 'Bearer ']) {
        const req = http().post('/api-docs/_portal/session');
        const res = await (header ? req.set('Authorization', header) : req).expect(401);
        expect(res.body.code).toBe('TOKEN_INVALID');
        expect(docsCookie(res)).toBe('');
      }
    });

    it("refuse un compte sans la permission `api.docs:read` (le caissier), sans cookie", async () => {
      const token = (await login('caissier')).body.accessToken;
      const res = await http().post('/api-docs/_portal/session').set('Authorization', `Bearer ${token}`).expect(403);
      expect(res.body).toMatchObject({ code: 'DOCS_FORBIDDEN', reason: 'forbidden' });
      expect(docsCookie(res)).toBe('');
    });

    it('refuse une session restreinte (compte à finaliser), même pour un administrateur', async () => {
      const token = (await login('nouveau')).body.accessToken;
      const res = await http().post('/api-docs/_portal/session').set('Authorization', `Bearer ${token}`).expect(403);
      expect(res.body).toMatchObject({ code: 'SETUP_REQUIRED', reason: 'setup-required' });
    });

    it("pose un cookie httpOnly, SameSite=Strict, limité à /api-docs, de durée bornée par celle du jeton", async () => {
      const token = (await login('docs.admin', { totpCode: totp() })).body.accessToken;
      const res = await http().post('/api-docs/_portal/session').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body).toEqual({ displayName: 'docs.admin' });
      const cookie = docsCookie(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api-docs(;|$)/);
      const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie)?.[1]);
      expect(maxAge).toBeGreaterThan(0);
      expect(maxAge).toBeLessThanOrEqual(900);
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('avec une session de documentation', () => {
    let cookie: string;
    beforeAll(async () => { ({ cookie } = await openSession('docs.admin')); });

    it("donne accès à l'interface Swagger, au document JSON et YAML, et à la barre de session", async () => {
      const ui = await http().get('/api-docs').set('Cookie', cookie).expect(200);
      expect(ui.text).toContain('swagger-ui');
      expect(ui.text).toContain('/api-docs/_portal/toolbar.js');
      expect(ui.headers['cache-control']).toBe('no-store');

      const json = await http().get('/api-docs/json').set('Cookie', cookie).expect(200);
      expect(json.body.openapi).toMatch(/^3\./);
      expect(Object.keys(json.body.paths).length).toBeGreaterThan(10);
      expect((await http().get('/api-docs/yaml').set('Cookie', cookie).expect(200)).text).toContain('openapi: 3');
    });

    it('identifie la personne connectée et localise le libellé de déconnexion', async () => {
      const fr = await http().get('/api-docs/_portal/me').set('Cookie', cookie).expect(200);
      expect(fr.body).toEqual({ displayName: 'docs.admin', signOut: 'Se déconnecter' });
      const en = await http().get('/api-docs/_portal/me?lang=en').set('Cookie', cookie).expect(200);
      expect(en.body.signOut).toBe('Sign out');
    });

    it('la déconnexion efface le cookie', async () => {
      const res = await http().post('/api-docs/_portal/logout').set('Cookie', cookie).expect(204);
      expect(docsCookie(res)).toMatch(/sanjeevani_docs=;/);
      expect(docsCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
  });

  describe('révocation immédiate', () => {
    it("désactiver le compte ferme l'accès sans attendre l'expiration du cookie", async () => {
      const victim = await w.seed({ username: 'docs.temp', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
      const { cookie } = await openSession('docs.temp');
      await http().get('/api-docs/json').set('Cookie', cookie).expect(200);

      const adminToken = (await login('docs.admin', { totpCode: totp() })).body.accessToken;
      await http().post(`/api/v1/users/${victim.id.value}/disable`).set('Authorization', `Bearer ${adminToken}`).expect(200);

      await http().get('/api-docs/json').set('Cookie', cookie).expect(401);
      expect((await http().get('/api-docs').set('Cookie', cookie).expect(200)).text).toContain('id="login-form"');
    });

    it("retirer le rôle qui porte la permission ferme l'accès", async () => {
      const user = await w.seed({ username: 'docs.demote', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
      const { cookie } = await openSession('docs.demote');
      await http().get('/api-docs/json').set('Cookie', cookie).expect(200);

      const adminToken = (await login('docs.admin', { totpCode: totp() })).body.accessToken;
      await http().put(`/api/v1/users/${user.id.value}/roles`).set('Authorization', `Bearer ${adminToken}`).send({ roles: ['DPO_AUDITOR'] }).expect(200);

      await http().get('/api-docs/json').set('Cookie', cookie).expect(401);
    });
  });

  describe('permission', () => {
    it("n'est accordée par défaut qu'à l'administrateur système", async () => {
      const rows = await w.sql.query<{ code: string }>("SELECT code FROM iam_roles WHERE 'api.docs:read' = ANY(permissions) ORDER BY code");
      expect(rows.map((r) => r.code)).toEqual(['SYSTEM_ADMIN']);
    });
  });
});

describe('options du portail', () => {
  it("l'attribut Secure du cookie suit la configuration", async () => {
    const w = await createTestWorld({ docs: true, secureCookies: true });
    try {
      await w.seed({ username: 'caissier', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
      const token = (await request(w.app.getHttpServer()).post('/api/v1/auth/login').send({ username: 'caissier', password: PWD, totpCode: totp() })).body.accessToken;
      const res = await request(w.app.getHttpServer()).post('/api-docs/_portal/session').set('Authorization', `Bearer ${token}`).expect(200);
      expect(docsCookie(res)).toMatch(/;\s*Secure/i);
    } finally {
      await w.close();
    }
  });

  it('requireLogin: false ouvre la documentation sans portail (poste de développement isolé)', async () => {
    const w = await createTestWorld({ docs: true, docsOptions: { requireLogin: false } });
    try {
      const ui = await request(w.app.getHttpServer()).get('/api-docs').expect(200);
      expect(ui.text).toContain('swagger-ui');
      expect(ui.text).not.toContain('_portal/toolbar.js');
      await request(w.app.getHttpServer()).get('/api-docs/json').expect(200);
      await request(w.app.getHttpServer()).get('/api-docs/_portal/session').expect(404);
    } finally {
      await w.close();
    }
  });

  it("échec fermé : sans système d'identité branché, la documentation n'est pas publiée (et rien ne plante)", async () => {
    // Démarrage via NestFactory, comme en production : son proxy arrête le processus si on cherche un fournisseur absent
    // (ce que `Test.createTestingModule` ne reproduit pas). Ce test aurait détecté ce défaut.
    const app = await NestFactory.create<NestExpressApplication>(AppModule.register({ database: false }), { logger: false });
    configureApp(app, { corsOrigins: [], docs: buildApiDocsOptions(true), secureCookies: false });
    await app.init();
    try {
      for (const url of ['/api-docs', '/api-docs/json']) expect((await request(app.getHttpServer()).get(url)).status).toBe(404);
    } finally {
      await app.close();
    }
  });
});

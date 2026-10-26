import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from './e2e-app';

type Op = {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  security?: Record<string, string[]>[];
  responses: Record<string, { description?: string; content?: Record<string, { schema?: { $ref?: string; items?: { $ref?: string } } }> }>;
  requestBody?: { content: Record<string, { schema: { $ref: string } }> };
};
type Doc = {
  openapi: string;
  info: { title: string; description: string; version: string };
  tags: { name: string; description?: string }[];
  paths: Record<string, Record<string, Op>>;
  components: { securitySchemes: Record<string, unknown>; schemas: Record<string, { properties?: Record<string, { example?: unknown; description?: string; enum?: string[]; type?: string }>; required?: string[] }> };
};

describe('documentation interactive de l\'API (OpenAPI)', () => {
  let w: TestWorld;
  let doc: Doc;
  let cookie: string; // session de documentation d'un administrateur
  const ops = (): { path: string; method: string; op: Op }[] =>
    Object.entries(doc.paths).flatMap(([path, item]) => Object.entries(item).map(([method, op]) => ({ path, method: method.toUpperCase(), op })));
  const find = (method: string, path: string) => ops().find((o) => o.method === method && o.path === path)!.op;

  beforeAll(async () => {
    w = await createTestWorld({ docs: true });
    await w.seed({ username: 'docs.admin', password: 'une phrase de passe solide', roles: ['SYSTEM_ADMIN'], mfa: true });
    const login = await request(w.app.getHttpServer()).post('/api/v1/auth/login').send({ username: 'docs.admin', password: 'une phrase de passe solide', totpCode: generateSync({ secret: TOTP_SECRET }) });
    const session = await request(w.app.getHttpServer()).post('/api-docs/_portal/session').set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
    cookie = (session.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    doc = (await request(w.app.getHttpServer()).get('/api-docs/json').set('Cookie', cookie).expect(200)).body as Doc;
  });
  afterAll(() => w.close());

  it('est un document OpenAPI 3 avec un titre, une description et un schéma de sécurité Bearer JWT', () => {
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBe('Sanjeevani EMR — API');
    expect(doc.info.description).toContain('Tester les endpoints');
    expect(doc.info.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(doc.components.securitySchemes.bearer).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
  });

  it('documente TOUS les endpoints de la nouvelle API (résumé, groupe, réponse de succès)', () => {
    const v1 = ops().filter((o) => o.path.startsWith('/api/v1/'));
    expect(v1.length).toBe(74); // 7 d'authentification + 11 d'administration des comptes et de droits d'accès + 7 d'organisation et d'établissements + 7 de structure + 6 de référentiels + 8 de personnel + 5 d'affectations + 2 d'audit + 7 de patients + 6 de rendez-vous + 8 d'admissions
    for (const { path, method, op } of v1) {
      expect({ path, method, summary: !!op.summary?.trim() }).toEqual({ path, method, summary: true });
      expect({ path, method, tags: (op.tags ?? []).length }).toEqual({ path, method, tags: 1 });
      expect({ path, method, success: Object.keys(op.responses).some((s) => /^2/.test(s)) }).toEqual({ path, method, success: true });
    }
  });

  it('a des identifiants d\'opération uniques et lisibles', () => {
    const ids = ops().map((o) => o.op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(find('POST', '/api/v1/auth/login').operationId).toBe('Auth_login');
  });

  it('affiche le cadenas uniquement sur les endpoints qui exigent un jeton', () => {
    const publicOps = ['POST /api/v1/auth/login', 'POST /api/v1/auth/refresh', 'POST /api/v1/auth/logout', 'GET /api/Health'];
    for (const { path, method, op } of ops()) {
      const isPublic = publicOps.includes(`${method} ${path}`);
      expect({ route: `${method} ${path}`, secured: !!op.security?.some((s) => 'bearer' in s) }).toEqual({ route: `${method} ${path}`, secured: !isPublic });
    }
  });

  it('indique les permissions requises, déduites du contrôle d\'accès réel (une seule source de vérité)', () => {
    expect(find('GET', '/api/v1/users').description).toContain('**Permissions requises :** `iam.users:read`');
    expect(find('POST', '/api/v1/users').description).toContain('`iam.users:manage`');
    expect(find('GET', '/api/v1/roles').description).toContain('`iam.roles:read`');
    expect(find('POST', '/api/v1/users/{id}/disable').description).toContain('`iam.users:manage`');
    expect(find('GET', '/api/v1/auth/me').description).not.toContain('Permissions requises');
  });

  it('signale les endpoints accessibles avec une session restreinte', () => {
    for (const [m, p] of [['GET', '/api/v1/auth/me'], ['POST', '/api/v1/auth/password/change'], ['POST', '/api/v1/auth/mfa/enroll'], ['POST', '/api/v1/auth/mfa/activate']] as const) {
      expect(find(m, p).description).toContain('session restreinte');
    }
    expect(find('GET', '/api/v1/users').description).not.toContain('session restreinte');
  });

  it('décrit les erreurs possibles avec le schéma d\'erreur standard', () => {
    const login = find('POST', '/api/v1/auth/login');
    expect(Object.keys(login.responses)).toEqual(expect.arrayContaining(['200', '400', '401', '429']));
    expect(login.responses['401'].content?.['application/json'].schema?.$ref).toBe('#/components/schemas/ErrorBodyDto');
    expect(Object.keys(find('GET', '/api/v1/users').responses)).toEqual(expect.arrayContaining(['401', '403']));
    expect(Object.keys(find('POST', '/api/v1/users/{id}/disable').responses)).toEqual(expect.arrayContaining(['401', '403', '404']));
  });

  it('pré-remplit « Try it out » avec des exemples réalistes (corps de requête)', () => {
    const body = find('POST', '/api/v1/auth/login').requestBody?.content['application/json'].schema.$ref;
    expect(body).toBe('#/components/schemas/LoginDto');
    const login = doc.components.schemas.LoginDto;
    expect(login.properties?.username.example).toBe('marie.curie');
    expect(login.properties?.totpCode.example).toBe('123456');
    expect(login.required).toEqual(['username', 'password']); // totpCode et recoveryCode sont optionnels
    expect(doc.components.schemas.CreateUserDto.properties?.roles.example).toEqual(['PHARMACIST']);
  });

  it('documente les réponses (schémas, énumérations, listes)', () => {
    expect(find('POST', '/api/v1/auth/login').responses['200'].content?.['application/json'].schema?.$ref).toBe('#/components/schemas/LoginResponseDto');
    expect(find('GET', '/api/v1/roles').responses['200'].content?.['application/json'].schema?.items?.$ref).toBe('#/components/schemas/RoleDto');
    expect(doc.components.schemas.TokenResponseDto.properties?.scope.enum).toEqual(['full', 'setup']);
    expect(doc.components.schemas.CreatedUserDto.properties?.temporaryPassword.description).toContain('UNE SEULE FOIS');
  });

  it('organise les groupes dans l\'ordre voulu, avec leur description', () => {
    expect(doc.tags.map((t) => t.name)).toEqual(['Authentification', 'Utilisateurs et rôles', 'Organisation et établissements', "Structure de l'établissement", 'Personnel', 'Affectations', 'Référentiels', 'Patients', 'Rendez-vous', 'Admissions', "Journal d'audit", 'Système']);
    expect(doc.tags[0].description).toContain('Parcours type');
  });

  it('ne contient aucun secret ni valeur de configuration', () => {
    const text = JSON.stringify(doc);
    expect(text).not.toContain('j'.repeat(40)); // JWT_SECRET de test
    expect(text).not.toMatch(/argon2id\$|password_hash|SECRET_ENCRYPTION_KEY/);
  });

  describe('interface et formats', () => {
    it("sert l'interface Swagger UI et le document en YAML", async () => {
      const ui = await request(w.app.getHttpServer()).get('/api-docs').set('Cookie', cookie).expect(200);
      expect(ui.text).toContain('swagger-ui');
      const yaml = await request(w.app.getHttpServer()).get('/api-docs/yaml').set('Cookie', cookie).expect(200);
      expect(yaml.text).toContain('openapi: 3');
    });

    it("charge l'initialisation avec la connexion automatique du jeton", async () => {
      const initJs = (await request(w.app.getHttpServer()).get('/api-docs/swagger-ui-init.js').set('Cookie', cookie).expect(200)).text;
      expect(initJs).toContain("ui.preauthorizeApiKey('bearer', token)");
      expect(initJs).toContain('persistAuthorization');
    });

    it("relâche la CSP uniquement pour la documentation (pas d'upgrade-insecure-requests), pas pour l'API", async () => {
      const docs = await request(w.app.getHttpServer()).get('/api-docs').expect(200);
      expect(docs.headers['content-security-policy']).toBeDefined();
      expect(docs.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');

      const api = await request(w.app.getHttpServer()).get('/api/v1/auth/me').expect(401);
      expect(api.headers['content-security-policy']).toContain('upgrade-insecure-requests');
      expect(api.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});

describe('documentation désactivée', () => {
  it("n'expose ni l'interface ni le document (cas de la production par défaut)", async () => {
    const w = await createTestWorld({ docs: false });
    try {
      for (const url of ['/api-docs', '/api-docs/json', '/api-docs/yaml', '/api-docs/_portal/portal.css', '/api-docs/_portal/session']) {
        expect((await request(w.app.getHttpServer()).get(url)).status).toBe(404);
      }
    } finally {
      await w.close();
    }
  });
});

import request from 'supertest';
import { I18nAdapterName } from '../../src/modules/i18n/localization.module';
import { createTestWorld, TestWorld } from './e2e-app';

const PWD = 'une phrase de passe solide';

describe.each<I18nAdapterName>(['nestjs-i18n', 'json'])('API localisée de bout en bout — adaptateur « %s »', (adapter) => {
  let w: TestWorld;
  const http = () => request(w.app.getHttpServer());
  const badLogin = () => http().post('/api/v1/auth/login');

  beforeAll(async () => {
    w = await createTestWorld({ i18nAdapter: adapter });
    await w.seed({ username: 'caissier', password: PWD, roles: ['CASHIER'] });
    await w.seed({ username: 'nouveau', password: 'Provisoire-2026', roles: ['CASHIER'], mustChangePassword: true });
  });
  afterAll(() => w.close());

  describe('choix de la langue', () => {
    // Identifiant fictif : des échecs répétés sur un vrai compte le verrouilleraient (comportement voulu).
    const wrong = { username: 'compte.fantome', password: 'mauvais mot de passe' };

    it('français par défaut, annoncé dans Content-Language', async () => {
      const res = await badLogin().send(wrong).expect(401);
      expect(res.body).toEqual({ statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Identifiant ou mot de passe incorrect.' });
      expect(res.headers['content-language']).toBe('fr');
      expect(res.headers.vary).toMatch(/Accept-Language/i);
    });

    it('suit Accept-Language (avec poids et variante régionale)', async () => {
      const res = await badLogin().set('Accept-Language', 'de;q=0.9, en-US;q=0.8, fr;q=0.2').send(wrong).expect(401);
      expect(res.body.message).toBe('Incorrect username or password.');
      expect(res.headers['content-language']).toBe('en');
      expect(res.body.code).toBe('INVALID_CREDENTIALS'); // le code, lui, ne change jamais : les clients s'appuient dessus
    });

    it('respecte la priorité ?lang= > X-Locale > Accept-Language', async () => {
      const q = await badLogin().query({ lang: 'en' }).set('Accept-Language', 'fr').set('X-Locale', 'fr').send(wrong);
      expect(q.body.message).toBe('Incorrect username or password.');
      const h = await badLogin().set('X-Locale', 'en').set('Accept-Language', 'fr').send(wrong);
      expect(h.body.message).toBe('Incorrect username or password.');
    });

    it('retombe en français pour une langue non supportée ou une valeur malveillante', async () => {
      for (const lang of ['de', 'zz', "en'; DROP TABLE users;--", '../../etc/passwd']) {
        const res = await badLogin().query({ lang }).send(wrong);
        expect(res.body.message).toBe('Identifiant ou mot de passe incorrect.');
        expect(res.headers['content-language']).toBe('fr');
      }
    });
  });

  describe('messages paramétrés', () => {
    it('insère les paramètres dans la langue demandée', async () => {
      const login = await badLogin().send({ username: 'nouveau', password: 'Provisoire-2026' }).expect(200);
      const change = (lang: string) =>
        http().post('/api/v1/auth/password/change').query({ lang }).set('Authorization', `Bearer ${login.body.accessToken}`).send({ currentPassword: 'Provisoire-2026', newPassword: 'court' });
      const fr = await change('fr').expect(422);
      expect(fr.body).toEqual({ statusCode: 422, code: 'PASSWORD_TOO_SHORT', message: 'Le mot de passe doit contenir au moins 12 caractères.' });
      const en = await change('en').expect(422);
      expect(en.body).toEqual({ statusCode: 422, code: 'PASSWORD_TOO_SHORT', message: 'The password must be at least 12 characters long.' });
      expect(JSON.stringify(en.body)).not.toContain('params'); // détail interne, non exposé
    });
  });

  describe('validation des entrées', () => {
    it('renvoie des erreurs structurées avec le libellé du champ dans la langue demandée', async () => {
      const fr = await badLogin().send({}).expect(400);
      expect(fr.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED', message: 'Les données envoyées sont invalides.' });
      const username = fr.body.errors.find((e: { field: string; rule: string }) => e.field === 'username' && e.rule === 'isString');
      expect(username.message).toBe('Le champ « identifiant » doit être un texte.');

      const en = await badLogin().set('Accept-Language', 'en').send({}).expect(400);
      expect(en.body.message).toBe('The submitted data is invalid.');
      expect(en.body.errors.find((e: { field: string; rule: string }) => e.field === 'password' && e.rule === 'isString').message).toBe('The "password" field must be text.');
    });

    it('traduit une règle personnalisée désignée par une clé de catalogue', async () => {
      const fr = await badLogin().send({ username: 'caissier', password: PWD, totpCode: 'abcdef' }).expect(400);
      expect(fr.body.errors).toEqual([{ field: 'totpCode', rule: 'sixDigits', message: 'Le champ « code de vérification » doit comporter 6 chiffres.' }]);
      const en = await badLogin().query({ lang: 'en' }).send({ username: 'caissier', password: PWD, totpCode: 'abcdef' }).expect(400);
      expect(en.body.errors[0].message).toBe('The "verification code" field must be 6 digits.');
    });

    it("ne renvoie jamais la valeur saisie (un mot de passe ne revient pas dans l'erreur)", async () => {
      const res = await badLogin().send({ username: 'caissier', password: PWD, totpCode: 'secret-visible' }).expect(400);
      expect(JSON.stringify(res.body)).not.toContain('secret-visible');
    });
  });

  describe("erreurs d'accès et de routage", () => {
    it('401, 403 et « configuration requise » sont traduits, avec un code stable', async () => {
      const none = await http().get('/api/v1/auth/me').set('Accept-Language', 'en').expect(401);
      expect(none.body).toMatchObject({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });

      const session = await badLogin().send({ username: 'caissier', password: PWD }).expect(200);
      const forbidden = await http().get('/api/v1/users').set('Authorization', `Bearer ${session.body.accessToken}`).set('Accept-Language', 'en').expect(403);
      expect(forbidden.body).toMatchObject({ code: 'FORBIDDEN', message: 'You are not allowed to perform this action.' });

      const setup = await badLogin().send({ username: 'nouveau', password: 'Provisoire-2026' });
      const blocked = await http().get('/api/v1/users').set('Authorization', `Bearer ${setup.body.accessToken}`).expect(403);
      expect(blocked.body).toMatchObject({ code: 'SETUP_REQUIRED', message: expect.stringContaining('double authentification') });
    });

    it('une route inconnue donne un 404 traduit, sans révéler le détail technique', async () => {
      const res = await http().get('/api/v1/nexiste-pas').set('Accept-Language', 'en').expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, code: 'HTTP_404', message: 'Resource not found.' });
      expect(JSON.stringify(res.body)).not.toContain('Cannot GET');
    });
  });
});

describe('limitation de débit localisée', () => {
  it('traduit le 429', async () => {
    const w = await createTestWorld({ rateLimiting: true });
    try {
      let last: request.Response | undefined;
      for (let i = 0; i < 12; i++) last = await request(w.app.getHttpServer()).post('/api/v1/auth/login').set('Accept-Language', 'en').send({ username: 'inconnu', password: 'x' });
      expect(last?.status).toBe(429);
      expect(last?.body).toMatchObject({ code: 'HTTP_429', message: 'Too many requests. Please try again shortly.' });
    } finally {
      await w.close();
    }
  });
});

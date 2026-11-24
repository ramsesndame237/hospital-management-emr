import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';

const PWD = 'une phrase de passe solide';
const YAOUNDE = { countryCode: 'CM', region: 'Centre', commune: 'Yaoundé', street: 'Avenue Kennedy', latitude: 3.848, longitude: 11.502 };

describe('API sites : localisation et code composé (HTTP réel, PostgreSQL réel)', () => {
  let w: TestWorld;
  let admin: string;
  let cashier: string;
  const http = () => request(w.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, mfa = false): Promise<string> =>
    (await http().post('/api/v1/auth/login').send({ username, password: PWD, ...(mfa ? { totpCode: generateSync({ secret: TOTP_SECRET }) } : {}) }).expect(200)).body.accessToken as string;
  const register = (body: object) => http().post('/api/v1/facilities').set(bearer(admin)).send(body);
  const preview = (body: object, token = admin) => http().post('/api/v1/facilities/code-preview').set(bearer(token)).send(body);

  beforeAll(async () => {
    w = await createTestWorld();
    await w.seed({ username: 'admin', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
    await w.seed({ username: 'caissier', password: PWD, roles: ['CASHIER'] });
    admin = await login('admin', true);
    cashier = await login('caissier');
    await http().put('/api/v1/organization').set(bearer(admin)).send({ name: 'Groupe Hospitalier' }).expect(200);
  });
  afterAll(() => w.close());

  describe("code composé d'après la localisation et le nom", () => {
    it('compose CMYA-hcy-01 pour l’Hôpital Central de Yaoundé, et garde la localisation', async () => {
      const res = await register({ name: 'Hôpital Central de Yaoundé', location: YAOUNDE });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ code: 'CMYA-hcy-01', name: 'Hôpital Central de Yaoundé', location: YAOUNDE });
    });

    it("prend le numéro d'ordre suivant pour un site de même nom et même commune, et un autre début pour une autre commune", async () => {
      const second = await register({ name: 'Hôpital Central de Yaoundé (annexe)', location: YAOUNDE });
      expect(second.body.code).toBe('CMYA-hcy-02'); // même pays/commune, mêmes initiales (hcy) : numéro suivant
      const douala = await register({ name: 'Hôpital Central de Douala', location: { countryCode: 'cm', commune: 'Douala' } });
      expect(douala.body).toMatchObject({ code: 'CMDO-hcd-01', location: { countryCode: 'CM', commune: 'Douala', region: null, street: null, latitude: null, longitude: null } });
    });

    it("utilise la région à défaut de commune, et « XX » quand il n'y a ni l'une ni l'autre", async () => {
      expect((await register({ name: 'Dispensaire Rural', location: { countryCode: 'SN', region: 'Kolda' } })).body.code).toBe('SNKO-dri-01');
      expect((await register({ name: 'Poste Frontalier', location: { countryCode: 'TD' } })).body.code).toBe('TDXX-pfo-01');
    });

    it("le code proposé avant la création est celui qui sera attribué, et ne réserve rien", async () => {
      const body = { name: 'Clinique du Parc', location: { countryCode: 'FR', commune: 'Paris' } };
      const proposed = await preview(body);
      expect(proposed.status).toBe(200);
      expect(proposed.body).toEqual({ code: 'FRPA-cpl-01' });
      expect((await preview(body)).body.code).toBe('FRPA-cpl-01'); // rien n'a été enregistré
      expect((await register(body)).body.code).toBe('FRPA-cpl-01');
      expect((await preview(body)).body.code).toBe('FRPA-cpl-02');
    });

    it('un code fourni est toujours accepté (reprise de données) ; il est contrôlé et reste unique', async () => {
      const ok = await register({ name: 'Site historique', code: 'A1B2-abc-01', location: YAOUNDE });
      expect(ok.status).toBe(201);
      expect(ok.body.code).toBe('A1B2-abc-01');
      expect((await register({ name: 'Doublon', code: 'A1B2-abc-01' })).body.code).toBe('FACILITY_CODE_ALREADY_EXISTS');
      expect((await register({ name: 'Mal formé', code: 'pas-un-code' })).body.code).toBe('FACILITY_CODE_INVALID');
      const noLocation = await register({ name: 'Sans lieu ni code' });
      expect([noLocation.status, noLocation.body.code]).toEqual([422, 'FACILITY_CODE_LOCATION_REQUIRED']);
    });

    it('deux enregistrements simultanés du même site reçoivent deux codes différents', async () => {
      const body = { name: 'Centre de Santé Simultané', location: { countryCode: 'CI', commune: 'Abidjan' } };
      const [a, b] = await Promise.all([register(body), register(body)]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(new Set([a.body.code, b.body.code]).size).toBe(2);
      expect([a.body.code, b.body.code].sort()).toEqual(['CIAB-css-01', 'CIAB-css-02']);
    });
  });

  describe('localisation invalide', () => {
    it.each([
      [{ countryCode: 'CMR' }], [{ countryCode: '12' }], [{ countryCode: 'CM', latitude: 3.8 }], [{ countryCode: 'CM', latitude: 91, longitude: 0 }],
    ])('refuse %j', async (location) => {
      const res = await register({ name: 'Site', location });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect((await preview({ name: 'Site', location })).status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('modifier la localisation', () => {
    it("remplace la localisation sans changer le code, l'efface avec null, et ne journalise que le fait", async () => {
      const created = (await register({ name: 'Hôpital Régional de Bafoussam', location: { countryCode: 'CM', commune: 'Bafoussam' } })).body;
      expect(created.code).toBe('CMBA-hrb-01');
      const moved = await http().patch(`/api/v1/facilities/${created.id}`).set(bearer(admin)).send({ location: { countryCode: 'CM', region: 'Ouest', commune: 'Bafoussam', street: 'Rue 1.200', latitude: 5.4737, longitude: 10.4179 } });
      expect(moved.status).toBe(200);
      expect(moved.body).toMatchObject({ code: 'CMBA-hrb-01', location: { region: 'Ouest', street: 'Rue 1.200', latitude: 5.4737, longitude: 10.4179 } });
      const kept = await http().patch(`/api/v1/facilities/${created.id}`).set(bearer(admin)).send({ name: 'Hôpital Régional de l’Ouest' });
      expect(kept.body.location).toMatchObject({ region: 'Ouest' }); // champ absent : inchangé
      const cleared = await http().patch(`/api/v1/facilities/${created.id}`).set(bearer(admin)).send({ location: null });
      expect(cleared.body.location).toBeNull();
      const rows = await w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'administration.facility.update' AND resource_id = $1", [created.id]);
      expect(rows.length).toBe(3);
      expect(JSON.stringify(rows)).not.toMatch(/Rue 1\.200/);
    });

    it('la liste et la lecture renvoient la localisation', async () => {
      const list = (await http().get('/api/v1/facilities').set(bearer(admin)).expect(200)).body.items as { code: string; location: unknown }[];
      expect(list.find((f) => f.code === 'CMYA-hcy-01')?.location).toMatchObject({ countryCode: 'CM', commune: 'Yaoundé' });
    });
  });

  describe("contrôle d'accès", () => {
    it("l'aperçu du code, comme la création, est réservé à qui gère les établissements", async () => {
      const body = { name: 'Site', location: { countryCode: 'CM' } };
      expect((await http().post('/api/v1/facilities/code-preview').send(body)).status).toBe(401);
      expect((await preview(body, cashier)).status).toBe(403);
    });
  });
});

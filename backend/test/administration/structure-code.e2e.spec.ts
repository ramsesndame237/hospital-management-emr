import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';
import { childCodeCandidate, serviceCodeCandidate } from '../../src/modules/administration/domain/structure/node-code-generator';

const PWD = 'une phrase de passe solide';

describe('codes composés des éléments de structure', () => {
  it('compose le code d’un service depuis les initiales de son nom, avec un numéro à partir du deuxième', () => {
    expect(serviceCodeCandidate('Pédiatrie', 1)).toBe('PED');
    expect(serviceCodeCandidate('Médecine Générale', 1)).toBe('MGE');
    expect(serviceCodeCandidate('Pédiatrie', 2)).toBe('PED-02');
  });

  it('compose celui d’une unité, d’une salle, d’un lit selon leur niveau', () => {
    expect([childCodeCandidate('UNIT', 1), childCodeCandidate('ROOM', 3), childCodeCandidate('BED', 12)]).toEqual(['U01', 'R03', 'B12']);
  });
});

describe('API structure : code automatique (HTTP réel, PostgreSQL réel)', () => {
  let w: TestWorld;
  let admin: string;
  let facilityId: string;
  const http = () => request(w.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    w = await createTestWorld();
    await w.seed({ username: 'admin', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true });
    admin = (await http().post('/api/v1/auth/login').send({ username: 'admin', password: PWD, totpCode: generateSync({ secret: TOTP_SECRET }) }).expect(200)).body.accessToken as string;
    await http().put('/api/v1/organization').set(bearer(admin)).send({ name: 'Hôpital' }).expect(200);
    facilityId = (await http().post('/api/v1/facilities').set(bearer(admin)).send({ name: 'Site', code: 'A1B2-abc-01' }).expect(201)).body.id;
  });
  afterAll(() => w.close());

  const service = (name: string, extra: object = {}) => http().post(`/api/v1/facilities/${facilityId}/services`).set(bearer(admin)).send({ name, serviceType: 'CLINICAL', ...extra });
  const child = (parentId: string, name: string, extra: object = {}) => http().post(`/api/v1/structure/${parentId}/children`).set(bearer(admin)).send({ name, ...extra });

  it('donne un code à chaque service sans qu’on en saisisse, et un autre à un homonyme', async () => {
    const a = await service('Pédiatrie');
    expect([a.status, a.body.code]).toEqual([201, 'PED']);
    expect((await service('Pédiatrie')).body.code).toBe('PED-02');
    expect((await service('Pédiatre Conseil')).body.code).toBe('PC' + 'E'); // initiales « pc » complétées par la suite du premier mot : PCE
  });

  it('numérote unités, salles et lits parmi leurs frères', async () => {
    const svc = (await service('Maternité')).body.id as string;
    const u1 = await child(svc, 'Suites de couches');
    const u2 = await child(svc, 'Salle de travail');
    expect([u1.body.code, u2.body.code]).toEqual(['U01', 'U02']);
    const room = await child(u1.body.id, 'Chambre 1', { floor: '1' });
    expect(room.body.code).toBe('R01');
    expect((await child(room.body.id, 'Lit A')).body.code).toBe('B01');
    expect((await child(room.body.id, 'Lit B')).body.code).toBe('B02');
  });

  it('accepte encore un code fourni (reprise de données), qui reste contrôlé et unique', async () => {
    expect((await service('Urgences', { code: 'urg' })).body.code).toBe('URG');
    expect((await service('Autres urgences', { code: 'URG' })).body.code).toBe('STRUCTURE_CODE_ALREADY_EXISTS');
    expect((await service('Mal formé', { code: 'pas bon!' })).body.code).toBe('STRUCTURE_CODE_INVALID');
  });

  it('un code composé saute ceux déjà pris, même fournis à la main', async () => {
    const svc = (await service('Radiologie')).body.id as string;
    await child(svc, 'Unité manuelle', { code: 'U01' });
    expect((await child(svc, 'Unité suivante')).body.code).toBe('U02');
  });
});

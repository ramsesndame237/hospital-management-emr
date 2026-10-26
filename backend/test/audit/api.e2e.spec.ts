import { generateSync } from 'otplib';
import request from 'supertest';
import { Temporal } from '../../src/shared-kernel/temporal';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';

const PWD = 'une phrase de passe solide';
const api = (path: string) => `/api/v1${path}`;

describe("journal d'audit : consultation et intégrité (HTTP réel, PostgreSQL réel)", () => {
  let w: TestWorld;
  let admin: string;
  let auditor: string;
  let nurse: string;
  let adminId: string;
  const http = () => request(w.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, mfa = false): Promise<string> => {
    const res = await http().post('/api/v1/auth/login').send({ username, password: PWD, ...(mfa ? { totpCode: generateSync({ secret: TOTP_SECRET }) } : {}) }).expect(200);
    return res.body.accessToken as string;
  };
  const events = (query: Record<string, string | number> = {}, token = () => auditor) => http().get(api('/audit/events')).query(query).set(bearer(token()));

  beforeAll(async () => {
    w = await createTestWorld();
    adminId = (await w.seed({ username: 'admin', password: PWD, roles: ['SYSTEM_ADMIN'], mfa: true })).id.value;
    await w.seed({ username: 'auditeur', password: PWD, roles: ['DPO_AUDITOR'], mfa: true });
    await w.seed({ username: 'infirmier', password: PWD, roles: ['NURSE'], mfa: true });
    [admin, auditor, nurse] = [await login('admin', true), await login('auditeur', true), await login('infirmier', true)];
    // quelques actions métier à retrouver dans le journal
    await http().put(api('/organization')).set(bearer(admin)).send({ name: 'Hôpital' }).expect(200);
    await http().post(api('/facilities')).set(bearer(admin)).send({ name: 'Site', code: 'A1B2-abc-01' }).expect(201);
    await http().post(api('/users')).set(bearer(nurse)).send({ username: 'x.y', email: 'x@y.co', roles: ['NURSE'] }).expect(403); // refus à tracer
  });
  afterAll(() => w.close());

  it.each(['/audit/events', '/audit/verify'])('GET %s : sans jeton → 401, infirmier → 403', async (url) => {
    await http().get(api(url)).expect(401);
    await http().get(api(url)).set(bearer(nurse)).expect(403);
  });

  describe('recherche', () => {
    it("l'auditeur ET l'administrateur système lisent le journal ; les entrées sont complètes et les plus récentes d'abord", async () => {
      const res = await events({ limit: 200 }).expect(200);
      const ids = (res.body.items as { id: string }[]).map((e) => BigInt(e.id));
      expect(ids).toEqual([...ids].sort((a, b) => (a < b ? 1 : -1)));
      expect(res.body.items[0]).toMatchObject({
        id: expect.any(String), occurredAt: expect.stringMatching(/Z$/), action: expect.any(String), outcome: expect.any(String), hash: expect.stringMatching(/^[0-9a-f]{64}$/), prevHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      await events({}, () => admin).expect(200);
    });

    it('filtre par action exacte, par préfixe, par acteur, par ressource et par résultat', async () => {
      const exact = (await events({ action: 'administration.organization.create' }).expect(200)).body.items;
      expect(exact).toHaveLength(1);
      expect(exact[0]).toMatchObject({ actorId: adminId, resourceType: 'organization', outcome: 'SUCCESS' });

      const prefix = (await events({ actionPrefix: 'administration.', limit: 200 }).expect(200)).body.items as { action: string }[];
      expect(prefix.map((e) => e.action).sort()).toEqual(['administration.facility.register', 'administration.organization.create']);

      const byActor = (await events({ actorId: adminId, actionPrefix: 'administration.' }).expect(200)).body.items;
      expect(byActor).toHaveLength(2);

      const denied = (await events({ outcome: 'denied' }).expect(200)).body.items as { action: string; reason: string; actorUsername: string; outcome: string }[];
      expect(denied.every((d) => d.action === 'access.denied' && d.outcome === 'DENIED' && d.actorUsername === 'infirmier')).toBe(true);
      expect(denied.map((d) => d.reason).sort()).toEqual(['missing:audit:read', 'missing:audit:read', 'missing:iam.users:manage']);

      const resource = (await events({ resourceType: 'facility', resourceId: (await events({ action: 'administration.facility.register' })).body.items[0].resourceId }).expect(200)).body.items;
      expect(resource).toHaveLength(1);
      expect((await events({ actionPrefix: '%' }).expect(200)).body.items).toEqual([]); // le préfixe est littéral, pas un joker
    });

    it('filtre par période (bornes incluses) et refuse les dates mal formées ou inversées', async () => {
      const all = (await events({ limit: 200 })).body.items as { occurredAt: string }[];
      const first = all[all.length - 1].occurredAt;
      const last = all[0].occurredAt;
      expect((await events({ from: first, to: last, limit: 200 }).expect(200)).body.items.length).toBeGreaterThanOrEqual(all.length);
      expect((await events({ from: '2999-01-01T00:00:00Z' }).expect(200)).body.items).toEqual([]);
      expect((await events({ to: '2000-01-01T00:00:00Z' }).expect(200)).body.items).toEqual([]);
      for (const bad of [{ from: 'hier' }, { to: '2026-10-23' }, { from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' }, { outcome: 'MAYBE' }, { before: 'abc' }, { before: '-1' }]) {
        const res = await events(bad).expect(422);
        expect(res.body.code ?? res.body.error?.code).toBe('AUDIT_FILTER_INVALID');
      }
    });

    it('pagine par curseur sans trou ni doublon, jusqu\'à la fin du journal', async () => {
      const everything = (await events({ limit: 200 })).body.items as { id: string }[];
      expect(everything.length).toBeGreaterThan(6);
      const seen: string[] = [];
      let before: string | undefined;
      for (let page = 0; page < 100; page += 1) {
        const res = await events({ limit: 4, ...(before ? { before } : {}), actionPrefix: '' }).expect(200);
        seen.push(...(res.body.items as { id: string }[]).map((e) => e.id));
        if (!res.body.nextBefore) break;
        before = res.body.nextBefore;
      }
      // chaque lecture ajoute une entrée « audit.log.read » : on compare ce qui existait avant la première page
      const stable = seen.filter((id) => BigInt(id) <= BigInt(everything[0].id));
      expect(new Set(stable).size).toBe(stable.length);
      expect(stable).toEqual(everything.map((e) => e.id));
    });

    it('borne la taille de page (1 à 200)', async () => {
      expect((await events({ limit: 0 }).expect(200)).body.limit).toBe(1);
      expect((await events({ limit: 5000 }).expect(200)).body.limit).toBe(200);
      expect((await events({ limit: 'abc' }).expect(200)).body.limit).toBe(50);
    });
  });

  describe('la consultation est elle-même tracée', () => {
    it('inscrit qui a lu quoi, avec les filtres utilisés et le nombre de résultats, sans en divulguer le contenu', async () => {
      await events({ actionPrefix: 'staff.', outcome: 'SUCCESS' }).expect(200);
      const [entry] = (await events({ action: 'audit.log.read', limit: 1 })).body.items;
      expect(entry).toMatchObject({ action: 'audit.log.read', actorUsername: 'auditeur', outcome: 'SUCCESS' });
      expect(entry.metadata).toEqual({ 'filter.actionPrefix': 'staff.', 'filter.outcome': 'SUCCESS', returned: 0 });
      // la lecture précédente (staff.*, SUCCESS) est retrouvable avec ses filtres
      const rows = await w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'audit.log.read' AND metadata ->> 'filter.actionPrefix' = 'staff.'");
      expect(rows).toHaveLength(1);
      expect(rows[0].metadata).toMatchObject({ returned: 0, 'filter.outcome': 'SUCCESS' });
    });
  });

  describe('vérification d\'intégrité', () => {
    it('confirme une chaîne intacte, et l\'inscrit', async () => {
      const res = await http().get(api('/audit/verify')).set(bearer(auditor)).expect(200);
      expect(res.body).toMatchObject({ valid: true, brokenAtId: null, checked: expect.any(Number) });
      const [entry] = (await events({ action: 'audit.log.verify', limit: 1 })).body.items;
      expect(entry).toMatchObject({ outcome: 'SUCCESS', actorUsername: 'auditeur' });
    });

    it("détecte une altération faite directement en base (même par un administrateur de base) et la localise", async () => {
      const target = (await events({ action: 'administration.facility.register' })).body.items[0];
      // L'attaque : un administrateur de base neutralise le déclencheur d'ajout seul puis falsifie une entrée.
      await w.db.exec('ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_immutable');
      await w.sql.query("UPDATE audit_log SET actor_id = 'someone-else' WHERE id = $1::bigint", [target.id]);
      await w.db.exec('ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_immutable');

      const res = await http().get(api('/audit/verify')).set(bearer(admin)).expect(200);
      expect(res.body).toMatchObject({ valid: false, brokenAtId: target.id });
      const [entry] = (await events({ action: 'audit.log.verify', outcome: 'FAILURE', limit: 1 })).body.items;
      expect(entry).toMatchObject({ reason: 'chain-broken', actorUsername: 'admin', metadata: { brokenAtId: target.id } });
    });
  });

  it("refuse toute modification ou suppression du journal (déclencheur d'ajout seul)", async () => {
    // journal sain, dans un monde neuf : le test précédent a volontairement altéré celui-ci
    const fresh = await createTestWorld();
    try {
      await fresh.seed({ username: 'audit.seed', password: PWD, roles: ['SYSTEM_ADMIN'] });
      await fresh.audit.record({ action: 'test.entry', outcome: 'SUCCESS', occurredAt: Temporal.Now.instant() });
      await expect(fresh.sql.query("UPDATE audit_log SET action = 'x'")).rejects.toThrow(/ajout seul/);
      await expect(fresh.sql.query('DELETE FROM audit_log')).rejects.toThrow(/ajout seul/);
      await expect(fresh.sql.query('TRUNCATE audit_log')).rejects.toThrow(/ajout seul/);
    } finally {
      await fresh.close();
    }
  });
});

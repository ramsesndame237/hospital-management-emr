import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { SqlExecutor } from '../../src/database/sql-executor';
import { PgAuditLog } from '../../src/modules/audit/infrastructure/pg-audit-log';
import { AccessPolicy } from '../../src/modules/iam/domain/role';
import { User } from '../../src/modules/iam/domain/user';
import { Email } from '../../src/modules/iam/domain/value-objects/email';
import { PasswordHash } from '../../src/modules/iam/domain/value-objects/password-hash';
import { Permission } from '../../src/modules/iam/domain/value-objects/permission';
import { RoleCode } from '../../src/modules/iam/domain/value-objects/role-code';
import { UserId } from '../../src/modules/iam/domain/value-objects/user-id';
import { Username } from '../../src/modules/iam/domain/value-objects/username';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { PgUserRepository } from '../../src/modules/iam/infrastructure/persistence/pg-user.repository';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from './fakes';

const DDL = fs.readFileSync(path.join(__dirname, '../../migration/schema/iam.pg.sql'), 'utf8');

/** Exécuteur SQL branché sur PostgreSQL embarqué : mêmes requêtes qu'en production, vrai moteur. */
export class PgliteSql implements SqlExecutor {
  constructor(private readonly db: Pick<PGlite, 'query'> & Partial<Pick<PGlite, 'transaction'>>) {}
  async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return (await this.db.query<T>(sql, [...params])).rows;
  }
  transaction<R>(work: (tx: SqlExecutor) => Promise<R>): Promise<R> {
    if (!this.db.transaction) return work(this);
    return this.db.transaction((tx) => work(new PgliteSql(tx as never)));
  }
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = Temporal.Instant.from('2026-10-23T10:00:00.123Z');

function newUser(n: number, name = `user${n}`, roles = ['CASHIER']): User {
  return User.register({
    id: must(UserId.create(uuid(n))),
    username: must(Username.create(name)),
    email: must(Email.create(`${name}@hopital.test`)),
    passwordHash: PasswordHash.fromStored('$argon2id$v=19$fake'),
    roles: roles.map((r) => must(RoleCode.create(r))),
    now: NOW,
  });
}

describe('schéma IAM sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(DDL);
    sql = new PgliteSql(db);
  });
  afterAll(() => db.close());

  it('est idempotent : le rejouer ne casse rien et ne duplique pas les rôles', async () => {
    await db.exec(DDL);
    const [{ n }] = await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM iam_roles');
    expect(n).toBe(11);
  });

  describe('rôles', () => {
    const repo = () => new PgRoleRepository(sql);

    it('charge les rôles système avec des permissions valides', async () => {
      const roles = await repo().findAll();
      expect(roles).toHaveLength(11);
      expect(roles.every((r) => r.isSystem && r.permissions.length > 0)).toBe(true);
    });

    it("sépare les tâches : l'administrateur système n'accède à aucun fichier clinique", async () => {
      const [admin] = await repo().findByCodes([must(RoleCode.create('SYSTEM_ADMIN'))]);
      const granted = AccessPolicy.permissionsOf([admin]);
      expect(AccessPolicy.can(granted, must(Permission.create('iam.users:manage')))).toBe(true);
      expect(AccessPolicy.can(granted, must(Permission.create('files.clinical:read:own')))).toBe(false);
    });

    it('exige la MFA pour les profils cliniques et administrateur, pas pour la caisse', async () => {
      const byCode = new Map((await repo().findAll()).map((r) => [r.code.value, r]));
      for (const c of ['SYSTEM_ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'DPO_AUDITOR']) {
        expect(byCode.get(c)?.requiresMfa).toBe(true);
      }
      for (const c of ['CASHIER', 'RECEPTIONIST', 'ACCOUNTANT']) expect(byCode.get(c)?.requiresMfa).toBe(false);
    });

    it('le médecin lit les dossiers de son service mais pas ceux de tous ; le patient seulement les siens', async () => {
      const get = async (c: string) => AccessPolicy.permissionsOf(await repo().findByCodes([must(RoleCode.create(c))]));
      const p = (s: string) => must(Permission.create(s));
      const doctor = await get('DOCTOR');
      expect(AccessPolicy.can(doctor, p('files.clinical:read:department'))).toBe(true);
      expect(AccessPolicy.can(doctor, p('files.clinical:read:all'))).toBe(false);
      const patient = await get('PATIENT');
      expect(AccessPolicy.can(patient, p('files.clinical:read:own'))).toBe(true);
      expect(AccessPolicy.can(patient, p('files.clinical:read:department'))).toBe(false);
    });
  });

  describe('utilisateurs', () => {
    const repo = () => new PgUserRepository(sql);

    it("enregistre et relit un compte à l'identique (instants Temporal, rôles, tableaux)", async () => {
      const u = newUser(1, 'marie.curie', ['DOCTOR', 'NURSE']);
      u.beginMfaEnrollment('v1.iv.tag.data');
      u.confirmMfaEnrollment(['h1', 'h2']);
      u.recordFailedLogin(NOW);
      await repo().save(u);

      const back = await repo().findById(u.id);
      expect(back?.snapshot()).toEqual(u.snapshot());
      expect(back?.roles.map((r) => r.value).sort()).toEqual(['DOCTOR', 'NURSE']);
      expect(back?.snapshot().createdAt.toString()).toBe('2026-10-23T10:00:00.123Z');
    });

    it('recherche sans tenir compte de la casse', async () => {
      const found = await repo().findByUsername(must(Username.create('MARIE.CURIE')));
      expect(found?.id.value).toBe(uuid(1));
      expect(await repo().findByUsername(must(Username.create('inconnu')))).toBeNull();
    });

    it('met à jour : verrouillage, rôles remplacés, mot de passe', async () => {
      const u = (await repo().findById(must(UserId.create(uuid(1)))))!;
      for (let i = 0; i < 4; i++) u.recordFailedLogin(NOW); // 1 échec déjà enregistré + 4 = 5 : seuil atteint
      u.assignRoles([must(RoleCode.create('PHARMACIST'))]);
      await repo().save(u);

      const back = (await repo().findById(u.id))!;
      expect(back.isLocked(NOW)).toBe(true);
      expect(back.isLocked(NOW.add({ minutes: 20 }))).toBe(false);
      expect(back.roles.map((r) => r.value)).toEqual(['PHARMACIST']);
    });

    it("détecte les doublons d'identifiant ou d'e-mail, quelle que soit la casse", async () => {
      expect(await repo().existsByUsernameOrEmail(must(Username.create('marie.curie')), must(Email.create('autre@x.fr')))).toBe(true);
      expect(await repo().existsByUsernameOrEmail(must(Username.create('nouveau')), must(Email.create('MARIE.CURIE@hopital.test')))).toBe(true);
      expect(await repo().existsByUsernameOrEmail(must(Username.create('nouveau')), must(Email.create('n@x.fr')))).toBe(false);
    });

    it("la base elle-même refuse un doublon (contrainte unique insensible à la casse)", async () => {
      await expect(repo().save(newUser(2, 'Marie.Curie'))).rejects.toThrow();
    });

    it('refuse un rôle inexistant (clé étrangère)', async () => {
      await expect(repo().save(newUser(3, 'sansrole', ['ROLE_FANTOME']))).rejects.toThrow();
    });

    it('liste avec pagination et rôles', async () => {
      await repo().save(newUser(4, 'second', ['RECEPTIONIST']));
      await repo().save(newUser(5, 'troisieme', ['ACCOUNTANT']));
      const page = await repo().list(0, 2);
      expect(page.total).toBe(3);
      expect(page.items).toHaveLength(2);
      const rest = await repo().list(2, 2);
      expect(rest.items.map((i) => i.username.value)).toEqual(['troisieme']);
      expect(rest.items[0].roles.map((r) => r.value)).toEqual(['ACCOUNTANT']);
    });

    it("l'écriture est atomique : un échec sur les rôles n'écrit pas le compte", async () => {
      await expect(repo().save(newUser(9, 'fantome', ['ROLE_FANTOME']))).rejects.toThrow();
      expect(await repo().findById(must(UserId.create(uuid(9))))).toBeNull();
    });
  });

  describe("journal d'audit", () => {
    const audit = () => new PgAuditLog(sql);
    const entry = (action: string, extra: object = {}) => ({ action, outcome: 'SUCCESS' as const, occurredAt: NOW.add({ seconds: 1 }), ...extra });

    it('enchaîne les entrées et la chaîne se vérifie', async () => {
      await audit().record(entry('auth.login', { actorId: uuid(1), actorUsername: 'marie.curie', ip: '10.0.0.1', metadata: { zeta: 1, alpha: 'a', mid: true } }));
      await audit().record(entry('iam.user.create', { resourceType: 'user', resourceId: uuid(4), metadata: { roles: 'DOCTOR', b: 2, a: 1 } }));
      await audit().record({ ...entry('auth.login'), outcome: 'FAILURE', reason: 'bad-password', occurredAt: Temporal.Instant.from('2026-10-23T10:00:05.123456789Z') });
      expect(await audit().verifyChain()).toEqual({ valid: true, brokenAtId: null, checked: 3 });
    });

    it('reste valide sous écritures concurrentes (chaîne linéaire)', async () => {
      await Promise.all(Array.from({ length: 10 }, (_, i) => audit().record(entry(`test.concurrent.${i}`))));
      const v = await audit().verifyChain();
      expect(v.valid).toBe(true);
      expect(v.checked).toBe(13);
    });

    it('interdit UPDATE, DELETE et TRUNCATE (ajout seul)', async () => {
      await expect(sql.query("UPDATE audit_log SET outcome = 'SUCCESS'")).rejects.toThrow(/ajout seul/);
      await expect(sql.query('DELETE FROM audit_log')).rejects.toThrow(/ajout seul/);
      await expect(sql.query('TRUNCATE audit_log')).rejects.toThrow(/ajout seul/);
    });

    it("détecte une altération faite par un administrateur de base qui contourne le trigger", async () => {
      await sql.query('ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_immutable');
      await sql.query("UPDATE audit_log SET actor_username = 'quelqu-un-d-autre' WHERE id = 1");
      const broken = await audit().verifyChain();
      expect(broken.valid).toBe(false);
      expect(broken.brokenAtId).toBe('1');
    });
  });
});

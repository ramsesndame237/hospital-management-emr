import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Facility } from '../../src/modules/administration/domain/entities/facility';
import { Organization } from '../../src/modules/administration/domain/entities/organization';
import { FacilityCode } from '../../src/modules/administration/domain/value-objects/facility-code';
import { FacilityId } from '../../src/modules/administration/domain/value-objects/facility-id';
import { FacilityName } from '../../src/modules/administration/domain/value-objects/facility-name';
import { FacilityStatus, FacilityStatusEnum } from '../../src/modules/administration/domain/value-objects/FacilityStatus';
import { OrganizationId } from '../../src/modules/administration/domain/value-objects/organization-id';
import { OrganizationName } from '../../src/modules/administration/domain/value-objects/organization-name';
import { PgFacilityRepository } from '../../src/modules/administration/infrastructure/persistence/pg-facility.repository';
import { PgOrganizationRepository } from '../../src/modules/administration/infrastructure/persistence/pg-organization.repository';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { RoleCode } from '../../src/modules/iam/domain/value-objects/role-code';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';

const schema = (file: string) => fs.readFileSync(path.join(__dirname, '../../migration/schema', file), 'utf8');
const IAM = schema('iam.pg.sql');
const ADMIN = schema('administration.pg.sql');

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const organization = (n = 1, name = 'Hôpital Central') => must(Organization.create(must(OrganizationId.create(uuid(n))), must(OrganizationName.create(name))));
const facility = (n: number, code: string, name = `Site ${n}`, status?: FacilityStatus) =>
  must(Facility.create(must(FacilityName.create(name)), must(FacilityCode.create(code)), must(FacilityId.create(uuid(100 + n))), must(OrganizationId.create(uuid(1))), status));

describe('schéma administration sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(IAM);
    await db.exec(ADMIN);
    sql = new PgliteSql(db);
  });
  afterEach(() => db.close());

  it('est idempotent : le rejouer (après iam, comme au démarrage) ne duplique ni les tables ni les permissions', async () => {
    await db.exec(IAM);
    await db.exec(ADMIN);
    await db.exec(ADMIN);
    const [admin] = await new PgRoleRepository(sql).findByCodes([must(RoleCode.create('SYSTEM_ADMIN'))]);
    const granted = admin.permissions.map((p) => p.value);
    expect(new Set(granted).size).toBe(granted.length);
    expect(granted).toEqual(expect.arrayContaining(['administration.organization:manage:all', 'administration.facilities:manage:all', 'iam.users:manage:all']));
  });

  it("donne la lecture seule à l'auditeur et rien aux profils cliniques", async () => {
    const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, r.permissions.map((p) => p.value)]));
    expect(roles.get('DPO_AUDITOR')).toEqual(expect.arrayContaining(['administration.organization:read:all', 'administration.facilities:read:all']));
    expect(roles.get('DPO_AUDITOR')).not.toContain('administration.facilities:manage:all');
    for (const code of ['DOCTOR', 'NURSE', 'CASHIER', 'PATIENT']) expect(roles.get(code)!.some((p) => /^administration.(organization|facilities):/.test(p))).toBe(false);
  });

  describe('organisation', () => {
    it('est introuvable puis retrouvée, et se renomme sans changer de ligne', async () => {
      const repo = new PgOrganizationRepository(sql);
      expect(await repo.find()).toBeNull();
      await repo.save(organization());
      const found = (await repo.find())!;
      expect(found.getName().value).toBe('Hôpital Central');
      found.updateName(must(OrganizationName.create('Groupe')));
      await repo.save(found);
      expect((await repo.find())!.getName().value).toBe('Groupe');
      expect((await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM administration_organizations'))[0].n).toBe(1);
    });

    it("refuse une seconde organisation : une seule par installation", async () => {
      const repo = new PgOrganizationRepository(sql);
      await repo.save(organization(1));
      await expect(repo.save(organization(2, 'Autre'))).rejects.toThrow();
    });
  });

  describe('établissements', () => {
    beforeEach(() => new PgOrganizationRepository(sql).save(organization()));

    it('conserve code, nom et statut (par défaut « en construction ») et les retrouve par id ou par code', async () => {
      const repo = new PgFacilityRepository(sql);
      await repo.save(facility(1, 'A1B2-abc-01', 'Site principal'));
      const byId = (await repo.findById(must(FacilityId.create(uuid(101)))))!;
      expect(byId.getName().value).toBe('Site principal');
      expect(byId.getStatus().getValue()).toBe(FacilityStatusEnum.OPERATIONAL_UNDER_CONSTRUCTION);
      expect(byId.isOperational()).toBe(false);
      expect((await repo.findByCode(must(FacilityCode.create('A1B2-abc-01'))))!.getId().value).toBe(uuid(101));
      expect(await repo.findByCode(must(FacilityCode.create('Z9Z9-zzz-99')))).toBeNull();
    });

    it('met à jour sur place (même id) et applique le statut', async () => {
      const repo = new PgFacilityRepository(sql);
      const f = facility(1, 'A1B2-abc-01');
      await repo.save(f);
      f.updateName(must(FacilityName.create('Renommé')));
      f.updateStatus(FacilityStatus.fromEnum(FacilityStatusEnum.OPERATIONAL_OPEN));
      await repo.save(f);
      const again = (await repo.findById(f.getId()))!;
      expect(again.getName().value).toBe('Renommé');
      expect(again.isOperational()).toBe(true);
      expect((await repo.list(0, 10)).total).toBe(1);
    });

    it('garantit un code unique même si le contrôle applicatif est contourné (accès concurrents)', async () => {
      const repo = new PgFacilityRepository(sql);
      await repo.save(facility(1, 'A1B2-abc-01'));
      await expect(repo.save(facility(2, 'A1B2-abc-01'))).rejects.toThrow(/ux_administration_facilities_code|unique/i);
    });

    it('refuse en base un statut inconnu', async () => {
      await expect(
        sql.query("INSERT INTO administration_facilities (id, organization_id, code, name, status) VALUES ($1, $2, 'X', 'X', 'OUVERT')", [uuid(150), uuid(1)]),
      ).rejects.toThrow();
    });

    it('liste par nom avec pagination et total', async () => {
      const repo = new PgFacilityRepository(sql);
      await repo.save(facility(1, 'A1B2-abc-01', 'Charlie'));
      await repo.save(facility(2, 'A1B2-abc-02', 'Alpha'));
      await repo.save(facility(3, 'A1B2-abc-03', 'Bravo'));
      const page = await repo.list(1, 2);
      expect(page.total).toBe(3);
      expect(page.items.map((f) => f.getName().value)).toEqual(['Bravo', 'Charlie']);
    });
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Facility } from '../../src/modules/administration/domain/entities/facility';
import { Organization } from '../../src/modules/administration/domain/entities/organization';
import { StructureNode } from '../../src/modules/administration/domain/structure/structure-node';
import { FloorLabel, NodeCode, NodeId, NodeName, ServiceType, SpecialtyCode } from '../../src/modules/administration/domain/structure/values';
import { FacilityCode } from '../../src/modules/administration/domain/value-objects/facility-code';
import { FacilityId } from '../../src/modules/administration/domain/value-objects/facility-id';
import { FacilityName } from '../../src/modules/administration/domain/value-objects/facility-name';
import { OrganizationId } from '../../src/modules/administration/domain/value-objects/organization-id';
import { OrganizationName } from '../../src/modules/administration/domain/value-objects/organization-name';
import { PgFacilityRepository } from '../../src/modules/administration/infrastructure/persistence/pg-facility.repository';
import { PgOrganizationRepository } from '../../src/modules/administration/infrastructure/persistence/pg-organization.repository';
import { PgStructureRepository } from '../../src/modules/administration/infrastructure/persistence/pg-structure.repository';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';

const DDL = ['iam.pg.sql', 'administration.pg.sql'].map((f) => fs.readFileSync(path.join(__dirname, '../../migration/schema', f), 'utf8'));
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ORG = must(OrganizationId.create(uuid(1)));
const F1 = must(FacilityId.create(uuid(10)));
const F2 = must(FacilityId.create(uuid(11)));
const nid = (n: number) => must(NodeId.create(uuid(100 + n)));

const service = (n: number, code: string, facility = F1, specialty?: string) =>
  StructureNode.createService({ id: nid(n), facilityId: facility, code: must(NodeCode.create(code)), name: must(NodeName.create(`Service ${code}`)), serviceType: ServiceType.CLINICAL, specialtyCode: specialty ? must(SpecialtyCode.create(specialty)) : null });
const child = (parent: StructureNode, n: number, code: string, floor?: string) =>
  must(StructureNode.createChild(parent, { id: nid(n), code: must(NodeCode.create(code)), name: must(NodeName.create(`Élément ${code}`)), floor: floor ? must(FloorLabel.create(floor)) : null }));

describe('schéma de la structure sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let repo: PgStructureRepository;
  beforeEach(async () => {
    db = new PGlite();
    for (const ddl of DDL) await db.exec(ddl);
    sql = new PgliteSql(db);
    await new PgOrganizationRepository(sql).save(must(Organization.create(ORG, must(OrganizationName.create('Hôpital')))));
    const facilities = new PgFacilityRepository(sql);
    for (const [id, code] of [[F1, 'A1B2-abc-01'], [F2, 'A1B2-abc-02']] as const) {
      await facilities.save(must(Facility.create(must(FacilityName.create(`Site ${code}`)), must(FacilityCode.create(code)), id, ORG)));
    }
    repo = new PgStructureRepository(sql);
  });
  afterEach(() => db.close());

  it('est idempotent : le rejouer ne casse rien et ne duplique pas les permissions', async () => {
    await repo.save(service(1, 'PED'));
    for (const ddl of DDL) await db.exec(ddl);
    for (const ddl of DDL) await db.exec(ddl);
    expect(await repo.findById(nid(1))).not.toBeNull();
    const admin = (await new PgRoleRepository(sql).findAll()).find((r) => r.code.value === 'SYSTEM_ADMIN')!.permissions.map((p) => p.value);
    expect(new Set(admin).size).toBe(admin.length);
    expect(admin).toEqual(expect.arrayContaining(['administration.structure:read:all', 'administration.structure:manage:all']));
  });

  it('accorde la lecture à tout le personnel (pas au patient) et la gestion au seul administrateur système', async () => {
    for (const r of await new PgRoleRepository(sql).findAll()) {
      const has = (p: string) => r.permissions.some((x) => x.value === p);
      expect({ code: r.code.value, read: has('administration.structure:read:all') }).toEqual({ code: r.code.value, read: r.code.value !== 'PATIENT' });
      expect({ code: r.code.value, manage: has('administration.structure:manage:all') }).toEqual({ code: r.code.value, manage: r.code.value === 'SYSTEM_ADMIN' });
    }
  });

  it('conserve chaque niveau avec ses attributs (accents compris) et le retrouve par id ou par frère', async () => {
    const ped = service(1, 'PED', F1, 'PEDIATRICS');
    const unit = child(ped, 2, 'U1');
    const room = child(unit, 3, 'R1', 'RDC');
    const bed = child(room, 4, 'B1');
    for (const n of [ped, unit, room, bed]) await repo.save(n);

    const loaded = (await repo.findById(nid(1)))!;
    expect(loaded).toMatchObject({ kind: 'SERVICE', serviceType: 'CLINICAL', active: true });
    expect(loaded.specialtyCode?.value).toBe('PEDIATRICS');
    expect((await repo.findById(nid(3)))!.floor?.value).toBe('RDC');
    expect((await repo.findById(nid(4)))!.parentId?.value).toBe(nid(3).value);
    expect((await repo.findSibling(F1, null, must(NodeCode.create('PED'))))!.id.value).toBe(nid(1).value);
    expect((await repo.findSibling(F1, nid(1), must(NodeCode.create('U1'))))!.id.value).toBe(nid(2).value);
    expect(await repo.findSibling(F1, nid(1), must(NodeCode.create('PED')))).toBeNull();
    expect(await repo.findSibling(F2, null, must(NodeCode.create('PED')))).toBeNull();
  });

  it('met à jour nom, attributs et état sur place, sans jamais toucher au code ni au rattachement', async () => {
    const ped = service(1, 'PED');
    await repo.save(ped);
    ped.rename(must(NodeName.create('Renommé')));
    ped.assignSpecialty(must(SpecialtyCode.create('CARDIOLOGY')));
    ped.deactivate();
    await repo.save(ped);
    const again = (await repo.findById(nid(1)))!;
    expect(again).toMatchObject({ code: ped.code, active: false });
    expect(again.name.value).toBe('Renommé');
    expect(again.specialtyCode?.value).toBe('CARDIOLOGY');
    expect((await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM administration_structure_nodes'))[0].n).toBe(1);
  });

  it('garantit en base un code unique parmi les frères, services compris (parent nul)', async () => {
    await repo.save(service(1, 'PED'));
    await expect(repo.save(service(2, 'PED'))).rejects.toThrow();
    await repo.save(service(3, 'PED', F2)); // autre établissement : permis
    const ped = (await repo.findById(nid(1)))!;
    await repo.save(child(ped, 4, 'U1'));
    await expect(repo.save(child(ped, 5, 'U1'))).rejects.toThrow();
  });

  it("refuse en base un parent d'un autre établissement et les attributs incohérents avec le niveau", async () => {
    const ped = service(1, 'PED');
    await repo.save(ped);
    const insert = (cols: Record<string, unknown>) => {
      const row = { id: uuid(900), facility_id: uuid(10), parent_id: null, kind: 'SERVICE', code: 'X', name: 'X', service_type: 'CLINICAL', specialty_code: null, floor: null, ...cols };
      return sql.query(
        'INSERT INTO administration_structure_nodes (id, facility_id, parent_id, kind, code, name, service_type, specialty_code, floor) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        Object.values(row),
      );
    };
    await expect(insert({ kind: 'UNIT', parent_id: uuid(100 + 1), facility_id: uuid(11), service_type: null })).rejects.toThrow(); // parent d'un autre établissement
    await expect(insert({ kind: 'UNIT', parent_id: null, service_type: null })).rejects.toThrow(); // une unité sans parent
    await expect(insert({ kind: 'SERVICE', parent_id: uuid(101) })).rejects.toThrow(); // un service avec un parent
    await expect(insert({ service_type: null })).rejects.toThrow(); // un service sans type
    await expect(insert({ service_type: 'HOTEL' })).rejects.toThrow();
    await expect(insert({ kind: 'UNIT', parent_id: uuid(101), service_type: null, specialty_code: 'PEDIATRICS' })).rejects.toThrow(); // spécialité hors service
    await expect(insert({ kind: 'UNIT', parent_id: uuid(101), service_type: null, floor: '1' })).rejects.toThrow(); // étage hors salle
    await expect(insert({ code: 'mauvais code' })).rejects.toThrow();
  });

  it("liste par établissement (ordre des codes), filtre les désactivés, et détecte les enfants actifs", async () => {
    const b = service(1, 'B');
    const a = service(2, 'A');
    await repo.save(b);
    await repo.save(a);
    await repo.save(service(3, 'C', F2));
    const unit = child(b, 4, 'U1');
    await repo.save(unit);
    expect((await repo.listByFacility(F1, false)).map((n) => n.code.value)).toEqual(['A', 'B', 'U1']);
    expect((await repo.listByFacility(F2, false)).map((n) => n.code.value)).toEqual(['C']);

    expect(await repo.hasActiveChildren(b.id)).toBe(true);
    expect(await repo.hasActiveChildren(a.id)).toBe(false);
    unit.deactivate();
    await repo.save(unit);
    expect(await repo.hasActiveChildren(b.id)).toBe(false);
    expect((await repo.listByFacility(F1, false)).map((n) => n.code.value)).toEqual(['A', 'B']);
    expect((await repo.listByFacility(F1, true)).map((n) => n.code.value)).toEqual(['A', 'B', 'U1']);
  });
});

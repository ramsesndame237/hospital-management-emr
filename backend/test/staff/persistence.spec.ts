import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Facility } from '../../src/modules/administration/domain/entities/facility';
import { Organization } from '../../src/modules/administration/domain/entities/organization';
import { StructureNode } from '../../src/modules/administration/domain/structure/structure-node';
import { NodeCode, NodeId, NodeName, ServiceType } from '../../src/modules/administration/domain/structure/values';
import { FacilityCode } from '../../src/modules/administration/domain/value-objects/facility-code';
import { FacilityId } from '../../src/modules/administration/domain/value-objects/facility-id';
import { FacilityName } from '../../src/modules/administration/domain/value-objects/facility-name';
import { OrganizationId } from '../../src/modules/administration/domain/value-objects/organization-id';
import { OrganizationName } from '../../src/modules/administration/domain/value-objects/organization-name';
import { PgFacilityRepository } from '../../src/modules/administration/infrastructure/persistence/pg-facility.repository';
import { PgOrganizationRepository } from '../../src/modules/administration/infrastructure/persistence/pg-organization.repository';
import { PgStructureRepository } from '../../src/modules/administration/infrastructure/persistence/pg-structure.repository';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { Temporal } from '../../src/shared-kernel/temporal';
import { Assignment } from '../../src/modules/staff/domain/assignment';
import { StaffMember } from '../../src/modules/staff/domain/staff-member';
import { AssignmentId, ContactEmail, FacilityRef, NodeRef, PersonName, PhoneNumber, ReferenceCode, StaffId, StaffNumber, UserRef } from '../../src/modules/staff/domain/values';
import { PgAssignmentRepository } from '../../src/modules/staff/infrastructure/persistence/pg-assignment.repository';
import { PgStaffRepository } from '../../src/modules/staff/infrastructure/persistence/pg-staff.repository';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';

const DDL = ['iam.pg.sql', 'administration.pg.sql', 'referentials.pg.sql', 'staff.pg.sql'].map((f) => fs.readFileSync(path.join(__dirname, '../../migration/schema', f), 'utf8'));
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const date = (s: string) => Temporal.PlainDate.from(s);
const FACILITY = must(FacilityId.create(uuid(10)));
const NODE = (n: number) => must(NodeRef.create(uuid(200 + n)));

const staff = (n: number, number: string, over: Partial<{ last: string; first: string; profession: string; email: string; hiredOn: string; userId: string }> = {}) =>
  StaffMember.register({
    id: must(StaffId.create(uuid(300 + n))), staffNumber: must(StaffNumber.create(number)), firstName: must(PersonName.create(over.first ?? 'Marie', 'firstName')),
    lastName: must(PersonName.create(over.last ?? `Nom${n}`, 'lastName')), professionCode: must(ReferenceCode.create(over.profession ?? 'DOCTOR', 'STAFF_PROFESSION_UNKNOWN')),
    specialtyCode: null, email: over.email ? must(ContactEmail.create(over.email)) : null, phone: null, hiredOn: over.hiredOn ? date(over.hiredOn) : null,
  });
const assignment = (n: number, staffN: number, node: number, start: string, end: string | null = null, primary = false) =>
  must(Assignment.create({
    id: must(AssignmentId.create(uuid(400 + n))), staffId: must(StaffId.create(uuid(300 + staffN))), nodeId: NODE(node), facilityId: must(FacilityRef.create(FACILITY.value)),
    startDate: date(start), endDate: end ? date(end) : null, primary,
  }));

describe('schéma du personnel sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let staffRepo: PgStaffRepository;
  let assignmentRepo: PgAssignmentRepository;
  beforeEach(async () => {
    db = new PGlite();
    for (const ddl of DDL) await db.exec(ddl);
    sql = new PgliteSql(db);
    const org = must(OrganizationId.create(uuid(1)));
    await new PgOrganizationRepository(sql).save(must(Organization.create(org, must(OrganizationName.create('Hôpital')))));
    await new PgFacilityRepository(sql).save(must(Facility.create(must(FacilityName.create('Site')), must(FacilityCode.create('A1B2-abc-01')), FACILITY, org)));
    const structure = new PgStructureRepository(sql);
    for (const n of [1, 2, 3]) {
      await structure.save(StructureNode.createService({ id: must(NodeId.create(NODE(n).value)), facilityId: FACILITY, code: must(NodeCode.create(`S${n}`)), name: must(NodeName.create(`Service ${n}`)), serviceType: ServiceType.CLINICAL }));
    }
    staffRepo = new PgStaffRepository(sql);
    assignmentRepo = new PgAssignmentRepository(sql);
  });
  afterEach(() => db.close());

  it("est idempotent, et ses droits ne sont pas dupliqués par un nouveau passage", async () => {
    await staffRepo.save(staff(1, 'MAT-1'));
    for (const ddl of DDL) await db.exec(ddl);
    for (const ddl of DDL) await db.exec(ddl);
    expect(await staffRepo.findById(must(StaffId.create(uuid(301))))).not.toBeNull();
    const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, r.permissions.map((p) => p.value)]));
    for (const permissions of roles.values()) expect(new Set(permissions).size).toBe(permissions.length);
  });

  it("donne la gestion à l'administrateur système, la lecture à l'auditeur, et à chacun (sauf le patient) la lecture de sa propre fiche", async () => {
    const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, r.permissions.map((p) => p.value)]));
    for (const [code, permissions] of roles) {
      expect({ code, own: permissions.includes('staff:read:own') }).toEqual({ code, own: code !== 'PATIENT' });
      expect({ code, manage: permissions.includes('staff:manage:all') }).toEqual({ code, manage: code === 'SYSTEM_ADMIN' });
      expect({ code, readAll: permissions.includes('staff:read:all') }).toEqual({ code, readAll: ['SYSTEM_ADMIN', 'DPO_AUDITOR'].includes(code) });
    }
  });

  describe('fiches', () => {
    it('conserve tous les champs (accents, dates sans décalage) et retrouve par id, matricule ou compte', async () => {
      const s = staff(1, 'MAT-1', { first: 'Zoé', last: 'Élisabeth', email: 'zoe@hopital.example', hiredOn: '2024-02-29' });
      await staffRepo.save(s);
      const byId = (await staffRepo.findById(s.id))!;
      expect(byId).toMatchObject({ staffNumber: s.staffNumber, professionCode: s.professionCode });
      expect([byId.firstName.value, byId.lastName.value, byId.email?.value, byId.hiredOn?.toString(), byId.departedOn]).toEqual(['Zoé', 'Élisabeth', 'zoe@hopital.example', '2024-02-29', null]);
      expect((await staffRepo.findByNumber(must(StaffNumber.create('mat-1'))))!.id.value).toBe(s.id.value);
      expect(await staffRepo.findByNumber(must(StaffNumber.create('NOPE')))).toBeNull();
    });

    it('met à jour sur place sans jamais toucher au matricule', async () => {
      const s = staff(1, 'MAT-1');
      await staffRepo.save(s);
      s.rename(must(PersonName.create('Anne', 'firstName')), must(PersonName.create('Durand', 'lastName')));
      s.changeContact(must(ContactEmail.create('a@b.co')), must(PhoneNumber.create('+237 655 00 00 00')));
      await staffRepo.save(s);
      const again = (await staffRepo.findById(s.id))!;
      expect([again.firstName.value, again.lastName.value, again.email?.value, again.phone?.value, again.staffNumber.value]).toEqual(['Anne', 'Durand', 'a@b.co', '+237 655 00 00 00', 'MAT-1']);
      expect((await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM staff_members'))[0].n).toBe(1);
    });

    it('garantit en base matricule et compte uniques, et un compte qui existe', async () => {
      await staffRepo.save(staff(1, 'MAT-1'));
      await expect(staffRepo.save(staff(2, 'MAT-1'))).rejects.toThrow();
      const missing = staff(2, 'MAT-2');
      missing.linkAccount(must(UserRef.create(uuid(999))));
      await expect(staffRepo.save(missing)).rejects.toThrow(); // aucun compte avec cet identifiant
    });

    it('refuse en base un matricule invalide et un départ avant l\'embauche', async () => {
      await expect(sql.query("INSERT INTO staff_members (id, staff_number, first_name, last_name, profession_code) VALUES ($1, 'mauvais matricule', 'A', 'B', 'DOCTOR')", [uuid(310)])).rejects.toThrow();
      await expect(sql.query("INSERT INTO staff_members (id, staff_number, first_name, last_name, profession_code, hired_on, departed_on) VALUES ($1, 'M1', 'A', 'B', 'DOCTOR', '2024-02-01', '2024-01-01')", [uuid(311)])).rejects.toThrow();
    });

    it('liste par nom avec recherche littérale, situation à la date donnée, profession et pagination', async () => {
      await staffRepo.save(staff(1, 'MAT-1', { last: 'Zola', email: 'z@hopital.example' }));
      await staffRepo.save(staff(2, 'MAT-2', { last: 'abel', profession: 'NURSE' }));
      const gone = staff(3, 'MAT-3', { last: 'Moreau' });
      gone.depart(date('2026-01-31'));
      await staffRepo.save(gone);
      const today = date('2026-10-23');
      const lastNames = async (f: Partial<Parameters<PgStaffRepository['list']>[0]> = {}, offset = 0, limit = 50) =>
        (await staffRepo.list({ today, ...f }, offset, limit)).items.map((s) => s.lastName.value);
      expect(await lastNames()).toEqual(['abel', 'Moreau', 'Zola']); // tri insensible à la casse
      expect(await lastNames({ status: 'ACTIVE' })).toEqual(['abel', 'Zola']);
      expect(await lastNames({ status: 'DEPARTED' })).toEqual(['Moreau']);
      expect(await lastNames({ status: 'DEPARTED', today: date('2026-01-30') })).toEqual([]); // départ pas encore atteint
      expect(await lastNames({ professionCode: 'NURSE' })).toEqual(['abel']);
      expect(await lastNames({ search: 'HOPITAL' })).toEqual(['Zola']);
      expect(await lastNames({ search: '%' })).toEqual([]); // « % » est cherché tel quel, pas comme un joker
      expect(await lastNames({}, 1, 1)).toEqual(['Moreau']);
      expect((await staffRepo.list({ today, status: 'ACTIVE' }, 0, 1)).total).toBe(2);
    });
  });

  describe('affectations', () => {
    beforeEach(async () => {
      await staffRepo.save(staff(1, 'MAT-1', { last: 'Zola' }));
      await staffRepo.save(staff(2, 'MAT-2', { last: 'Abel' }));
    });

    it('conserve période (sans décalage de fuseau), état principal et références, et se met à jour sur place', async () => {
      const a = assignment(1, 1, 1, '2026-03-31', null, true);
      await assignmentRepo.save(a);
      const loaded = (await assignmentRepo.findById(a.id))!;
      expect([loaded.startDate.toString(), loaded.endDate, loaded.primary, loaded.nodeId.value, loaded.facilityId.value]).toEqual(['2026-03-31', null, true, NODE(1).value, FACILITY.value]);
      loaded.end(date('2026-12-31'));
      loaded.markPrimary(false);
      await assignmentRepo.save(loaded);
      const again = (await assignmentRepo.findById(a.id))!;
      expect([again.endDate?.toString(), again.primary]).toEqual(['2026-12-31', false]);
      expect((await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM staff_assignments'))[0].n).toBe(1);
    });

    it("refuse en base une personne, un élément ou un établissement inconnus, et une fin avant le début", async () => {
      await expect(assignmentRepo.save(assignment(1, 9, 1, '2026-01-01'))).rejects.toThrow();
      await expect(assignmentRepo.save(assignment(1, 1, 9, '2026-01-01'))).rejects.toThrow();
      await expect(sql.query("INSERT INTO staff_assignments (id, staff_id, node_id, facility_id, start_date, end_date) VALUES ($1, $2, $3, $4, '2026-02-01', '2026-01-01')", [uuid(420), uuid(301), NODE(1).value, FACILITY.value])).rejects.toThrow();
    });

    it("liste les affectations d'une personne, de la plus récente à la plus ancienne", async () => {
      await assignmentRepo.save(assignment(1, 1, 1, '2025-01-01', '2025-12-31'));
      await assignmentRepo.save(assignment(2, 1, 2, '2026-01-01'));
      await assignmentRepo.save(assignment(3, 2, 1, '2026-05-01'));
      expect((await assignmentRepo.listByStaff(must(StaffId.create(uuid(301))))).map((a) => a.startDate.toString())).toEqual(['2026-01-01', '2025-01-01']);
    });

    it("liste le personnel d'un élément avec la personne, par nom ; écarte les affectations terminées avant la date donnée", async () => {
      await assignmentRepo.save(assignment(1, 1, 1, '2026-01-01'));
      await assignmentRepo.save(assignment(2, 2, 1, '2025-01-01', '2026-10-22'));
      await assignmentRepo.save(assignment(3, 2, 2, '2025-01-01'));
      const today = date('2026-10-23');
      const names = async (ended: boolean) => (await assignmentRepo.listByNode(NODE(1), ended, today)).map((r) => r.staff.lastName);
      expect(await names(false)).toEqual(['Zola']);
      expect(await names(true)).toEqual(['Abel', 'Zola']);
      const [row] = await assignmentRepo.listByNode(NODE(1), false, today);
      expect(row.staff).toMatchObject({ staffNumber: 'MAT-1', firstName: 'Marie', professionCode: 'DOCTOR' });
      expect((await assignmentRepo.listByNode(NODE(1), false, date('2026-10-22'))).length).toBe(2); // le jour de la fin, l'affectation compte encore
    });
  });

  describe('départ', () => {
    it('enregistre le départ ET raccourcit les affectations qui se poursuivaient, dans la même transaction', async () => {
      const s = staff(1, 'MAT-1');
      await staffRepo.save(s);
      await assignmentRepo.save(assignment(1, 1, 1, '2025-01-01'));
      await assignmentRepo.save(assignment(2, 1, 2, '2025-01-01', '2025-06-30'));
      await assignmentRepo.save(assignment(3, 1, 3, '2026-01-01', '2027-06-30'));
      s.depart(date('2026-03-15'));
      await staffRepo.saveDeparture(s);
      expect((await staffRepo.findById(s.id))!.departedOn?.toString()).toBe('2026-03-15');
      const ends = (await assignmentRepo.listByStaff(s.id)).map((a) => [a.nodeId.value, a.endDate?.toString()]);
      expect(ends).toEqual([[NODE(3).value, '2026-03-15'], [NODE(1).value, '2026-03-15'], [NODE(2).value, '2025-06-30']]);
    });

    it("annule tout si l'une des écritures échoue (pas de parti avec une affectation ouverte)", async () => {
      const s = staff(1, 'MAT-1');
      await staffRepo.save(s);
      await assignmentRepo.save(assignment(1, 1, 1, '2026-06-01')); // commence après le départ : la contrainte de dates refuse la mise à jour
      s.depart(date('2026-03-15'));
      await expect(staffRepo.saveDeparture(s)).rejects.toThrow();
      expect((await staffRepo.findById(s.id))!.departedOn).toBeNull();
      expect((await assignmentRepo.listByStaff(s.id))[0].endDate).toBeNull();
    });
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PgliteSql } from '../iam/pglite-sql';

/** Les migrations dans l'ordre où le conteneur les applique. */
export const MIGRATIONS = ['iam', 'administration', 'referentials', 'staff', 'patients', 'appointments', 'admissions', 'billing', 'lab'].map((f) =>
  fs.readFileSync(path.join(__dirname, '../../migration/schema', `${f}.pg.sql`), 'utf8'),
);

export const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Base PostgreSQL embarquée avec tout le schéma, et un jeu de lignes minimales posées en SQL direct (indépendant du code des modules). */
export async function freshDatabase(): Promise<{ db: PGlite; sql: PgliteSql }> {
  const db = new PGlite();
  for (const ddl of MIGRATIONS) await db.exec(ddl);
  return { db, sql: new PgliteSql(db) };
}

export interface Fixture {
  org: string;
  facility: string;
  /** Service « PED » (A) et service « CHI » (B), chacun avec une unité, une salle et deux lits. */
  serviceA: string;
  serviceB: string;
  unitA: string;
  roomA: string;
  bedA1: string;
  bedA2: string;
  bedB1: string;
  patient1: string;
  patient2: string;
  staff1: string;
  staff2: string;
}

/** Numéros 1xx : structure ; 2xx : patients ; 3xx : personnel. Le personnel 1 est affecté au service A (depuis 2020), le 2 n'est affecté nulle part. */
export async function seedFixture(sql: PgliteSql): Promise<Fixture> {
  const f: Fixture = {
    org: uuid(1), facility: uuid(10), serviceA: uuid(101), serviceB: uuid(102), unitA: uuid(103), roomA: uuid(104), bedA1: uuid(105), bedA2: uuid(106), bedB1: uuid(107),
    patient1: uuid(201), patient2: uuid(202), staff1: uuid(301), staff2: uuid(302),
  };
  await sql.query("INSERT INTO administration_organizations (id, name) VALUES ($1, 'Hôpital')", [f.org]);
  await sql.query("INSERT INTO administration_facilities (id, organization_id, code, name, status) VALUES ($1, $2, 'A1B2-abc-01', 'Site', 'OPERATIONAL_OPEN')", [f.facility, f.org]);
  const node = (id: string, parent: string | null, kind: string, code: string, extra = "NULL") =>
    sql.query(
      `INSERT INTO administration_structure_nodes (id, facility_id, parent_id, kind, code, name, service_type) VALUES ($1, $2, $3, $4, $5, $6, ${extra === 'NULL' ? 'NULL' : "'CLINICAL'"})`,
      [id, f.facility, parent, kind, code, `${kind} ${code}`],
    );
  await node(f.serviceA, null, 'SERVICE', 'PED', 'CLINICAL');
  await node(f.serviceB, null, 'SERVICE', 'CHI', 'CLINICAL');
  await node(f.unitA, f.serviceA, 'UNIT', 'U1');
  await node(f.roomA, f.unitA, 'ROOM', 'R1');
  await node(f.bedA1, f.roomA, 'BED', 'B1');
  await node(f.bedA2, f.roomA, 'BED', 'B2');
  const unitB = uuid(108);
  const roomB = uuid(109);
  await node(unitB, f.serviceB, 'UNIT', 'U1');
  await node(roomB, unitB, 'ROOM', 'R1');
  await node(f.bedB1, roomB, 'BED', 'B1');

  const patient = (id: string, n: number, last: string) =>
    sql.query(
      "INSERT INTO patients (id, patient_number, identity_status, last_name, first_name, name_key, sex, birth_date) VALUES ($1, $2, 'CONFIRMED', $3, 'Test', $4, 'FEMALE', '1990-01-01')",
      [id, `PAT-${String(n).padStart(7, '0')}`, last, `${last.toLowerCase()} test`],
    );
  await patient(f.patient1, 1, 'Mbarga');
  await patient(f.patient2, 2, 'Ndongo');

  const staff = (id: string, n: number, last: string) =>
    sql.query("INSERT INTO staff_members (id, staff_number, first_name, last_name, profession_code, hired_on) VALUES ($1, $2, 'Doc', $3, 'DOCTOR', '2019-01-01')", [id, `MAT-${n}`, last]);
  await staff(f.staff1, 1, 'Curie');
  await staff(f.staff2, 2, 'Pasteur');
  await sql.query(
    "INSERT INTO staff_assignments (id, staff_id, node_id, facility_id, start_date) VALUES ($1, $2, $3, $4, '2020-01-01')",
    [uuid(401), f.staff1, f.serviceA, f.facility],
  );
  return f;
}

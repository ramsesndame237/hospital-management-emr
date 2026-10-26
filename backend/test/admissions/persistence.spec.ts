import { PGlite } from '@electric-sql/pglite';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { Admission, Movement } from '../../src/modules/admissions/domain/admission';
import { AdmissionId, AdmissionStatus, AdmissionType, AppointmentRef, BedRef, DischargeType, PatientRef, PractitionerRef, ServiceRef } from '../../src/modules/admissions/domain/values';
import { PgAdmissionRepository } from '../../src/modules/admissions/infrastructure/persistence/pg-admission.repository';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, MIGRATIONS, seedFixture, uuid } from '../support/seed-sql';

const at = (s: string) => Temporal.Instant.from(s);
const NOW = at('2026-11-05T12:00:00Z');

describe('schéma des admissions sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let repo: PgAdmissionRepository;
  let seq = 0;

  const make = async (o: { type?: AdmissionType; patient?: string; bed?: string | null; service?: string; appointment?: string; practitioner?: string } = {}): Promise<Admission> => {
    seq += 1;
    const type = o.type ?? AdmissionType.INPATIENT;
    const bed = o.bed === undefined ? (type === AdmissionType.INPATIENT ? f.bedA1 : null) : o.bed;
    return must(
      Admission.open({
        id: must(AdmissionId.create(uuid(900 + seq))), number: await repo.nextNumber(), patientId: must(PatientRef.create(o.patient ?? f.patient1)), type,
        serviceId: must(ServiceRef.create(o.service ?? f.serviceA)), bedId: bed ? must(BedRef.create(bed)) : null,
        practitionerId: o.practitioner ? must(PractitionerRef.create(o.practitioner)) : null, appointmentId: o.appointment ? must(AppointmentRef.create(o.appointment)) : null,
        reasonCode: null, admittedAt: at('2026-11-02T08:00:00Z'),
      }),
    );
  };
  const arrival = (a: Admission): Movement => ({ kind: 'ADMISSION', at: a.state.admittedAt, actorId: 'actor-1', serviceId: a.state.serviceId.value, bedId: a.state.bedId?.value ?? null });

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    repo = new PgAdmissionRepository(sql);
    seq = 0;
  });
  afterEach(() => db.close());

  it('est idempotent et répartit les droits : accueil/administrateur partout, médecins et infirmiers dans leur service', async () => {
    await repo.save(await make(), arrival(await make()));
    for (const ddl of MIGRATIONS) await db.exec(ddl);
    const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, new Set(r.permissions.map((p) => p.value))]));
    const holders = (p: string) => [...roles].filter(([, s]) => s.has(p)).map(([c]) => c).sort();
    expect(holders('admissions:read:all')).toEqual(['RECEPTIONIST', 'SYSTEM_ADMIN']);
    expect(holders('admissions:write:all')).toEqual(['RECEPTIONIST', 'SYSTEM_ADMIN']);
    expect(holders('admissions:read:department')).toEqual(['DOCTOR', 'NURSE']);
    expect(holders('admissions:write:department')).toEqual(['DOCTOR', 'NURSE']);
    expect(roles.get('PATIENT')!.has('admissions:read:all')).toBe(false);
  });

  it('numérote en séquence, conserve tous les champs et archive le premier mouvement', async () => {
    const a = await make({ type: AdmissionType.OUTPATIENT, practitioner: f.staff1 });
    expect(a.state.number.value).toBe('ADM-0000001');
    expect(await repo.save(a, arrival(a))).toBe('OK');
    const loaded = (await repo.findById(a.id))!;
    expect(loaded.state).toMatchObject({ type: 'OUTPATIENT', status: 'IN_PROGRESS', bedId: null });
    expect(loaded.state.practitionerId?.value).toBe(f.staff1);
    expect(loaded.state.admittedAt.toString()).toBe('2026-11-02T08:00:00Z');
    expect(await repo.movements(a.id)).toMatchObject([{ seq: 1, kind: 'ADMISSION', actorId: 'actor-1', serviceId: f.serviceA, bedId: null }]);
    expect(await repo.findById(must(AdmissionId.create(uuid(999))))).toBeNull();
  });

  it('garantit « un lit, un occupant » par la base, et libère le lit à la sortie', async () => {
    const first = await make({ patient: f.patient1 });
    expect(await repo.save(first, arrival(first))).toBe('OK');
    const second = await make({ patient: f.patient2 }); // même lit B1
    expect(await repo.save(second, arrival(second))).toBe('BED_OCCUPIED');
    expect(await repo.findById(second.id)).toBeNull();
    expect((await repo.occupants([must(BedRef.create(f.bedA1))])).get(f.bedA1)?.id.value).toBe(first.id.value);

    first.discharge(DischargeType.HOME, at('2026-11-03T08:00:00Z'), NOW);
    await repo.save(first, { kind: 'DISCHARGE', at: at('2026-11-03T08:00:00Z'), actorId: 'actor-1', serviceId: f.serviceA, bedId: f.bedA1 });
    expect((await repo.occupants([must(BedRef.create(f.bedA1))])).size).toBe(0);
    expect(await repo.save(second, arrival(second))).toBe('OK'); // le lit est libre
  });

  it('garantit une seule hospitalisation en cours par patient — pas pour les autres admissions', async () => {
    const a = await make({ patient: f.patient1, bed: f.bedA1 });
    await repo.save(a, arrival(a));
    const other = await make({ patient: f.patient1, bed: f.bedA2 });
    expect(await repo.save(other, arrival(other))).toBe('PATIENT_ALREADY_INPATIENT');
    expect((await repo.findInpatientOf(must(PatientRef.create(f.patient1))))?.id.value).toBe(a.id.value);
    expect(await repo.findInpatientOf(must(PatientRef.create(f.patient2)))).toBeNull();
    const consult = await make({ patient: f.patient1, type: AdmissionType.OUTPATIENT });
    expect(await repo.save(consult, arrival(consult))).toBe('OK');
    const emergency = await make({ patient: f.patient1, type: AdmissionType.EMERGENCY });
    expect(await repo.save(emergency, arrival(emergency))).toBe('OK');
    a.cancel('Erreur');
    await repo.save(a, { kind: 'CANCELLATION', at: NOW, actorId: 'actor-1', serviceId: f.serviceA, bedId: f.bedA1 });
    expect(await repo.save(other, arrival(other))).toBe('OK'); // plus aucune hospitalisation en cours
  });

  it('un rendez-vous ne donne lieu qu\'à une admission (hors admission annulée)', async () => {
    await sql.query(
      "INSERT INTO appointments (id, appointment_number, patient_id, practitioner_id, location_id, service_id, starts_at, duration_minutes, ends_at, status) VALUES ($1, 'RDV-0000001', $2, $3, $4, $4, '2026-11-02T08:00:00Z', 30, '2026-11-02T08:30:00Z', 'ARRIVED')",
      [uuid(500), f.patient1, f.staff1, f.serviceA],
    );
    const a = await make({ type: AdmissionType.OUTPATIENT, appointment: uuid(500) });
    expect(await repo.save(a, arrival(a))).toBe('OK');
    const b = await make({ type: AdmissionType.OUTPATIENT, appointment: uuid(500) });
    expect(await repo.save(b, arrival(b))).toBe('APPOINTMENT_ALREADY_USED');
    a.cancel('Erreur');
    await repo.save(a, { kind: 'CANCELLATION', at: NOW, actorId: 'actor-1', serviceId: f.serviceA, bedId: null });
    expect(await repo.save(b, arrival(b))).toBe('OK');
  });

  it('archive chaque mouvement, numéroté, avec le lit libéré ou occupé', async () => {
    const a = await make();
    await repo.save(a, arrival(a));
    a.transfer({ serviceId: must(ServiceRef.create(f.serviceA)), bedId: must(BedRef.create(f.bedA2)) });
    await repo.save(a, { kind: 'TRANSFER', at: at('2026-11-03T08:00:00Z'), actorId: 'actor-2', serviceId: f.serviceA, bedId: f.bedA2 });
    a.discharge(DischargeType.HOME, at('2026-11-04T08:00:00Z'), NOW);
    await repo.save(a, { kind: 'DISCHARGE', at: at('2026-11-04T08:00:00Z'), actorId: 'actor-3', serviceId: f.serviceA, bedId: f.bedA2 });
    const movements = await repo.movements(a.id);
    expect(movements.map((m) => [m.seq, m.kind, m.actorId, m.bedId])).toEqual([[1, 'ADMISSION', 'actor-1', f.bedA1], [2, 'TRANSFER', 'actor-2', f.bedA2], [3, 'DISCHARGE', 'actor-3', f.bedA2]]);
    expect(movements[2].at.toString()).toBe('2026-11-04T08:00:00Z');
    expect((await repo.findById(a.id))!.state).toMatchObject({ status: AdmissionStatus.DISCHARGED, bedId: null, dischargeType: 'HOME' });
  });

  it('est en ajout seul pour les mouvements : aucune modification, suppression ni vidage', async () => {
    const a = await make();
    await repo.save(a, arrival(a));
    await expect(sql.query("UPDATE admission_movements SET actor_id = 'x'")).rejects.toThrow(/ajout seul/);
    await expect(sql.query('DELETE FROM admission_movements')).rejects.toThrow(/ajout seul/);
    await expect(sql.query('TRUNCATE admission_movements')).rejects.toThrow(/ajout seul/);
  });

  it('annule tout (admission ET mouvement) quand une écriture est refusée', async () => {
    const a = await make({ patient: f.patient1 });
    await repo.save(a, arrival(a));
    const rejected = await make({ patient: f.patient2 });
    expect(await repo.save(rejected, arrival(rejected))).toBe('BED_OCCUPIED');
    expect((await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM admission_movements'))[0].n).toBe(1);
    expect((await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM admissions'))[0].n).toBe(1);
  });

  it('liste des plus récentes aux plus anciennes avec filtres et périmètre de services', async () => {
    const a = await make({ patient: f.patient1, bed: f.bedA1 });
    const b = await make({ patient: f.patient2, type: AdmissionType.OUTPATIENT, service: f.serviceB });
    const c = await make({ patient: f.patient2, type: AdmissionType.EMERGENCY });
    for (const x of [a, b, c]) await repo.save(x, arrival(x));
    c.discharge(DischargeType.HOME, at('2026-11-02T09:00:00Z'), NOW);
    await repo.save(c, { kind: 'DISCHARGE', at: at('2026-11-02T09:00:00Z'), actorId: 'actor-1', serviceId: f.serviceA, bedId: null });
    const numbers = async (filter: Parameters<PgAdmissionRepository['list']>[0], offset = 0, limit = 50) => (await repo.list(filter, offset, limit)).items.map((x) => x.state.number.value);
    expect(await numbers({ serviceIds: null })).toEqual(['ADM-0000001', 'ADM-0000002', 'ADM-0000003']); // même heure d'arrivée : ordre stable par identifiant
    expect((await repo.list({ serviceIds: null }, 0, 1)).total).toBe(3);
    expect(await numbers({ serviceIds: [f.serviceB] })).toEqual(['ADM-0000002']);
    expect(await numbers({ serviceIds: [] })).toEqual([]);
    expect(await numbers({ serviceIds: null, status: AdmissionStatus.DISCHARGED })).toEqual(['ADM-0000003']);
    expect(await numbers({ serviceIds: null, type: AdmissionType.INPATIENT })).toEqual(['ADM-0000001']);
    expect(await numbers({ serviceIds: null, patientId: must(PatientRef.create(f.patient2)) })).toEqual(['ADM-0000002', 'ADM-0000003']);
    expect(await numbers({ serviceIds: null, from: '2026-11-03T00:00:00Z' })).toEqual([]);
    expect(await numbers({ serviceIds: null, to: '2026-11-02T08:00:00Z' })).toEqual([]); // fin exclue
  });

  it('refuse en base les situations incohérentes, même si l\'application est contournée', async () => {
    const insert = (over: Record<string, unknown>) => {
      const row = {
        id: uuid(800), admission_number: 'ADM-0000800', patient_id: f.patient1, admission_type: 'OUTPATIENT', status: 'IN_PROGRESS', service_id: f.serviceA, admitted_at: '2026-11-02T08:00:00Z', ...over,
      };
      return sql.query(`INSERT INTO admissions (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
    };
    await expect(insert({})).resolves.toBeDefined();
    const n = (k: number, extra: Record<string, unknown> = {}) => ({ id: uuid(800 + k), admission_number: `ADM-000080${k}`, patient_id: f.patient2, ...extra });
    await expect(insert(n(1, { admission_type: 'INPATIENT' }))).rejects.toThrow(); // hospitalisation sans lit
    await expect(insert(n(2, { bed_id: f.bedA2 }))).rejects.toThrow(); // lit pour une consultation
    await expect(insert(n(3, { status: 'DISCHARGED' }))).rejects.toThrow(); // sortie sans date ni nature
    await expect(insert(n(4, { status: 'CANCELLED' }))).rejects.toThrow(); // annulée sans motif
    await expect(insert(n(5, { status: 'DISCHARGED', discharged_at: '2026-11-01T08:00:00Z', discharge_type: 'HOME' }))).rejects.toThrow(); // sortie avant l'arrivée
    await expect(insert(n(6, { status: 'DISCHARGED', discharged_at: '2026-11-03T08:00:00Z', discharge_type: 'HOME', bed_id: f.bedA2, admission_type: 'INPATIENT' }))).rejects.toThrow(); // lit non libéré
    await expect(insert(n(7, { admission_type: 'HOTEL' }))).rejects.toThrow();
    await expect(insert(n(8, { patient_id: uuid(999) }))).rejects.toThrow();
    await expect(insert(n(9, { admission_number: 'ADM-0000800' }))).rejects.toThrow();
  });

  it('retrouve les occupants de plusieurs lits d\'un coup', async () => {
    const a = await make({ patient: f.patient1, bed: f.bedA1 });
    const b = await make({ patient: f.patient2, bed: f.bedB1, service: f.serviceB });
    await repo.save(a, arrival(a));
    await repo.save(b, arrival(b));
    const occupants = await repo.occupants([f.bedA1, f.bedA2, f.bedB1].map((id) => must(BedRef.create(id))));
    expect([...occupants.keys()].sort()).toEqual([f.bedA1, f.bedB1].sort());
    expect((await repo.occupants([])).size).toBe(0);
  });
});

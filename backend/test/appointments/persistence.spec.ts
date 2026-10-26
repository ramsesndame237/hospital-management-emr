import { PGlite } from '@electric-sql/pglite';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { Appointment, AppointmentNumber } from '../../src/modules/appointments/domain/appointment';
import { AppointmentId, LocationRef, PatientRef, PractitionerRef, ReasonCode, ServiceRef, TimeSlot } from '../../src/modules/appointments/domain/values';
import { PgAppointmentRepository } from '../../src/modules/appointments/infrastructure/persistence/pg-appointment.repository';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, seedFixture, uuid } from '../support/seed-sql';

const slot = (startsAt: string, minutes = 30) => must(TimeSlot.create(startsAt, minutes));

describe('schéma des rendez-vous sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let repo: PgAppointmentRepository;
  let seq = 0;

  /** Un rendez-vous valide ; `overrides` change le professionnel, le patient ou le créneau. */
  const make = async (overrides: { practitioner?: string; patient?: string; slot?: TimeSlot; reason?: string } = {}): Promise<Appointment> => {
    seq += 1;
    return Appointment.schedule({
      id: must(AppointmentId.create(uuid(900 + seq))), number: await repo.nextNumber(), patientId: must(PatientRef.create(overrides.patient ?? f.patient1)),
      practitionerId: must(PractitionerRef.create(overrides.practitioner ?? f.staff1)), locationId: must(LocationRef.create(f.serviceA)), serviceId: must(ServiceRef.create(f.serviceA)),
      slot: overrides.slot ?? slot('2026-11-02T08:00:00Z'), reasonCode: overrides.reason ? must(ReasonCode.create(overrides.reason)) : null,
    });
  };
  const free = { practitionerBusy: false, patientBusy: false };

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    repo = new PgAppointmentRepository(sql);
    seq = 0;
  });
  afterEach(() => db.close());

  it('est idempotent et répartit les droits : accueil/administrateur partout, médecin dans son service, infirmier en lecture', async () => {
    await repo.save(await make());
    for (const ddl of (await import('../support/seed-sql')).MIGRATIONS) await db.exec(ddl);
    expect((await repo.list({ serviceIds: null }, 0, 10)).total).toBe(1);
    const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, new Set(r.permissions.map((p) => p.value))]));
    const holders = (p: string) => [...roles].filter(([, s]) => s.has(p)).map(([c]) => c).sort();
    expect(holders('appointments:read:all')).toEqual(['RECEPTIONIST', 'SYSTEM_ADMIN']);
    expect(holders('appointments:write:all')).toEqual(['RECEPTIONIST', 'SYSTEM_ADMIN']);
    expect(holders('appointments:read:department')).toEqual(['DOCTOR', 'NURSE']);
    expect(holders('appointments:write:department')).toEqual(['DOCTOR']);
    expect(roles.get('PATIENT')!.has('appointments:read:all')).toBe(false);
  });

  it('numérote en séquence et conserve tous les champs, instants sans décalage', async () => {
    const a = await make({ slot: slot('2026-11-02T09:00:00+01:00', 45), reason: 'follow_up' });
    expect(a.state.number.value).toBe('RDV-0000001');
    expect(await repo.save(a)).toEqual(free);
    const loaded = (await repo.findById(a.id))!;
    expect(loaded.state.slot.start.toString()).toBe('2026-11-02T08:00:00Z');
    expect(loaded.state.slot.end.toString()).toBe('2026-11-02T08:45:00Z');
    expect(loaded.state).toMatchObject({ status: 'SCHEDULED', cancellationReason: null });
    expect(loaded.state.reasonCode?.value).toBe('FOLLOW_UP');
    expect((await make()).state.number.value).toBe('RDV-0000002');
    expect(await repo.findById(must(AppointmentId.create(uuid(999))))).toBeNull();
  });

  it('refuse d\'écrire un créneau pris par le même professionnel, ou par le même patient — sans rien écrire', async () => {
    await repo.save(await make({ slot: slot('2026-11-02T08:00:00Z') }));
    const sameDoctor = await make({ patient: f.patient2, slot: slot('2026-11-02T08:15:00Z') });
    expect(await repo.save(sameDoctor)).toEqual({ practitionerBusy: true, patientBusy: false });
    const samePatient = await make({ practitioner: f.staff2, slot: slot('2026-11-02T07:45:00Z') });
    expect(await repo.save(samePatient)).toEqual({ practitionerBusy: false, patientBusy: true });
    const both = await make({ slot: slot('2026-11-02T08:00:00Z', 5) });
    expect(await repo.save(both)).toEqual({ practitionerBusy: true, patientBusy: true });
    expect((await repo.list({ serviceIds: null }, 0, 10)).total).toBe(1);
  });

  it('accepte des créneaux enchaînés, et d\'autres professionnels ou patients sur le même créneau', async () => {
    await repo.save(await make({ slot: slot('2026-11-02T08:00:00Z') }));
    expect(await repo.save(await make({ slot: slot('2026-11-02T08:30:00Z') }))).toEqual(free); // commence quand l'autre finit
    expect(await repo.save(await make({ practitioner: f.staff2, patient: f.patient2, slot: slot('2026-11-02T08:00:00Z') }))).toEqual(free);
    expect((await repo.list({ serviceIds: null }, 0, 10)).total).toBe(3);
  });

  it('libère le créneau dès que le rendez-vous est annulé ou constaté absent, mais pas quand le patient s\'est présenté', async () => {
    const a = await make({ slot: slot('2026-11-02T08:00:00Z') });
    await repo.save(a);
    a.cancel('Demande du patient');
    expect(await repo.save(a)).toEqual(free);
    const again = await make({ patient: f.patient2, slot: slot('2026-11-02T08:00:00Z') });
    expect(await repo.save(again)).toEqual(free); // le créneau annulé est de nouveau libre
    again.markArrived();
    expect(await repo.save(again)).toEqual(free);
    expect(await repo.save(await make({ practitioner: f.staff1, patient: f.patient1, slot: slot('2026-11-02T08:10:00Z', 5) }))).toEqual({ practitionerBusy: true, patientBusy: false });
  });

  it('ne se bloque pas lui-même quand on déplace ou qu\'on modifie le rendez-vous', async () => {
    const a = await make({ slot: slot('2026-11-02T08:00:00Z') });
    await repo.save(a);
    a.reschedule({ slot: slot('2026-11-02T08:10:00Z', 30) }); // chevauche son ancienne position
    expect(await repo.save(a)).toEqual(free);
    expect((await repo.findById(a.id))!.state.slot.start.toString()).toBe('2026-11-02T08:10:00Z');
    expect(await repo.findConflicts(a.state.practitionerId, a.state.patientId, a.state.slot, a.id)).toEqual(free);
    expect((await repo.findConflicts(a.state.practitionerId, a.state.patientId, a.state.slot)).practitionerBusy).toBe(true);
  });

  it('sérialise deux réservations simultanées du même créneau : une seule réussit', async () => {
    const [first, second] = [await make({ patient: f.patient1 }), await make({ patient: f.patient2 })];
    const results = await Promise.all([repo.save(first), repo.save(second)]);
    expect(results.filter((r) => !r.practitionerBusy && !r.patientBusy)).toHaveLength(1);
    expect(results.filter((r) => r.practitionerBusy)).toHaveLength(1);
    expect((await repo.list({ serviceIds: null }, 0, 10)).total).toBe(1);
  });

  it('liste du plus proche au plus lointain, avec filtres (période, professionnel, patient, statut) et périmètre de services', async () => {
    const a = await make({ slot: slot('2026-11-04T08:00:00Z') });
    const b = await make({ practitioner: f.staff2, patient: f.patient2, slot: slot('2026-11-02T08:00:00Z') });
    const c = await make({ slot: slot('2026-11-03T08:00:00Z') });
    for (const x of [a, b, c]) await repo.save(x);
    c.cancel('Erreur');
    await repo.save(c);
    const numbers = async (filter: Parameters<PgAppointmentRepository['list']>[0], offset = 0, limit = 50) => (await repo.list(filter, offset, limit)).items.map((x) => x.state.number.value);
    expect(await numbers({ serviceIds: null })).toEqual(['RDV-0000002', 'RDV-0000003', 'RDV-0000001']);
    expect(await numbers({ serviceIds: null }, 1, 1)).toEqual(['RDV-0000003']);
    expect((await repo.list({ serviceIds: null }, 0, 1)).total).toBe(3);
    expect(await numbers({ serviceIds: null, from: '2026-11-03T00:00:00Z', to: '2026-11-04T00:00:00Z' })).toEqual(['RDV-0000003']); // fin exclue
    expect(await numbers({ serviceIds: null, practitionerId: must(PractitionerRef.create(f.staff2)) })).toEqual(['RDV-0000002']);
    expect(await numbers({ serviceIds: null, patientId: must(PatientRef.create(f.patient1)) })).toEqual(['RDV-0000003', 'RDV-0000001']);
    expect(await numbers({ serviceIds: null, status: 'CANCELLED' as never })).toEqual(['RDV-0000003']);
    expect(await numbers({ serviceIds: [f.serviceA] })).toHaveLength(3);
    expect(await numbers({ serviceIds: [f.serviceB] })).toEqual([]);
    expect(await numbers({ serviceIds: [] })).toEqual([]);
  });

  it('refuse en base les valeurs incohérentes, même si l\'application est contournée', async () => {
    const insert = (over: Record<string, unknown>) => {
      const row = {
        id: uuid(800), appointment_number: 'RDV-0000800', patient_id: f.patient1, practitioner_id: f.staff1, location_id: f.serviceA, service_id: f.serviceA, starts_at: '2026-11-02T08:00:00Z',
        duration_minutes: 30, ends_at: '2026-11-02T08:30:00Z', status: 'SCHEDULED', ...over,
      };
      return sql.query(`INSERT INTO appointments (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
    };
    await expect(insert({})).resolves.toBeDefined(); // la ligne de référence est valide
    const n = (k: number) => ({ id: uuid(800 + k), appointment_number: `RDV-000080${k}` });
    await expect(insert({ ...n(1), duration_minutes: 7 })).rejects.toThrow();
    await expect(insert({ ...n(2), duration_minutes: 300 })).rejects.toThrow();
    await expect(insert({ ...n(3), ends_at: '2026-11-02T08:00:00Z' })).rejects.toThrow();
    await expect(insert({ ...n(4), status: 'DONE' })).rejects.toThrow();
    await expect(insert({ ...n(5), status: 'CANCELLED' })).rejects.toThrow(); // annulé sans motif
    await expect(insert({ ...n(6), cancellation_reason: 'x' })).rejects.toThrow(); // motif sans annulation
    await expect(insert({ ...n(7), patient_id: uuid(999) })).rejects.toThrow();
    await expect(insert({ ...n(8), practitioner_id: uuid(999) })).rejects.toThrow();
    await expect(insert({ ...n(9), appointment_number: 'RDV-0000800' })).rejects.toThrow(); // numéro déjà pris
  });
});

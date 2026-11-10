import { PGlite } from '@electric-sql/pglite';
import { Encounter } from '../../src/modules/clinical/domain/encounter';
import { LineInput, Prescription } from '../../src/modules/clinical/domain/prescription';
import { DrugRef, EncounterId, PatientRef, PrescriptionId } from '../../src/modules/clinical/domain/values';
import { PgEncounterRepository } from '../../src/modules/clinical/infrastructure/persistence/pg-encounter.repository';
import { PgPrescriptionRepository } from '../../src/modules/clinical/infrastructure/persistence/pg-prescription.repository';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, seedFixture, uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const DOC = uuid(41);

describe('schéma des ordonnances sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let encounters: PgEncounterRepository;
  let prescriptions: PgPrescriptionRepository;
  let seq = 0;

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    encounters = new PgEncounterRepository(sql);
    prescriptions = new PgPrescriptionRepository(sql);
    for (const n of [1, 2]) {
      await sql.query("INSERT INTO pharmacy_drugs (id, code, name, generic_name, form, schedule, unit) VALUES ($1, $2, $3, $3, 'TABLET', 'PRESCRIPTION', 'comprimé')", [uuid(700 + n), `D${n}`, `Médicament ${n}`]);
    }
  });
  afterEach(async () => db.close());

  const openEncounter = async (): Promise<Encounter> => {
    seq += 1;
    const e = Encounter.start({
      id: must(EncounterId.create(uuid(1000 + seq))), number: await encounters.nextNumber(), patientId: must(PatientRef.create(f.patient1)), serviceId: f.serviceA, admissionId: null, doctorId: DOC, startedAt: NOW,
    });
    expect(await encounters.insert(e)).toBe(true);
    return e;
  };

  const line = (n: number, over: Partial<LineInput> = {}): LineInput => ({ drugId: must(DrugRef.create(uuid(700 + n))), dose: '1 comprimé', frequency: '3 fois par jour', durationDays: 7, quantity: 21, ...over });

  const issue = async (e: Encounter, lines: LineInput[] = [line(1)], notes: string | null = null): Promise<Prescription> => {
    seq += 1;
    const p = must(Prescription.issue({
      id: must(PrescriptionId.create(uuid(2000 + seq))), number: await prescriptions.nextNumber(), encounterId: e.id, patientId: e.state.patientId, serviceId: e.state.serviceId, doctorId: DOC, issuedAt: NOW, notes, lines,
    }));
    await prescriptions.insert(p);
    return p;
  };

  it('enregistre et relit une ordonnance avec ses lignes dans l\'ordre, et ses numéros se suivent', async () => {
    const e = await openEncounter();
    const a = await issue(e, [line(2, { instructions: 'Pendant les repas' }), line(1, { durationDays: null, allergyOverride: 'Bénéfice supérieur au risque' })], 'Revoir à 7 jours');
    const b = await issue(e);
    expect([a.state.number.value, b.state.number.value]).toEqual(['RX-0000001', 'RX-0000002']);
    const found = (await prescriptions.findById(a.id))!;
    expect(found.state).toMatchObject({ status: 'ISSUED', doctorId: DOC, serviceId: f.serviceA, notes: 'Revoir à 7 jours' });
    expect(found.state.lines.map((l) => [l.drugId.value, l.durationDays, l.instructions, l.allergyOverride])).toEqual([
      [uuid(702), 7, 'Pendant les repas', null],
      [uuid(701), null, null, 'Bénéfice supérieur au risque'],
    ]);
    expect((await prescriptions.listOfEncounter(e.id)).map((p) => p.state.number.value)).toEqual(['RX-0000001', 'RX-0000002']);
  });

  it('compte les ordonnances en cours d\'une consultation, annulées exclues', async () => {
    const e = await openEncounter();
    const a = await issue(e);
    await issue(e);
    expect(await prescriptions.countIssued(e.id)).toBe(2);
    must((await prescriptions.mutate(a.id, (p) => p.cancel('Erreur', DOC, LATER)))!);
    expect(await prescriptions.countIssued(e.id)).toBe(1);
    expect(await prescriptions.countIssued(must(EncounterId.create(uuid(99))))).toBe(0);
  });

  it('annule sous verrou ; une règle refusée n\'écrit rien ; introuvable : null', async () => {
    const e = await openEncounter();
    const p = await issue(e);
    expect(await prescriptions.mutate(p.id, (x) => x.cancel('Erreur', 'u-other', LATER))).toMatchObject({ ok: false });
    expect((await prescriptions.findById(p.id))!.status).toBe('ISSUED');
    const done = must((await prescriptions.mutate(p.id, (x) => x.cancel('Posologie erronée', DOC, LATER)))!);
    expect(done.state).toMatchObject({ status: 'CANCELLED', cancelledBy: DOC, cancellationReason: 'Posologie erronée' });
    expect(done.state.lines).toHaveLength(1);
    expect(await prescriptions.mutate(must(PrescriptionId.create(uuid(98))), () => ({ ok: true, value: undefined }))).toBeNull();
  });

  describe('verrous posés par la base', () => {
    it('refuse une ordonnance sur une consultation signée ou annulée', async () => {
      const e = await openEncounter();
      must((await encounters.mutate(e.id, (x) => x.cancel('Erreur', DOC, LATER)))!);
      await expect(issue(e)).rejects.toThrow(/consultation en cours/);
    });

    it('refuse de supprimer une ordonnance et de réécrire ou supprimer une ligne', async () => {
      const e = await openEncounter();
      const p = await issue(e);
      await expect(sql.query('DELETE FROM clinical_prescriptions WHERE id = $1', [p.id.value])).rejects.toThrow(/suppression interdite/);
      await expect(sql.query("UPDATE clinical_prescription_lines SET quantity = 1 WHERE prescription_id = $1", [p.id.value])).rejects.toThrow(/ajout seul/);
      await expect(sql.query('DELETE FROM clinical_prescription_lines WHERE prescription_id = $1', [p.id.value])).rejects.toThrow(/ajout seul/);
    });

    it('gèle une ordonnance annulée', async () => {
      const e = await openEncounter();
      const p = await issue(e);
      must((await prescriptions.mutate(p.id, (x) => x.cancel('Erreur', DOC, LATER)))!);
      await expect(sql.query("UPDATE clinical_prescriptions SET notes = 'x' WHERE id = $1", [p.id.value])).rejects.toThrow(/ne peut plus être modifiée/);
    });

    it('refuse un médicament inconnu, deux fois le même médicament, une quantité hors bornes et un statut annulé sans motif', async () => {
      const e = await openEncounter();
      const p = await issue(e);
      const insert = (drug: string, quantity = 1) =>
        sql.query("INSERT INTO clinical_prescription_lines (prescription_id, position, drug_id, dose, frequency, quantity) VALUES ($1, 5, $2, '1', '1/j', $3)", [p.id.value, drug, quantity]);
      await expect(insert(uuid(799))).rejects.toThrow();
      await expect(insert(uuid(701))).rejects.toThrow();
      await expect(insert(uuid(702), 10001)).rejects.toThrow();
      await expect(sql.query("UPDATE clinical_prescriptions SET status = 'CANCELLED' WHERE id = $1", [p.id.value])).rejects.toThrow();
      await expect(sql.query("UPDATE clinical_prescription_lines SET allergy_override = 'ab' WHERE prescription_id = $1", [p.id.value])).rejects.toThrow();
    });
  });
});

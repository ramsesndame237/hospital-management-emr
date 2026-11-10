import { PGlite } from '@electric-sql/pglite';
import { Allergy } from '../../src/modules/clinical/domain/allergy';
import { Diagnosis, Encounter } from '../../src/modules/clinical/domain/encounter';
import { createVitals } from '../../src/modules/clinical/domain/vitals';
import { AllergyId, EncounterId, IcdCode, PatientRef } from '../../src/modules/clinical/domain/values';
import { PgAllergyRepository } from '../../src/modules/clinical/infrastructure/persistence/pg-allergy.repository';
import { PgEncounterRepository } from '../../src/modules/clinical/infrastructure/persistence/pg-encounter.repository';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, seedFixture, uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const DOC = uuid(41);
const NURSE = uuid(42);

describe('schéma clinique sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let encounters: PgEncounterRepository;
  let allergies: PgAllergyRepository;
  let seq = 0;

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    encounters = new PgEncounterRepository(sql);
    allergies = new PgAllergyRepository(sql);
  });
  afterEach(async () => db.close());

  const admission = async (type = 'OUTPATIENT', patient = f.patient1): Promise<string> => {
    seq += 1;
    const id = uuid(600 + seq);
    await sql.query(
      "INSERT INTO admissions (id, admission_number, patient_id, admission_type, status, service_id, admitted_at) VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5, '2026-11-02T07:00:00Z')",
      [id, `ADM-${String(seq).padStart(7, '0')}`, patient, type, f.serviceA],
    );
    return id;
  };

  const start = async (over: { admissionId?: string | null; patient?: string; doctor?: string } = {}): Promise<Encounter> => {
    seq += 1;
    const e = Encounter.start({
      id: must(EncounterId.create(uuid(1000 + seq))), number: await encounters.nextNumber(), patientId: must(PatientRef.create(over.patient ?? f.patient1)), serviceId: f.serviceA,
      admissionId: over.admissionId === undefined ? await admission() : over.admissionId, doctorId: over.doctor ?? DOC, startedAt: NOW,
    });
    expect(await encounters.insert(e)).toBe(true);
    return e;
  };

  const dx = (code: string, kind: 'PRIMARY' | 'SECONDARY' = 'PRIMARY', label = 'Pneumopathie'): Diagnosis => ({ code: must(IcdCode.create(code)), label, kind, certainty: 'CONFIRMED' });

  describe('consultations', () => {
    it('enregistre et relit une consultation vide, avec son numéro', async () => {
      const e = await start();
      expect(e.state.number.value).toBe('CON-0000001');
      const found = (await encounters.findById(e.id))!;
      expect(found.state).toMatchObject({ status: 'IN_PROGRESS', doctorId: DOC, serviceId: f.serviceA, vitals: null, diagnoses: [], addenda: [] });
      expect(found.state.patientId.value).toBe(f.patient1);
      expect(found.state.startedAt.toString()).toBe('2026-11-02T08:00:00Z');
    });

    it('une seule consultation en cours par admission ; une fois signée ou annulée, on peut en rouvrir une', async () => {
      const adm = await admission();
      const first = await start({ admissionId: adm });
      const dup = Encounter.start({ id: must(EncounterId.create(uuid(9))), number: await encounters.nextNumber(), patientId: must(PatientRef.create(f.patient1)), serviceId: f.serviceA, admissionId: adm, doctorId: NURSE, startedAt: NOW });
      expect(await encounters.insert(dup)).toBe(false);
      must((await encounters.mutate(first.id, (x) => x.cancel('Erreur', DOC, LATER)))!);
      expect(await encounters.insert(dup)).toBe(true);
    });

    it('persiste constantes, note et diagnostics, et les relit à l\'identique (décimales comprises)', async () => {
      const e = await start();
      must((await encounters.mutate(e.id, (x) => x.recordVitals(must(createVitals({ temperature: 38.1, pulse: 92, systolic: 120, diastolic: 80, weightKg: 68.5, heightCm: 172.5 })), NURSE, LATER)))!);
      must((await encounters.mutate(e.id, (x) => x.updateNote(DOC, { chiefComplaint: 'Fièvre', assessment: 'Pneumopathie' })))!);
      const done = must((await encounters.mutate(e.id, (x) => x.setDiagnoses(DOC, [dx('J18.9'), dx('R50.9', 'SECONDARY', 'Fièvre')])))!);
      expect(done.state.vitals).toEqual({ temperature: 38.1, pulse: 92, systolic: 120, diastolic: 80, respiratoryRate: null, spo2: null, weightKg: 68.5, heightCm: 172.5 });
      expect(done.state).toMatchObject({ vitalsBy: NURSE, note: { chiefComplaint: 'Fièvre', assessment: 'Pneumopathie', plan: null } });
      expect(done.state.diagnoses.map((d) => [d.code.value, d.kind, d.label])).toEqual([['J18.9', 'PRIMARY', 'Pneumopathie'], ['R50.9', 'SECONDARY', 'Fièvre']]);
    });

    it('remplacer les diagnostics les remplace tous ; une règle refusée n\'écrit rien', async () => {
      const e = await start();
      must((await encounters.mutate(e.id, (x) => x.setDiagnoses(DOC, [dx('J18.9')])))!);
      expect(await encounters.mutate(e.id, (x) => x.setDiagnoses(DOC, [dx('J18.9'), dx('R50.9')]))).toMatchObject({ ok: false });
      expect((await encounters.findById(e.id))!.state.diagnoses.map((d) => d.code.value)).toEqual(['J18.9']);
      must((await encounters.mutate(e.id, (x) => x.setDiagnoses(DOC, [dx('R50.9')])))!);
      expect((await encounters.findById(e.id))!.state.diagnoses.map((d) => d.code.value)).toEqual(['R50.9']);
    });

    it('signe avec ses diagnostics inchangés, puis refuse toute modification', async () => {
      const e = await start();
      must((await encounters.mutate(e.id, (x) => x.updateNote(DOC, { assessment: 'x' })))!);
      must((await encounters.mutate(e.id, (x) => x.setDiagnoses(DOC, [dx('J18.9')])))!);
      const signed = must((await encounters.mutate(e.id, (x) => x.sign(DOC, LATER)))!);
      expect(signed.state).toMatchObject({ status: 'SIGNED', signedBy: DOC });
      expect(signed.state.signedAt!.toString()).toBe('2026-11-02T09:00:00Z');
      expect(await encounters.mutate(e.id, (x) => x.updateNote(DOC, { plan: 'x' }))).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_LOCKED' } });
      expect((await encounters.findById(e.id))!.state.diagnoses).toHaveLength(1);
    });

    it('ajoute des addenda dans l\'ordre sans réécrire la consultation', async () => {
      const e = await start();
      must((await encounters.mutate(e.id, (x) => x.updateNote(DOC, { assessment: 'x' })))!);
      must((await encounters.mutate(e.id, (x) => x.setDiagnoses(DOC, [dx('J18.9')])))!);
      expect(await encounters.addAddendum(e.id, (x) => x.addAddendum('Trop tôt', DOC, LATER))).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_NOT_SIGNED' } });
      must((await encounters.mutate(e.id, (x) => x.sign(DOC, LATER)))!);
      const versionBefore = (await sql.query<{ version: number }>('SELECT version FROM clinical_encounters WHERE id = $1', [e.id.value]))[0].version;
      must((await encounters.addAddendum(e.id, (x) => x.addAddendum('Premier', DOC, LATER)))!);
      const done = must((await encounters.addAddendum(e.id, (x) => x.addAddendum('Second', DOC, LATER)))!);
      expect(done.state.addenda.map((a) => [a.seq, a.text, a.by])).toEqual([[1, 'Premier', DOC], [2, 'Second', DOC]]);
      expect((await sql.query<{ version: number }>('SELECT version FROM clinical_encounters WHERE id = $1', [e.id.value]))[0].version).toBe(versionBefore);
      expect(await encounters.addAddendum(must(EncounterId.create(uuid(404))), (x) => x.addAddendum('x', DOC, LATER))).toBeNull();
    });

    it('signale une consultation introuvable', async () => {
      expect(await encounters.mutate(must(EncounterId.create(uuid(404))), () => ({ ok: true, value: undefined }))).toBeNull();
      expect(await encounters.findById(must(EncounterId.create(uuid(404))))).toBeNull();
    });

    it('liste par service, patient, statut et médecin, avec le diagnostic principal, les plus récentes d\'abord', async () => {
      const a = await start({ patient: f.patient1 });
      const b = await start({ patient: f.patient2, doctor: NURSE });
      must((await encounters.mutate(a.id, (x) => x.updateNote(DOC, { assessment: 'x' })))!);
      must((await encounters.mutate(a.id, (x) => x.setDiagnoses(DOC, [dx('J18.9', 'PRIMARY', 'Pneumopathie')])))!);
      must((await encounters.mutate(a.id, (x) => x.sign(DOC, LATER)))!);
      const all = await encounters.list({ serviceIds: null }, 0, 10);
      expect(all.total).toBe(2);
      expect(all.items.find((i) => i.id === a.id.value)).toMatchObject({ status: 'SIGNED', primaryDiagnosis: { code: 'J18.9', label: 'Pneumopathie' } });
      expect(all.items.find((i) => i.id === b.id.value)!.primaryDiagnosis).toBeNull();
      expect((await encounters.list({ serviceIds: [f.serviceA] }, 0, 10)).total).toBe(2);
      expect((await encounters.list({ serviceIds: [f.serviceB] }, 0, 10)).total).toBe(0);
      expect((await encounters.list({ serviceIds: [] }, 0, 10)).total).toBe(0);
      expect((await encounters.list({ serviceIds: null, patientId: must(PatientRef.create(f.patient2)) }, 0, 10)).items.map((i) => i.id)).toEqual([b.id.value]);
      expect((await encounters.list({ serviceIds: null, status: 'SIGNED' }, 0, 10)).items.map((i) => i.id)).toEqual([a.id.value]);
      expect((await encounters.list({ serviceIds: null, doctorId: NURSE }, 0, 10)).items.map((i) => i.id)).toEqual([b.id.value]);
      expect((await encounters.list({ serviceIds: null }, 1, 1)).items).toHaveLength(1);
    });

    it('donne la consultation de chaque admission : en cours, sinon signée, jamais annulée', async () => {
      const [a1, a2, a3, a4] = [await admission(), await admission(), await admission(), await admission()];
      const open = await start({ admissionId: a1 });
      const toSign = await start({ admissionId: a2 });
      const cancelled = await start({ admissionId: a3 });
      must((await encounters.mutate(toSign.id, (x) => x.updateNote(DOC, { assessment: 'x' })))!);
      must((await encounters.mutate(toSign.id, (x) => x.setDiagnoses(DOC, [dx('J18.9')])))!);
      must((await encounters.mutate(toSign.id, (x) => x.sign(DOC, LATER)))!);
      must((await encounters.mutate(cancelled.id, (x) => x.cancel('Erreur', DOC, LATER)))!);
      const map = await encounters.byAdmissions([a1, a2, a3, a4]);
      expect([...map.keys()].sort()).toEqual([a1, a2].sort());
      expect(map.get(a1)).toMatchObject({ id: open.id.value, status: 'IN_PROGRESS', doctorId: DOC });
      expect(map.get(a2)).toMatchObject({ status: 'SIGNED' });
      expect((await encounters.byAdmissions([])).size).toBe(0);
    });
  });

  describe('verrous du dossier en base', () => {
    const signed = async () => {
      const e = await start();
      must((await encounters.mutate(e.id, (x) => x.updateNote(DOC, { assessment: 'x' })))!);
      must((await encounters.mutate(e.id, (x) => x.setDiagnoses(DOC, [dx('J18.9')])))!);
      must((await encounters.mutate(e.id, (x) => x.sign(DOC, LATER)))!);
      return e;
    };

    it('une consultation signée ne peut plus être modifiée ni supprimée, quoi que fasse l\'application', async () => {
      const e = await signed();
      await expect(db.query("UPDATE clinical_encounters SET assessment = 'réécrit' WHERE id = $1", [e.id.value])).rejects.toThrow(/ne peut plus être modifiée/);
      await expect(db.query("UPDATE clinical_encounters SET status = 'IN_PROGRESS' WHERE id = $1", [e.id.value])).rejects.toThrow();
      await expect(db.query('DELETE FROM clinical_encounters WHERE id = $1', [e.id.value])).rejects.toThrow(/suppression interdite/);
    });

    it('les diagnostics d\'une consultation signée ne bougent plus', async () => {
      const e = await signed();
      await expect(db.query("INSERT INTO clinical_encounter_diagnoses (encounter_id, position, code, label, kind, certainty) VALUES ($1, 5, 'R50.9', 'Fièvre', 'SECONDARY', 'CONFIRMED')", [e.id.value])).rejects.toThrow(/n'est plus en cours/);
      await expect(db.query('DELETE FROM clinical_encounter_diagnoses WHERE encounter_id = $1', [e.id.value])).rejects.toThrow(/n'est plus en cours/);
      await expect(db.query("UPDATE clinical_encounter_diagnoses SET label = 'x' WHERE encounter_id = $1", [e.id.value])).rejects.toThrow();
    });

    it('un addendum ne se pose que sur une consultation signée, et ne se modifie ni ne s\'efface', async () => {
      const open = await start();
      await expect(db.query("INSERT INTO clinical_encounter_addenda (encounter_id, seq, text, by, at) VALUES ($1, 1, 'x', $2, now())", [open.id.value, DOC])).rejects.toThrow(/seule une consultation signée/);
      const e = await signed();
      must((await encounters.addAddendum(e.id, (x) => x.addAddendum('Premier', DOC, LATER)))!);
      await expect(db.query("UPDATE clinical_encounter_addenda SET text = 'réécrit'")).rejects.toThrow(/ajout seul/);
      await expect(db.query('DELETE FROM clinical_encounter_addenda')).rejects.toThrow(/ajout seul/);
      await expect(db.query('TRUNCATE clinical_encounter_addenda')).rejects.toThrow(/ajout seul/);
    });

    it('la base refuse un signataire autre que le médecin, une signature sans date et une annulation sans motif', async () => {
      const e = await start();
      await expect(db.query("UPDATE clinical_encounters SET status = 'SIGNED', signed_by = $2, signed_at = now() WHERE id = $1", [e.id.value, NURSE])).rejects.toThrow();
      await expect(db.query("UPDATE clinical_encounters SET status = 'SIGNED' WHERE id = $1", [e.id.value])).rejects.toThrow();
      await expect(db.query("UPDATE clinical_encounters SET status = 'CANCELLED', cancelled_by = $2, cancelled_at = now() WHERE id = $1", [e.id.value, DOC])).rejects.toThrow();
    });

    it('la base refuse des constantes hors plage, une diastolique au-dessus de la systolique et deux diagnostics principaux', async () => {
      const e = await start();
      await expect(db.query('UPDATE clinical_encounters SET pulse = 500 WHERE id = $1', [e.id.value])).rejects.toThrow();
      await expect(db.query('UPDATE clinical_encounters SET systolic = 80, diastolic = 90 WHERE id = $1', [e.id.value])).rejects.toThrow();
      await db.query("INSERT INTO clinical_encounter_diagnoses (encounter_id, position, code, label, kind, certainty) VALUES ($1, 0, 'J18.9', 'a', 'PRIMARY', 'CONFIRMED')", [e.id.value]);
      await expect(db.query("INSERT INTO clinical_encounter_diagnoses (encounter_id, position, code, label, kind, certainty) VALUES ($1, 1, 'R50.9', 'b', 'PRIMARY', 'CONFIRMED')", [e.id.value])).rejects.toThrow();
      await expect(db.query("INSERT INTO clinical_encounter_diagnoses (encounter_id, position, code, label, kind, certainty) VALUES ($1, 2, 'pas un code', 'c', 'SECONDARY', 'CONFIRMED')", [e.id.value])).rejects.toThrow();
    });
  });

  describe('allergies', () => {
    const newAllergy = async (substance = 'Pénicilline', patient = f.patient1): Promise<Allergy> => {
      seq += 1;
      const a = must(Allergy.record({ id: must(AllergyId.create(uuid(2000 + seq))), patientId: must(PatientRef.create(patient)), substance, reaction: 'Urticaire', severity: 'SEVERE', by: DOC, at: NOW }));
      await allergies.insert(a);
      return a;
    };

    it('enregistre et relit une allergie', async () => {
      const a = await newAllergy();
      expect((await allergies.findById(a.id))!.state).toMatchObject({ substance: 'Pénicilline', reaction: 'Urticaire', severity: 'SEVERE', status: 'ACTIVE', recordedBy: DOC });
    });

    it('corrige et déclare erronée sous verrou ; la liste active l\'écarte, l\'historique la garde', async () => {
      const a = await newAllergy('Latex');
      const b = await newAllergy('Arachide');
      must((await allergies.mutate(a.id, (x) => x.update({ severity: 'MILD' })))!);
      must((await allergies.mutate(b.id, (x) => x.void('Mauvais dossier', DOC, LATER)))!);
      expect((await allergies.listOf(must(PatientRef.create(f.patient1)), false)).map((x) => [x.state.substance, x.state.severity])).toEqual([['Latex', 'MILD']]);
      const all = await allergies.listOf(must(PatientRef.create(f.patient1)), true);
      expect(all.map((x) => x.state.status).sort()).toEqual(['ACTIVE', 'ENTERED_IN_ERROR']);
      expect(await allergies.mutate(b.id, (x) => x.update({ severity: 'MILD' }))).toMatchObject({ ok: false, error: { code: 'CLINICAL_ALLERGY_VOIDED' } });
      expect(await allergies.mutate(must(AllergyId.create(uuid(404))), () => ({ ok: true, value: undefined }))).toBeNull();
    });

    it('ne mélange pas les patients, et ne se supprime jamais', async () => {
      const a = await newAllergy('Latex', f.patient1);
      await newAllergy('Arachide', f.patient2);
      expect((await allergies.listOf(must(PatientRef.create(f.patient2)), false)).map((x) => x.state.substance)).toEqual(['Arachide']);
      await expect(db.query('DELETE FROM clinical_allergies WHERE id = $1', [a.id.value])).rejects.toThrow(/suppression interdite/);
    });

    it('la base refuse une gravité inconnue et un statut « erroné » sans motif', async () => {
      const a = await newAllergy();
      await expect(db.query("UPDATE clinical_allergies SET severity = 'EXTREME' WHERE id = $1", [a.id.value])).rejects.toThrow();
      await expect(db.query("UPDATE clinical_allergies SET status = 'ENTERED_IN_ERROR' WHERE id = $1", [a.id.value])).rejects.toThrow();
    });
  });
});

import { PGlite } from '@electric-sql/pglite';
import { Encounter } from '../../src/modules/clinical/domain/encounter';
import { Prescription } from '../../src/modules/clinical/domain/prescription';
import { DrugRef, EncounterId, PatientRef, PrescriptionId } from '../../src/modules/clinical/domain/values';
import { PgEncounterRepository } from '../../src/modules/clinical/infrastructure/persistence/pg-encounter.repository';
import { PgPrescriptionRepository } from '../../src/modules/clinical/infrastructure/persistence/pg-prescription.repository';
import { allocateFefo } from '../../src/modules/pharmacy/domain/batch';
import { Dispensation } from '../../src/modules/pharmacy/domain/dispensation';
import { DispensationId } from '../../src/modules/pharmacy/domain/values';
import { PgDispensationRepository } from '../../src/modules/pharmacy/infrastructure/persistence/pg-dispensation.repository';
import { DomainError, err, ok } from '../../src/shared-kernel/result';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, seedFixture, uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const TODAY = Temporal.PlainDate.from('2026-11-02');
const DOC = uuid(41);
const PHARMACIST = uuid(51);

describe('schéma de la dispensation sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let prescriptions: PgPrescriptionRepository;
  let dispensations: PgDispensationRepository;
  let rx: Prescription;
  let seq = 0;

  const drugA = uuid(701);
  const drugB = uuid(702);

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    prescriptions = new PgPrescriptionRepository(sql);
    dispensations = new PgDispensationRepository(sql);
    for (const [n, id] of [[1, drugA], [2, drugB]] as const) {
      await sql.query("INSERT INTO pharmacy_drugs (id, code, name, generic_name, form, schedule, unit) VALUES ($1, $2, $3, $3, 'TABLET', 'PRESCRIPTION', 'comprimé')", [id, `D${n}`, `Médicament ${n}`]);
    }
    await batch('b-a-late', drugA, 'LATE', '2027-06-30', 10);
    await batch('b-a-soon', drugA, 'SOON', '2026-12-31', 5);
    await batch('b-b', drugB, 'B1', '2027-01-31', 20);
    rx = await issue([{ drug: drugA, quantity: 12 }, { drug: drugB, quantity: 4 }]);
  });
  afterEach(async () => db.close());

  async function batch(key: string, drug: string, number: string, expiry: string, quantity: number): Promise<void> {
    seq += 1;
    await sql.query("INSERT INTO pharmacy_batches (id, drug_id, batch_number, expiry_date, quantity, unit_cost, received_at) VALUES ($1, $2, $3, $4::date, $5, 10, $6::timestamptz)", [uuid(800 + [...key].reduce((n, c) => n + c.charCodeAt(0), 0) + seq), drug, number, expiry, quantity, NOW.toString()]);
  }

  async function issue(lines: { drug: string; quantity: number }[]): Promise<Prescription> {
    seq += 1;
    const encounters = new PgEncounterRepository(sql);
    const e = Encounter.start({ id: must(EncounterId.create(uuid(1000 + seq))), number: await encounters.nextNumber(), patientId: must(PatientRef.create(f.patient1)), serviceId: f.serviceA, admissionId: null, doctorId: DOC, startedAt: NOW });
    await encounters.insert(e);
    const p = must(Prescription.issue({
      id: must(PrescriptionId.create(uuid(2000 + seq))), number: await prescriptions.nextNumber(), encounterId: e.id, patientId: e.state.patientId, serviceId: f.serviceA, doctorId: DOC, issuedAt: NOW,
      lines: lines.map((l) => ({ drugId: must(DrugRef.create(l.drug)), dose: '1', frequency: '1/j', quantity: l.quantity })),
    }));
    await prescriptions.insert(p);
    return p;
  }

  /** Délivre par la voie normale : premier périmé, premier sorti, les lots verrouillés, le grand livre écrit. */
  const dispense = async (target: Prescription, wanted: { position: number; drug: string; quantity: number }[]) => {
    // Le numéro se demande AVANT la transaction (comme le fait le cas d'usage) : une seule connexion sous PGlite.
    const number = await dispensations.nextNumber();
    return dispensations.dispense(target.id.value, async (context) => {
      const lines = [];
      const movements = [];
      for (const w of wanted) {
        const batches = await context.batchesOf(w.drug);
        const plan = allocateFefo(batches, w.quantity, TODAY);
        if (plan.shortfall > 0) return err(new DomainError('PHARMACY_STOCK_INSUFFICIENT_FOR_LINE', 'manque'));
        for (const a of plan.allocations) {
          const b = batches.find((x) => x.id.value === a.batchId)!;
          movements.push({ batch: b, draft: must(b.dispense(a.quantity, TODAY, number.value)) });
          lines.push({ prescriptionPosition: w.position, drugId: w.drug, batchId: a.batchId, batchNumber: a.batchNumber, expiry: a.expiry, quantity: a.quantity, allergyOverride: null });
        }
      }
      seq += 1;
      const d = must(Dispensation.create({ id: must(DispensationId.create(uuid(3000 + seq))), number, prescriptionId: target.id.value, patientId: f.patient1, dispensedBy: PHARMACIST, dispensedAt: LATER, notes: null, lines }));
      return ok({ dispensation: d, movements });
    });
  };

  const rows = (table: string) => sql.query<Record<string, unknown>>(`SELECT * FROM ${table}`);

  it('délivre sous verrou : la dispensation, ses lignes par lot, les lots et le grand livre s\'écrivent ensemble, premier périmé d\'abord', async () => {
    const done = must(await dispense(rx, [{ position: 0, drug: drugA, quantity: 12 }]));
    expect(done.state.number.value).toBe('DSP-0000001');
    expect(done.state.lines.map((l) => [l.batchNumber, l.quantity])).toEqual([['SOON', 5], ['LATE', 7]]);
    const batches = await sql.query<{ batch_number: string; quantity: number }>("SELECT batch_number, quantity FROM pharmacy_batches WHERE drug_id = $1 ORDER BY batch_number", [drugA]);
    expect(batches).toEqual([{ batch_number: 'LATE', quantity: 3 }, { batch_number: 'SOON', quantity: 0 }]);
    const moves = await sql.query<{ type: string; delta: number; balance: number; reference: string }>("SELECT type, delta, balance, reference FROM pharmacy_stock_movements ORDER BY seq");
    expect(moves).toEqual([{ type: 'DISPENSE', delta: -5, balance: 0, reference: 'DSP-0000001' }, { type: 'DISPENSE', delta: -7, balance: 3, reference: 'DSP-0000001' }]);
    expect((await dispensations.dispensedQuantities([rx.id.value])).get(rx.id.value)).toEqual(new Map([[0, 12]]));
    const listed = await dispensations.listOf(rx.id.value);
    expect(listed).toHaveLength(1);
    expect(listed[0].state.lines[1].expiry.toString()).toBe('2027-06-30');
  });

  it('n\'écrit rien quand la décision refuse (stock ou règle) : ni dispensation, ni lot, ni mouvement', async () => {
    const refused = await dispense(rx, [{ position: 0, drug: drugA, quantity: 12 }, { position: 1, drug: drugB, quantity: 99 }]);
    expect(refused.ok).toBe(false);
    expect(await rows('pharmacy_dispensations')).toEqual([]);
    expect(await rows('pharmacy_stock_movements')).toEqual([]);
    expect((await sql.query<{ quantity: number }>("SELECT quantity FROM pharmacy_batches WHERE drug_id = $1 ORDER BY quantity", [drugA])).map((r) => r.quantity)).toEqual([5, 10]);
  });

  it('voit ce qui est déjà délivré avant de décider (la somme se relit sous le verrou)', async () => {
    must(await dispense(rx, [{ position: 1, drug: drugB, quantity: 3 }]));
    let seen: ReadonlyMap<number, number> | null = null;
    await dispensations.dispense(rx.id.value, async (context) => {
      seen = context.dispensed;
      return err(new DomainError('X', 'stop'));
    });
    expect(seen).toEqual(new Map([[1, 3]]));
  });

  describe('verrous posés par la base', () => {
    const insertLine = async (prescription: Prescription, over: { position?: number; quantity: number; drug?: string; batch?: string }) => {
      const dispensationId = uuid(4000 + (seq += 1));
      await sql.query("INSERT INTO pharmacy_dispensations (id, dispensation_number, prescription_id, patient_id, dispensed_by, dispensed_at) VALUES ($1, $2, $3, $4, $5, $6::timestamptz)",
        [dispensationId, `DSP-${String(9000 + seq).padStart(7, '0')}`, prescription.id.value, f.patient1, PHARMACIST, LATER.toString()]);
      const batchId = over.batch ?? (await sql.query<{ id: string }>('SELECT id FROM pharmacy_batches WHERE drug_id = $1 LIMIT 1', [over.drug ?? drugA]))[0].id;
      return sql.query("INSERT INTO pharmacy_dispensation_lines (dispensation_id, position, prescription_position, drug_id, batch_id, batch_number, expiry_date, quantity) VALUES ($1, 0, $2, $3, $4, 'X', '2027-01-01', $5)",
        [dispensationId, over.position ?? 0, over.drug ?? drugA, batchId, over.quantity]);
    };

    it('refuse de délivrer plus que la quantité prescrite, en plusieurs fois comprises', async () => {
      await insertLine(rx, { quantity: 12 });
      await expect(insertLine(rx, { quantity: 1 })).rejects.toThrow(/plus que la quantité prescrite/);
      await expect(insertLine(rx, { position: 1, drug: drugB, quantity: 5 })).rejects.toThrow(/plus que la quantité prescrite/);
    });

    it('refuse une ligne qui n\'est pas sur l\'ordonnance (autre médicament pour ce rang)', async () => {
      await expect(insertLine(rx, { position: 0, drug: drugB, quantity: 1 })).rejects.toThrow(/n'existe pas sur l'ordonnance/);
      await expect(insertLine(rx, { position: 7, quantity: 1 })).rejects.toThrow(/n'existe pas sur l'ordonnance/);
    });

    it('refuse de délivrer une ordonnance annulée', async () => {
      const other = await issue([{ drug: drugA, quantity: 3 }]);
      must((await prescriptions.mutate(other.id, (p) => p.cancel('Erreur', DOC, LATER)))!);
      await expect(insertLine(other, { quantity: 1 })).rejects.toThrow(/seule une ordonnance en cours se délivre/);
    });

    it('refuse d\'annuler une ordonnance déjà délivrée, même en partie', async () => {
      await insertLine(rx, { quantity: 1 });
      await expect(prescriptions.mutate(rx.id, (p) => p.cancel('Erreur', DOC, LATER))).rejects.toThrow(/déjà délivrée ne s'annule pas/);
      expect((await prescriptions.findById(rx.id))!.status).toBe('ISSUED');
    });

    it('laisse annuler une ordonnance jamais délivrée', async () => {
      const other = await issue([{ drug: drugA, quantity: 3 }]);
      expect(must((await prescriptions.mutate(other.id, (p) => p.cancel('Erreur', DOC, LATER)))!).status).toBe('CANCELLED');
    });

    it('est en ajout seul : ni modification ni suppression d\'une dispensation ou de ses lignes', async () => {
      await insertLine(rx, { quantity: 1 });
      await expect(sql.query("UPDATE pharmacy_dispensations SET notes = 'x'")).rejects.toThrow(/ajout seul/);
      await expect(sql.query('DELETE FROM pharmacy_dispensations')).rejects.toThrow(/ajout seul/);
      await expect(sql.query('UPDATE pharmacy_dispensation_lines SET quantity = 1')).rejects.toThrow(/ajout seul/);
      await expect(sql.query('DELETE FROM pharmacy_dispensation_lines')).rejects.toThrow(/ajout seul/);
    });

    it('le grand livre : une délivrance est toujours une sortie ; les autres mouvements gardent leur règle', async () => {
      const batchId = (await sql.query<{ id: string }>('SELECT id FROM pharmacy_batches WHERE drug_id = $1 LIMIT 1', [drugA]))[0].id;
      const insert = (type: string, delta: number) =>
        sql.query("INSERT INTO pharmacy_stock_movements (drug_id, batch_id, type, delta, balance, by, at) VALUES ($1, $2, $3, $4, 5, $5, $6::timestamptz)", [drugA, batchId, type, delta, PHARMACIST, NOW.toString()]);
      await expect(insert('DISPENSE', 3)).rejects.toThrow();
      await expect(insert('ADJUSTMENT_OUT', 3)).rejects.toThrow();
      await expect(insert('RECEIPT', -3)).rejects.toThrow();
      await expect(insert('MYSTERY', -3)).rejects.toThrow();
      await insert('DISPENSE', -3);
      await insert('ADJUSTMENT_OUT', -3);
      await insert('RECEIPT', 3);
    });
  });
});

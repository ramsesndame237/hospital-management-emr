import { PGlite } from '@electric-sql/pglite';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { LabTest, ReferenceRange } from '../../src/modules/lab/domain/test';
import { Requisition, TestToOrder, specimenCount } from '../../src/modules/lab/domain/requisition';
import { PgRequisitionRepository } from '../../src/modules/lab/infrastructure/persistence/pg-requisition.repository';
import { PgTestRepository } from '../../src/modules/lab/infrastructure/persistence/pg-test.repository';
import {
  PatientRef, Priority, Reason, RequisitionId, RequisitionNumber, SpecimenBarcode, SpecimenId, Source, TestCode, TestId, TestName,
} from '../../src/modules/lab/domain/values';
import { err } from '../../src/shared-kernel/result';
import { DomainError } from '../../src/shared-kernel/result';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';
import { Fixture, freshDatabase, MIGRATIONS, seedFixture, uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const DOC = uuid(11);
const TECH = uuid(12);

describe('schéma du laboratoire sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let f: Fixture;
  let tests: PgTestRepository;
  let reqs: PgRequisitionRepository;
  let seq = 0;

  const range = (over: Partial<ReferenceRange> = {}): ReferenceRange => ({ sex: 'ANY', ageMinDays: 0, ageMaxDays: null, low: 12.5, high: 16.25, criticalLow: 7, criticalHigh: 20, ...over });

  const newTest = async (over: Partial<Parameters<typeof LabTest.create>[0]> = {}): Promise<LabTest> => {
    seq += 1;
    const test = must(LabTest.create({
      id: must(TestId.create(uuid(1000 + seq))), code: must(TestCode.create(`T${seq}`)), name: must(TestName.create(`Analyse ${seq}`)), section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC',
      unit: 'g/dL', decimals: 1, choices: [], tatMinutes: 120, instructions: null, ranges: [range()], ...over,
    }));
    expect(await tests.insert(test)).toBe(true);
    return test;
  };

  const toOrder = (t: LabTest): TestToOrder => ({ testId: t.state.id, code: t.state.code, name: t.state.name, section: t.state.section, specimenType: t.state.specimenType, container: t.state.container });

  const newRequisition = async (list: LabTest[], over: Partial<{ priority: Priority; source: Source; orderedBy: string; orderedAt: Temporal.Instant; patient: string }> = {}): Promise<Requisition> => {
    seq += 1;
    const order = list.map(toOrder);
    const n = specimenCount(order);
    const r = must(Requisition.order({
      id: must(RequisitionId.create(uuid(2000 + seq))), number: await reqs.nextNumber(), patientId: must(PatientRef.create(over.patient ?? f.patient1)), priority: over.priority ?? 'ROUTINE', source: over.source ?? 'OPD',
      clinicalNotes: 'Fièvre', orderedBy: over.orderedBy ?? DOC, orderedAt: over.orderedAt ?? NOW, tests: order,
      specimenIds: Array.from({ length: n }, (_, i) => must(SpecimenId.create(uuid(3000 + seq * 10 + i)))), barcodes: await reqs.nextBarcodes(n),
    }));
    await reqs.insert(r);
    return r;
  };

  const collect = (r: Requisition, i = 0) => reqs.mutate(r.id, (x) => x.collect(x.state.specimens[i].id, TECH, LATER));

  beforeEach(async () => {
    ({ db, sql } = await freshDatabase());
    f = await seedFixture(sql);
    tests = new PgTestRepository(sql);
    reqs = new PgRequisitionRepository(sql);
    seq = 0;
  });
  afterEach(() => db.close());

  describe('droits', () => {
    it('est idempotent et répartit les droits : le médecin prescrit, le laboratoire traite, l\'administrateur système tient le catalogue', async () => {
      await newTest();
      for (const ddl of MIGRATIONS) await db.exec(ddl);
      expect((await tests.list({ includeInactive: true }, 0, 10)).total).toBe(1);
      const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, new Set(r.permissions.map((p) => p.value))]));
      const holders = (p: string) => [...roles].filter(([, s]) => s.has(p)).map(([c]) => c).sort();
      expect(holders('lab.catalog:read:all')).toEqual(['DOCTOR', 'LAB_TECHNICIAN', 'SYSTEM_ADMIN']);
      expect(holders('lab.catalog:manage:all')).toEqual(['SYSTEM_ADMIN']);
      expect(holders('lab.requisitions:order:all')).toEqual(['DOCTOR', 'LAB_TECHNICIAN']);
      expect(holders('lab.requisitions:read:own')).toEqual(['DOCTOR']);
      expect(holders('lab.requisitions:read:all')).toEqual(['LAB_TECHNICIAN', 'SYSTEM_ADMIN']);
      expect(holders('lab.requisitions:cancel:all')).toEqual(['DOCTOR', 'LAB_TECHNICIAN']);
      for (const p of ['collect', 'receive', 'reject']) expect(holders(`lab.specimens:${p}:all`)).toEqual(['LAB_TECHNICIAN']);
    });
  });

  describe('catalogue', () => {
    it('relit une analyse avec ses valeurs de référence décimales sans perte, ses choix et ses consignes', async () => {
      const t = await newTest({ ranges: [range({ sex: 'FEMALE', low: 11.5, high: 15.5, criticalLow: 6.9, criticalHigh: null }), range({ sex: 'MALE', ageMinDays: 6574, low: 13 })], instructions: 'À jeun' });
      const back = (await tests.findById(t.id))!;
      expect(back.state).toMatchObject({ unit: 'g/dL', decimals: 1, tatMinutes: 120, instructions: 'À jeun', active: true, section: 'HAEMATOLOGY', container: 'PURPLE' });
      expect(back.state.ranges).toEqual([
        { sex: 'FEMALE', ageMinDays: 0, ageMaxDays: null, low: 11.5, high: 15.5, criticalLow: 6.9, criticalHigh: null },
        { sex: 'MALE', ageMinDays: 6574, ageMaxDays: null, low: 13, high: 16.25, criticalLow: 7, criticalHigh: 20 },
      ]);
      const choice = await newTest({ resultType: 'CHOICE', unit: null, ranges: [], choices: ['Positif', 'Négatif', 'Douteux'], decimals: 0 });
      expect((await tests.findById(choice.id))!.state.choices).toEqual(['Positif', 'Négatif', 'Douteux']);
    });

    it('refuse un code déjà pris, sans rien écrire, et retrouve une analyse par son code', async () => {
      const t = await newTest();
      const dup = must(LabTest.create({ ...t.state, id: must(TestId.create(uuid(5000))), ranges: [range()] }));
      expect(await tests.insert(dup)).toBe(false);
      expect(await tests.findById(dup.id)).toBeNull();
      expect((await tests.findByCode(t.state.code))!.id.value).toBe(t.id.value);
      expect(await tests.findByCode(must(TestCode.create('NOPE')))).toBeNull();
    });

    it('retrouve plusieurs analyses d\'un coup, ignore les inconnues', async () => {
      const a = await newTest();
      const b = await newTest();
      const found = await tests.findByIds([a.id, b.id, must(TestId.create(uuid(99999)))]);
      expect(found.map((t) => t.state.code.value).sort()).toEqual([a.state.code.value, b.state.code.value].sort());
      expect(await tests.findByIds([])).toEqual([]);
    });

    it('met à jour l\'analyse et remplace ses valeurs de référence d\'un bloc', async () => {
      const t = await newTest({ ranges: [range(), range({ sex: 'MALE', ageMinDays: 100 })].slice(0, 1) });
      must(t.update({ name: must(TestName.create('Renommée')), tatMinutes: 30 }));
      must(t.setRanges([range({ sex: 'FEMALE' }), range({ sex: 'MALE' }), range({ sex: 'ANY', ageMinDays: 0 })]));
      t.setActive(false);
      await tests.update(t);
      const back = (await tests.findById(t.id))!;
      expect(back.state).toMatchObject({ name: { value: 'Renommée' }, tatMinutes: 30, active: false });
      expect(back.state.ranges).toHaveLength(3);
      must(back.setRanges([]));
      await tests.update(back);
      expect((await tests.findById(t.id))!.state.ranges).toHaveLength(0);
    });

    it('liste par section puis code, filtre par texte (jokers échappés), section et état, et pagine', async () => {
      await newTest({ code: must(TestCode.create('B1')), name: must(TestName.create('Glycémie à jeun')), section: 'BIOCHEMISTRY' });
      await newTest({ code: must(TestCode.create('B2')), name: must(TestName.create('Urée 100%')), section: 'BIOCHEMISTRY' });
      await newTest({ code: must(TestCode.create('H1')), name: must(TestName.create('Hémoglobine')), section: 'HAEMATOLOGY' });
      const retired = await newTest({ code: must(TestCode.create('H2')), section: 'HAEMATOLOGY' });
      retired.setActive(false);
      await tests.update(retired);
      const codes = (page: { items: LabTest[] }) => page.items.map((t) => t.state.code.value);
      expect(codes(await tests.list({ includeInactive: false }, 0, 10))).toEqual(['B1', 'B2', 'H1']);
      expect(codes(await tests.list({ includeInactive: true }, 0, 10))).toEqual(['B1', 'B2', 'H1', 'H2']);
      expect(codes(await tests.list({ includeInactive: false, section: 'HAEMATOLOGY' }, 0, 10))).toEqual(['H1']);
      expect(codes(await tests.list({ includeInactive: false, search: 'gly' }, 0, 10))).toEqual(['B1']);
      expect(codes(await tests.list({ includeInactive: false, search: '100%' }, 0, 10))).toEqual(['B2']);
      expect(codes(await tests.list({ includeInactive: false, search: '%' }, 0, 10))).toEqual(['B2']);
      const page = await tests.list({ includeInactive: true }, 1, 2);
      expect(codes(page)).toEqual(['B2', 'H1']);
      expect(page.total).toBe(4);
    });

    it('la base refuse des lignes incohérentes : unité hors numérique, choix mal formés, seuils désordonnés, code ou type inconnus', async () => {
      const t = await newTest();
      const insert = (over: Record<string, unknown>) => {
        seq += 1;
        const r = { code: `Z${seq}`, result_type: 'NUMERIC', unit: null, choices: '{}', section: 'OTHER', ...over };
        return sql.query(
          `INSERT INTO lab_tests (id, code, name, section, specimen_type, container, result_type, unit, choices) VALUES ($1, $2, 'x', $3, 'BLOOD', 'RED', $4, $5, $6::text[])`,
          [uuid(7000 + seq), r.code, r.section, r.result_type, r.unit, r.choices],
        );
      };
      await expect(insert({ result_type: 'TEXT', unit: 'g' })).rejects.toThrow();
      await expect(insert({ result_type: 'CHOICE', choices: '{Seul}' })).rejects.toThrow();
      await expect(insert({ result_type: 'NUMERIC', choices: '{A,B}' })).rejects.toThrow();
      await expect(insert({ code: 'bad code' })).rejects.toThrow();
      await expect(insert({ section: 'MAGIE' })).rejects.toThrow();
      await insert({ result_type: 'CHOICE', choices: '{Oui,Non}' });
      const range = (cols: string) => sql.query(`INSERT INTO lab_reference_ranges (test_id, position, sex, age_min_days, ${cols.split('|')[0]}) VALUES ($1, 9, 'ANY', 0, ${cols.split('|')[1]})`, [t.id.value]);
      await expect(range('low, high|20, 10')).rejects.toThrow();
      await expect(range('low|NULL')).rejects.toThrow();
      await expect(range('low, high, critical_low|10, 12, 11')).rejects.toThrow();
      await expect(range('low, high, critical_high|10, 12, 11')).rejects.toThrow();
      await expect(range('low, age_max_days|10, 0')).rejects.toThrow();
    });
  });

  describe('demandes', () => {
    it('relit la demande avec ses analyses (copies), ses échantillons et leur traçabilité', async () => {
      const a = await newTest();
      const b = await newTest({ section: 'BIOCHEMISTRY', specimenType: 'SERUM', container: 'YELLOW' });
      const r = await newRequisition([a, b], { priority: 'URGENT', source: 'ER' });
      const back = (await reqs.findById(r.id))!;
      expect(back.state).toMatchObject({ number: { value: r.state.number.value }, priority: 'URGENT', source: 'ER', clinicalNotes: 'Fièvre', orderedBy: DOC, version: 0, cancelledAt: null });
      expect(back.state.orderedAt.toString()).toBe(NOW.toString());
      expect(back.state.tests.map((t) => [t.code.value, t.section])).toEqual([[a.state.code.value, 'HAEMATOLOGY'], [b.state.code.value, 'BIOCHEMISTRY']]);
      expect(back.state.specimens).toHaveLength(2);
      expect(back.state.specimens.every((s) => s.status === 'PENDING_COLLECTION' && s.events.length === 1)).toBe(true);
      expect(back.status).toBe('ORDERED');
      // La demande garde la copie du libellé même si le catalogue change.
      a.update({ name: must(TestName.create('Autre libellé')) });
      await tests.update(a);
      expect((await reqs.findById(r.id))!.state.tests[0].name.value).toBe('Analyse 1');
    });

    it('numérote les demandes et réserve des codes-barres consécutifs et uniques', async () => {
      expect([(await reqs.nextNumber()).value, (await reqs.nextNumber()).value]).toEqual(['LAB-0000001', 'LAB-0000002']);
      const codes = (await reqs.nextBarcodes(3)).map((b) => b.value);
      expect(codes).toEqual(['SPC-0000001', 'SPC-0000002', 'SPC-0000003']);
      const [again] = await reqs.nextBarcodes(1);
      expect(again.value).toBe('SPC-0000004');
    });

    it('retrouve une demande par échantillon ou code-barres, ou rien', async () => {
      const r = await newRequisition([await newTest()]);
      const sp = r.state.specimens[0];
      expect((await reqs.findBySpecimen(sp.id))!.id.value).toBe(r.id.value);
      expect((await reqs.findByBarcode(sp.barcode))!.id.value).toBe(r.id.value);
      expect(await reqs.findBySpecimen(must(SpecimenId.create(uuid(99999))))).toBeNull();
      expect(await reqs.findByBarcode(must(SpecimenBarcode.fromSequence(99999)))).toBeNull();
    });

    it('persiste prélèvement et réception, incrémente la version et n\'ajoute que les nouvelles étapes de traçabilité', async () => {
      const r = await newRequisition([await newTest()]);
      const done = must(await collect(r));
      expect(done.status).toBe('COLLECTED');
      expect(done.state.version).toBe(1);
      expect(done.state.specimens[0]).toMatchObject({ status: 'COLLECTED', collectedBy: TECH });
      const received = must(await reqs.mutate(r.id, (x) => x.receive(x.state.specimens[0].id, TECH, LATER)));
      expect(received.status).toBe('RECEIVED');
      expect(received.state.version).toBe(2);
      const events = await sql.query<{ seq: number; kind: string }>('SELECT seq, kind FROM lab_specimen_events WHERE specimen_id = $1 ORDER BY seq', [r.state.specimens[0].id.value]);
      expect(events).toEqual([{ seq: 1, kind: 'CREATED' }, { seq: 2, kind: 'COLLECTED' }, { seq: 3, kind: 'RECEIVED' }]);
    });

    it('un rejet crée le remplaçant (nouveau code-barres), rattache les analyses et garde l\'historique', async () => {
      const r = await newRequisition([await newTest(), await newTest()]);
      const old = r.state.specimens[0];
      await collect(r);
      const [barcode] = await reqs.nextBarcodes(1);
      const replacement = must(SpecimenId.create(uuid(8000)));
      const done = must(await reqs.mutate(r.id, (x) => x.reject(old.id, TECH, LATER, 'HEMOLYSED', 'Plasma rosé', { id: replacement, barcode })));
      expect(done.state.specimens.map((s) => s.status)).toEqual(['REJECTED', 'PENDING_COLLECTION']);
      expect(done.state.specimens[0]).toMatchObject({ rejectionReason: 'HEMOLYSED', rejectionNote: 'Plasma rosé', rejectedBy: TECH });
      expect(done.state.specimens[1]).toMatchObject({ recollectionOf: { value: old.id.value } });
      expect(done.state.tests.every((t) => t.specimenId.equals(replacement))).toBe(true);
      expect(done.status).toBe('ORDERED');
      const rows = await sql.query<{ specimen_id: string }>('SELECT specimen_id FROM lab_requisition_tests WHERE requisition_id = $1', [r.id.value]);
      expect(rows.every((row) => row.specimen_id === replacement.value)).toBe(true);
    });

    it('si la règle refuse, rien n\'est écrit ; une demande inconnue répond null', async () => {
      const r = await newRequisition([await newTest()]);
      const refused = await reqs.mutate(r.id, (x) => {
        x.collect(x.state.specimens[0].id, TECH, LATER);
        return err(new DomainError('TEST_REFUSED', 'non'));
      });
      expect(refused && !refused.ok && refused.error.code).toBe('TEST_REFUSED');
      const back = (await reqs.findById(r.id))!;
      expect(back.state.specimens[0].status).toBe('PENDING_COLLECTION');
      expect(back.state.version).toBe(0);
      expect(await reqs.mutate(must(RequisitionId.create(uuid(99999))), () => err(new DomainError('X', 'x')))).toBeNull();
    });

    it('annule avec son motif, et relit l\'annulation', async () => {
      const r = await newRequisition([await newTest()]);
      const done = must(await reqs.mutate(r.id, (x) => x.cancel(must(Reason.create('Prescrit par erreur')), DOC, LATER)));
      expect(done.status).toBe('CANCELLED');
      expect(done.state).toMatchObject({ cancelledBy: DOC, cancellationReason: { value: 'Prescrit par erreur' } });
      expect((await reqs.list({ status: 'CANCELLED' }, 0, 10)).total).toBe(1);
    });

    it('deux prélèvements simultanés du même échantillon : un seul réussit', async () => {
      const r = await newRequisition([await newTest()]);
      const [a, b] = await Promise.all([collect(r), collect(r)]);
      const codes = [a, b].map((x) => (x && x.ok ? 'OK' : x && !x.ok ? x.error.code : 'NULL')).sort();
      expect(codes).toEqual(['LAB_SPECIMEN_NOT_PENDING', 'OK']);
      expect((await reqs.findById(r.id))!.state.version).toBe(1);
    });

    it('prélèvement et rejet simultanés : jamais deux échantillons actifs pour les mêmes analyses', async () => {
      const r = await newRequisition([await newTest()]);
      const sp = r.state.specimens[0];
      const [barcode] = await reqs.nextBarcodes(1);
      await Promise.all([
        collect(r),
        reqs.mutate(r.id, (x) => x.reject(sp.id, TECH, LATER, 'CLOTTED', null, { id: must(SpecimenId.create(uuid(8100))), barcode })),
      ]);
      const back = (await reqs.findById(r.id))!;
      const active = back.state.specimens.filter((s) => s.status !== 'REJECTED');
      expect(active).toHaveLength(1);
      expect(back.state.tests[0].specimenId.equals(active[0].id)).toBe(true);
    });
  });

  describe('liste', () => {
    it('met les actives d\'abord (STAT, urgent, routine ; la plus ancienne en tête), puis les terminées', async () => {
      const t = await newTest();
      const routineOld = await newRequisition([t], { priority: 'ROUTINE', orderedAt: NOW.add({ minutes: 1 }) });
      const routineNew = await newRequisition([t], { priority: 'ROUTINE', orderedAt: NOW.add({ minutes: 5 }) });
      const urgent = await newRequisition([t], { priority: 'URGENT', orderedAt: NOW.add({ minutes: 3 }) });
      const stat = await newRequisition([t], { priority: 'STAT', orderedAt: NOW.add({ minutes: 4 }) });
      const cancelled = await newRequisition([t], { priority: 'STAT', orderedAt: NOW.add({ minutes: 2 }) });
      await reqs.mutate(cancelled.id, (x) => x.cancel(must(Reason.create('Erreur')), DOC, LATER));
      const order = (await reqs.list({}, 0, 10)).items.map((i) => i.id);
      expect(order).toEqual([stat, urgent, routineOld, routineNew, cancelled].map((r) => r.id.value));
    });

    it('filtre par statut, priorité, provenance, section, patient, numéro, code-barres et prescripteur ; agrège codes et sections', async () => {
      const hema = await newTest({ code: must(TestCode.create('HGB')) });
      const bio = await newTest({ code: must(TestCode.create('GLU')), section: 'BIOCHEMISTRY', specimenType: 'SERUM', container: 'YELLOW' });
      const one = await newRequisition([hema, bio], { priority: 'STAT', source: 'ER', orderedBy: DOC });
      const two = await newRequisition([hema], { priority: 'ROUTINE', source: 'IPD', orderedBy: uuid(13), patient: f.patient2 });
      await collect(two);
      const ids = async (filter: Parameters<PgRequisitionRepository['list']>[0]) => (await reqs.list(filter, 0, 10)).items.map((i) => i.id);
      expect(await ids({ status: 'ORDERED' })).toEqual([one.id.value]);
      expect(await ids({ status: 'COLLECTED' })).toEqual([two.id.value]);
      expect(await ids({ priority: 'STAT' })).toEqual([one.id.value]);
      expect(await ids({ source: 'IPD' })).toEqual([two.id.value]);
      expect(await ids({ section: 'BIOCHEMISTRY' })).toEqual([one.id.value]);
      expect((await ids({ section: 'HAEMATOLOGY' })).sort()).toEqual([one.id.value, two.id.value].sort());
      expect(await ids({ patientId: must(PatientRef.create(f.patient2)) })).toEqual([two.id.value]);
      expect(await ids({ number: two.state.number })).toEqual([two.id.value]);
      expect(await ids({ barcode: one.state.specimens[1].barcode })).toEqual([one.id.value]);
      expect(await ids({ orderedBy: DOC })).toEqual([one.id.value]);
      const [first] = (await reqs.list({ number: one.state.number }, 0, 10)).items;
      expect(first.testCodes).toEqual(['HGB', 'GLU']);
      expect([...first.sections].sort()).toEqual(['BIOCHEMISTRY', 'HAEMATOLOGY']);
      expect(first.orderedAt.toString()).toBe(NOW.toString());
    });

    it('pagine et compte toutes les pages', async () => {
      const t = await newTest();
      for (let i = 0; i < 5; i++) await newRequisition([t], { orderedAt: NOW.add({ minutes: i }) });
      const page = await reqs.list({}, 3, 10);
      expect(page.items).toHaveLength(2);
      expect(page.total).toBe(5);
    });
  });

  describe('garde-fous de la base', () => {
    it('la traçabilité est en ajout seul : ni modification, ni suppression, ni vidage', async () => {
      const r = await newRequisition([await newTest()]);
      const id = r.state.specimens[0].id.value;
      await expect(sql.query("UPDATE lab_specimen_events SET note = 'x' WHERE specimen_id = $1", [id])).rejects.toThrow(/ajout seul/);
      await expect(sql.query('DELETE FROM lab_specimen_events WHERE specimen_id = $1', [id])).rejects.toThrow(/ajout seul/);
      await expect(sql.query('TRUNCATE lab_specimen_events')).rejects.toThrow(/ajout seul/);
    });

    it('refuse des échantillons incohérents : à prélever mais daté, rejeté sans motif, prélevé sans préleveur, code-barres en double', async () => {
      const r = await newRequisition([await newTest()]);
      const sp = r.state.specimens[0];
      const base = (over: Record<string, string | null>) => {
        seq += 1;
        const c = { barcode: `SPC-${String(9000000 + seq)}`, status: 'PENDING_COLLECTION', collected_at: null, collected_by: null, rejection_reason: null, rejected_at: null, rejected_by: null, ...over };
        return sql.query(
          `INSERT INTO lab_specimens (id, barcode, requisition_id, specimen_type, container, status, collected_at, collected_by, rejection_reason, rejected_at, rejected_by)
           VALUES ($1, $2, $3, 'BLOOD', 'RED', $4, $5::timestamptz, $6, $7, $8::timestamptz, $9)`,
          [uuid(6000 + seq), c.barcode, r.id.value, c.status, c.collected_at, c.collected_by, c.rejection_reason, c.rejected_at, c.rejected_by],
        );
      };
      await expect(base({ collected_at: '2026-11-02T08:00:00Z' })).rejects.toThrow();
      await expect(base({ status: 'REJECTED' })).rejects.toThrow();
      await expect(base({ status: 'COLLECTED' })).rejects.toThrow();
      await expect(base({ barcode: sp.barcode.value })).rejects.toThrow();
      await expect(base({ status: 'REJECTED', rejection_reason: 'OTHER', rejected_at: '2026-11-02T08:00:00Z', rejected_by: TECH })).rejects.toThrow(); // « autre » sans précision
      await base({ status: 'REJECTED', rejection_reason: 'CLOTTED', rejected_at: '2026-11-02T08:00:00Z', rejected_by: TECH });
    });

    it('refuse une demande annulée sans motif, un statut inconnu, et un numéro mal formé', async () => {
      const r = await newRequisition([await newTest()]);
      await expect(sql.query("UPDATE lab_requisitions SET status = 'CANCELLED' WHERE id = $1", [r.id.value])).rejects.toThrow();
      await expect(sql.query("UPDATE lab_requisitions SET status = 'DONE' WHERE id = $1", [r.id.value])).rejects.toThrow();
      await expect(sql.query("UPDATE lab_requisitions SET requisition_number = 'X-1' WHERE id = $1", [r.id.value])).rejects.toThrow();
    });
  });
});

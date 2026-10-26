import { SqlExecutor } from '../../../../database/sql-executor';
import { ReferenceRange, LabTest } from '../../domain/test';
import { TestFilter, TestRepository } from '../../domain/ports';
import { Container, parseContainer, parseRangeSex, parseResultType, parseSection, parseSpecimenType, Section, SpecimenType, TestCode, TestId, TestName } from '../../domain/values';

interface TestRow {
  id: string;
  code: string;
  name: string;
  section: string;
  specimen_type: string;
  container: string;
  result_type: string;
  unit: string | null;
  decimals: number;
  choices: string[];
  tat_minutes: number;
  instructions: string | null;
  active: boolean;
}

interface RangeRow {
  test_id: string;
  sex: string;
  age_min_days: number;
  age_max_days: number | null;
  low: string | number | null;
  high: string | number | null;
  critical_low: string | number | null;
  critical_high: string | number | null;
}

const COLUMNS = 'id, code, name, section, specimen_type, container, result_type, unit, decimals, choices, tat_minutes, instructions, active';
const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

function toTest(row: TestRow, ranges: RangeRow[]): LabTest {
  const what = `Analyse ${row.id}`;
  return LabTest.restore({
    id: need(TestId.create(row.id), what),
    code: need(TestCode.create(row.code), what),
    name: need(TestName.create(row.name), what),
    section: need(parseSection(row.section), what) as Section,
    specimenType: need(parseSpecimenType(row.specimen_type), what) as SpecimenType,
    container: need(parseContainer(row.container), what) as Container,
    resultType: need(parseResultType(row.result_type), what),
    unit: row.unit,
    decimals: row.decimals,
    choices: row.choices ?? [],
    tatMinutes: row.tat_minutes,
    instructions: row.instructions,
    ranges: ranges.map((r): ReferenceRange => ({
      sex: need(parseRangeSex(r.sex), what), ageMinDays: r.age_min_days, ageMaxDays: r.age_max_days, low: num(r.low), high: num(r.high), criticalLow: num(r.critical_low), criticalHigh: num(r.critical_high),
    })),
    active: row.active,
  });
}

async function writeRanges(db: SqlExecutor, test: LabTest): Promise<void> {
  await db.query('DELETE FROM lab_reference_ranges WHERE test_id = $1', [test.id.value]);
  let position = 0;
  for (const r of test.state.ranges) {
    await db.query(
      'INSERT INTO lab_reference_ranges (test_id, position, sex, age_min_days, age_max_days, low, high, critical_low, critical_high) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [test.id.value, position++, r.sex, r.ageMinDays, r.ageMaxDays, r.low, r.high, r.criticalLow, r.criticalHigh],
    );
  }
}

export class PgTestRepository implements TestRepository {
  constructor(private readonly sql: SqlExecutor) {}

  private async hydrate(rows: TestRow[]): Promise<LabTest[]> {
    if (rows.length === 0) return [];
    const ranges = await this.sql.query<RangeRow>(
      'SELECT test_id, sex, age_min_days, age_max_days, low, high, critical_low, critical_high FROM lab_reference_ranges WHERE test_id = ANY($1::uuid[]) ORDER BY test_id, position',
      [rows.map((r) => r.id)],
    );
    return rows.map((row) => toTest(row, ranges.filter((r) => r.test_id === row.id)));
  }

  async findById(id: TestId): Promise<LabTest | null> {
    return (await this.hydrate(await this.sql.query<TestRow>(`SELECT ${COLUMNS} FROM lab_tests WHERE id = $1`, [id.value])))[0] ?? null;
  }

  async findByCode(code: TestCode): Promise<LabTest | null> {
    return (await this.hydrate(await this.sql.query<TestRow>(`SELECT ${COLUMNS} FROM lab_tests WHERE code = $1`, [code.value])))[0] ?? null;
  }

  async findByIds(ids: readonly TestId[]): Promise<LabTest[]> {
    if (ids.length === 0) return [];
    return this.hydrate(await this.sql.query<TestRow>(`SELECT ${COLUMNS} FROM lab_tests WHERE id = ANY($1::uuid[])`, [ids.map((i) => i.value)]));
  }

  async insert(test: LabTest): Promise<boolean> {
    const s = test.state;
    return this.sql.transaction(async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `INSERT INTO lab_tests (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11, $12, $13) ON CONFLICT (code) DO NOTHING RETURNING id`,
        [s.id.value, s.code.value, s.name.value, s.section, s.specimenType, s.container, s.resultType, s.unit, s.decimals, s.choices, s.tatMinutes, s.instructions, s.active],
      );
      if (rows.length !== 1) return false;
      await writeRanges(tx, test);
      return true;
    });
  }

  async update(test: LabTest): Promise<void> {
    const s = test.state;
    await this.sql.transaction(async (tx) => {
      await tx.query(
        `UPDATE lab_tests SET name = $2, section = $3, specimen_type = $4, container = $5, unit = $6, decimals = $7, choices = $8::text[], tat_minutes = $9, instructions = $10, active = $11, updated_at = now()
          WHERE id = $1`,
        [s.id.value, s.name.value, s.section, s.specimenType, s.container, s.unit, s.decimals, s.choices, s.tatMinutes, s.instructions, s.active],
      );
      await writeRanges(tx, test);
    });
  }

  async list(filter: TestFilter, offset: number, limit: number): Promise<{ items: LabTest[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (!filter.includeInactive) where.push('active');
    if (filter.section) where.push(`section = ${arg(filter.section)}`);
    if (filter.search) {
      const p = arg(`%${filter.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      where.push(`(code ILIKE ${p} OR name ILIKE ${p})`);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<TestRow>(`SELECT ${COLUMNS} FROM lab_tests ${condition} ORDER BY section, code, id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`, args);
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM lab_tests ${condition}`, args.slice(0, args.length - 2));
    return { items: await this.hydrate(rows), total: total[0]?.n ?? 0 };
  }
}

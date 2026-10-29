import { SqlExecutor } from '../../../../database/sql-executor';
import { Drug } from '../../domain/drug';
import { DrugFilter, DrugRepository } from '../../domain/ports';
import { DrugCode, DrugId, DrugName, GenericName, Money, parseForm, parseSchedule, parseStorage } from '../../domain/values';

interface DrugRow {
  id: string;
  code: string;
  name: string;
  generic_name: string;
  strength: string | null;
  form: string;
  schedule: string;
  storage: string;
  atc_code: string | null;
  unit: string;
  unit_price: string | number;
  reorder_level: number;
  notes: string | null;
  active: boolean;
}

const COLUMNS = 'id, code, name, generic_name, strength, form, schedule, storage, atc_code, unit, unit_price, reorder_level, notes, active';

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

export function toDrug(row: DrugRow): Drug {
  const what = `Médicament ${row.id}`;
  return Drug.restore({
    id: need(DrugId.create(row.id), what),
    code: need(DrugCode.create(row.code), what),
    name: need(DrugName.create(row.name), what),
    genericName: need(GenericName.create(row.generic_name), what),
    strength: row.strength,
    form: need(parseForm(row.form), what),
    schedule: need(parseSchedule(row.schedule), what),
    storage: need(parseStorage(row.storage), what),
    atcCode: row.atc_code,
    unit: row.unit,
    unitPrice: Money.restore(Number(row.unit_price)),
    reorderLevel: row.reorder_level,
    notes: row.notes,
    active: row.active,
  });
}

export class PgDrugRepository implements DrugRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: DrugId): Promise<Drug | null> {
    const rows = await this.sql.query<DrugRow>(`SELECT ${COLUMNS} FROM pharmacy_drugs WHERE id = $1`, [id.value]);
    return rows[0] ? toDrug(rows[0]) : null;
  }

  async findByCode(code: DrugCode): Promise<Drug | null> {
    const rows = await this.sql.query<DrugRow>(`SELECT ${COLUMNS} FROM pharmacy_drugs WHERE code = $1`, [code.value]);
    return rows[0] ? toDrug(rows[0]) : null;
  }

  async findByIds(ids: readonly DrugId[]): Promise<Drug[]> {
    if (ids.length === 0) return [];
    const rows = await this.sql.query<DrugRow>(`SELECT ${COLUMNS} FROM pharmacy_drugs WHERE id = ANY($1::uuid[])`, [ids.map((i) => i.value)]);
    return rows.map(toDrug);
  }

  async insert(drug: Drug): Promise<boolean> {
    const s = drug.state;
    const rows = await this.sql.query<{ id: string }>(
      `INSERT INTO pharmacy_drugs (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (code) DO NOTHING RETURNING id`,
      [s.id.value, s.code.value, s.name.value, s.genericName.value, s.strength, s.form, s.schedule, s.storage, s.atcCode, s.unit, s.unitPrice.value, s.reorderLevel, s.notes, s.active],
    );
    return rows.length === 1;
  }

  async update(drug: Drug): Promise<void> {
    const s = drug.state;
    await this.sql.query(
      `UPDATE pharmacy_drugs SET name = $2, generic_name = $3, strength = $4, form = $5, schedule = $6, storage = $7, atc_code = $8, unit = $9, unit_price = $10, reorder_level = $11, notes = $12, active = $13, updated_at = now()
        WHERE id = $1`,
      [s.id.value, s.name.value, s.genericName.value, s.strength, s.form, s.schedule, s.storage, s.atcCode, s.unit, s.unitPrice.value, s.reorderLevel, s.notes, s.active],
    );
  }

  async list(filter: DrugFilter, offset: number, limit: number): Promise<{ items: Drug[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (!filter.includeInactive) where.push('active');
    if (filter.form) where.push(`form = ${arg(filter.form)}`);
    if (filter.schedule) where.push(`schedule = ${arg(filter.schedule)}`);
    if (filter.search) {
      const p = arg(`%${filter.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      where.push(`(code ILIKE ${p} OR name ILIKE ${p} OR generic_name ILIKE ${p})`);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM pharmacy_drugs ${condition}`, args);
    const rows = await this.sql.query<DrugRow>(`SELECT ${COLUMNS} FROM pharmacy_drugs ${condition} ORDER BY generic_name, name, code, id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`, args);
    return { items: rows.map(toDrug), total: total[0]?.n ?? 0 };
  }
}

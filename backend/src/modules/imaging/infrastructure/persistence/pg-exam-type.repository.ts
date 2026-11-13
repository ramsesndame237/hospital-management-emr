import { SqlExecutor } from '../../../../database/sql-executor';
import { ExamType } from '../../domain/exam-type';
import { ExamTypeFilter, ExamTypeRepository } from '../../domain/ports';
import { ExamCode, ExamName, ExamTypeId, parseModality } from '../../domain/values';

interface ExamTypeRow {
  id: string;
  code: string;
  name: string;
  modality: string;
  body_part: string | null;
  uses_contrast: boolean;
  duration_minutes: number;
  preparation: string | null;
  active: boolean;
}

const COLUMNS = 'id, code, name, modality, body_part, uses_contrast, duration_minutes, preparation, active';

function need<T>(r: { ok: true; value: T } | { ok: false }, what: string): T {
  if (!r.ok) throw new Error(`${what} corrompu en base`);
  return r.value;
}

function toExamType(row: ExamTypeRow): ExamType {
  const what = `Examen ${row.id}`;
  return ExamType.restore({
    id: need(ExamTypeId.create(row.id), what),
    code: need(ExamCode.create(row.code), what),
    name: need(ExamName.create(row.name), what),
    modality: need(parseModality(row.modality), what),
    bodyPart: row.body_part,
    usesContrast: row.uses_contrast,
    durationMinutes: row.duration_minutes,
    preparation: row.preparation,
    active: row.active,
  });
}

export class PgExamTypeRepository implements ExamTypeRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: ExamTypeId): Promise<ExamType | null> {
    const rows = await this.sql.query<ExamTypeRow>(`SELECT ${COLUMNS} FROM imaging_exam_types WHERE id = $1`, [id.value]);
    return rows[0] ? toExamType(rows[0]) : null;
  }

  async findByCode(code: ExamCode): Promise<ExamType | null> {
    const rows = await this.sql.query<ExamTypeRow>(`SELECT ${COLUMNS} FROM imaging_exam_types WHERE code = $1`, [code.value]);
    return rows[0] ? toExamType(rows[0]) : null;
  }

  async insert(exam: ExamType): Promise<boolean> {
    const s = exam.state;
    const rows = await this.sql.query<{ id: string }>(
      `INSERT INTO imaging_exam_types (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (code) DO NOTHING RETURNING id`,
      [s.id.value, s.code.value, s.name.value, s.modality, s.bodyPart, s.usesContrast, s.durationMinutes, s.preparation, s.active],
    );
    return rows.length === 1;
  }

  async update(exam: ExamType): Promise<void> {
    const s = exam.state;
    await this.sql.query(
      'UPDATE imaging_exam_types SET name = $2, body_part = $3, uses_contrast = $4, duration_minutes = $5, preparation = $6, active = $7, updated_at = now() WHERE id = $1',
      [s.id.value, s.name.value, s.bodyPart, s.usesContrast, s.durationMinutes, s.preparation, s.active],
    );
  }

  async list(filter: ExamTypeFilter, offset: number, limit: number): Promise<{ items: ExamType[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (!filter.includeInactive) where.push('active');
    if (filter.modality) where.push(`modality = ${arg(filter.modality)}`);
    if (filter.search) {
      const p = arg(`%${filter.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      where.push(`(code ILIKE ${p} OR name ILIKE ${p})`);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<ExamTypeRow>(`SELECT ${COLUMNS} FROM imaging_exam_types ${condition} ORDER BY modality, code, id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`, args);
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM imaging_exam_types ${condition}`, args.slice(0, args.length - 2));
    return { items: rows.map(toExamType), total: total[0]?.n ?? 0 };
  }
}

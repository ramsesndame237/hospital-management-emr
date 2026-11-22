import { SqlExecutor } from '../../../../database/sql-executor';
import { CoverageRepository, Payer, PayerFilter, PayerRepository, PatientCoverage } from '../../domain/payer';

interface PayerRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface CoverageRow {
  id: string;
  patient_id: string;
  payer_id: string;
  policy_number: string;
  percent: number;
  valid_from: Date | string;
  valid_until: Date | string | null;
  active: boolean;
}

const toPayer = (r: PayerRow): Payer => ({ id: r.id, code: r.code, name: r.name, active: r.active });

/** Une date SQL (`date`) lue comme `AAAA-MM-JJ`, quel que soit le pilote. */
const day = (value: Date | string): string => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));

const toCoverage = (r: CoverageRow): PatientCoverage => ({
  id: r.id, patientId: r.patient_id, payerId: r.payer_id, policyNumber: r.policy_number, percent: r.percent, validFrom: day(r.valid_from), validUntil: r.valid_until ? day(r.valid_until) : null, active: r.active,
});

export class PgPayerRepository implements PayerRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async insert(payer: Payer): Promise<boolean> {
    const rows = await this.sql.query<{ id: string }>('INSERT INTO billing_payers (id, code, name, active) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING RETURNING id', [payer.id, payer.code, payer.name, payer.active]);
    return rows.length === 1;
  }

  async findById(id: string): Promise<Payer | null> {
    const rows = await this.sql.query<PayerRow>('SELECT id, code, name, active FROM billing_payers WHERE id = $1::uuid', [id]);
    return rows[0] ? toPayer(rows[0]) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Map<string, Payer>> {
    if (ids.length === 0) return new Map();
    const rows = await this.sql.query<PayerRow>('SELECT id, code, name, active FROM billing_payers WHERE id = ANY($1::uuid[])', [ids]);
    return new Map(rows.map((r) => [r.id, toPayer(r)]));
  }

  async update(payer: Payer): Promise<void> {
    await this.sql.query('UPDATE billing_payers SET name = $2, active = $3, updated_at = now() WHERE id = $1', [payer.id, payer.name, payer.active]);
  }

  async list(filter: PayerFilter, offset: number, limit: number): Promise<{ items: Payer[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (!filter.includeInactive) where.push('active');
    if (filter.search) {
      const p = arg(`%${filter.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      where.push(`(code ILIKE ${p} OR name ILIKE ${p})`);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<PayerRow>(`SELECT id, code, name, active FROM billing_payers ${condition} ORDER BY name, id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`, args);
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM billing_payers ${condition}`, args.slice(0, args.length - 2));
    return { items: rows.map(toPayer), total: total[0]?.n ?? 0 };
  }
}

export class PgCoverageRepository implements CoverageRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async insert(c: PatientCoverage, createdBy: string): Promise<void> {
    await this.sql.query(
      'INSERT INTO billing_coverages (id, patient_id, payer_id, policy_number, percent, valid_from, valid_until, active, created_by) VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9)',
      [c.id, c.patientId, c.payerId, c.policyNumber, c.percent, c.validFrom, c.validUntil, c.active, createdBy],
    );
  }

  async findById(id: string): Promise<PatientCoverage | null> {
    const rows = await this.sql.query<CoverageRow>('SELECT id, patient_id, payer_id, policy_number, percent, valid_from, valid_until, active FROM billing_coverages WHERE id = $1::uuid', [id]);
    return rows[0] ? toCoverage(rows[0]) : null;
  }

  async deactivate(id: string): Promise<void> {
    await this.sql.query('UPDATE billing_coverages SET active = false WHERE id = $1', [id]);
  }

  async forPatient(patientId: string): Promise<PatientCoverage[]> {
    const rows = await this.sql.query<CoverageRow>(
      'SELECT id, patient_id, payer_id, policy_number, percent, valid_from, valid_until, active FROM billing_coverages WHERE patient_id = $1::uuid AND active ORDER BY valid_from DESC, id', [patientId],
    );
    return rows.map(toCoverage);
  }
}

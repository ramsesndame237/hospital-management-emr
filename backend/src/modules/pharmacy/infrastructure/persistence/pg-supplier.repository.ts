import { SqlExecutor } from '../../../../database/sql-executor';
import { Supplier } from '../../domain/supplier';
import { SupplierFilter, SupplierRepository } from '../../domain/ports';
import { SupplierCode, SupplierId } from '../../domain/values';
import { need } from './pg-batch';

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms_days: number;
  notes: string | null;
  active: boolean;
}

const COLUMNS = 'id, code, name, contact_name, phone, email, address, payment_terms_days, notes, active';

function toSupplier(row: SupplierRow): Supplier {
  const what = `Fournisseur ${row.id}`;
  return Supplier.restore({
    id: need(SupplierId.create(row.id), what), code: need(SupplierCode.create(row.code), what), name: row.name, contactName: row.contact_name, phone: row.phone, email: row.email, address: row.address,
    paymentTermsDays: row.payment_terms_days, notes: row.notes, active: row.active,
  });
}

export class PgSupplierRepository implements SupplierRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: SupplierId): Promise<Supplier | null> {
    const rows = await this.sql.query<SupplierRow>(`SELECT ${COLUMNS} FROM pharmacy_suppliers WHERE id = $1`, [id.value]);
    return rows[0] ? toSupplier(rows[0]) : null;
  }

  async findByCode(code: SupplierCode): Promise<Supplier | null> {
    const rows = await this.sql.query<SupplierRow>(`SELECT ${COLUMNS} FROM pharmacy_suppliers WHERE code = $1`, [code.value]);
    return rows[0] ? toSupplier(rows[0]) : null;
  }

  async findByIds(ids: readonly SupplierId[]): Promise<Supplier[]> {
    if (ids.length === 0) return [];
    const rows = await this.sql.query<SupplierRow>(`SELECT ${COLUMNS} FROM pharmacy_suppliers WHERE id = ANY($1::uuid[])`, [ids.map((i) => i.value)]);
    return rows.map(toSupplier);
  }

  async insert(supplier: Supplier): Promise<boolean> {
    const s = supplier.state;
    const rows = await this.sql.query<{ id: string }>(
      `INSERT INTO pharmacy_suppliers (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (code) DO NOTHING RETURNING id`,
      [s.id.value, s.code.value, s.name, s.contactName, s.phone, s.email, s.address, s.paymentTermsDays, s.notes, s.active],
    );
    return rows.length === 1;
  }

  async update(supplier: Supplier): Promise<void> {
    const s = supplier.state;
    await this.sql.query(
      'UPDATE pharmacy_suppliers SET name = $2, contact_name = $3, phone = $4, email = $5, address = $6, payment_terms_days = $7, notes = $8, active = $9, updated_at = now() WHERE id = $1',
      [s.id.value, s.name, s.contactName, s.phone, s.email, s.address, s.paymentTermsDays, s.notes, s.active],
    );
  }

  async list(filter: SupplierFilter, offset: number, limit: number): Promise<{ items: Supplier[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (!filter.includeInactive) where.push('active');
    if (filter.search) {
      const p = arg(`%${filter.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      where.push(`(code ILIKE ${p} OR name ILIKE ${p})`);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM pharmacy_suppliers ${condition}`, args);
    const rows = await this.sql.query<SupplierRow>(`SELECT ${COLUMNS} FROM pharmacy_suppliers ${condition} ORDER BY name, code, id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`, args);
    return { items: rows.map(toSupplier), total: total[0]?.n ?? 0 };
  }
}

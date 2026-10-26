import { SqlExecutor } from '../../../../database/sql-executor';
import { BillableItem } from '../../domain/item';
import { ItemFilter, ItemRepository } from '../../domain/ports';
import { Amount, ItemCategory, ItemCode, ItemId, ItemName, parseCategory, ServiceRef } from '../../domain/values';

interface ItemRow {
  id: string;
  code: string;
  name: string;
  category: string;
  unit_price: string | number;
  service_id: string | null;
  active: boolean;
}

const COLUMNS = 'id, code, name, category, unit_price, service_id, active';

function toItem(row: ItemRow): BillableItem {
  const need = <T>(r: { ok: true; value: T } | { ok: false }): T => {
    if (!r.ok) throw new Error(`Acte corrompu en base : ${row.id}`);
    return r.value;
  };
  return BillableItem.restore({
    id: need(ItemId.create(row.id)),
    code: need(ItemCode.create(row.code)),
    name: need(ItemName.create(row.name)),
    category: need(parseCategory(row.category)) as ItemCategory,
    unitPrice: Amount.restore(Number(row.unit_price)),
    serviceId: row.service_id === null ? null : need(ServiceRef.create(row.service_id)),
    active: row.active,
  });
}

export class PgItemRepository implements ItemRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: ItemId): Promise<BillableItem | null> {
    const rows = await this.sql.query<ItemRow>(`SELECT ${COLUMNS} FROM billing_items WHERE id = $1`, [id.value]);
    return rows[0] ? toItem(rows[0]) : null;
  }

  async findByCode(code: ItemCode): Promise<BillableItem | null> {
    const rows = await this.sql.query<ItemRow>(`SELECT ${COLUMNS} FROM billing_items WHERE code = $1`, [code.value]);
    return rows[0] ? toItem(rows[0]) : null;
  }

  async insert(item: BillableItem): Promise<boolean> {
    const s = item.state;
    const rows = await this.sql.query<{ id: string }>(
      `INSERT INTO billing_items (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (code) DO NOTHING RETURNING id`,
      [s.id.value, s.code.value, s.name.value, s.category, s.unitPrice.value, s.serviceId?.value ?? null, s.active],
    );
    return rows.length === 1;
  }

  async update(item: BillableItem): Promise<void> {
    // Le code ne change jamais : les factures y renvoient.
    const s = item.state;
    await this.sql.query(
      'UPDATE billing_items SET name = $2, category = $3, unit_price = $4, service_id = $5, active = $6, updated_at = now() WHERE id = $1',
      [s.id.value, s.name.value, s.category, s.unitPrice.value, s.serviceId?.value ?? null, s.active],
    );
  }

  async list(filter: ItemFilter, offset: number, limit: number): Promise<{ items: BillableItem[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (!filter.includeInactive) where.push('active');
    if (filter.category) where.push(`category = ${arg(filter.category)}`);
    if (filter.serviceId) where.push(`service_id = ${arg(filter.serviceId.value)}`);
    if (filter.search) {
      const like = `%${filter.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const p = arg(like);
      where.push(`(code ILIKE ${p} OR name ILIKE ${p})`);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<ItemRow>(`SELECT ${COLUMNS} FROM billing_items ${condition} ORDER BY code, id OFFSET ${arg(offset)} LIMIT ${arg(limit)}`, args);
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM billing_items ${condition}`, args.slice(0, args.length - 2));
    return { items: rows.map(toItem), total: total[0]?.n ?? 0 };
  }
}

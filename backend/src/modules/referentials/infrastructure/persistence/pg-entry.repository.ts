import { SqlExecutor } from '../../../../database/sql-executor';
import { CatalogEntry } from '../../domain/entities/catalog-entry';
import { EntryFilter, EntryRepository } from '../../domain/ports';
import { CatalogCode, EntryCode, EntryId, SortOrder } from '../../domain/value-objects/codes';
import { LocalizedLabels } from '../../domain/value-objects/localized-labels';

interface EntryRow {
  id: string;
  catalog_code: string;
  code: string;
  labels: Record<string, string>;
  sort_order: number;
  active: boolean;
}

const COLUMNS = 'id, catalog_code, code, labels, sort_order, active';

function toEntry(row: EntryRow): CatalogEntry {
  const id = EntryId.create(row.id);
  const catalogCode = CatalogCode.create(row.catalog_code);
  const code = EntryCode.create(row.code);
  const labels = LocalizedLabels.create(row.labels);
  const sortOrder = SortOrder.create(row.sort_order);
  if (!id.ok || !catalogCode.ok || !code.ok || !labels.ok || !sortOrder.ok) throw new Error(`Entrée de nomenclature corrompue en base : ${row.id}`);
  return CatalogEntry.create({ id: id.value, catalogCode: catalogCode.value, code: code.value, labels: labels.value, sortOrder: sortOrder.value, active: row.active });
}

export class PgEntryRepository implements EntryRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: EntryId): Promise<CatalogEntry | null> {
    const rows = await this.sql.query<EntryRow>(`SELECT ${COLUMNS} FROM referentials_entries WHERE id = $1`, [id.value]);
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async findByCode(catalog: CatalogCode, code: EntryCode): Promise<CatalogEntry | null> {
    const rows = await this.sql.query<EntryRow>(`SELECT ${COLUMNS} FROM referentials_entries WHERE catalog_code = $1 AND code = $2`, [catalog.value, code.value]);
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async save(entry: CatalogEntry): Promise<void> {
    // Le code et le catalogue ne sont jamais mis à jour : ils identifient l'entrée pour les données qui la référencent.
    await this.sql.query(
      `INSERT INTO referentials_entries (${COLUMNS}) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (id) DO UPDATE SET labels = EXCLUDED.labels, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active, updated_at = now()`,
      [entry.id.value, entry.catalogCode.value, entry.code.value, JSON.stringify(entry.labels.toRecord()), entry.sortOrder.value, entry.active],
    );
  }

  async list(catalog: CatalogCode, filter: EntryFilter, offset: number, limit: number): Promise<{ items: CatalogEntry[]; total: number }> {
    const where = ['catalog_code = $1'];
    const params: unknown[] = [catalog.value];
    if (filter.activeOnly) where.push('active');
    if (filter.search) {
      params.push(filter.search);
      // `position` plutôt que `LIKE` : le texte cherché est pris tel quel, sans caractères joker à échapper.
      where.push(`position(lower($${params.length}) in lower(code || ' ' || labels::text)) > 0`);
    }
    const condition = where.join(' AND ');
    const rows = await this.sql.query<EntryRow>(
      `SELECT ${COLUMNS} FROM referentials_entries WHERE ${condition} ORDER BY sort_order, code OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
      [...params, offset, limit],
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM referentials_entries WHERE ${condition}`, params);
    return { items: rows.map(toEntry), total: total[0]?.n ?? 0 };
  }
}

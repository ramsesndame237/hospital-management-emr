import { SqlExecutor } from '../../../../database/sql-executor';
import { Catalog } from '../../domain/entities/catalog';
import { CatalogRepository } from '../../domain/ports';
import { CatalogCode } from '../../domain/value-objects/codes';
import { LocalizedLabels } from '../../domain/value-objects/localized-labels';

interface CatalogRow {
  code: string;
  labels: Record<string, string>;
}

function toCatalog(row: CatalogRow): Catalog {
  const code = CatalogCode.create(row.code);
  const labels = LocalizedLabels.create(row.labels);
  if (!code.ok || !labels.ok) throw new Error(`Catalogue corrompu en base : ${row.code}`);
  return new Catalog(code.value, labels.value);
}

export class PgCatalogRepository implements CatalogRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findByCode(code: CatalogCode): Promise<Catalog | null> {
    const rows = await this.sql.query<CatalogRow>('SELECT code, labels FROM referentials_catalogs WHERE code = $1', [code.value]);
    return rows[0] ? toCatalog(rows[0]) : null;
  }

  async findAll(): Promise<Catalog[]> {
    const rows = await this.sql.query<CatalogRow>('SELECT code, labels FROM referentials_catalogs ORDER BY code');
    return rows.map(toCatalog);
  }

  async countEntries(): Promise<Record<string, { total: number; active: number }>> {
    const rows = await this.sql.query<{ catalog_code: string; total: number; active: number }>(
      `SELECT catalog_code, count(*)::int AS total, (count(*) FILTER (WHERE active))::int AS active
         FROM referentials_entries GROUP BY catalog_code`,
    );
    return Object.fromEntries(rows.map((r) => [r.catalog_code, { total: r.total, active: r.active }]));
  }
}

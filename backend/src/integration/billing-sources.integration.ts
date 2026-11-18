import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR } from '../database/sql-executor';
import type { SqlExecutor } from '../database/sql-executor';
import { BILLING_SOURCES } from '../modules/billing/domain/ports';
import type { BillableLine, BillableSource, SourceDirectory, SourceType } from '../modules/billing/domain/ports';

/**
 * Racine de composition : c'est ici, et seulement ici, que la Facturation apprend ce que le Laboratoire, l'Imagerie et la Pharmacie ont fait. Elle n'en lit
 * que l'identité du patient, un numéro lisible, une date et des CODES avec leurs quantités (aucune donnée clinique : ni résultat, ni compte rendu, ni diagnostic).
 */
interface SourceConfig {
  readonly table: string;
  readonly reference: string;
  readonly at: string;
  /** Ce qui est facturable : pas une demande annulée, pas un examen qui n'a pas eu lieu. */
  readonly billable: string;
}

const CONFIG: Readonly<Record<SourceType, SourceConfig>> = {
  LAB_REQUISITION: { table: 'lab_requisitions', reference: 'requisition_number', at: 'ordered_at', billable: "status <> 'CANCELLED'" },
  IMAGING_ORDER: { table: 'imaging_orders', reference: 'order_number', at: 'performed_at', billable: "status IN ('PERFORMED', 'REPORTED')" },
  DISPENSATION: { table: 'pharmacy_dispensations', reference: 'dispensation_number', at: 'dispensed_at', billable: 'true' },
};

interface SourceRow {
  id: string;
  reference: string;
  patient_id: string;
  at: string | Date;
}

export class SqlSourceDirectory implements SourceDirectory {
  constructor(private readonly sql: SqlExecutor) {}

  async find(type: SourceType, id: string): Promise<BillableSource | null> {
    const c = CONFIG[type];
    const rows = await this.sql.query<SourceRow>(
      `SELECT id, ${c.reference} AS reference, patient_id, ${c.at} AS at FROM ${c.table} WHERE id = $1::uuid AND ${c.billable}`,
      [id],
    );
    return rows[0] ? this.build(type, rows[0]) : null;
  }

  async pending(type: SourceType, offset: number, limit: number): Promise<{ items: BillableSource[]; total: number }> {
    const c = CONFIG[type];
    const notBilled = `NOT EXISTS (
      SELECT 1 FROM billing_invoice_sources s JOIN billing_invoices i ON i.id = s.invoice_id
       WHERE s.source_type = $1 AND s.source_id = t.id AND i.status <> 'CANCELLED')`;
    const rows = await this.sql.query<SourceRow>(
      `SELECT t.id, t.${c.reference} AS reference, t.patient_id, t.${c.at} AS at FROM ${c.table} t
        WHERE ${c.billable.replace(/(status)/, 't.$1')} AND ${notBilled} ORDER BY t.${c.at}, t.id OFFSET $2 LIMIT $3`,
      [type, offset, limit],
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${c.table} t WHERE ${c.billable.replace(/(status)/, 't.$1')} AND ${notBilled}`, [type]);
    const items: BillableSource[] = [];
    for (const row of rows) items.push(await this.build(type, row));
    return { items, total: total[0]?.n ?? 0 };
  }

  private async build(type: SourceType, row: SourceRow): Promise<BillableSource> {
    return {
      type, id: row.id, reference: row.reference, patientId: row.patient_id,
      occurredAt: new Date(row.at).toISOString(),
      lines: await this.lines(type, row.id),
    };
  }

  private async lines(type: SourceType, id: string): Promise<BillableLine[]> {
    if (type === 'LAB_REQUISITION') {
      const rows = await this.sql.query<{ code: string; label: string }>('SELECT test_code AS code, test_name AS label FROM lab_requisition_tests WHERE requisition_id = $1 ORDER BY position', [id]);
      return rows.map((r) => ({ code: r.code, label: r.label, quantity: 1 }));
    }
    if (type === 'IMAGING_ORDER') {
      const rows = await this.sql.query<{ code: string; label: string }>('SELECT exam_code AS code, exam_name AS label FROM imaging_orders WHERE id = $1', [id]);
      return rows.map((r) => ({ code: r.code, label: r.label, quantity: 1 }));
    }
    // Délivrance : les quantités réellement sorties du stock, regroupées par médicament (un médicament peut venir de plusieurs lots).
    const rows = await this.sql.query<{ code: string; label: string; quantity: number }>(
      `SELECT d.code, d.name AS label, sum(l.quantity)::int AS quantity
         FROM pharmacy_dispensation_lines l JOIN pharmacy_drugs d ON d.id = l.drug_id
        WHERE l.dispensation_id = $1 GROUP BY d.code, d.name ORDER BY d.code`,
      [id],
    );
    return rows.map((r) => ({ code: r.code, label: r.label, quantity: r.quantity }));
  }
}

@Module({})
export class BillingSourcesIntegrationModule {
  static register(): DynamicModule {
    return {
      module: BillingSourcesIntegrationModule,
      global: true,
      providers: [{ provide: BILLING_SOURCES, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new SqlSourceDirectory(sql) }],
      exports: [BILLING_SOURCES],
    };
  }
}

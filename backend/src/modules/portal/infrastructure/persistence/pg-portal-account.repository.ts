import { SqlExecutor } from '../../../../database/sql-executor';
import { requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { PortalAccount, PortalAccountRepository } from '../../domain/ports';

interface Row {
  user_id: string;
  patient_id: string;
  linked_by: string;
  linked_at: Date | string;
}

const toAccount = (r: Row): PortalAccount => ({ userId: r.user_id, patientId: r.patient_id, linkedBy: r.linked_by, linkedAt: requiredInstantFromDb(r.linked_at) });

export class PgPortalAccountRepository implements PortalAccountRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findByUser(userId: string): Promise<PortalAccount | null> {
    const rows = await this.sql.query<Row>('SELECT user_id, patient_id, linked_by, linked_at FROM portal_accounts WHERE user_id = $1', [userId]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async findByPatient(patientId: string): Promise<PortalAccount | null> {
    const rows = await this.sql.query<Row>('SELECT user_id, patient_id, linked_by, linked_at FROM portal_accounts WHERE patient_id = $1', [patientId]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async insert(account: PortalAccount): Promise<boolean> {
    const rows = await this.sql.query<{ user_id: string }>(
      'INSERT INTO portal_accounts (user_id, patient_id, linked_by, linked_at) VALUES ($1, $2, $3, $4::timestamptz) ON CONFLICT DO NOTHING RETURNING user_id',
      [account.userId, account.patientId, account.linkedBy, account.linkedAt.toString()],
    );
    return rows.length === 1;
  }
}

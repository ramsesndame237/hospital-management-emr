import { SqlExecutor } from '../../../../database/sql-executor';
import { Organization } from '../../domain/entities/organization';
import { OrganizationRepository } from '../../domain/ports';
import { OrganizationId } from '../../domain/value-objects/organization-id';
import { OrganizationName } from '../../domain/value-objects/organization-name';

interface OrganizationRow {
  id: string;
  name: string;
}

function toOrganization(row: OrganizationRow): Organization {
  const id = OrganizationId.create(row.id);
  const name = OrganizationName.create(row.name);
  if (!id.ok || !name.ok) throw new Error(`Organisation corrompue en base : ${row.id}`);
  const organization = Organization.create(id.value, name.value);
  if (!organization.ok) throw new Error(`Organisation corrompue en base : ${row.id}`);
  return organization.value;
}

export class PgOrganizationRepository implements OrganizationRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async find(): Promise<Organization | null> {
    const rows = await this.sql.query<OrganizationRow>('SELECT id, name FROM administration_organizations LIMIT 1');
    return rows[0] ? toOrganization(rows[0]) : null;
  }

  async save(organization: Organization): Promise<void> {
    await this.sql.query(
      `INSERT INTO administration_organizations (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`,
      [organization.getId().value, organization.getName().value],
    );
  }
}

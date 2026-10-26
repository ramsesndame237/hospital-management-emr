import { SqlExecutor } from '../../../../database/sql-executor';
import { Facility } from '../../domain/entities/facility';
import { FacilityRepository } from '../../domain/ports';
import { FacilityCode } from '../../domain/value-objects/facility-code';
import { FacilityId } from '../../domain/value-objects/facility-id';
import { FacilityName } from '../../domain/value-objects/facility-name';
import { FacilityStatus } from '../../domain/value-objects/FacilityStatus';
import { OrganizationId } from '../../domain/value-objects/organization-id';

interface FacilityRow {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  status: string;
}

const COLUMNS = 'id, organization_id, code, name, status';

function toFacility(row: FacilityRow): Facility {
  const id = FacilityId.create(row.id);
  const organizationId = OrganizationId.create(row.organization_id);
  const code = FacilityCode.create(row.code);
  const name = FacilityName.create(row.name);
  const status = FacilityStatus.create(row.status);
  if (!id.ok || !organizationId.ok || !code.ok || !name.ok || !status.ok) throw new Error(`Établissement corrompu en base : ${row.id}`);
  const facility = Facility.create(name.value, code.value, id.value, organizationId.value, status.value);
  if (!facility.ok) throw new Error(`Établissement corrompu en base : ${row.id}`);
  return facility.value;
}

export class PgFacilityRepository implements FacilityRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: FacilityId): Promise<Facility | null> {
    const rows = await this.sql.query<FacilityRow>(`SELECT ${COLUMNS} FROM administration_facilities WHERE id = $1`, [id.value]);
    return rows[0] ? toFacility(rows[0]) : null;
  }

  async findByCode(code: FacilityCode): Promise<Facility | null> {
    const rows = await this.sql.query<FacilityRow>(`SELECT ${COLUMNS} FROM administration_facilities WHERE code = $1`, [code.value]);
    return rows[0] ? toFacility(rows[0]) : null;
  }

  async save(facility: Facility): Promise<void> {
    await this.sql.query(
      `INSERT INTO administration_facilities (${COLUMNS}) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, status = EXCLUDED.status, updated_at = now()`,
      [facility.getId().value, facility.getOrganizationId().value, facility.getCode().value, facility.getName().value, facility.getStatus().getValue()],
    );
  }

  async list(offset: number, limit: number): Promise<{ items: Facility[]; total: number }> {
    const rows = await this.sql.query<FacilityRow>(
      `SELECT ${COLUMNS} FROM administration_facilities ORDER BY name, id OFFSET $1 LIMIT $2`,
      [offset, limit],
    );
    const total = await this.sql.query<{ n: number }>('SELECT count(*)::int AS n FROM administration_facilities');
    return { items: rows.map(toFacility), total: total[0]?.n ?? 0 };
  }
}

import { SqlExecutor } from '../../../../database/sql-executor';
import { Facility } from '../../domain/entities/facility';
import { FacilityRepository } from '../../domain/ports';
import { FacilityCode } from '../../domain/value-objects/facility-code';
import { FacilityId } from '../../domain/value-objects/facility-id';
import { FacilityName } from '../../domain/value-objects/facility-name';
import { FacilityStatus } from '../../domain/value-objects/FacilityStatus';
import { OrganizationId } from '../../domain/value-objects/organization-id';
import { FacilityLocation } from '../../domain/value-objects/facility-location';

interface FacilityRow {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  status: string;
  country_code: string | null;
  region: string | null;
  commune: string | null;
  street: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
}

const COLUMNS = 'id, organization_id, code, name, status, country_code, region, commune, street, latitude, longitude';

function toFacility(row: FacilityRow): Facility {
  const id = FacilityId.create(row.id);
  const organizationId = OrganizationId.create(row.organization_id);
  const code = FacilityCode.create(row.code);
  const name = FacilityName.create(row.name);
  const status = FacilityStatus.create(row.status);
  if (!id.ok || !organizationId.ok || !code.ok || !name.ok || !status.ok) throw new Error(`Établissement corrompu en base : ${row.id}`);
  const location = row.country_code
    ? FacilityLocation.restore({
        countryCode: row.country_code, region: row.region, commune: row.commune, street: row.street,
        latitude: row.latitude === null ? null : Number(row.latitude), longitude: row.longitude === null ? null : Number(row.longitude),
      })
    : null;
  const facility = Facility.create(name.value, code.value, id.value, organizationId.value, status.value, location);
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

  async codesWithPrefix(prefix: string): Promise<string[]> {
    // Échappement des jokers LIKE : un préfixe ne contient que lettres, chiffres et tirets, mais on ne s'en remet pas à l'appelant.
    const like = `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await this.sql.query<{ code: string }>('SELECT code FROM administration_facilities WHERE code LIKE $1', [like]);
    return rows.map((r) => r.code);
  }

  async save(facility: Facility): Promise<void> {
    await this.sql.query(
      `INSERT INTO administration_facilities (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, status = EXCLUDED.status, country_code = EXCLUDED.country_code, region = EXCLUDED.region,
         commune = EXCLUDED.commune, street = EXCLUDED.street, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = now()`,
      [
        facility.getId().value, facility.getOrganizationId().value, facility.getCode().value, facility.getName().value, facility.getStatus().getValue(),
        facility.getLocation()?.state.countryCode ?? null, facility.getLocation()?.state.region ?? null, facility.getLocation()?.state.commune ?? null,
        facility.getLocation()?.state.street ?? null, facility.getLocation()?.state.latitude ?? null, facility.getLocation()?.state.longitude ?? null,
      ],
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

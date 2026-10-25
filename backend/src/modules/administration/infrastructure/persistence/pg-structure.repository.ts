import { SqlExecutor } from '../../../../database/sql-executor';
import { StructureRepository } from '../../domain/ports';
import { StructureNode } from '../../domain/structure/structure-node';
import { FloorLabel, NodeCode, NodeId, NodeKind, NodeName, parseServiceType, SpecialtyCode } from '../../domain/structure/values';
import { FacilityId } from '../../domain/value-objects/facility-id';

interface NodeRow {
  id: string;
  facility_id: string;
  parent_id: string | null;
  kind: string;
  code: string;
  name: string;
  active: boolean;
  service_type: string | null;
  specialty_code: string | null;
  floor: string | null;
}

const COLUMNS = 'id, facility_id, parent_id, kind, code, name, active, service_type, specialty_code, floor';

function toNode(row: NodeRow): StructureNode {
  const corrupted = () => new Error(`Élément de structure corrompu en base : ${row.id}`);
  const id = NodeId.create(row.id);
  const facilityId = FacilityId.create(row.facility_id);
  const parentId = row.parent_id === null ? null : NodeId.create(row.parent_id);
  const code = NodeCode.create(row.code);
  const name = NodeName.create(row.name);
  const serviceType = row.service_type === null ? null : parseServiceType(row.service_type);
  const specialty = row.specialty_code === null ? null : SpecialtyCode.create(row.specialty_code);
  const floor = row.floor === null ? null : FloorLabel.create(row.floor);
  if (!id.ok || !facilityId.ok || (parentId && !parentId.ok) || !code.ok || !name.ok || (serviceType && !serviceType.ok) || (specialty && !specialty.ok) || (floor && !floor.ok)) {
    throw corrupted();
  }
  if (!(Object.values(NodeKind) as string[]).includes(row.kind)) throw corrupted();
  return StructureNode.restore({
    id: id.value,
    facilityId: facilityId.value,
    parentId: parentId && parentId.ok ? parentId.value : null,
    kind: row.kind as NodeKind,
    code: code.value,
    name: name.value,
    active: row.active,
    serviceType: serviceType && serviceType.ok ? serviceType.value : null,
    specialtyCode: specialty && specialty.ok ? specialty.value : null,
    floor: floor && floor.ok ? floor.value : null,
  });
}

export class PgStructureRepository implements StructureRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: NodeId): Promise<StructureNode | null> {
    const rows = await this.sql.query<NodeRow>(`SELECT ${COLUMNS} FROM administration_structure_nodes WHERE id = $1`, [id.value]);
    return rows[0] ? toNode(rows[0]) : null;
  }

  async findSibling(facilityId: FacilityId, parentId: NodeId | null, code: NodeCode): Promise<StructureNode | null> {
    const rows = await this.sql.query<NodeRow>(
      `SELECT ${COLUMNS} FROM administration_structure_nodes
        WHERE facility_id = $1 AND parent_id IS NOT DISTINCT FROM $2::uuid AND code = $3`,
      [facilityId.value, parentId?.value ?? null, code.value],
    );
    return rows[0] ? toNode(rows[0]) : null;
  }

  async save(node: StructureNode): Promise<void> {
    // Code, niveau, établissement et parent ne sont jamais mis à jour : ils situent l'élément pour les données qui le référencent.
    await this.sql.query(
      `INSERT INTO administration_structure_nodes (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active, service_type = EXCLUDED.service_type,
         specialty_code = EXCLUDED.specialty_code, floor = EXCLUDED.floor, updated_at = now()`,
      [
        node.id.value, node.facilityId.value, node.parentId?.value ?? null, node.kind, node.code.value, node.name.value, node.active,
        node.serviceType, node.specialtyCode?.value ?? null, node.floor?.value ?? null,
      ],
    );
  }

  async listByFacility(facilityId: FacilityId, includeInactive: boolean): Promise<StructureNode[]> {
    const rows = await this.sql.query<NodeRow>(
      `SELECT ${COLUMNS} FROM administration_structure_nodes WHERE facility_id = $1 ${includeInactive ? '' : 'AND active'} ORDER BY code, id`,
      [facilityId.value],
    );
    return rows.map(toNode);
  }

  async hasActiveChildren(id: NodeId): Promise<boolean> {
    const rows = await this.sql.query<{ found: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM administration_structure_nodes WHERE parent_id = $1 AND active) AS found',
      [id.value],
    );
    return rows[0]?.found === true;
  }
}

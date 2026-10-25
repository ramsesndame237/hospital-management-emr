import { SqlExecutor } from '../../../../database/sql-executor';
import { PlainDate, Temporal } from '../../../../shared-kernel/temporal';
import { Assignment } from '../../domain/assignment';
import { AssignmentRepository, StaffSummary } from '../../domain/ports';
import { AssignmentId, FacilityRef, NodeRef, StaffId } from '../../domain/values';

interface AssignmentRow {
  id: string;
  staff_id: string;
  node_id: string;
  facility_id: string;
  start_date: string;
  end_date: string | null;
  is_primary: boolean;
}

// Dates lues en texte (`::text`) : voir `pg-staff.repository.ts`.
const COLUMNS = 'a.id, a.staff_id, a.node_id, a.facility_id, a.start_date::text AS start_date, a.end_date::text AS end_date, a.is_primary';

function toAssignment(row: AssignmentRow): Assignment {
  const id = AssignmentId.create(row.id);
  const staffId = StaffId.create(row.staff_id);
  const nodeId = NodeRef.create(row.node_id);
  const facilityId = FacilityRef.create(row.facility_id);
  if (!id.ok || !staffId.ok || !nodeId.ok || !facilityId.ok) throw new Error(`Affectation corrompue en base : ${row.id}`);
  return Assignment.restore({
    id: id.value, staffId: staffId.value, nodeId: nodeId.value, facilityId: facilityId.value,
    startDate: Temporal.PlainDate.from(row.start_date), endDate: row.end_date === null ? null : Temporal.PlainDate.from(row.end_date), primary: row.is_primary,
  });
}

export class PgAssignmentRepository implements AssignmentRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: AssignmentId): Promise<Assignment | null> {
    const rows = await this.sql.query<AssignmentRow>(`SELECT ${COLUMNS} FROM staff_assignments a WHERE a.id = $1`, [id.value]);
    return rows[0] ? toAssignment(rows[0]) : null;
  }

  async save(assignment: Assignment): Promise<void> {
    // Personne, élément et établissement ne sont jamais mis à jour : une autre affectation se crée, l'historique reste.
    await this.sql.query(
      `INSERT INTO staff_assignments (id, staff_id, node_id, facility_id, start_date, end_date, is_primary)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)
       ON CONFLICT (id) DO UPDATE SET end_date = EXCLUDED.end_date, is_primary = EXCLUDED.is_primary, updated_at = now()`,
      [assignment.id.value, assignment.staffId.value, assignment.nodeId.value, assignment.facilityId.value, assignment.startDate.toString(), assignment.endDate?.toString() ?? null, assignment.primary],
    );
  }

  async listByStaff(staffId: StaffId): Promise<Assignment[]> {
    const rows = await this.sql.query<AssignmentRow>(
      `SELECT ${COLUMNS} FROM staff_assignments a WHERE a.staff_id = $1 ORDER BY a.start_date DESC, a.id`,
      [staffId.value],
    );
    return rows.map(toAssignment);
  }

  async listByNode(nodeId: NodeRef, includeEnded: boolean, today: PlainDate): Promise<{ assignment: Assignment; staff: StaffSummary }[]> {
    const rows = await this.sql.query<AssignmentRow & { staff_number: string; first_name: string; last_name: string; profession_code: string }>(
      `SELECT ${COLUMNS}, s.staff_number, s.first_name, s.last_name, s.profession_code
         FROM staff_assignments a JOIN staff_members s ON s.id = a.staff_id
        WHERE a.node_id = $1 ${includeEnded ? '' : 'AND (a.end_date IS NULL OR a.end_date >= $2::date)'}
        ORDER BY lower(s.last_name), lower(s.first_name), a.start_date DESC, a.id`,
      includeEnded ? [nodeId.value] : [nodeId.value, today.toString()],
    );
    return rows.map((r) => {
      const staffId = StaffId.create(r.staff_id);
      if (!staffId.ok) throw new Error(`Affectation corrompue en base : ${r.id}`);
      return {
        assignment: toAssignment(r),
        staff: { id: staffId.value, staffNumber: r.staff_number, firstName: r.first_name, lastName: r.last_name, professionCode: r.profession_code },
      };
    });
  }
}

import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Calendar, Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../../shared-kernel/temporal';
import { Assignment } from '../../domain/assignment';
import { AssignmentRepository, StaffRepository, StructureDirectory } from '../../domain/ports';
import { AssignmentId, NodeRef, parseDate, StaffId } from '../../domain/values';
import { AssignmentView, NodeAssignmentView, toAssignmentView, toNodeAssignmentView } from '../views';

const STAFF_NOT_FOUND = new DomainError('STAFF_NOT_FOUND', 'Membre du personnel introuvable.');
const ASSIGNMENT_NOT_FOUND = new DomainError('ASSIGNMENT_NOT_FOUND', 'Affectation introuvable.');
const NODE_NOT_FOUND = new DomainError('ASSIGNMENT_NODE_NOT_FOUND', 'Service ou unité introuvable.');
const NODE_KIND = new DomainError('ASSIGNMENT_NODE_KIND_INVALID', "On affecte une personne à un service ou à une unité, pas à une salle ni à un lit.");
const NODE_INACTIVE = new DomainError('ASSIGNMENT_NODE_INACTIVE', 'Ce service ou cette unité est désactivé : on ne peut pas y affecter.');
const OUTSIDE_EMPLOYMENT = new DomainError('ASSIGNMENT_OUTSIDE_EMPLOYMENT', "La période d'affectation sort de la période d'emploi de la personne (embauche, départ).");
const OVERLAPS = new DomainError('ASSIGNMENT_OVERLAPS', 'La personne a déjà une affectation à ce service ou à cette unité sur une partie de cette période.');
const PRIMARY_CONFLICT = new DomainError('ASSIGNMENT_PRIMARY_CONFLICT', "La personne a déjà une affectation principale sur cette période : retirez-lui ce statut ou terminez-la d'abord.");

const cmp = (a: PlainDate, b: PlainDate) => Temporal.PlainDate.compare(a, b);

async function loadAssignment(assignments: AssignmentRepository, rawId: string): Promise<Result<Assignment>> {
  const id = AssignmentId.create(rawId);
  if (!id.ok) return err(ASSIGNMENT_NOT_FOUND);
  const found = await assignments.findById(id.value);
  return found ? ok(found) : err(ASSIGNMENT_NOT_FOUND);
}

export class ListStaffAssignmentsUseCase {
  constructor(private readonly staff: StaffRepository, private readonly assignments: AssignmentRepository, private readonly calendar: Calendar) {}

  async execute(staffId: string): Promise<Result<AssignmentView[]>> {
    const id = StaffId.create(staffId);
    if (!id.ok || !(await this.staff.findById(id.value))) return err(STAFF_NOT_FOUND);
    const today = this.calendar.today();
    return ok((await this.assignments.listByStaff(id.value)).map((a) => toAssignmentView(a, today)));
  }
}

/** Qui travaille dans ce service ou cette unité. Par défaut sans les affectations terminées. */
export class ListNodeAssignmentsUseCase {
  constructor(private readonly structure: StructureDirectory, private readonly assignments: AssignmentRepository, private readonly calendar: Calendar) {}

  async execute(nodeId: string, includeEnded: boolean): Promise<Result<NodeAssignmentView[]>> {
    const node = NodeRef.create(nodeId);
    if (!node.ok || !(await this.structure.describe(node.value))) return err(NODE_NOT_FOUND);
    const today = this.calendar.today();
    const rows = await this.assignments.listByNode(node.value, includeEnded, today);
    return ok(rows.map((r) => toNodeAssignmentView(r.assignment, r.staff, today)));
  }
}

export class ManageAssignmentsUseCases {
  constructor(
    private readonly staff: StaffRepository,
    private readonly assignments: AssignmentRepository,
    private readonly structure: StructureDirectory,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
    private readonly calendar: Calendar,
  ) {}

  /**
   * Affecte une personne à un service ou une unité. Début : aujourd'hui par défaut ; fin : ouverte par défaut.
   * Refusé si l'élément est désactivé, si la période sort de l'emploi de la personne, si elle chevauche une affectation
   * au même endroit, ou si elle serait principale en même temps qu'une autre affectation principale.
   */
  async assign(
    actorId: string,
    staffId: string,
    input: { nodeId: string; startDate?: string; endDate?: string | null; primary?: boolean },
  ): Promise<Result<AssignmentView>> {
    const sid = StaffId.create(staffId);
    if (!sid.ok) return err(STAFF_NOT_FOUND);
    const nodeId = NodeRef.create(input.nodeId);
    if (!nodeId.ok) return err(nodeId.error);
    const start: Result<PlainDate> = input.startDate ? parseDate(input.startDate, 'startDate') : ok(this.calendar.today());
    if (!start.ok) return err(start.error);
    const end = input.endDate ? parseDate(input.endDate, 'endDate') : ok(null);
    if (!end.ok) return err(end.error);

    const member = await this.staff.findById(sid.value);
    if (!member) return err(STAFF_NOT_FOUND);
    // Emploi : embauché au début de la période, et la période s'achève avant le départ (le jour du départ est travaillé).
    if (!member.isEmployedOn(start.value)) return err(OUTSIDE_EMPLOYMENT);
    if (member.departedOn && (end.value === null || cmp(end.value, member.departedOn) > 0)) return err(OUTSIDE_EMPLOYMENT);

    const node = await this.structure.describe(nodeId.value);
    if (!node) return err(NODE_NOT_FOUND);
    if (node.kind !== 'SERVICE' && node.kind !== 'UNIT') return err(NODE_KIND);
    if (!node.active) return err(NODE_INACTIVE);

    const id = AssignmentId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const created = Assignment.create({
      id: id.value, staffId: sid.value, nodeId: nodeId.value, facilityId: node.facilityId, startDate: start.value, endDate: end.value, primary: input.primary === true,
    });
    if (!created.ok) return err(created.error);

    const existing = await this.assignments.listByStaff(sid.value);
    const overlapping = existing.filter((a) => a.overlaps(created.value));
    if (overlapping.some((a) => a.nodeId.equals(nodeId.value))) return err(OVERLAPS);
    if (created.value.primary && overlapping.some((a) => a.primary)) return err(PRIMARY_CONFLICT);

    await this.assignments.save(created.value);
    await this.record(actorId, 'staff.assignment.create', created.value, member.staffNumber.value, {});
    return ok(toAssignmentView(created.value, this.calendar.today()));
  }

  /** Termine l'affectation à la date donnée (aujourd'hui par défaut). Une affectation déjà terminée ne se re-termine pas. */
  async end(actorId: string, assignmentId: string, input: { endDate?: string }): Promise<Result<AssignmentView>> {
    const date: Result<PlainDate> = input.endDate ? parseDate(input.endDate, 'endDate') : ok(this.calendar.today());
    if (!date.ok) return err(date.error);
    const loaded = await loadAssignment(this.assignments, assignmentId);
    if (!loaded.ok) return err(loaded.error);
    const assignment = loaded.value;
    const member = await this.staff.findById(assignment.staffId);
    if (member?.departedOn && cmp(date.value, member.departedOn) > 0) return err(OUTSIDE_EMPLOYMENT);

    const ended = assignment.end(date.value);
    if (!ended.ok) return err(ended.error);
    await this.assignments.save(assignment);
    await this.record(actorId, 'staff.assignment.end', assignment, member?.staffNumber.value, { endDate: date.value.toString() });
    return ok(toAssignmentView(assignment, this.calendar.today()));
  }

  /** Fait de l'affectation la principale de la personne, ou lui retire ce statut. Sans effet si l'état est déjà celui demandé. */
  async setPrimary(actorId: string, assignmentId: string, primary: boolean): Promise<Result<AssignmentView>> {
    const loaded = await loadAssignment(this.assignments, assignmentId);
    if (!loaded.ok) return err(loaded.error);
    const assignment = loaded.value;
    const today = this.calendar.today();
    if (assignment.primary === primary) return ok(toAssignmentView(assignment, today));

    if (primary) {
      const others = (await this.assignments.listByStaff(assignment.staffId)).filter((a) => !a.id.equals(assignment.id));
      if (others.some((a) => a.primary && a.overlaps(assignment))) return err(PRIMARY_CONFLICT);
    }
    assignment.markPrimary(primary);
    await this.assignments.save(assignment);
    const member = await this.staff.findById(assignment.staffId);
    await this.record(actorId, primary ? 'staff.assignment.set-primary' : 'staff.assignment.unset-primary', assignment, member?.staffNumber.value, {});
    return ok(toAssignmentView(assignment, today));
  }

  private record(actorId: string, action: string, a: Assignment, staffNumber: string | undefined, extra: Record<string, string>): Promise<void> {
    return this.audit.record({
      action, outcome: 'SUCCESS', actorId, resourceType: 'staff-assignment', resourceId: a.id.value,
      metadata: {
        ...(staffNumber ? { staffNumber } : {}), staffId: a.staffId.value, nodeId: a.nodeId.value, startDate: a.startDate.toString(),
        endDate: a.endDate?.toString() ?? null, primary: a.primary, ...extra,
      },
      occurredAt: this.clock.now(),
    });
  }
}

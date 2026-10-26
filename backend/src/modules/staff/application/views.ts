import { PlainDate } from '../../../shared-kernel/temporal';
import { Assignment } from '../domain/assignment';
import { StaffSummary } from '../domain/ports';
import { StaffMember } from '../domain/staff-member';

export interface StaffView {
  readonly id: string;
  readonly staffNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly professionCode: string;
  readonly specialtyCode: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly hiredOn: string | null;
  readonly departedOn: string | null;
  /** `ACTIVE` ou `DEPARTED` à la date du jour (un départ prévu dans le futur laisse la personne `ACTIVE`). */
  readonly status: 'ACTIVE' | 'DEPARTED';
  /** Compte de connexion relié, s'il y en a un. */
  readonly userId: string | null;
}

export interface AssignmentView {
  readonly id: string;
  readonly staffId: string;
  readonly nodeId: string;
  readonly facilityId: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly primary: boolean;
  /** Vrai si l'affectation est en cours aujourd'hui (commencée et pas terminée). */
  readonly current: boolean;
}

export interface NodeAssignmentView extends AssignmentView {
  readonly staff: { readonly staffNumber: string; readonly firstName: string; readonly lastName: string; readonly professionCode: string };
}

export const toStaffView = (s: StaffMember, today: PlainDate): StaffView => ({
  id: s.id.value,
  staffNumber: s.staffNumber.value,
  firstName: s.firstName.value,
  lastName: s.lastName.value,
  professionCode: s.professionCode.value,
  specialtyCode: s.specialtyCode?.value ?? null,
  email: s.email?.value ?? null,
  phone: s.phone?.value ?? null,
  hiredOn: s.hiredOn?.toString() ?? null,
  departedOn: s.departedOn?.toString() ?? null,
  status: s.hasDepartedBy(today) ? 'DEPARTED' : 'ACTIVE',
  userId: s.userId?.value ?? null,
});

export const toAssignmentView = (a: Assignment, today: PlainDate): AssignmentView => ({
  id: a.id.value,
  staffId: a.staffId.value,
  nodeId: a.nodeId.value,
  facilityId: a.facilityId.value,
  startDate: a.startDate.toString(),
  endDate: a.endDate?.toString() ?? null,
  primary: a.primary,
  current: a.isCurrentOn(today),
});

export const toNodeAssignmentView = (a: Assignment, staff: StaffSummary, today: PlainDate): NodeAssignmentView => ({
  ...toAssignmentView(a, today),
  staff: { staffNumber: staff.staffNumber, firstName: staff.firstName, lastName: staff.lastName, professionCode: staff.professionCode },
});

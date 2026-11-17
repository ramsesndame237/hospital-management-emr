import { vi } from 'vitest';
import { StaffGateway } from '../staff.gateway';
import { AssignInput, Assignment, ReferenceChoice, RegisterStaffInput, StaffChanges, StaffMember, StaffPage, StaffQuery } from '../staff.models';

export const staffMember = (over: Partial<StaffMember> = {}): StaffMember => ({
  id: 'st-1', staffNumber: 'MAT-0042', firstName: 'Marie', lastName: 'Curie', professionCode: 'DOCTOR', specialtyCode: 'PEDIATRICS',
  email: 'm.curie@hopital.example', phone: null, hiredOn: '2024-09-01', departedOn: null, status: 'ACTIVE', userId: null, ...over,
});

export const assignment = (over: Partial<Assignment> = {}): Assignment => ({
  id: 'as-1', staffId: 'st-1', nodeId: 's-1', facilityId: 'f-1', startDate: '2026-11-01', endDate: null, primary: true, current: true, ...over,
});

export const PROFESSIONS: readonly ReferenceChoice[] = [{ code: 'DOCTOR', label: 'Médecin' }, { code: 'NURSE', label: 'Infirmier' }];
export const SPECIALTIES: readonly ReferenceChoice[] = [{ code: 'PEDIATRICS', label: 'Pédiatrie' }];

/** Double de test : personnel en mémoire, chaque appel est un espion. */
export class FakeStaffGateway extends StaffGateway {
  members: StaffMember[] = [
    staffMember(),
    staffMember({ id: 'st-2', staffNumber: 'MAT-0043', firstName: 'Paul', lastName: 'Martin', professionCode: 'NURSE', specialtyCode: null, userId: 'u-9' }),
  ];
  rows: Assignment[] = [assignment()];

  private find(id: string): StaffMember {
    return this.members.find((m) => m.id === id) ?? staffMember({ id });
  }

  override list = vi.fn<(query: StaffQuery) => Promise<StaffPage>>().mockImplementation((q) =>
    Promise.resolve({ items: this.members.slice(q.offset, q.offset + q.limit), total: this.members.length, offset: q.offset, limit: q.limit }),
  );
  override register = vi.fn<(input: RegisterStaffInput) => Promise<StaffMember>>().mockImplementation((input) =>
    Promise.resolve(staffMember({ id: 'st-new', ...input, specialtyCode: input.specialtyCode ?? null, email: input.email ?? null, phone: input.phone ?? null, hiredOn: input.hiredOn ?? null })),
  );
  override update = vi.fn<(id: string, changes: StaffChanges) => Promise<StaffMember>>().mockImplementation((id, changes) =>
    Promise.resolve({ ...this.find(id), ...changes } as StaffMember),
  );
  override depart = vi.fn<(id: string, departedOn?: string) => Promise<StaffMember>>().mockImplementation((id, departedOn) =>
    Promise.resolve({ ...this.find(id), status: 'DEPARTED', departedOn: departedOn ?? '2026-11-17' } as StaffMember),
  );
  override linkAccount = vi.fn<(id: string, userId: string) => Promise<StaffMember>>().mockImplementation((id, userId) =>
    Promise.resolve({ ...this.find(id), userId }),
  );
  override unlinkAccount = vi.fn<(id: string) => Promise<StaffMember>>().mockImplementation((id) => Promise.resolve({ ...this.find(id), userId: null }));
  override assignments = vi.fn<(id: string) => Promise<readonly Assignment[]>>().mockImplementation(() => Promise.resolve(this.rows));
  override assign = vi.fn<(id: string, input: AssignInput) => Promise<Assignment>>().mockImplementation((id, input) =>
    Promise.resolve(assignment({ id: 'as-new', staffId: id, nodeId: input.nodeId, primary: input.primary ?? false })),
  );
  override endAssignment = vi.fn<(assignmentId: string, endDate?: string) => Promise<Assignment>>().mockImplementation((assignmentId, endDate) =>
    Promise.resolve(assignment({ id: assignmentId, endDate: endDate ?? '2026-11-17', current: false })),
  );
  override professions = vi.fn<() => Promise<readonly ReferenceChoice[]>>().mockResolvedValue(PROFESSIONS);
  override specialties = vi.fn<() => Promise<readonly ReferenceChoice[]>>().mockResolvedValue(SPECIALTIES);
}

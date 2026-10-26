import { DynamicModule, Module } from '@nestjs/common';
import { STRUCTURE_REPOSITORY } from '../modules/administration/domain/ports';
import type { StructureRepository } from '../modules/administration/domain/ports';
import { NodeId } from '../modules/administration/domain/structure/values';
import { DEPARTMENT_DIRECTORY } from '../modules/iam/domain/ports';
import type { DepartmentDirectory } from '../modules/iam/domain/ports';
import { ASSIGNMENT_REPOSITORY, STAFF_REPOSITORY } from '../modules/staff/domain/ports';
import type { AssignmentRepository, StaffRepository } from '../modules/staff/domain/ports';
import { UserRef } from '../modules/staff/domain/values';
import { CALENDAR } from '../shared-kernel/ports';
import type { Calendar } from '../shared-kernel/ports';

/**
 * Racine de composition : c'est ici, et seulement ici, que les droits « par service » de l'IAM sont reliés à l'organisation
 * du personnel. L'IAM ne sait pas ce qu'est une affectation ; le module Personnel ne sait pas ce qu'est une portée.
 *
 * Les services d'un compte sont ceux des affectations EN COURS aujourd'hui de la fiche du personnel qui lui est reliée :
 * une affectation affecte à un service ou à une unité, et une unité compte pour le service qui la contient. Un compte sans
 * fiche reliée, ou dont la fiche est partie, n'a aucun service.
 */
export class StaffDepartmentDirectory implements DepartmentDirectory {
  constructor(
    private readonly staff: StaffRepository,
    private readonly assignments: AssignmentRepository,
    private readonly structure: StructureRepository,
    private readonly calendar: Calendar,
  ) {}

  async departmentsOf(userId: string): Promise<readonly string[]> {
    const user = UserRef.create(userId);
    if (!user.ok) return [];
    const member = await this.staff.findByUserId(user.value);
    const today = this.calendar.today();
    if (!member || member.hasDepartedBy(today)) return [];

    const services = new Set<string>();
    for (const assignment of await this.assignments.listByStaff(member.id)) {
      if (!assignment.isCurrentOn(today)) continue;
      const nodeId = NodeId.create(assignment.nodeId.value);
      const node = nodeId.ok ? await this.structure.findById(nodeId.value) : null;
      if (!node?.active) continue; // un service ou une unité désactivé ne confère plus de droits
      const service = node.kind === 'SERVICE' ? node.id : node.parentId;
      if (service && node.kind !== 'ROOM' && node.kind !== 'BED') services.add(service.value);
    }
    return [...services];
  }
}

@Module({})
export class AuthorizationIntegrationModule {
  static register(): DynamicModule {
    return {
      module: AuthorizationIntegrationModule,
      // Global : l'IAM y trouve son annuaire de services sans importer (ni connaître) le module Personnel.
      global: true,
      providers: [
        {
          provide: DEPARTMENT_DIRECTORY,
          inject: [STAFF_REPOSITORY, ASSIGNMENT_REPOSITORY, STRUCTURE_REPOSITORY, CALENDAR],
          useFactory: (s: StaffRepository, a: AssignmentRepository, st: StructureRepository, c: Calendar) => new StaffDepartmentDirectory(s, a, st, c),
        },
      ],
      exports: [DEPARTMENT_DIRECTORY],
    };
  }
}

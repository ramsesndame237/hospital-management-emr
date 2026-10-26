import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CALENDAR, Calendar, CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { ListNodeAssignmentsUseCase, ListStaffAssignmentsUseCase, ManageAssignmentsUseCases } from './application/use-cases/assignments';
import { GetMyStaffProfileUseCase, GetStaffUseCase, ListStaffUseCase, ManageStaffUseCases, RegisterStaffUseCase } from './application/use-cases/staff';
import {
  ASSIGNMENT_REPOSITORY, AssignmentRepository, REFERENCE_CODES, ReferenceCodes, STAFF_REPOSITORY, StaffRepository, STRUCTURE_DIRECTORY, StructureDirectory,
  USER_DIRECTORY, UserDirectory,
} from './domain/ports';
import { PgAssignmentRepository } from './infrastructure/persistence/pg-assignment.repository';
import { PgStaffRepository } from './infrastructure/persistence/pg-staff.repository';
import { AssignmentsController } from './presentation/assignments.controller';
import { StaffController } from './presentation/staff.controller';

/**
 * Module Personnel : fiches et affectations. Les ports du domaine sont reliés à PostgreSQL ici ; ses annuaires (structure,
 * comptes, nomenclatures) sont branchés sur les autres modules par la racine de composition (`src/integration`).
 * L'accès est contrôlé par les gardes globaux de l'IAM (`@RequirePermissions` sur chaque point d'entrée).
 */
@Module({})
export class StaffModule {
  static register(): DynamicModule {
    return {
      module: StaffModule,
      // Global : la racine de composition (`src/integration`) en consomme les dépôts sans réimporter (ni dupliquer) le module.
      global: true,
      controllers: [StaffController, AssignmentsController],
      providers: [
        { provide: STAFF_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgStaffRepository(sql) },
        { provide: ASSIGNMENT_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgAssignmentRepository(sql) },

        { provide: GetStaffUseCase, inject: [STAFF_REPOSITORY, CALENDAR], useFactory: (s: StaffRepository, c: Calendar) => new GetStaffUseCase(s, c) },
        { provide: ListStaffUseCase, inject: [STAFF_REPOSITORY, CALENDAR], useFactory: (s: StaffRepository, c: Calendar) => new ListStaffUseCase(s, c) },
        {
          provide: GetMyStaffProfileUseCase,
          inject: [STAFF_REPOSITORY, ASSIGNMENT_REPOSITORY, CALENDAR],
          useFactory: (s: StaffRepository, a: AssignmentRepository, c: Calendar) => new GetMyStaffProfileUseCase(s, a, c),
        },
        {
          provide: RegisterStaffUseCase,
          inject: [STAFF_REPOSITORY, REFERENCE_CODES, ID_GENERATOR, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (s: StaffRepository, r: ReferenceCodes, ids: IdGenerator, a: AuditLog, clock: Clock, cal: Calendar) => new RegisterStaffUseCase(s, r, ids, a, clock, cal),
        },
        {
          provide: ManageStaffUseCases,
          inject: [STAFF_REPOSITORY, ASSIGNMENT_REPOSITORY, REFERENCE_CODES, USER_DIRECTORY, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (s: StaffRepository, a: AssignmentRepository, r: ReferenceCodes, u: UserDirectory, audit: AuditLog, clock: Clock, cal: Calendar) =>
            new ManageStaffUseCases(s, a, r, u, audit, clock, cal),
        },
        {
          provide: ListStaffAssignmentsUseCase,
          inject: [STAFF_REPOSITORY, ASSIGNMENT_REPOSITORY, CALENDAR],
          useFactory: (s: StaffRepository, a: AssignmentRepository, c: Calendar) => new ListStaffAssignmentsUseCase(s, a, c),
        },
        {
          provide: ListNodeAssignmentsUseCase,
          inject: [STRUCTURE_DIRECTORY, ASSIGNMENT_REPOSITORY, CALENDAR],
          useFactory: (d: StructureDirectory, a: AssignmentRepository, c: Calendar) => new ListNodeAssignmentsUseCase(d, a, c),
        },
        {
          provide: ManageAssignmentsUseCases,
          inject: [STAFF_REPOSITORY, ASSIGNMENT_REPOSITORY, STRUCTURE_DIRECTORY, ID_GENERATOR, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (s: StaffRepository, a: AssignmentRepository, d: StructureDirectory, ids: IdGenerator, audit: AuditLog, clock: Clock, cal: Calendar) =>
            new ManageAssignmentsUseCases(s, a, d, ids, audit, clock, cal),
        },
      ],
      exports: [STAFF_REPOSITORY, ASSIGNMENT_REPOSITORY],
    };
  }
}

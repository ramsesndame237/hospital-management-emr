import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { SERVICE_ACCESS, ServiceAccess } from '../../shared-kernel/service-access';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { CatalogDependencies, CreateTestUseCase, GetTestUseCase, ListTestsUseCase, ManageTestUseCases } from './application/use-cases/catalog';
import {
  CancelRequisitionUseCase, FindBySpecimenUseCase, GetRequisitionUseCase, ListRequisitionsUseCase, OrderRequisitionUseCase, RequisitionDependencies, SpecimenUseCases,
} from './application/use-cases/requisitions';
import {
  LAB_PATIENTS, LAB_USERS, PatientDirectory, REQUISITION_REPOSITORY, RequisitionRepository, TEST_REPOSITORY, TestRepository, UserDirectory,
} from './domain/ports';
import { PgRequisitionRepository } from './infrastructure/persistence/pg-requisition.repository';
import { PgTestRepository } from './infrastructure/persistence/pg-test.repository';
import { LabRequisitionsController } from './presentation/requisitions.controller';
import { LabTestsController } from './presentation/tests.controller';

const CATALOG_DEPENDENCIES = Symbol('LAB_CATALOG_DEPENDENCIES');
const REQUISITION_DEPENDENCIES = Symbol('LAB_REQUISITION_DEPENDENCIES');

/**
 * Module Laboratoire. Les ports de persistance sont reliés à PostgreSQL ici ; les patients et les comptes sont fournis par la racine de
 * composition (`src/integration`). L'accès est contrôlé par les gardes globaux de l'IAM (`@RequirePermissions`).
 */
@Module({})
export class LabModule {
  static register(): DynamicModule {
    return {
      module: LabModule,
      controllers: [LabTestsController, LabRequisitionsController],
      providers: [
        { provide: TEST_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgTestRepository(sql) },
        { provide: REQUISITION_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgRequisitionRepository(sql) },
        {
          provide: CATALOG_DEPENDENCIES,
          inject: [TEST_REPOSITORY, AUDIT_LOG, CLOCK],
          useFactory: (tests: TestRepository, audit: AuditLog, clock: Clock): CatalogDependencies => ({ tests, audit, clock }),
        },
        {
          provide: REQUISITION_DEPENDENCIES,
          inject: [REQUISITION_REPOSITORY, TEST_REPOSITORY, LAB_PATIENTS, LAB_USERS, SERVICE_ACCESS, AUDIT_LOG, CLOCK],
          useFactory: (requisitions: RequisitionRepository, tests: TestRepository, patients: PatientDirectory, users: UserDirectory, access: ServiceAccess, audit: AuditLog, clock: Clock): RequisitionDependencies => ({
            requisitions, tests, patients, users, access, audit, clock,
          }),
        },
        { provide: CreateTestUseCase, inject: [CATALOG_DEPENDENCIES, ID_GENERATOR], useFactory: (d: CatalogDependencies, ids: IdGenerator) => new CreateTestUseCase(d, ids) },
        { provide: ManageTestUseCases, inject: [CATALOG_DEPENDENCIES], useFactory: (d: CatalogDependencies) => new ManageTestUseCases(d) },
        { provide: GetTestUseCase, inject: [CATALOG_DEPENDENCIES], useFactory: (d: CatalogDependencies) => new GetTestUseCase(d) },
        { provide: ListTestsUseCase, inject: [CATALOG_DEPENDENCIES], useFactory: (d: CatalogDependencies) => new ListTestsUseCase(d) },
        { provide: OrderRequisitionUseCase, inject: [REQUISITION_DEPENDENCIES, ID_GENERATOR], useFactory: (d: RequisitionDependencies, ids: IdGenerator) => new OrderRequisitionUseCase(d, ids) },
        { provide: GetRequisitionUseCase, inject: [REQUISITION_DEPENDENCIES], useFactory: (d: RequisitionDependencies) => new GetRequisitionUseCase(d) },
        { provide: ListRequisitionsUseCase, inject: [REQUISITION_DEPENDENCIES], useFactory: (d: RequisitionDependencies) => new ListRequisitionsUseCase(d) },
        { provide: CancelRequisitionUseCase, inject: [REQUISITION_DEPENDENCIES], useFactory: (d: RequisitionDependencies) => new CancelRequisitionUseCase(d) },
        { provide: FindBySpecimenUseCase, inject: [REQUISITION_DEPENDENCIES], useFactory: (d: RequisitionDependencies) => new FindBySpecimenUseCase(d) },
        { provide: SpecimenUseCases, inject: [REQUISITION_DEPENDENCIES, ID_GENERATOR], useFactory: (d: RequisitionDependencies, ids: IdGenerator) => new SpecimenUseCases(d, ids) },
      ],
    };
  }
}

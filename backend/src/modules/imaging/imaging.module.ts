import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { SERVICE_ACCESS, ServiceAccess } from '../../shared-kernel/service-access';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { CatalogDependencies, CreateExamTypeUseCase, GetExamTypeUseCase, ListExamTypesUseCase, ManageExamTypeUseCases } from './application/use-cases/catalog';
import { GetOrderUseCase, ListOrdersUseCase, OrderActionUseCases, OrderDependencies, OrderImagingUseCase } from './application/use-cases/orders';
import { ReportUseCases } from './application/use-cases/reports';
import {
  EncounterDirectory, EXAM_TYPE_REPOSITORY, ExamTypeRepository, IMAGING_ENCOUNTERS, IMAGING_PATIENTS, IMAGING_USERS, ORDER_REPOSITORY, OrderRepository, PatientDirectory, UserDirectory,
} from './domain/ports';
import { PgExamTypeRepository } from './infrastructure/persistence/pg-exam-type.repository';
import { PgOrderRepository } from './infrastructure/persistence/pg-order.repository';
import { ImagingExamTypesController } from './presentation/exam-types.controller';
import { ImagingOrdersController } from './presentation/orders.controller';

const CATALOG_DEPENDENCIES = Symbol('IMAGING_CATALOG_DEPENDENCIES');
const ORDER_DEPENDENCIES = Symbol('IMAGING_ORDER_DEPENDENCIES');

/**
 * Module Imagerie. Les ports de persistance sont reliés à PostgreSQL ici ; les patients, les comptes et les consultations sont fournis par la
 * racine de composition (`src/integration`). L'accès est contrôlé par les gardes globaux de l'IAM (`@RequirePermissions`).
 */
@Module({})
export class ImagingModule {
  static register(): DynamicModule {
    return {
      module: ImagingModule,
      controllers: [ImagingExamTypesController, ImagingOrdersController],
      providers: [
        { provide: EXAM_TYPE_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgExamTypeRepository(sql) },
        { provide: ORDER_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgOrderRepository(sql) },
        {
          provide: CATALOG_DEPENDENCIES,
          inject: [EXAM_TYPE_REPOSITORY, AUDIT_LOG, CLOCK],
          useFactory: (exams: ExamTypeRepository, audit: AuditLog, clock: Clock): CatalogDependencies => ({ exams, audit, clock }),
        },
        {
          provide: ORDER_DEPENDENCIES,
          inject: [ORDER_REPOSITORY, EXAM_TYPE_REPOSITORY, IMAGING_PATIENTS, IMAGING_ENCOUNTERS, IMAGING_USERS, SERVICE_ACCESS, AUDIT_LOG, CLOCK],
          useFactory: (orders: OrderRepository, exams: ExamTypeRepository, patients: PatientDirectory, encounters: EncounterDirectory, users: UserDirectory, access: ServiceAccess, audit: AuditLog, clock: Clock): OrderDependencies => ({
            orders, exams, patients, encounters, users, access, audit, clock,
          }),
        },
        { provide: CreateExamTypeUseCase, inject: [CATALOG_DEPENDENCIES, ID_GENERATOR], useFactory: (d: CatalogDependencies, ids: IdGenerator) => new CreateExamTypeUseCase(d, ids) },
        { provide: ManageExamTypeUseCases, inject: [CATALOG_DEPENDENCIES], useFactory: (d: CatalogDependencies) => new ManageExamTypeUseCases(d) },
        { provide: GetExamTypeUseCase, inject: [CATALOG_DEPENDENCIES], useFactory: (d: CatalogDependencies) => new GetExamTypeUseCase(d) },
        { provide: ListExamTypesUseCase, inject: [CATALOG_DEPENDENCIES], useFactory: (d: CatalogDependencies) => new ListExamTypesUseCase(d) },
        { provide: OrderImagingUseCase, inject: [ORDER_DEPENDENCIES, ID_GENERATOR], useFactory: (d: OrderDependencies, ids: IdGenerator) => new OrderImagingUseCase(d, ids) },
        { provide: GetOrderUseCase, inject: [ORDER_DEPENDENCIES], useFactory: (d: OrderDependencies) => new GetOrderUseCase(d) },
        { provide: ListOrdersUseCase, inject: [ORDER_DEPENDENCIES], useFactory: (d: OrderDependencies) => new ListOrdersUseCase(d) },
        { provide: OrderActionUseCases, inject: [ORDER_DEPENDENCIES], useFactory: (d: OrderDependencies) => new OrderActionUseCases(d) },
        { provide: ReportUseCases, inject: [ORDER_DEPENDENCIES], useFactory: (d: OrderDependencies) => new ReportUseCases(d) },
      ],
    };
  }
}

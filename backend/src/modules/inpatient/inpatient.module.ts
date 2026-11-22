import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { SERVICE_ACCESS, ServiceAccess } from '../../shared-kernel/service-access';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { AddNoteUseCase, GetChartUseCase, InpatientDependencies, ListWardUseCase, RecordAdministrationUseCase, RecordObservationUseCase } from './application/use-cases/chart';
import {
  CHART_REPOSITORY, ChartRepository, INPATIENT_MEDICATIONS, INPATIENT_PATIENTS, INPATIENT_STAYS, INPATIENT_USERS, MedicationDirectory, PatientDirectory, StayDirectory, UserDirectory,
} from './domain/ports';
import { PgChartRepository } from './infrastructure/persistence/pg-chart.repository';
import { InpatientChartController } from './presentation/chart.controller';

const DEPENDENCIES = Symbol('INPATIENT_DEPENDENCIES');

/**
 * Module Hospitalisation (soins). Il ne possède que les relevés, les administrations et les notes ; les séjours, les patients, les comptes et les ordonnances
 * sont lus par des ports que la racine de composition (`src/integration/inpatient.integration.ts`) branche sur les autres modules.
 */
@Module({})
export class InpatientModule {
  static register(): DynamicModule {
    return {
      module: InpatientModule,
      controllers: [InpatientChartController],
      providers: [
        { provide: CHART_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgChartRepository(sql) },
        {
          provide: DEPENDENCIES,
          inject: [CHART_REPOSITORY, INPATIENT_STAYS, INPATIENT_PATIENTS, INPATIENT_USERS, INPATIENT_MEDICATIONS, SERVICE_ACCESS, AUDIT_LOG, CLOCK],
          useFactory: (
            chart: ChartRepository, stays: StayDirectory, patients: PatientDirectory, users: UserDirectory, medications: MedicationDirectory, access: ServiceAccess, audit: AuditLog, clock: Clock,
          ): InpatientDependencies => ({ chart, stays, patients, users, medications, access, audit, clock }),
        },
        { provide: ListWardUseCase, inject: [DEPENDENCIES], useFactory: (d: InpatientDependencies) => new ListWardUseCase(d) },
        { provide: GetChartUseCase, inject: [DEPENDENCIES], useFactory: (d: InpatientDependencies) => new GetChartUseCase(d) },
        { provide: RecordObservationUseCase, inject: [DEPENDENCIES, ID_GENERATOR], useFactory: (d: InpatientDependencies, ids: IdGenerator) => new RecordObservationUseCase(d, ids) },
        { provide: RecordAdministrationUseCase, inject: [DEPENDENCIES, ID_GENERATOR], useFactory: (d: InpatientDependencies, ids: IdGenerator) => new RecordAdministrationUseCase(d, ids) },
        { provide: AddNoteUseCase, inject: [DEPENDENCIES, ID_GENERATOR], useFactory: (d: InpatientDependencies, ids: IdGenerator) => new AddNoteUseCase(d, ids) },
      ],
    };
  }
}

import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CALENDAR, Calendar, CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import {
  CheckDuplicatesUseCase, GetPatientHistoryUseCase, GetPatientUseCase, RecordPatientDeathUseCase, RegisterPatientUseCase, SearchPatientsUseCase, UpdatePatientUseCase,
} from './application/use-cases/patients';
import { PATIENT_REPOSITORY, PatientRepository } from './domain/ports';
import { PgPatientRepository } from './infrastructure/persistence/pg-patient.repository';
import { PatientsController } from './presentation/patients.controller';

/**
 * Module Patients : identité et dossier administratif. Le port du domaine est relié à PostgreSQL ici, et seulement ici.
 * L'accès est contrôlé par les gardes globaux de l'IAM (`@RequirePermissions` sur chaque point d'entrée).
 */
@Module({})
export class PatientsModule {
  static register(): DynamicModule {
    return {
      module: PatientsModule,
      controllers: [PatientsController],
      providers: [
        { provide: PATIENT_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgPatientRepository(sql) },
        {
          provide: RegisterPatientUseCase,
          inject: [PATIENT_REPOSITORY, ID_GENERATOR, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (p: PatientRepository, ids: IdGenerator, a: AuditLog, c: Clock, cal: Calendar) => new RegisterPatientUseCase(p, ids, a, c, cal),
        },
        {
          provide: UpdatePatientUseCase,
          inject: [PATIENT_REPOSITORY, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (p: PatientRepository, a: AuditLog, c: Clock, cal: Calendar) => new UpdatePatientUseCase(p, a, c, cal),
        },
        {
          provide: RecordPatientDeathUseCase,
          inject: [PATIENT_REPOSITORY, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (p: PatientRepository, a: AuditLog, c: Clock, cal: Calendar) => new RecordPatientDeathUseCase(p, a, c, cal),
        },
        {
          provide: GetPatientUseCase,
          inject: [PATIENT_REPOSITORY, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (p: PatientRepository, a: AuditLog, c: Clock, cal: Calendar) => new GetPatientUseCase(p, a, c, cal),
        },
        {
          provide: SearchPatientsUseCase,
          inject: [PATIENT_REPOSITORY, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (p: PatientRepository, a: AuditLog, c: Clock, cal: Calendar) => new SearchPatientsUseCase(p, a, c, cal),
        },
        {
          provide: CheckDuplicatesUseCase,
          inject: [PATIENT_REPOSITORY, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (p: PatientRepository, a: AuditLog, c: Clock, cal: Calendar) => new CheckDuplicatesUseCase(p, a, c, cal),
        },
        {
          provide: GetPatientHistoryUseCase,
          inject: [PATIENT_REPOSITORY, AUDIT_LOG, CLOCK],
          useFactory: (p: PatientRepository, a: AuditLog, c: Clock) => new GetPatientHistoryUseCase(p, a, c),
        },
      ],
    };
  }
}

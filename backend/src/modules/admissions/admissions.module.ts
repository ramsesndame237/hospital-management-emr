import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CALENDAR, Calendar, CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { SERVICE_ACCESS, ServiceAccess } from '../../shared-kernel/service-access';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import {
  Dependencies, GetAdmissionUseCase, GetOccupancyUseCase, ListAdmissionsUseCase, ManageAdmissionUseCases, OpenAdmissionUseCase,
} from './application/use-cases/admissions';
import {
  ADMISSION_APPOINTMENTS, ADMISSION_PATIENTS, ADMISSION_PRACTITIONERS, ADMISSION_REASONS, ADMISSION_REPOSITORY, ADMISSION_STRUCTURE, AdmissionRepository, AppointmentDirectory,
  PatientDirectory, PractitionerDirectory, StructureDirectory, VisitReasons,
} from './domain/ports';
import { PgAdmissionRepository } from './infrastructure/persistence/pg-admission.repository';
import { AdmissionsController } from './presentation/admissions.controller';

const DEPENDENCIES = Symbol('ADMISSION_DEPENDENCIES');

/**
 * Module Admissions. Le port de persistance est relié à PostgreSQL ici ; patients, personnel, structure, rendez-vous, nomenclatures et
 * droits par service sont branchés sur les autres modules par la racine de composition (`src/integration`). L'accès est contrôlé par
 * les gardes globaux de l'IAM (`@RequirePermissions`) puis, par admission, par le périmètre « service » de l'utilisateur.
 */
@Module({})
export class AdmissionsModule {
  static register(): DynamicModule {
    return {
      module: AdmissionsModule,
      controllers: [AdmissionsController],
      providers: [
        { provide: ADMISSION_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgAdmissionRepository(sql) },
        {
          provide: DEPENDENCIES,
          inject: [ADMISSION_REPOSITORY, ADMISSION_PATIENTS, ADMISSION_PRACTITIONERS, ADMISSION_STRUCTURE, ADMISSION_APPOINTMENTS, ADMISSION_REASONS, SERVICE_ACCESS, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (
            admissions: AdmissionRepository, patients: PatientDirectory, practitioners: PractitionerDirectory, structure: StructureDirectory, appointments: AppointmentDirectory,
            reasons: VisitReasons, access: ServiceAccess, audit: AuditLog, clock: Clock, calendar: Calendar,
          ): Dependencies => ({ admissions, patients, practitioners, structure, appointments, reasons, access, audit, clock, calendar }),
        },
        { provide: OpenAdmissionUseCase, inject: [DEPENDENCIES, ID_GENERATOR], useFactory: (d: Dependencies, ids: IdGenerator) => new OpenAdmissionUseCase(d, ids) },
        { provide: ManageAdmissionUseCases, inject: [DEPENDENCIES], useFactory: (d: Dependencies) => new ManageAdmissionUseCases(d) },
        { provide: GetAdmissionUseCase, inject: [DEPENDENCIES], useFactory: (d: Dependencies) => new GetAdmissionUseCase(d) },
        { provide: ListAdmissionsUseCase, inject: [DEPENDENCIES], useFactory: (d: Dependencies) => new ListAdmissionsUseCase(d) },
        { provide: GetOccupancyUseCase, inject: [DEPENDENCIES], useFactory: (d: Dependencies) => new GetOccupancyUseCase(d) },
      ],
    };
  }
}

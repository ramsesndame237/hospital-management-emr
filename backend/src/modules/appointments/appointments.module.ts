import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CALENDAR, Calendar, CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { SERVICE_ACCESS, ServiceAccess } from '../../shared-kernel/service-access';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import {
  ArriveAppointmentUseCase, Dependencies, GetAppointmentUseCase, ListAppointmentsUseCase, ManageAppointmentUseCases, ScheduleAppointmentUseCase,
} from './application/use-cases/appointments';
import {
  APPOINTMENT_LOCATIONS, APPOINTMENT_PATIENTS, APPOINTMENT_PRACTITIONERS, APPOINTMENT_REASONS, APPOINTMENT_REPOSITORY, AppointmentRepository, LocationDirectory,
  PatientDirectory, PractitionerDirectory, VisitReasons,
} from './domain/ports';
import { PgAppointmentRepository } from './infrastructure/persistence/pg-appointment.repository';
import { AppointmentsController } from './presentation/appointments.controller';

const DEPENDENCIES = Symbol('APPOINTMENT_DEPENDENCIES');

/**
 * Module Rendez-vous. Le port de persistance est relié à PostgreSQL ici ; patients, personnel, structure, nomenclatures et droits par
 * service sont branchés sur les autres modules par la racine de composition (`src/integration`). L'accès est contrôlé par les
 * gardes globaux de l'IAM (`@RequirePermissions`) puis, par rendez-vous, par le périmètre « service » de l'utilisateur.
 */
@Module({})
export class AppointmentsModule {
  static register(): DynamicModule {
    return {
      module: AppointmentsModule,
      controllers: [AppointmentsController],
      // Global : la racine de composition en consomme le cas d'usage « le patient s'est présenté » pour relier les admissions.
      global: true,
      providers: [
        { provide: APPOINTMENT_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgAppointmentRepository(sql) },
        {
          provide: DEPENDENCIES,
          inject: [APPOINTMENT_REPOSITORY, APPOINTMENT_PATIENTS, APPOINTMENT_PRACTITIONERS, APPOINTMENT_LOCATIONS, APPOINTMENT_REASONS, SERVICE_ACCESS, AUDIT_LOG, CLOCK, CALENDAR],
          useFactory: (
            appointments: AppointmentRepository, patients: PatientDirectory, practitioners: PractitionerDirectory, locations: LocationDirectory, reasons: VisitReasons,
            access: ServiceAccess, audit: AuditLog, clock: Clock, calendar: Calendar,
          ): Dependencies => ({ appointments, patients, practitioners, locations, reasons, access, audit, clock, calendar }),
        },
        { provide: ScheduleAppointmentUseCase, inject: [DEPENDENCIES, ID_GENERATOR], useFactory: (d: Dependencies, ids: IdGenerator) => new ScheduleAppointmentUseCase(d, ids) },
        { provide: ManageAppointmentUseCases, inject: [DEPENDENCIES], useFactory: (d: Dependencies) => new ManageAppointmentUseCases(d) },
        { provide: GetAppointmentUseCase, inject: [DEPENDENCIES], useFactory: (d: Dependencies) => new GetAppointmentUseCase(d) },
        { provide: ListAppointmentsUseCase, inject: [DEPENDENCIES], useFactory: (d: Dependencies) => new ListAppointmentsUseCase(d) },
        { provide: ArriveAppointmentUseCase, inject: [DEPENDENCIES], useFactory: (d: Dependencies) => new ArriveAppointmentUseCase(d) },
      ],
      exports: [ArriveAppointmentUseCase],
    };
  }
}

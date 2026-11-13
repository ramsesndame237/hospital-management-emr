import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CLOCK, Clock } from '../../shared-kernel/ports';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { PortalAccountUseCases, PortalDependencies, PortalReadUseCases } from './application/use-cases/portal';
import {
  PORTAL_ACCOUNT_REPOSITORY, PORTAL_APPOINTMENTS, PORTAL_INVOICES, PORTAL_PATIENTS, PORTAL_PRESCRIPTIONS, PORTAL_RESULTS, PORTAL_USERS, PortalAccountRepository, PortalAppointments, PortalInvoices,
  PortalPatients, PortalPrescriptions, PortalResults, PortalUsers,
} from './domain/ports';
import { PgPortalAccountRepository } from './infrastructure/persistence/pg-portal-account.repository';
import { PortalController } from './presentation/portal.controller';

const DEPENDENCIES = Symbol('PORTAL_DEPENDENCIES');

/**
 * Module Portail patient. Le lien compte ↔ dossier est le seul état propre au module ; tout le reste est lu, pour UN patient, chez les autres modules par les
 * ports que la racine de composition (`src/integration/portal.integration.ts`) branche sur eux.
 */
@Module({})
export class PortalModule {
  static register(): DynamicModule {
    const use = <T>(factory: (d: PortalDependencies) => T) => ({ inject: [DEPENDENCIES], useFactory: factory });
    return {
      module: PortalModule,
      controllers: [PortalController],
      providers: [
        { provide: PORTAL_ACCOUNT_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgPortalAccountRepository(sql) },
        {
          provide: DEPENDENCIES,
          inject: [PORTAL_ACCOUNT_REPOSITORY, PORTAL_PATIENTS, PORTAL_USERS, PORTAL_APPOINTMENTS, PORTAL_RESULTS, PORTAL_PRESCRIPTIONS, PORTAL_INVOICES, AUDIT_LOG, CLOCK],
          useFactory: (
            accounts: PortalAccountRepository, patients: PortalPatients, users: PortalUsers, appointments: PortalAppointments, results: PortalResults, prescriptions: PortalPrescriptions,
            invoices: PortalInvoices, audit: AuditLog, clock: Clock,
          ): PortalDependencies => ({ accounts, patients, users, appointments, results, prescriptions, invoices, audit, clock }),
        },
        { provide: PortalReadUseCases, ...use((d) => new PortalReadUseCases(d)) },
        { provide: PortalAccountUseCases, ...use((d) => new PortalAccountUseCases(d)) },
      ],
    };
  }
}

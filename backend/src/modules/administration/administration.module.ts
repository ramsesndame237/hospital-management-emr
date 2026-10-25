import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { GetFacilityUseCase, ListFacilitiesUseCase, ManageFacilityUseCases, RegisterFacilityUseCase } from './application/use-cases/facilities';
import { GetOrganizationUseCase, SetupOrganizationUseCase } from './application/use-cases/organization';
import { FACILITY_REPOSITORY, FacilityRepository, ORGANIZATION_REPOSITORY, OrganizationRepository } from './domain/ports';
import { PgFacilityRepository } from './infrastructure/persistence/pg-facility.repository';
import { PgOrganizationRepository } from './infrastructure/persistence/pg-organization.repository';
import { AdministrationController } from './presentation/administration.controller';

/**
 * Module Administration : organisation et établissements. Comme pour l'IAM, c'est ici, et seulement ici, que les ports
 * du domaine sont reliés à leurs adaptateurs (PostgreSQL). L'accès est contrôlé par les gardes globaux de l'IAM
 * (`@RequirePermissions` sur chaque point d'entrée) ; ce module ne connaît que les décorateurs.
 */
@Module({})
export class AdministrationModule {
  static register(): DynamicModule {
    return {
      module: AdministrationModule,
      controllers: [AdministrationController],
      providers: [
        // --- adaptateurs ---
        { provide: ORGANIZATION_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgOrganizationRepository(sql) },
        { provide: FACILITY_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgFacilityRepository(sql) },

        // --- cas d'usage ---
        { provide: GetOrganizationUseCase, inject: [ORGANIZATION_REPOSITORY], useFactory: (o: OrganizationRepository) => new GetOrganizationUseCase(o) },
        {
          provide: SetupOrganizationUseCase,
          inject: [ORGANIZATION_REPOSITORY, ID_GENERATOR, AUDIT_LOG, CLOCK],
          useFactory: (o: OrganizationRepository, ids: IdGenerator, a: AuditLog, c: Clock) => new SetupOrganizationUseCase(o, ids, a, c),
        },
        { provide: GetFacilityUseCase, inject: [FACILITY_REPOSITORY], useFactory: (f: FacilityRepository) => new GetFacilityUseCase(f) },
        { provide: ListFacilitiesUseCase, inject: [FACILITY_REPOSITORY], useFactory: (f: FacilityRepository) => new ListFacilitiesUseCase(f) },
        {
          provide: RegisterFacilityUseCase,
          inject: [ORGANIZATION_REPOSITORY, FACILITY_REPOSITORY, ID_GENERATOR, AUDIT_LOG, CLOCK],
          useFactory: (o: OrganizationRepository, f: FacilityRepository, ids: IdGenerator, a: AuditLog, c: Clock) => new RegisterFacilityUseCase(o, f, ids, a, c),
        },
        {
          provide: ManageFacilityUseCases,
          inject: [FACILITY_REPOSITORY, AUDIT_LOG, CLOCK],
          useFactory: (f: FacilityRepository, a: AuditLog, c: Clock) => new ManageFacilityUseCases(f, a, c),
        },
      ],
    };
  }
}

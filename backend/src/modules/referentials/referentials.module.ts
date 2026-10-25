import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { ListCatalogsUseCase, ListEntriesUseCase, ManageEntriesUseCases } from './application/use-cases/referentials';
import { CATALOG_REPOSITORY, CatalogRepository, ENTRY_REPOSITORY, EntryRepository } from './domain/ports';
import { PgCatalogRepository } from './infrastructure/persistence/pg-catalog.repository';
import { PgEntryRepository } from './infrastructure/persistence/pg-entry.repository';
import { ReferentialsController } from './presentation/referentials.controller';

/**
 * Module Référentiels : nomenclatures de l'établissement. Les ports du domaine sont reliés à PostgreSQL ici, et seulement ici.
 * L'accès est contrôlé par les gardes globaux de l'IAM (`@RequirePermissions` sur chaque point d'entrée).
 */
@Module({})
export class ReferentialsModule {
  static register(): DynamicModule {
    return {
      module: ReferentialsModule,
      // Global : la racine de composition (`src/integration`) en consomme les dépôts sans réimporter (ni dupliquer) le module.
      global: true,
      controllers: [ReferentialsController],
      providers: [
        { provide: CATALOG_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgCatalogRepository(sql) },
        { provide: ENTRY_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgEntryRepository(sql) },

        { provide: ListCatalogsUseCase, inject: [CATALOG_REPOSITORY], useFactory: (c: CatalogRepository) => new ListCatalogsUseCase(c) },
        {
          provide: ListEntriesUseCase,
          inject: [CATALOG_REPOSITORY, ENTRY_REPOSITORY],
          useFactory: (c: CatalogRepository, e: EntryRepository) => new ListEntriesUseCase(c, e),
        },
        {
          provide: ManageEntriesUseCases,
          inject: [CATALOG_REPOSITORY, ENTRY_REPOSITORY, ID_GENERATOR, AUDIT_LOG, CLOCK],
          useFactory: (c: CatalogRepository, e: EntryRepository, ids: IdGenerator, a: AuditLog, clock: Clock) => new ManageEntriesUseCases(c, e, ids, a, clock),
        },
      ],
      exports: [CATALOG_REPOSITORY, ENTRY_REPOSITORY],
    };
  }
}

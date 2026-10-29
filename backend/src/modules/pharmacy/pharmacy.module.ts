import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CALENDAR, Calendar, CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { AdjustmentUseCases } from './application/use-cases/adjustments';
import { CreateDrugUseCase, GetDrugUseCase, ListDrugsUseCase, ManageDrugUseCases } from './application/use-cases/catalog';
import { GetReceiptUseCase, ListReceiptsUseCase, PostReceiptUseCase } from './application/use-cases/receipts';
import {
  BatchActionUseCases, GetDrugStockUseCase, ListExpiryUseCase, ListMovementsUseCase, ListStockUseCase, StockSummaryUseCase, SuggestBatchesUseCase,
} from './application/use-cases/stock';
import { PharmacyDependencies } from './application/views';
import {
  ADJUSTMENT_REPOSITORY, AdjustmentRepository, DRUG_REPOSITORY, DrugRepository, PHARMACY_EXPIRY_ALERT_DAYS, PHARMACY_USERS, STOCK_REPOSITORY, StockRepository, UserDirectory,
} from './domain/ports';
import { PgAdjustmentRepository } from './infrastructure/persistence/pg-adjustment.repository';
import { PgDrugRepository } from './infrastructure/persistence/pg-drug.repository';
import { PgStockRepository } from './infrastructure/persistence/pg-stock.repository';
import { PharmacyDrugsController } from './presentation/drugs.controller';
import { PharmacyAdjustmentsController, PharmacyReceiptsController } from './presentation/receipts.controller';
import { PharmacyStockController } from './presentation/stock.controller';

const DEPENDENCIES = Symbol('PHARMACY_DEPENDENCIES');

/**
 * Module Pharmacie (catalogue et stock). Les ports de persistance sont reliés à PostgreSQL ici ; les comptes et la configuration sont
 * fournis par la racine de composition (`src/integration`). L'accès est contrôlé par les gardes globaux de l'IAM (`@RequirePermissions`).
 */
@Module({})
export class PharmacyModule {
  static register(): DynamicModule {
    const use = <T>(factory: (d: PharmacyDependencies, ids: IdGenerator) => T) => ({ inject: [DEPENDENCIES, ID_GENERATOR], useFactory: factory });
    return {
      module: PharmacyModule,
      controllers: [PharmacyDrugsController, PharmacyStockController, PharmacyReceiptsController, PharmacyAdjustmentsController],
      providers: [
        { provide: DRUG_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgDrugRepository(sql) },
        { provide: STOCK_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgStockRepository(sql) },
        { provide: ADJUSTMENT_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgAdjustmentRepository(sql) },
        {
          provide: DEPENDENCIES,
          inject: [DRUG_REPOSITORY, STOCK_REPOSITORY, ADJUSTMENT_REPOSITORY, PHARMACY_USERS, AUDIT_LOG, CLOCK, CALENDAR, PHARMACY_EXPIRY_ALERT_DAYS],
          useFactory: (drugs: DrugRepository, stock: StockRepository, adjustments: AdjustmentRepository, users: UserDirectory, audit: AuditLog, clock: Clock, calendar: Calendar, expiryAlertDays: number): PharmacyDependencies => ({
            drugs, stock, adjustments, users, audit, clock, calendar, expiryAlertDays,
          }),
        },
        { provide: CreateDrugUseCase, ...use((d, ids) => new CreateDrugUseCase(d, ids)) },
        { provide: ManageDrugUseCases, ...use((d) => new ManageDrugUseCases(d)) },
        { provide: GetDrugUseCase, ...use((d) => new GetDrugUseCase(d)) },
        { provide: ListDrugsUseCase, ...use((d) => new ListDrugsUseCase(d)) },
        { provide: ListStockUseCase, ...use((d) => new ListStockUseCase(d)) },
        { provide: StockSummaryUseCase, ...use((d) => new StockSummaryUseCase(d)) },
        { provide: GetDrugStockUseCase, ...use((d) => new GetDrugStockUseCase(d)) },
        { provide: SuggestBatchesUseCase, ...use((d) => new SuggestBatchesUseCase(d)) },
        { provide: ListExpiryUseCase, ...use((d) => new ListExpiryUseCase(d)) },
        { provide: ListMovementsUseCase, ...use((d) => new ListMovementsUseCase(d)) },
        { provide: BatchActionUseCases, ...use((d) => new BatchActionUseCases(d)) },
        { provide: PostReceiptUseCase, ...use((d, ids) => new PostReceiptUseCase(d, ids)) },
        { provide: GetReceiptUseCase, ...use((d) => new GetReceiptUseCase(d)) },
        { provide: ListReceiptsUseCase, ...use((d) => new ListReceiptsUseCase(d)) },
        { provide: AdjustmentUseCases, ...use((d, ids) => new AdjustmentUseCases(d, ids)) },
      ],
    };
  }
}

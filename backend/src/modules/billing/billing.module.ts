import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { CatalogDependencies, CreateItemUseCase, GetItemUseCase, ListItemsUseCase, ManageItemUseCases } from './application/use-cases/catalog';
import {
  CollectPaymentUseCase, CreateInvoiceUseCase, GetInvoiceUseCase, InvoiceDependencies, ListInvoicesUseCase, ManageInvoiceUseCases, ReprintReceiptUseCase,
} from './application/use-cases/invoices';
import {
  BILLING_CURRENCY, BILLING_PATIENTS, BILLING_SERVICES, INVOICE_REPOSITORY, InvoiceRepository, ITEM_REPOSITORY, ItemRepository, PatientDirectory, ServiceDirectory,
} from './domain/ports';
import { Currency } from './domain/values';
import { PgInvoiceRepository } from './infrastructure/persistence/pg-invoice.repository';
import { PgItemRepository } from './infrastructure/persistence/pg-item.repository';
import { BillingCatalogController } from './presentation/catalog.controller';
import { BillingInvoicesController } from './presentation/invoices.controller';

const CATALOG_DEPENDENCIES = Symbol('BILLING_CATALOG_DEPENDENCIES');
const INVOICE_DEPENDENCIES = Symbol('BILLING_INVOICE_DEPENDENCIES');

/**
 * Module Facturation. Les ports de persistance sont reliés à PostgreSQL ici ; les patients, les services et la devise de
 * l'installation (`BILLING_CURRENCY`) sont fournis par la racine de composition (`src/integration`). L'accès est contrôlé par les
 * gardes globaux de l'IAM (`@RequirePermissions`).
 */
@Module({})
export class BillingModule {
  static register(): DynamicModule {
    return {
      module: BillingModule,
      controllers: [BillingCatalogController, BillingInvoicesController],
      providers: [
        { provide: ITEM_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgItemRepository(sql) },
        { provide: INVOICE_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgInvoiceRepository(sql) },
        {
          provide: CATALOG_DEPENDENCIES,
          inject: [ITEM_REPOSITORY, BILLING_SERVICES, BILLING_CURRENCY, AUDIT_LOG, CLOCK],
          useFactory: (items: ItemRepository, services: ServiceDirectory, currency: Currency, audit: AuditLog, clock: Clock): CatalogDependencies => ({ items, services, currency, audit, clock }),
        },
        {
          provide: INVOICE_DEPENDENCIES,
          inject: [INVOICE_REPOSITORY, ITEM_REPOSITORY, BILLING_PATIENTS, BILLING_CURRENCY, AUDIT_LOG, CLOCK],
          useFactory: (invoices: InvoiceRepository, items: ItemRepository, patients: PatientDirectory, currency: Currency, audit: AuditLog, clock: Clock): InvoiceDependencies => ({ invoices, items, patients, currency, audit, clock }),
        },
        { provide: CreateItemUseCase, inject: [CATALOG_DEPENDENCIES, ID_GENERATOR], useFactory: (d: CatalogDependencies, ids: IdGenerator) => new CreateItemUseCase(d, ids) },
        { provide: ManageItemUseCases, inject: [CATALOG_DEPENDENCIES], useFactory: (d: CatalogDependencies) => new ManageItemUseCases(d) },
        { provide: GetItemUseCase, inject: [CATALOG_DEPENDENCIES], useFactory: (d: CatalogDependencies) => new GetItemUseCase(d) },
        { provide: ListItemsUseCase, inject: [CATALOG_DEPENDENCIES], useFactory: (d: CatalogDependencies) => new ListItemsUseCase(d) },
        { provide: CreateInvoiceUseCase, inject: [INVOICE_DEPENDENCIES, ID_GENERATOR], useFactory: (d: InvoiceDependencies, ids: IdGenerator) => new CreateInvoiceUseCase(d, ids) },
        { provide: ManageInvoiceUseCases, inject: [INVOICE_DEPENDENCIES, ID_GENERATOR], useFactory: (d: InvoiceDependencies, ids: IdGenerator) => new ManageInvoiceUseCases(d, ids) },
        { provide: CollectPaymentUseCase, inject: [INVOICE_DEPENDENCIES, ID_GENERATOR], useFactory: (d: InvoiceDependencies, ids: IdGenerator) => new CollectPaymentUseCase(d, ids) },
        { provide: ReprintReceiptUseCase, inject: [INVOICE_DEPENDENCIES], useFactory: (d: InvoiceDependencies) => new ReprintReceiptUseCase(d) },
        { provide: GetInvoiceUseCase, inject: [INVOICE_DEPENDENCIES], useFactory: (d: InvoiceDependencies) => new GetInvoiceUseCase(d) },
        { provide: ListInvoicesUseCase, inject: [INVOICE_DEPENDENCIES], useFactory: (d: InvoiceDependencies) => new ListInvoicesUseCase(d) },
      ],
    };
  }
}

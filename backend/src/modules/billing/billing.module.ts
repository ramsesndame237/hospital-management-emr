import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { SERVICE_ACCESS, ServiceAccess } from '../../shared-kernel/service-access';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import {
  ApprovalDependencies, DecideApprovalUseCase, GetApprovalUseCase, ListApprovalsUseCase, RequestApprovalUseCase, WithdrawApprovalUseCase,
} from './application/use-cases/approvals';
import { CatalogDependencies, CreateItemUseCase, GetItemUseCase, ListItemsUseCase, ManageItemUseCases } from './application/use-cases/catalog';
import {
  CloseSessionUseCase, CosignSessionUseCase, GetCurrentSessionUseCase, GetDenominationsUseCase, GetSessionUseCase, ListSessionsUseCase, OpenSessionUseCase, SessionDependencies,
} from './application/use-cases/sessions';
import {
  CollectPaymentUseCase, CreateInvoiceUseCase, GetInvoiceUseCase, InvoiceDependencies, ListInvoicesUseCase, ManageInvoiceUseCases, ReprintReceiptUseCase,
} from './application/use-cases/invoices';
import {
  APPROVAL_REPOSITORY, ApprovalRepository, BILLING_CURRENCY, BILLING_DISCOUNT_APPROVAL_PERCENT, BILLING_PATIENTS, BILLING_SERVICES, BILLING_USERS, BILLING_VARIANCE_LIMIT, CASH_SESSION_REPOSITORY, CashSessionRepository, INVOICE_REPOSITORY, InvoiceRepository, ITEM_REPOSITORY, ItemRepository,
  PatientDirectory, ServiceDirectory, UserDirectory,
} from './domain/ports';
import { Currency } from './domain/values';
import { PgApprovalRepository } from './infrastructure/persistence/pg-approval.repository';
import { PgInvoiceRepository } from './infrastructure/persistence/pg-invoice.repository';
import { PgCashSessionRepository } from './infrastructure/persistence/pg-cash-session.repository';
import { PgItemRepository } from './infrastructure/persistence/pg-item.repository';
import { BillingApprovalsController } from './presentation/approvals.controller';
import { BillingCatalogController } from './presentation/catalog.controller';
import { BillingInvoicesController } from './presentation/invoices.controller';
import { BillingSessionsController } from './presentation/sessions.controller';

const CATALOG_DEPENDENCIES = Symbol('BILLING_CATALOG_DEPENDENCIES');
const INVOICE_DEPENDENCIES = Symbol('BILLING_INVOICE_DEPENDENCIES');
const SESSION_DEPENDENCIES = Symbol('BILLING_SESSION_DEPENDENCIES');
const APPROVAL_DEPENDENCIES = Symbol('BILLING_APPROVAL_DEPENDENCIES');

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
      controllers: [BillingCatalogController, BillingInvoicesController, BillingSessionsController, BillingApprovalsController],
      providers: [
        { provide: ITEM_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgItemRepository(sql) },
        { provide: INVOICE_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgInvoiceRepository(sql) },
        { provide: CASH_SESSION_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgCashSessionRepository(sql) },
        { provide: APPROVAL_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgApprovalRepository(sql) },
        {
          provide: CATALOG_DEPENDENCIES,
          inject: [ITEM_REPOSITORY, BILLING_SERVICES, BILLING_CURRENCY, AUDIT_LOG, CLOCK],
          useFactory: (items: ItemRepository, services: ServiceDirectory, currency: Currency, audit: AuditLog, clock: Clock): CatalogDependencies => ({ items, services, currency, audit, clock }),
        },
        {
          provide: INVOICE_DEPENDENCIES,
          inject: [INVOICE_REPOSITORY, ITEM_REPOSITORY, BILLING_PATIENTS, CASH_SESSION_REPOSITORY, APPROVAL_REPOSITORY, BILLING_USERS, BILLING_DISCOUNT_APPROVAL_PERCENT, BILLING_CURRENCY, AUDIT_LOG, CLOCK],
          useFactory: (
            invoices: InvoiceRepository, items: ItemRepository, patients: PatientDirectory, sessions: CashSessionRepository, approvals: ApprovalRepository, users: UserDirectory,
            discountApprovalPercent: number, currency: Currency, audit: AuditLog, clock: Clock,
          ): InvoiceDependencies => ({ invoices, items, patients, sessions, approvals, users, discountApprovalPercent, currency, audit, clock }),
        },
        {
          provide: APPROVAL_DEPENDENCIES,
          inject: [APPROVAL_REPOSITORY, INVOICE_REPOSITORY, BILLING_PATIENTS, BILLING_USERS, SERVICE_ACCESS, BILLING_CURRENCY, BILLING_DISCOUNT_APPROVAL_PERCENT, AUDIT_LOG, CLOCK],
          useFactory: (
            approvals: ApprovalRepository, invoices: InvoiceRepository, patients: PatientDirectory, users: UserDirectory, access: ServiceAccess, currency: Currency, discountApprovalPercent: number, audit: AuditLog, clock: Clock,
          ): ApprovalDependencies => ({ approvals, invoices, patients, users, access, currency, discountApprovalPercent, audit, clock }),
        },
        {
          provide: SESSION_DEPENDENCIES,
          inject: [CASH_SESSION_REPOSITORY, BILLING_USERS, SERVICE_ACCESS, BILLING_CURRENCY, BILLING_VARIANCE_LIMIT, AUDIT_LOG, CLOCK],
          useFactory: (sessions: CashSessionRepository, users: UserDirectory, access: ServiceAccess, currency: Currency, varianceLimit: number, audit: AuditLog, clock: Clock): SessionDependencies => ({
            sessions, users, access, currency, varianceLimit, audit, clock,
          }),
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
        { provide: GetDenominationsUseCase, inject: [SESSION_DEPENDENCIES], useFactory: (d: SessionDependencies) => new GetDenominationsUseCase(d) },
        { provide: OpenSessionUseCase, inject: [SESSION_DEPENDENCIES, ID_GENERATOR], useFactory: (d: SessionDependencies, ids: IdGenerator) => new OpenSessionUseCase(d, ids) },
        { provide: GetCurrentSessionUseCase, inject: [SESSION_DEPENDENCIES], useFactory: (d: SessionDependencies) => new GetCurrentSessionUseCase(d) },
        { provide: GetSessionUseCase, inject: [SESSION_DEPENDENCIES], useFactory: (d: SessionDependencies) => new GetSessionUseCase(d) },
        { provide: ListSessionsUseCase, inject: [SESSION_DEPENDENCIES], useFactory: (d: SessionDependencies) => new ListSessionsUseCase(d) },
        { provide: CloseSessionUseCase, inject: [SESSION_DEPENDENCIES], useFactory: (d: SessionDependencies) => new CloseSessionUseCase(d) },
        { provide: RequestApprovalUseCase, inject: [APPROVAL_DEPENDENCIES, ID_GENERATOR], useFactory: (d: ApprovalDependencies, ids: IdGenerator) => new RequestApprovalUseCase(d, ids) },
        { provide: DecideApprovalUseCase, inject: [APPROVAL_DEPENDENCIES], useFactory: (d: ApprovalDependencies) => new DecideApprovalUseCase(d) },
        { provide: WithdrawApprovalUseCase, inject: [APPROVAL_DEPENDENCIES], useFactory: (d: ApprovalDependencies) => new WithdrawApprovalUseCase(d) },
        { provide: GetApprovalUseCase, inject: [APPROVAL_DEPENDENCIES], useFactory: (d: ApprovalDependencies) => new GetApprovalUseCase(d) },
        { provide: ListApprovalsUseCase, inject: [APPROVAL_DEPENDENCIES], useFactory: (d: ApprovalDependencies) => new ListApprovalsUseCase(d) },
        { provide: CosignSessionUseCase, inject: [SESSION_DEPENDENCIES], useFactory: (d: SessionDependencies) => new CosignSessionUseCase(d) },
      ],
    };
  }
}

import { DynamicModule, Module } from '@nestjs/common';
import { CLOCK, Clock } from '../../shared-kernel/ports';
import { SearchAuditUseCase, VerifyAuditChainUseCase } from './application/audit-queries';
import { AUDIT_LOG, AUDIT_READER, AuditLog, AuditReader } from './domain/audit-log.port';
import { AuditController } from './presentation/audit.controller';

/**
 * Module Audit : consultation du journal (l'écriture se fait via le port `AuditLog`, fourni par la plateforme).
 * L'accès est contrôlé par les gardes globaux de l'IAM (`@RequirePermissions` sur chaque point d'entrée).
 */
@Module({})
export class AuditModule {
  static register(): DynamicModule {
    return {
      module: AuditModule,
      controllers: [AuditController],
      providers: [
        {
          provide: SearchAuditUseCase,
          inject: [AUDIT_READER, AUDIT_LOG, CLOCK],
          useFactory: (r: AuditReader, a: AuditLog, c: Clock) => new SearchAuditUseCase(r, a, c),
        },
        {
          provide: VerifyAuditChainUseCase,
          inject: [AUDIT_READER, AUDIT_LOG, CLOCK],
          useFactory: (r: AuditReader, a: AuditLog, c: Clock) => new VerifyAuditChainUseCase(r, a, c),
        },
      ],
    };
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUDIT_LOG } from '../../../audit/domain/audit-log.port';
import type { AuditLog } from '../../../audit/domain/audit-log.port';
import { CLOCK } from '../../../../shared-kernel/ports';
import type { Clock } from '../../../../shared-kernel/ports';
import { PermissionResolver } from '../../application/permission-resolver';
import { Permission } from '../../domain/value-objects/permission';
import { REQUIRED_PERMISSIONS } from '../decorators';
import type { AuthenticatedRequest } from '../decorators';

/** Contrôle d'accès par permissions. Chaque refus est journalisé (HIPAA §164.312(b)) : tentatives d'accès non autorisées visibles à l'audit. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolver,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Accès refusé.' });

    for (const raw of required) {
      const permission = Permission.create(raw);
      if (permission.ok && (await this.resolver.can(user.userId, permission.value))) continue;
      await this.audit.record({
        action: 'access.denied',
        outcome: 'DENIED',
        actorId: user.userId,
        actorUsername: user.username,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        reason: `missing:${raw}`,
        metadata: { method: req.method, path: req.route?.path ?? req.path },
        occurredAt: this.clock.now(),
      });
      throw new ForbiddenException({ code: 'FORBIDDEN', message: "Vous n'avez pas le droit d'effectuer cette action." });
    }
    return true;
  }
}

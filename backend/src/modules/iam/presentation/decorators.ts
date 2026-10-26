import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { TokenScope } from '../domain/ports';
import { Permission } from '../domain/value-objects/permission';

export const IS_PUBLIC = 'iam:public';
export const ALLOW_SETUP = 'iam:allow-setup';
export const REQUIRED_PERMISSIONS = 'iam:permissions';

/**
 * L'API est fermée par défaut : tout point d'entrée exige un jeton valide, sauf s'il est explicitement `@Public()`.
 * Un oubli de décorateur ferme donc la porte au lieu de l'ouvrir.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Autorise un jeton à portée restreinte (`setup`) : changement de mot de passe forcé, inscription MFA. */
export const AllowSetup = () => SetMetadata(ALLOW_SETUP, true);

/** Exige toutes les permissions listées (format `ressource:action[:portée]`). Validées dès la déclaration. */
export const RequirePermissions = (...permissions: string[]) => {
  for (const p of permissions) {
    const r = Permission.create(p);
    if (!r.ok) throw new Error(`@RequirePermissions : ${r.error.message}`);
  }
  return SetMetadata(REQUIRED_PERMISSIONS, permissions);
};

export interface AuthUser {
  readonly userId: string;
  readonly username: string;
  readonly roles: readonly string[];
  readonly scope: TokenScope;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user as AuthUser;
});

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

export const Client = createParamDecorator((_data: unknown, ctx: ExecutionContext): ClientInfo => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
});

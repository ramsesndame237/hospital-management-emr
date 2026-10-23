import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionResolver } from '../../application/permission-resolver';
import { TOKEN_ISSUER } from '../../domain/ports';
import type { TokenIssuer } from '../../domain/ports';
import { ALLOW_SETUP, IS_PUBLIC } from '../decorators';
import type { AuthenticatedRequest } from '../decorators';

/**
 * Garde global d'authentification : jeton Bearer valide, compte toujours actif (vérifié à chaque requête via le cache
 * d'autorisation, invalidé à la désactivation), et portée suffisante. Un jeton `setup` ne sert qu'à finaliser le compte.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
    private readonly resolver: PermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentification requise.' });

    const claims = await this.tokens.verify(token);
    if (!claims) throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Jeton invalide ou expiré.' });

    const authz = await this.resolver.authorizationOf(claims.userId);
    if (!authz?.active) throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Compte indisponible.' });

    if (claims.scope === 'setup' && !this.reflector.getAllAndOverride<boolean>(ALLOW_SETUP, targets)) {
      throw new ForbiddenException({ code: 'SETUP_REQUIRED', message: 'Changement de mot de passe ou inscription MFA requis avant de continuer.' });
    }

    // Les rôles viennent du serveur (cache), pas du jeton : une révocation prend effet immédiatement.
    req.user = { userId: claims.userId, username: claims.username, roles: authz.roles, scope: claims.scope };
    return true;
  }
}

import { JwtService } from '@nestjs/jwt';
import { Instant, Temporal } from '../../../../shared-kernel/temporal';
import { AccessClaims, TokenIssuer, TokenScope } from '../../domain/ports';

export interface JwtOptions {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly ttlMinutes: number;
}

/**
 * Jeton d'accès JWT HS256 de courte durée. L'algorithme est imposé à la vérification (pas de confusion `alg: none`/RS256),
 * ainsi que l'émetteur et l'audience. Le jeton ne porte que l'identité et les rôles : les permissions sont résolues
 * côté serveur à chaque requête (cache invalidé à la révocation), jamais lues dans le jeton.
 */
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    private readonly options: JwtOptions,
  ) {}

  async issue(claims: AccessClaims): Promise<{ token: string; expiresAt: Instant }> {
    const expiresInSeconds = this.options.ttlMinutes * 60;
    const token = await this.jwt.signAsync(
      { username: claims.username, roles: claims.roles, scope: claims.scope },
      {
        subject: claims.userId,
        issuer: this.options.issuer,
        audience: this.options.audience,
        expiresIn: expiresInSeconds,
        algorithm: 'HS256',
        secret: this.options.secret,
      },
    );
    return { token, expiresAt: Temporal.Now.instant().add({ seconds: expiresInSeconds }) };
  }

  async verify(token: string): Promise<AccessClaims | null> {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; username: string; roles: string[]; scope: TokenScope }>(token, {
        secret: this.options.secret,
        algorithms: ['HS256'],
        issuer: this.options.issuer,
        audience: this.options.audience,
      });
      if (!p.sub || (p.scope !== 'full' && p.scope !== 'setup')) return null;
      return { userId: p.sub, username: p.username, roles: p.roles ?? [], scope: p.scope };
    } catch {
      return null;
    }
  }
}

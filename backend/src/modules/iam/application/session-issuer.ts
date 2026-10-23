import { randomToken, sha256 } from '../../../shared-kernel/crypto';
import { Clock, IdGenerator } from '../../../shared-kernel/ports';
import { RefreshSessionStore, TokenIssuer, TokenScope } from '../domain/ports';
import { User } from '../domain/user';

export interface TokenPair {
  readonly accessToken: string;
  readonly accessExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
  readonly scope: TokenScope;
}

export interface ClientContext {
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** Ouvre une session : jeton d'accès court + jeton de rafraîchissement opaque (rotatif) rattaché à une « famille ». */
export class SessionIssuer {
  constructor(
    private readonly tokens: TokenIssuer,
    private readonly store: RefreshSessionStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly refreshTtlMs: number,
  ) {}

  async open(user: User, scope: TokenScope, ctx: ClientContext, familyId?: string): Promise<TokenPair> {
    const access = await this.tokens.issue({
      userId: user.id.value,
      username: user.username.value,
      roles: user.roles.map((r) => r.value),
      scope,
    });
    const id = this.ids.next();
    const secret = randomToken();
    const expiresAt = new Date(this.clock.now().getTime() + this.refreshTtlMs);
    await this.store.create({
      id,
      userId: user.id.value,
      familyId: familyId ?? this.ids.next(),
      secretHash: sha256(secret),
      expiresAt,
      scope,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: `${id}.${secret}`,
      refreshExpiresAt: expiresAt,
      scope,
    };
  }
}

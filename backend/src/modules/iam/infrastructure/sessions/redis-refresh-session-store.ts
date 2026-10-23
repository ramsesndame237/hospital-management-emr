import type { Redis } from 'ioredis';
import { Temporal } from '../../../../shared-kernel/temporal';
import { RefreshSession, RefreshSessionStore, TokenScope } from '../../domain/ports';

const sessionKey = (id: string) => `iam:rs:${id}`;
const familyKey = (familyId: string) => `iam:fam:${familyId}`;
const userKey = (userId: string) => `iam:usr:${userId}`;
/** Les index (famille, utilisateur) vivent au plus aussi longtemps que la plus longue session possible. */
const INDEX_TTL_SECONDS = 31 * 24 * 3600;

/**
 * Sessions de rafraîchissement dans Redis. Le jeton brut n'y figure jamais : seulement son SHA-256.
 * Chaque session expire d'elle-même à sa date de fin. Si Redis est indisponible, les opérations échouent :
 * l'authentification refuse plutôt que d'accepter une session qu'elle ne peut pas vérifier (échec fermé).
 */
export class RedisRefreshSessionStore implements RefreshSessionStore {
  constructor(private readonly redis: Redis) {}

  async create(s: RefreshSession): Promise<void> {
    const key = sessionKey(s.id);
    await this.redis
      .multi()
      .hset(key, {
        userId: s.userId,
        familyId: s.familyId,
        secretHash: s.secretHash,
        expiresAtMs: String(s.expiresAt.epochMilliseconds),
        scope: s.scope,
        ip: s.ip ?? '',
        userAgent: s.userAgent ?? '',
      })
      .pexpireat(key, s.expiresAt.epochMilliseconds)
      .sadd(familyKey(s.familyId), s.id)
      .expire(familyKey(s.familyId), INDEX_TTL_SECONDS)
      .sadd(userKey(s.userId), s.id)
      .expire(userKey(s.userId), INDEX_TTL_SECONDS)
      .exec();
  }

  async find(id: string): Promise<{ session: RefreshSession; used: boolean } | null> {
    const h = await this.redis.hgetall(sessionKey(id));
    if (!h.userId || !h.secretHash) return null; // absente, expirée, révoquée — ou simple trace de `markUsed`
    return {
      used: h.used === '1',
      session: {
        id,
        userId: h.userId,
        familyId: h.familyId,
        secretHash: h.secretHash,
        expiresAt: Temporal.Instant.fromEpochMilliseconds(Number(h.expiresAtMs)),
        scope: h.scope as TokenScope,
        ip: h.ip || null,
        userAgent: h.userAgent || null,
      },
    };
  }

  /** `HSETNX` est atomique : de deux rafraîchissements simultanés avec le même jeton, un seul gagne. */
  async markUsed(id: string): Promise<boolean> {
    const key = sessionKey(id);
    const first = (await this.redis.hsetnx(key, 'used', '1')) === 1;
    if (first && !(await this.redis.hexists(key, 'userId'))) {
      await this.redis.del(key); // la session venait d'être révoquée : ne laisse aucune trace
      return false;
    }
    return first;
  }

  async revokeFamily(familyId: string): Promise<void> {
    const ids = await this.redis.smembers(familyKey(familyId));
    if (ids.length > 0) await this.redis.del(...ids.map(sessionKey));
    await this.redis.del(familyKey(familyId));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const ids = await this.redis.smembers(userKey(userId));
    if (ids.length > 0) await this.redis.del(...ids.map(sessionKey));
    await this.redis.del(userKey(userId));
  }
}

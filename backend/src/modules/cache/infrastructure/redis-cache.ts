import type { Redis } from 'ioredis';
import { CachePort } from '../cache.port';

const TAG_TTL_SECONDS = 24 * 3600;
const tagKey = (tag: string) => `tag:${tag}`;

/** Cache Redis. Valeurs en JSON ; les étiquettes sont des ensembles de clés, ce qui permet l'invalidation ciblée. */
export class RedisCache implements CachePort {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'sanjeevani:cache:',
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.prefix + key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds: number, tags: readonly string[] = []): Promise<void> {
    const k = this.prefix + key;
    const tx = this.redis.multi().set(k, JSON.stringify(value), 'EX', ttlSeconds);
    for (const tag of tags) tx.sadd(this.prefix + tagKey(tag), k).expire(this.prefix + tagKey(tag), TAG_TTL_SECONDS);
    await tx.exec();
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.prefix + key);
  }

  async deleteByTag(tag: string): Promise<void> {
    const t = this.prefix + tagKey(tag);
    const keys = await this.redis.smembers(t);
    if (keys.length > 0) await this.redis.del(...keys);
    await this.redis.del(t);
  }
}

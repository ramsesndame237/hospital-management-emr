import { Temporal } from '../../../shared-kernel/temporal';
import { CachePort } from '../cache.port';

/** Cache en mémoire du processus : développement et tests (pas partagé entre instances). */
export class MemoryCache implements CachePort {
  private readonly entries = new Map<string, { value: string; expiresAtMs: number }>();
  private readonly tags = new Map<string, Set<string>>();

  async get<T>(key: string): Promise<T | null> {
    const e = this.entries.get(key);
    if (!e) return null;
    if (e.expiresAtMs <= Temporal.Now.instant().epochMilliseconds) {
      this.entries.delete(key);
      return null;
    }
    return JSON.parse(e.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number, tags: readonly string[] = []): Promise<void> {
    this.entries.set(key, { value: JSON.stringify(value), expiresAtMs: Temporal.Now.instant().epochMilliseconds + ttlSeconds * 1000 });
    for (const t of tags) {
      const set = this.tags.get(t) ?? new Set<string>();
      set.add(key);
      this.tags.set(t, set);
    }
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async deleteByTag(tag: string): Promise<void> {
    for (const k of this.tags.get(tag) ?? []) this.entries.delete(k);
    this.tags.delete(tag);
  }
}

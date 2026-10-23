import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { CachePort, readThrough } from '../../src/modules/cache/cache.port';
import { MemoryCache } from '../../src/modules/cache/infrastructure/memory-cache';
import { RedisCache } from '../../src/modules/cache/infrastructure/redis-cache';
import { RefreshSession, RefreshSessionStore } from '../../src/modules/iam/domain/ports';
import { MemoryRefreshSessionStore } from '../../src/modules/iam/infrastructure/sessions/memory-refresh-session-store';
import { RedisRefreshSessionStore } from '../../src/modules/iam/infrastructure/sessions/redis-refresh-session-store';
import { Permission } from '../../src/modules/iam/domain/value-objects/permission';
import { Temporal } from '../../src/shared-kernel/temporal';
import { buildWorld } from './fakes';

// ioredis-mock partage son état entre instances : on réutilise une instance et on la vide avant chaque test.
const shared = new (RedisMock as never as new () => Redis)();
const newRedis = () => shared;
beforeEach(async () => { await shared.flushall(); });

const session = (id: string, over: Partial<RefreshSession> = {}): RefreshSession => ({
  id,
  userId: 'user-1',
  familyId: 'fam-1',
  secretHash: 'h'.repeat(64),
  expiresAt: Temporal.Now.instant().add({ hours: 24 }),
  scope: 'full',
  ip: '10.0.0.1',
  userAgent: 'jest',
  ...over,
});

describe.each<[string, () => RefreshSessionStore]>([
  ['Redis', () => new RedisRefreshSessionStore(newRedis())],
  ['mémoire', () => new MemoryRefreshSessionStore()],
])('RefreshSessionStore — %s', (_name, make) => {
  let store: RefreshSessionStore;
  beforeEach(() => { store = make(); });

  it('crée puis retrouve une session sans la marquer utilisée', async () => {
    await store.create(session('a'));
    const f = await store.find('a');
    expect(f?.used).toBe(false);
    expect(f?.session).toMatchObject({ userId: 'user-1', familyId: 'fam-1', scope: 'full', ip: '10.0.0.1', userAgent: 'jest' });
    expect(f?.session.expiresAt.epochMilliseconds).toBeGreaterThan(Temporal.Now.instant().epochMilliseconds);
  });

  it('ne connaît pas une session inconnue', async () => {
    expect(await store.find('nope')).toBeNull();
  });

  it('markUsed est atomique : un seul gagnant parmi des rafraîchissements simultanés', async () => {
    await store.create(session('a'));
    const results = await Promise.all([store.markUsed('a'), store.markUsed('a'), store.markUsed('a')]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await store.find('a'))?.used).toBe(true);
  });

  it("markUsed sur une session absente ou révoquée échoue et ne laisse aucune trace", async () => {
    expect(await store.markUsed('ghost')).toBe(false);
    expect(await store.find('ghost')).toBeNull();
    await store.create(session('b'));
    await store.revokeFamily('fam-1');
    expect(await store.markUsed('b')).toBe(false);
    expect(await store.find('b')).toBeNull();
  });

  it('révoque une famille entière sans toucher les autres', async () => {
    await store.create(session('a'));
    await store.create(session('b'));
    await store.create(session('c', { familyId: 'fam-2' }));
    await store.revokeFamily('fam-1');
    expect(await store.find('a')).toBeNull();
    expect(await store.find('b')).toBeNull();
    expect(await store.find('c')).not.toBeNull();
  });

  it("révoque toutes les sessions d'un utilisateur, toutes familles confondues", async () => {
    await store.create(session('a'));
    await store.create(session('b', { familyId: 'fam-2' }));
    await store.create(session('c', { userId: 'user-2', familyId: 'fam-3' }));
    await store.revokeAllForUser('user-1');
    expect(await store.find('a')).toBeNull();
    expect(await store.find('b')).toBeNull();
    expect(await store.find('c')).not.toBeNull();
  });
});

describe('RedisRefreshSessionStore — particularités', () => {
  it("n'écrit jamais le jeton brut et fait expirer la session à sa date de fin", async () => {
    const redis = newRedis();
    const store = new RedisRefreshSessionStore(redis);
    await store.create(session('a', { expiresAt: Temporal.Now.instant().add({ seconds: 100 }) }));
    const raw = JSON.stringify(await redis.hgetall('iam:rs:a'));
    expect(raw).toContain('h'.repeat(64));
    const ttl = await redis.ttl('iam:rs:a');
    expect(ttl).toBeGreaterThan(90);
    expect(ttl).toBeLessThanOrEqual(100);
  });
});

describe.each<[string, () => CachePort]>([
  ['Redis', () => new RedisCache(newRedis())],
  ['mémoire', () => new MemoryCache()],
])('CachePort — %s', (_name, make) => {
  let cache: CachePort;
  beforeEach(() => { cache = make(); });

  it('stocke et relit des objets JSON ; une clé absente donne null', async () => {
    await cache.set('k', { a: 1, b: ['x'] }, 60);
    expect(await cache.get('k')).toEqual({ a: 1, b: ['x'] });
    expect(await cache.get('absent')).toBeNull();
  });

  it('supprime une clé', async () => {
    await cache.set('k', 1, 60);
    await cache.delete('k');
    expect(await cache.get('k')).toBeNull();
  });

  it('invalide par étiquette : seules les entrées étiquetées disparaissent', async () => {
    await cache.set('a', 1, 60, ['user:1']);
    await cache.set('b', 2, 60, ['user:1', 'dept:9']);
    await cache.set('c', 3, 60, ['user:2']);
    await cache.deleteByTag('user:1');
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
    expect(await cache.get('c')).toBe(3);
  });
});

describe('MemoryCache — expiration', () => {
  it('ne sert plus une entrée expirée', async () => {
    const cache = new MemoryCache();
    await cache.set('k', 1, -1); // déjà expirée
    expect(await cache.get('k')).toBeNull();
  });
});

describe('readThrough', () => {
  it('charge une fois puis sert le cache', async () => {
    const cache = new MemoryCache();
    const load = jest.fn(async () => ({ v: 1 }));
    expect(await readThrough(cache, 'k', 60, [], load)).toEqual({ v: 1 });
    expect(await readThrough(cache, 'k', 60, [], load)).toEqual({ v: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("continue de lire la source quand le cache est en panne (lecture et écriture)", async () => {
    const broken: CachePort = {
      get: async () => { throw new Error('redis down'); },
      set: async () => { throw new Error('redis down'); },
      delete: async () => undefined,
      deleteByTag: async () => undefined,
    };
    const load = jest.fn(async () => 'valeur');
    expect(await readThrough(broken, 'k', 60, [], load)).toBe('valeur');
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('PermissionResolver — cache d\'autorisation', () => {
  it("met en cache les droits, puis les relit frais dès qu'on change les rôles ou désactive le compte", async () => {
    const w = buildWorld();
    const user = await w.addUser({ username: 'caissier', password: 'x'.repeat(14), roles: ['CASHIER'] });
    const spy = jest.spyOn(w.users, 'findById');

    const first = await w.resolver.authorizationOf(user.id.value);
    await w.resolver.authorizationOf(user.id.value);
    expect(spy).toHaveBeenCalledTimes(1); // second appel servi par le cache
    expect(first).toMatchObject({ active: true, roles: ['CASHIER'], requiresMfa: false });

    // changement de rôle + invalidation : effet immédiat, pas dans 60 s
    user.assignRoles([...w.roles['roles'].filter((r) => r.code.value === 'DOCTOR').map((r) => r.code)]);
    await w.resolver.invalidate(user.id.value);
    const after = await w.resolver.authorizationOf(user.id.value);
    expect(after).toMatchObject({ roles: ['DOCTOR'], requiresMfa: true });
    expect(after?.permissions).toContain('files.clinical:read:department');

    user.disable();
    await w.resolver.invalidate(user.id.value);
    expect((await w.resolver.authorizationOf(user.id.value))?.active).toBe(false);
  });

  it('refuse un utilisateur inconnu, un compte désactivé et une permission non accordée', async () => {
    const w = buildWorld();
    const req = (s: string) => { const r = Permission.create(s); if (!r.ok) throw new Error('perm'); return r.value; };
    const user = await w.addUser({ username: 'caissier', password: 'x'.repeat(14), roles: ['CASHIER'] });

    expect(await w.resolver.can(user.id.value, req('billing:write'))).toBe(true);
    expect(await w.resolver.can(user.id.value, req('iam.users:manage'))).toBe(false);
    expect(await w.resolver.can('00000000-0000-4000-8000-0000000000ff', req('billing:write'))).toBe(false);
    expect(await w.resolver.can('pas-un-uuid', req('billing:write'))).toBe(false);

    user.disable();
    await w.resolver.invalidate(user.id.value);
    expect(await w.resolver.can(user.id.value, req('billing:write'))).toBe(false);
  });
});

import { AuditEntry, AuditLog } from '../../src/modules/audit/domain/audit-log.port';
import { CachePort } from '../../src/modules/cache/cache.port';
import { PermissionResolver } from '../../src/modules/iam/application/permission-resolver';
import { SessionIssuer } from '../../src/modules/iam/application/session-issuer';
import {
  AccessClaims,
  BreachedPasswordChecker,
  LegacyPasswordVerifier,
  PasswordHasher,
  RefreshSession,
  RefreshSessionStore,
  RoleRepository,
  SecretCipher,
  TokenIssuer,
  TotpService,
  UserRepository,
} from '../../src/modules/iam/domain/ports';
import { Role } from '../../src/modules/iam/domain/role';
import { User } from '../../src/modules/iam/domain/user';
import { Email } from '../../src/modules/iam/domain/value-objects/email';
import { PasswordHash } from '../../src/modules/iam/domain/value-objects/password-hash';
import { Permission } from '../../src/modules/iam/domain/value-objects/permission';
import { PlainPassword } from '../../src/modules/iam/domain/value-objects/plain-password';
import { RoleCode } from '../../src/modules/iam/domain/value-objects/role-code';
import { UserId } from '../../src/modules/iam/domain/value-objects/user-id';
import { Username } from '../../src/modules/iam/domain/value-objects/username';
import { Clock, IdGenerator } from '../../src/shared-kernel/ports';

export const must = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`Résultat en échec : ${JSON.stringify(r.error)}`);
  return r.value;
};

export class FixedClock implements Clock {
  constructor(private t = new Date('2026-10-23T10:00:00Z')) {}
  now(): Date { return new Date(this.t); }
  advance(ms: number): void { this.t = new Date(this.t.getTime() + ms); }
}

export class SeqIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`;
  }
}

export class InMemoryUsers implements UserRepository {
  readonly byId = new Map<string, User>();
  async findById(id: UserId) { return this.byId.get(id.value) ?? null; }
  async findByUsername(u: Username) { return [...this.byId.values()].find((x) => x.username.equals(u)) ?? null; }
  async existsByUsernameOrEmail(u: Username, e: Email) {
    return [...this.byId.values()].some((x) => x.username.equals(u) || x.email.equals(e));
  }
  async save(user: User) { this.byId.set(user.id.value, user); }
  async list(offset: number, limit: number) {
    const all = [...this.byId.values()];
    return { items: all.slice(offset, offset + limit), total: all.length };
  }
}

export class InMemoryRoles implements RoleRepository {
  constructor(private readonly roles: Role[]) {}
  async findByCodes(codes: readonly RoleCode[]) { return this.roles.filter((r) => codes.some((c) => c.equals(r.code))); }
  async findAll() { return this.roles; }
}

/** Hacheur factice rapide : `$argon2id$fake$<mot de passe>`. */
export class FakeHasher implements PasswordHasher {
  timingCalls = 0;
  async hash(p: PlainPassword) { return PasswordHash.fromStored(`$argon2id$fake$${p.reveal()}`); }
  async verify(h: PasswordHash, p: PlainPassword) { return h.value === `$argon2id$fake$${p.reveal()}`; }
  needsRehash() { return false; }
  async equalizeTiming() { this.timingCalls += 1; }
}

/** Ancien schéma factice : `legacy-3des$<base64(mot de passe)>`. */
export class FakeLegacy implements LegacyPasswordVerifier {
  verify(h: PasswordHash, p: PlainPassword) { return h.legacyPayload === Buffer.from(p.reveal()).toString('base64'); }
}

export class FakeTotp implements TotpService {
  static readonly GOOD = '123456';
  generateSecret() { return 'JBSWY3DPEHPK3PXP'; }
  keyUri(secret: string, account: string, issuer: string) { return `otpauth://totp/${issuer}:${account}?secret=${secret}`; }
  verify(_secret: string, code: string) { return code === FakeTotp.GOOD; }
}

export class FakeCipher implements SecretCipher {
  encrypt(p: string) { return `enc:${p}`; }
  decrypt(c: string) { return c.replace(/^enc:/, ''); }
}

export class FakeBreached implements BreachedPasswordChecker {
  constructor(readonly bad = new Set<string>()) {}
  async isBreached(p: PlainPassword) { return this.bad.has(p.reveal()); }
}

export class FakeTokens implements TokenIssuer {
  constructor(private readonly clock: Clock) {}
  async issue(c: AccessClaims) {
    return { token: `at.${Buffer.from(JSON.stringify(c)).toString('base64url')}`, expiresAt: new Date(this.clock.now().getTime() + 900_000) };
  }
  async verify(t: string) {
    return t.startsWith('at.') ? (JSON.parse(Buffer.from(t.slice(3), 'base64url').toString()) as AccessClaims) : null;
  }
}

export class InMemorySessions implements RefreshSessionStore {
  readonly sessions = new Map<string, { s: RefreshSession; used: boolean; revoked: boolean }>();
  async create(s: RefreshSession) { this.sessions.set(s.id, { s, used: false, revoked: false }); }
  async find(id: string) {
    const e = this.sessions.get(id);
    return e && !e.revoked ? { session: e.s, used: e.used } : null;
  }
  async markUsed(id: string) {
    const e = this.sessions.get(id);
    if (!e || e.used) return false;
    e.used = true;
    return true;
  }
  async revokeFamily(familyId: string) { for (const e of this.sessions.values()) if (e.s.familyId === familyId) e.revoked = true; }
  async revokeAllForUser(userId: string) { for (const e of this.sessions.values()) if (e.s.userId === userId) e.revoked = true; }
  active(userId: string) { return [...this.sessions.values()].filter((e) => e.s.userId === userId && !e.revoked && !e.used).length; }
}

export class MemoryAudit implements AuditLog {
  readonly entries: AuditEntry[] = [];
  async record(e: AuditEntry) { this.entries.push(e); }
  last(action: string) { return [...this.entries].reverse().find((e) => e.action === action); }
}

export class MapCache implements CachePort {
  readonly store = new Map<string, unknown>();
  private readonly tags = new Map<string, Set<string>>();
  hits = 0;
  async get<T>(key: string) {
    if (this.store.has(key)) { this.hits += 1; return this.store.get(key) as T; }
    return null;
  }
  async set<T>(key: string, value: T, _ttl: number, tags: readonly string[] = []) {
    this.store.set(key, value);
    for (const t of tags) (this.tags.get(t) ?? this.tags.set(t, new Set()).get(t)!).add(key);
  }
  async delete(key: string) { this.store.delete(key); }
  async deleteByTag(tag: string) { for (const k of this.tags.get(tag) ?? []) this.store.delete(k); this.tags.delete(tag); }
}

const perm = (...p: string[]) => p.map((x) => must(Permission.create(x)));
const code = (c: string) => must(RoleCode.create(c));

export function buildWorld() {
  const clock = new FixedClock();
  const ids = new SeqIds();
  const users = new InMemoryUsers();
  const roles = new InMemoryRoles([
    new Role(code('SYSTEM_ADMIN'), 'Administrateur', perm('iam.users:manage'), true, true),
    new Role(code('DOCTOR'), 'Médecin', perm('files.clinical:read:department', 'files:upload'), true, true),
    new Role(code('CASHIER'), 'Caissier', perm('billing:write'), false, true),
  ]);
  const hasher = new FakeHasher();
  const legacy = new FakeLegacy();
  const totp = new FakeTotp();
  const cipher = new FakeCipher();
  const breached = new FakeBreached();
  const store = new InMemorySessions();
  const audit = new MemoryAudit();
  const cache = new MapCache();
  const sessions = new SessionIssuer(new FakeTokens(clock), store, ids, clock, 7 * 24 * 3_600_000);
  const resolver = new PermissionResolver(users, roles, cache);

  async function addUser(opts: {
    username: string;
    password: string;
    roles: string[];
    legacy?: boolean;
    mustChangePassword?: boolean;
    mfa?: boolean;
  }): Promise<User> {
    const hash = opts.legacy
      ? PasswordHash.legacy(Buffer.from(opts.password).toString('base64'))
      : PasswordHash.fromStored(`$argon2id$fake$${opts.password}`);
    const user = User.register({
      id: must(UserId.create(ids.next())),
      username: must(Username.create(opts.username)),
      email: must(Email.create(`${opts.username}@hopital.test`)),
      passwordHash: hash,
      roles: opts.roles.map(code),
      now: clock.now(),
      mustChangePassword: opts.mustChangePassword ?? false,
    });
    if (opts.mfa) {
      user.beginMfaEnrollment(cipher.encrypt('JBSWY3DPEHPK3PXP'));
      user.confirmMfaEnrollment(['hash-of-recovery']);
    }
    await users.save(user);
    return user;
  }

  return { clock, ids, users, roles, hasher, legacy, totp, cipher, breached, store, audit, cache, sessions, resolver, addUser };
}
export type World = ReturnType<typeof buildWorld>;

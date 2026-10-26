import { SqlExecutor } from '../../../../database/sql-executor';
import { instantFromDb, instantToDb, requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { UserRepository } from '../../domain/ports';
import { User, UserState } from '../../domain/user';
import { Email } from '../../domain/value-objects/email';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { RoleCode } from '../../domain/value-objects/role-code';
import { UserId } from '../../domain/value-objects/user-id';
import { Username } from '../../domain/value-objects/username';

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  status: 'ACTIVE' | 'DISABLED';
  failed_attempts: number;
  locked_until: Date | null;
  must_change_password: boolean;
  mfa_secret: string | null;
  pending_mfa_secret: string | null;
  recovery_code_hashes: string[];
  password_changed_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  legacy_rbac_user_id: number | null;
}

const COLUMNS = `id, username, email, password_hash, status, failed_attempts, locked_until, must_change_password,
  mfa_secret, pending_mfa_secret, recovery_code_hashes, password_changed_at, last_login_at, created_at, legacy_rbac_user_id`;

/** Une valeur invalide en base est une corruption de données : on échoue bruyamment plutôt que de la laisser circuler. */
function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }, what: string): T {
  if (!r.ok) throw new Error(`Donnée corrompue (${what}) : ${r.error.message}`);
  return r.value;
}

function toUser(row: UserRow, roles: string[]): User {
  const state: UserState = {
    id: unwrap(UserId.create(row.id), 'id'),
    username: unwrap(Username.create(row.username), 'username'),
    email: unwrap(Email.create(row.email), 'email'),
    passwordHash: PasswordHash.fromStored(row.password_hash),
    roles: roles.map((r) => unwrap(RoleCode.create(r), 'role')),
    status: row.status,
    failedAttempts: row.failed_attempts,
    lockedUntil: instantFromDb(row.locked_until),
    mustChangePassword: row.must_change_password,
    mfaSecret: row.mfa_secret,
    pendingMfaSecret: row.pending_mfa_secret,
    recoveryCodeHashes: row.recovery_code_hashes ?? [],
    passwordChangedAt: instantFromDb(row.password_changed_at),
    lastLoginAt: instantFromDb(row.last_login_at),
    createdAt: requiredInstantFromDb(row.created_at),
    legacyRbacUserId: row.legacy_rbac_user_id,
  };
  return User.rehydrate(state);
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: UserId): Promise<User | null> {
    return this.one(`SELECT ${COLUMNS} FROM iam_users WHERE id = $1`, [id.value]);
  }

  async findByUsername(username: Username): Promise<User | null> {
    return this.one(`SELECT ${COLUMNS} FROM iam_users WHERE lower(username) = lower($1)`, [username.value]);
  }

  async existsByUsernameOrEmail(username: Username, email: Email): Promise<boolean> {
    const rows = await this.sql.query(
      'SELECT 1 FROM iam_users WHERE lower(username) = lower($1) OR lower(email) = lower($2) LIMIT 1',
      [username.value, email.value],
    );
    return rows.length > 0;
  }

  async save(user: User): Promise<void> {
    const s = user.snapshot();
    await this.sql.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO iam_users (${COLUMNS})
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[],$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash,
           status = EXCLUDED.status, failed_attempts = EXCLUDED.failed_attempts, locked_until = EXCLUDED.locked_until,
           must_change_password = EXCLUDED.must_change_password, mfa_secret = EXCLUDED.mfa_secret,
           pending_mfa_secret = EXCLUDED.pending_mfa_secret, recovery_code_hashes = EXCLUDED.recovery_code_hashes,
           password_changed_at = EXCLUDED.password_changed_at, last_login_at = EXCLUDED.last_login_at`,
        [
          s.id.value, s.username.value, s.email.value, s.passwordHash.value, s.status, s.failedAttempts, instantToDb(s.lockedUntil),
          s.mustChangePassword, s.mfaSecret, s.pendingMfaSecret, s.recoveryCodeHashes, instantToDb(s.passwordChangedAt), instantToDb(s.lastLoginAt),
          instantToDb(s.createdAt), s.legacyRbacUserId,
        ],
      );
      await tx.query('DELETE FROM iam_user_roles WHERE user_id = $1', [s.id.value]);
      if (s.roles.length > 0) {
        await tx.query(
          'INSERT INTO iam_user_roles (user_id, role_code) SELECT $1, unnest($2::text[])',
          [s.id.value, s.roles.map((r) => r.value)],
        );
      }
    });
  }

  async list(offset: number, limit: number): Promise<{ items: User[]; total: number }> {
    const rows = await this.sql.query<UserRow>(
      `SELECT ${COLUMNS} FROM iam_users ORDER BY created_at, id OFFSET $1 LIMIT $2`,
      [offset, limit],
    );
    const total = await this.sql.query<{ n: number }>('SELECT count(*)::int AS n FROM iam_users');
    const roles = rows.length
      ? await this.sql.query<{ user_id: string; role_code: string }>(
          'SELECT user_id, role_code FROM iam_user_roles WHERE user_id = ANY($1::uuid[])',
          [rows.map((r) => r.id)],
        )
      : [];
    const byUser = new Map<string, string[]>();
    for (const r of roles) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role_code]);
    return { items: rows.map((r) => toUser(r, byUser.get(r.id) ?? [])), total: total[0]?.n ?? 0 };
  }

  private async one(sql: string, params: unknown[]): Promise<User | null> {
    const rows = await this.sql.query<UserRow>(sql, params);
    if (rows.length === 0) return null;
    const roles = await this.sql.query<{ role_code: string }>(
      'SELECT role_code FROM iam_user_roles WHERE user_id = $1 ORDER BY role_code',
      [rows[0].id],
    );
    return toUser(rows[0], roles.map((r) => r.role_code));
  }
}

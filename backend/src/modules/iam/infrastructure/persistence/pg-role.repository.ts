import { SqlExecutor } from '../../../../database/sql-executor';
import { RoleRepository } from '../../domain/ports';
import { Role } from '../../domain/role';
import { Permission } from '../../domain/value-objects/permission';
import { RoleCode } from '../../domain/value-objects/role-code';

interface RoleRow {
  code: string;
  name: string;
  requires_mfa: boolean;
  is_system: boolean;
  permissions: string[];
}

function toRole(row: RoleRow): Role {
  const code = RoleCode.create(row.code);
  if (!code.ok) throw new Error(`Rôle corrompu en base : ${row.code}`);
  const permissions = row.permissions.map((p) => {
    const r = Permission.create(p);
    if (!r.ok) throw new Error(`Permission corrompue en base (${row.code}) : ${p}`);
    return r.value;
  });
  return new Role(code.value, row.name, permissions, row.requires_mfa, row.is_system);
}

export class PgRoleRepository implements RoleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findByCodes(codes: readonly RoleCode[]): Promise<Role[]> {
    if (codes.length === 0) return [];
    const rows = await this.sql.query<RoleRow>(
      'SELECT code, name, requires_mfa, is_system, permissions FROM iam_roles WHERE code = ANY($1::text[]) ORDER BY code',
      [codes.map((c) => c.value)],
    );
    return rows.map(toRole);
  }

  async findAll(): Promise<Role[]> {
    const rows = await this.sql.query<RoleRow>('SELECT code, name, requires_mfa, is_system, permissions FROM iam_roles ORDER BY code');
    return rows.map(toRole);
  }
}

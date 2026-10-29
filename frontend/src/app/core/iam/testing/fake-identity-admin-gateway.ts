import { IdentityAdminGateway } from '../identity-admin.gateway';
import { CreateUserInput, CreatedUser, ManagedUser, RoleInfo, UserAccess, UserPage } from '../identity-admin.models';

export const managedUser = (over: Partial<ManagedUser> = {}): ManagedUser => ({
  id: 'u-1', username: 'marie.curie', email: 'marie.curie@hopital.test', roles: ['DOCTOR'], active: true, locked: false, mfaEnabled: true, mustChangePassword: false, ...over,
});

export const ROLES: readonly RoleInfo[] = [
  { code: 'SYSTEM_ADMIN', name: 'Administrateur système', requiresMfa: true, isSystem: true, permissions: ['iam.users:read', 'iam.users:manage', 'iam.roles:read'] },
  { code: 'DOCTOR', name: 'Médecin', requiresMfa: true, isSystem: true, permissions: ['files.clinical:read:department', 'files.clinical:write:department', 'appointments:read:own'] },
  { code: 'CASHIER', name: 'Caissier(ère)', requiresMfa: false, isSystem: true, permissions: ['billing:read:own'] },
  { code: 'LAB_CHIEF', name: 'Chef de laboratoire', requiresMfa: false, isSystem: false, permissions: [] },
];

/** Double de test du port `IdentityAdminGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeIdentityAdminGateway extends IdentityAdminGateway {
  users: ManagedUser[] = [
    managedUser({ id: 'u-0', username: 'dsi.admin', email: 'dsi@hopital.test', roles: ['SYSTEM_ADMIN'] }),
    managedUser(),
    managedUser({ id: 'u-2', username: 'paul.caissier', email: 'paul@hopital.test', roles: ['CASHIER'], mfaEnabled: false, mustChangePassword: true }),
    managedUser({ id: 'u-3', username: 'ancien.agent', email: 'ancien@hopital.test', roles: ['CASHIER'], active: false }),
    managedUser({ id: 'u-4', username: 'agent.verrouille', email: 'verrou@hopital.test', roles: ['CASHIER'], locked: true }),
  ];

  override listUsers = vi.fn<(offset: number, limit: number) => Promise<UserPage>>().mockImplementation((offset, limit) =>
    Promise.resolve({ items: this.users.slice(offset, offset + limit), total: this.users.length }),
  );
  override createUser = vi.fn<(input: CreateUserInput) => Promise<CreatedUser>>().mockImplementation((input) =>
    Promise.resolve({ user: managedUser({ id: 'u-new', ...input, mfaEnabled: false, mustChangePassword: true }), temporaryPassword: 'k7Qm2xWvB9nRtE4y' }),
  );
  override assignRoles = vi.fn<(id: string, roles: readonly string[]) => Promise<ManagedUser>>().mockImplementation((id, roles) => Promise.resolve(managedUser({ id, roles })));
  override setActive = vi.fn<(id: string, active: boolean) => Promise<ManagedUser>>().mockImplementation((id, active) => Promise.resolve(managedUser({ id, active })));
  override unlock = vi.fn<(id: string) => Promise<ManagedUser>>().mockImplementation((id) => Promise.resolve(managedUser({ id, locked: false })));
  override resetMfa = vi.fn<(id: string) => Promise<ManagedUser>>().mockImplementation((id) => Promise.resolve(managedUser({ id, mfaEnabled: false })));
  override access = vi.fn<(id: string) => Promise<UserAccess>>().mockImplementation((id) =>
    Promise.resolve({
      userId: id, username: 'marie.curie', active: true,
      roles: [{ code: 'DOCTOR', name: 'Médecin', requiresMfa: true }],
      permissions: ['files.clinical:read:department', 'files.clinical:write:department', 'appointments:read:own'],
      departments: ['s-1'],
    }),
  );
  override roles = vi.fn<() => Promise<readonly RoleInfo[]>>().mockResolvedValue(ROLES);
}

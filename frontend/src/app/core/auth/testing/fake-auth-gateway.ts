import { AuthGateway } from '../auth.gateway';
import { CurrentUser, LoginCredentials, LoginResponse, TokenResponse } from '../auth.models';

/** Jeton d'accès factice expirant dans `minutes` minutes. */
export const token = (accessToken = 'at-1', scope: 'full' | 'setup' = 'full', minutes = 15): TokenResponse => ({
  accessToken,
  accessExpiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
  scope,
});

export const user = (over: Partial<CurrentUser> = {}): CurrentUser => ({
  id: '00000000-0000-4000-8000-000000000001',
  username: 'marie.curie',
  email: 'marie.curie@hopital.test',
  roles: ['CASHIER'],
  permissions: ['files:upload:all'],
  mfaEnabled: false,
  mfaRequired: false,
  mustChangePassword: false,
  scope: 'full',
  ...over,
});

/** Double de test du port `AuthGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeAuthGateway extends AuthGateway {
  override login = vi.fn<(c: LoginCredentials) => Promise<LoginResponse>>();
  override refresh = vi.fn<() => Promise<TokenResponse>>();
  override logout = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  override me = vi.fn<() => Promise<CurrentUser>>().mockResolvedValue(user());
  override changePassword = vi.fn<(currentPassword: string, newPassword: string) => Promise<TokenResponse>>();
}

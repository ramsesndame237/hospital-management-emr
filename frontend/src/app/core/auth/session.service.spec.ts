import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ApiError } from '../http/api-error';
import { AuthGateway } from './auth.gateway';
import { SessionService } from './session.service';
import { SessionStore } from './session.store';
import { FakeAuthGateway, token, user } from './testing/fake-auth-gateway';

describe('SessionService', () => {
  let gateway: FakeAuthGateway;
  let service: SessionService;
  let store: SessionStore;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    gateway = new FakeAuthGateway();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthGateway, useValue: gateway }] });
    service = TestBed.inject(SessionService);
    store = TestBed.inject(SessionStore);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  describe('login', () => {
    it('ouvre une session complète et charge le profil', async () => {
      gateway.login.mockResolvedValue({ status: 'authenticated', ...token('at-1'), mustChangePassword: false, mfaEnrollmentRequired: false });
      const outcome = await service.login({ username: 'marie', password: 'x' });
      expect(outcome).toEqual({ kind: 'signed_in', setupRequired: false });
      expect(store.isSignedIn()).toBe(true);
      expect(store.accessToken()).toBe('at-1');
      expect(store.user()?.username).toBe('marie.curie');
    });

    it('signale une session restreinte (compte à finaliser)', async () => {
      gateway.login.mockResolvedValue({ status: 'authenticated', ...token('at-s', 'setup'), mustChangePassword: true, mfaEnrollmentRequired: true });
      const outcome = await service.login({ username: 'nouveau', password: 'x' });
      expect(outcome).toEqual({ kind: 'signed_in', setupRequired: true });
      expect(store.needsSetup()).toBe(true);
      expect(store.isSignedIn()).toBe(false);
    });

    it('demande le second facteur sans ouvrir de session', async () => {
      gateway.login.mockResolvedValue({ status: 'mfa_required' });
      expect(await service.login({ username: 'docteur', password: 'x' })).toEqual({ kind: 'mfa_required' });
      expect(store.status()).toBe('unknown');
      expect(gateway.me).not.toHaveBeenCalled();
    });

    it('laisse remonter les erreurs du serveur sans toucher à la session', async () => {
      gateway.login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.'));
      await expect(service.login({ username: 'a', password: 'b' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(store.status()).toBe('unknown');
    });

    it('referme la session si le profil ne peut pas être chargé', async () => {
      gateway.login.mockResolvedValue({ status: 'authenticated', ...token(), mustChangePassword: false, mfaEnrollmentRequired: false });
      gateway.me.mockRejectedValue(new ApiError(500, 'UNKNOWN', 'boum'));
      await expect(service.login({ username: 'a', password: 'b' })).rejects.toBeInstanceOf(ApiError);
      expect(store.status()).toBe('anonymous');
      expect(store.accessToken()).toBeNull();
    });
  });

  describe('ensureRestored', () => {
    it('retrouve une session existante grâce au cookie de rafraîchissement', async () => {
      gateway.refresh.mockResolvedValue(token('at-restored'));
      await service.ensureRestored();
      expect(store.isSignedIn()).toBe(true);
      expect(store.accessToken()).toBe('at-restored');
    });

    it("passe en anonyme quand il n'y a pas de session", async () => {
      gateway.refresh.mockRejectedValue(new ApiError(401, 'SESSION_INVALID', 'Session expirée.'));
      await service.ensureRestored();
      expect(store.status()).toBe('anonymous');
    });

    it("fusionne les appels simultanés (un seul aller-retour) et n'interroge plus ensuite", async () => {
      gateway.refresh.mockResolvedValue(token());
      await Promise.all([service.ensureRestored(), service.ensureRestored(), service.ensureRestored()]);
      expect(gateway.refresh).toHaveBeenCalledTimes(1);
      await service.ensureRestored();
      expect(gateway.refresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    it('fusionne les rafraîchissements simultanés : une seule rotation du cookie côté serveur', async () => {
      gateway.refresh.mockResolvedValue(token('at-2'));
      const results = await Promise.all([service.refresh(), service.refresh(), service.refresh()]);
      expect(results).toEqual([true, true, true]);
      expect(gateway.refresh).toHaveBeenCalledTimes(1);
      expect(store.accessToken()).toBe('at-2');
    });

    it('perd la session sur un 401, mais pas sur une simple panne réseau', async () => {
      store.setToken('at-1', Date.now() + 60_000, 'full');
      gateway.refresh.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
      expect(await service.refresh()).toBe(false);
      expect(store.status()).toBe('active'); // l'utilisateur n'est pas déconnecté parce que le réseau a sauté

      gateway.refresh.mockRejectedValueOnce(new ApiError(401, 'SESSION_INVALID', 'expirée'));
      expect(await service.refresh()).toBe(false);
      expect(store.status()).toBe('anonymous');
    });

    it('programme le renouvellement du jeton avant son expiration', async () => {
      vi.useFakeTimers();
      gateway.login.mockResolvedValue({ status: 'authenticated', ...token('at-1', 'full', 15), mustChangePassword: false, mfaEnrollmentRequired: false });
      // Expiration calculée à CHAQUE appel, comme le serveur : un jeton figé ferait se rejouer le renouvellement en boucle.
      gateway.refresh.mockImplementation(async () => token('at-2', 'full', 15));
      await service.login({ username: 'a', password: 'b' });

      await vi.advanceTimersByTimeAsync(13 * 60_000);
      expect(gateway.refresh).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2 * 60_000);
      expect(gateway.refresh).toHaveBeenCalledTimes(1);
      expect(store.accessToken()).toBe('at-2');
    });
  });

  describe('logout / expire', () => {
    beforeEach(() => store.setToken('at-1', Date.now() + 60_000, 'full'));

    it('ferme la session et revient à la connexion', async () => {
      await service.logout();
      expect(gateway.logout).toHaveBeenCalled();
      expect(store.status()).toBe('anonymous');
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('ferme la session localement même si le serveur est injoignable', async () => {
      gateway.logout.mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'));
      await service.logout();
      expect(store.status()).toBe('anonymous');
    });

    it("expire : retient la page demandée et affiche l'écran « session expirée »", async () => {
      vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/patients/42');
      await service.expire();
      expect(store.status()).toBe('anonymous');
      expect(navigate).toHaveBeenCalledWith(['/session-expired'], { queryParams: { returnUrl: '/patients/42' } });
      expect(gateway.logout).not.toHaveBeenCalled(); // le serveur a déjà refusé la session : rien à révoquer
    });

    it("expire sans page à reprendre quand on était déjà sur l'écran de connexion", async () => {
      vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/login?returnUrl=%2Fx');
      await service.expire();
      expect(navigate).toHaveBeenCalledWith(['/session-expired'], {});
    });

    it("expire avec révocation (inactivité) : ferme aussi la session côté serveur, sinon le cookie la rouvrirait au rechargement", async () => {
      await service.expire(true);
      expect(gateway.logout).toHaveBeenCalled();
      expect(store.status()).toBe('anonymous');
    });

    it('expire avec révocation même si le serveur est injoignable', async () => {
      gateway.logout.mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'));
      await service.expire(true);
      expect(store.status()).toBe('anonymous');
      expect(navigate).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it("remplace le mot de passe, ouvre la nouvelle session et indique s'il reste à finaliser le compte", async () => {
      gateway.changePassword.mockResolvedValue(token('at-new', 'setup'));
      const outcome = await service.changePassword('provisoire', 'Cheval-pile-agrafe-2026');
      expect(gateway.changePassword).toHaveBeenCalledWith('provisoire', 'Cheval-pile-agrafe-2026');
      expect(outcome).toEqual({ setupRequired: true });
      expect(store.accessToken()).toBe('at-new');
    });

    it('session complète : plus rien à finaliser', async () => {
      gateway.changePassword.mockResolvedValue(token('at-full', 'full'));
      expect(await service.changePassword('a', 'b')).toEqual({ setupRequired: false });
      expect(store.isSignedIn()).toBe(true);
    });

    it('laisse remonter le refus du serveur sans toucher à la session', async () => {
      store.setToken('at-1', Date.now() + 60_000, 'setup');
      gateway.changePassword.mockRejectedValue(new ApiError(400, 'PASSWORD_TOO_COMMON', 'Ce mot de passe est trop courant.'));
      await expect(service.changePassword('a', 'password')).rejects.toMatchObject({ code: 'PASSWORD_TOO_COMMON' });
      expect(store.accessToken()).toBe('at-1');
    });
  });

  it('expose le profil renvoyé par le serveur', async () => {
    gateway.me.mockResolvedValue(user({ roles: ['DOCTOR'], permissions: ['files.clinical:read:department'] }));
    gateway.refresh.mockResolvedValue(token());
    await service.ensureRestored();
    expect(store.user()?.roles).toEqual(['DOCTOR']);
  });
});

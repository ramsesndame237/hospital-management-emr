import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../http/api-error';
import { AuthGateway } from './auth.gateway';
import { authInterceptor } from './auth.interceptor';
import { SessionService } from './session.service';
import { SessionStore } from './session.store';
import { FakeAuthGateway, token } from './testing/fake-auth-gateway';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let gateway: FakeAuthGateway;
  let store: SessionStore;
  let expire: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    gateway = new FakeAuthGateway();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthGateway, useValue: gateway },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
    expire = vi.spyOn(TestBed.inject(SessionService), 'expire').mockResolvedValue();
    store.setToken('at-old', Date.now() + 15 * 60_000, 'full');
  });
  afterEach(() => backend.verify());

  it("joint le jeton d'accès aux appels de l'API", () => {
    http.get('/api/v1/users').subscribe();
    const req = backend.expectOne('/api/v1/users');
    expect(req.request.headers.get('Authorization')).toBe('Bearer at-old');
    req.flush({});
  });

  it("n'envoie JAMAIS le jeton à un autre domaine ni sur les routes d'authentification", () => {
    http.get('https://tiers.example/api').subscribe();
    expect(backend.expectOne('https://tiers.example/api').request.headers.has('Authorization')).toBe(false);

    http.post('/api/v1/auth/login', {}).subscribe();
    expect(backend.expectOne('/api/v1/auth/login').request.headers.has('Authorization')).toBe(false);
    http.post('/api/v1/auth/refresh', {}).subscribe();
    expect(backend.expectOne('/api/v1/auth/refresh').request.headers.has('Authorization')).toBe(false);
  });

  it('sur un 401 : renouvelle le jeton une fois puis rejoue la requête avec le nouveau', async () => {
    gateway.refresh.mockResolvedValue(token('at-new'));
    const result = new Promise((resolve) => http.get('/api/v1/roles').subscribe(resolve));

    backend.expectOne('/api/v1/roles').flush({ code: 'TOKEN_INVALID' }, { status: 401, statusText: 'Unauthorized' });
    await vi.waitFor(() => expect(backend.match('/api/v1/roles').length).toBeGreaterThanOrEqual(0)); // laisse partir le refresh
    const retry = await vi.waitFor(() => backend.expectOne('/api/v1/roles'));
    expect(retry.request.headers.get('Authorization')).toBe('Bearer at-new');
    retry.flush([{ code: 'DOCTOR' }]);

    expect(await result).toEqual([{ code: 'DOCTOR' }]);
    expect(gateway.refresh).toHaveBeenCalledTimes(1);
  });

  it('ne rejoue qu\'une seule fois : un second 401 est remonté tel quel', async () => {
    gateway.refresh.mockResolvedValue(token('at-new'));
    const outcome = new Promise<unknown>((resolve) => http.get('/api/v1/users').subscribe({ error: resolve }));

    backend.expectOne('/api/v1/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    (await vi.waitFor(() => backend.expectOne('/api/v1/users'))).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(((await outcome) as { status: number }).status).toBe(401);
    expect(gateway.refresh).toHaveBeenCalledTimes(1); // pas de boucle infinie
  });

  it('session perdue : renvoie à la connexion et remonte le 401', async () => {
    gateway.refresh.mockRejectedValue(new ApiError(401, 'SESSION_INVALID', 'expirée'));
    const outcome = new Promise<unknown>((resolve) => http.get('/api/v1/users').subscribe({ error: resolve }));

    backend.expectOne('/api/v1/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(((await outcome) as { status: number }).status).toBe(401);
    expect(expire).toHaveBeenCalled();
    expect(store.status()).toBe('anonymous');
  });

  it('fusionne les 401 simultanés : un seul renouvellement pour plusieurs requêtes', async () => {
    gateway.refresh.mockResolvedValue(token('at-new'));
    for (const url of ['/api/v1/a', '/api/v1/b', '/api/v1/c']) http.get(url).subscribe();
    for (const url of ['/api/v1/a', '/api/v1/b', '/api/v1/c']) backend.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

    for (const url of ['/api/v1/a', '/api/v1/b', '/api/v1/c']) {
      const retry = await vi.waitFor(() => backend.expectOne(url));
      expect(retry.request.headers.get('Authorization')).toBe('Bearer at-new');
      retry.flush({});
    }
    expect(gateway.refresh).toHaveBeenCalledTimes(1);
  });

  it('un 401 sur une route d\'authentification ne déclenche aucun renouvellement', () => {
    let status = 0;
    http.post('/api/v1/auth/login', {}).subscribe({ error: (e) => (status = e.status) });
    backend.expectOne('/api/v1/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(gateway.refresh).not.toHaveBeenCalled();
  });

  it('laisse passer les autres erreurs (403, 500) sans renouveler', () => {
    const statuses: number[] = [];
    http.get('/api/v1/x').subscribe({ error: (e) => statuses.push(e.status) });
    backend.expectOne('/api/v1/x').flush({}, { status: 403, statusText: 'Forbidden' });
    http.get('/api/v1/y').subscribe({ error: (e) => statuses.push(e.status) });
    backend.expectOne('/api/v1/y').flush({}, { status: 500, statusText: 'Server Error' });
    expect(statuses).toEqual([403, 500]);
    expect(gateway.refresh).not.toHaveBeenCalled();
  });
});

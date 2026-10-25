import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ApiError, toApiError } from './api-error';

describe('ApiError : dérivés', () => {
  it('reconnaît trop de tentatives et incident serveur', () => {
    expect(new ApiError(429, 'HTTP_429', 'x').isRateLimited).toBe(true);
    expect(new ApiError(503, 'UNKNOWN', 'x').isServerError).toBe(true);
    expect(new ApiError(401, 'INVALID_CREDENTIALS', 'x').isServerError).toBe(false);
  });

  it("lit le délai d'attente demandé par le serveur (Retry-After)", () => {
    const withHeader = toApiError(new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '42' }), error: { code: 'HTTP_429', message: 'Trop' } }));
    expect(withHeader.retryAfterSeconds).toBe(42);
    const without = toApiError(new HttpErrorResponse({ status: 429, error: { code: 'HTTP_429', message: 'Trop' } }));
    expect(without.retryAfterSeconds).toBeNull();
  });
});

describe('toApiError', () => {
  it("lit la forme d'erreur de l'API { statusCode, code, message }", () => {
    const e = toApiError(new HttpErrorResponse({ status: 401, error: { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Identifiant ou mot de passe incorrect.' } }));
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Identifiant ou mot de passe incorrect.' });
    expect(e.isNetwork).toBe(false);
  });

  it('conserve le détail par champ des erreurs de validation', () => {
    const e = toApiError(
      new HttpErrorResponse({ status: 400, error: { code: 'VALIDATION_FAILED', message: 'Invalide.', errors: [{ field: 'username', rule: 'isString', message: 'Texte requis.' }, { nope: true }] } }),
    );
    expect(e.fieldErrors).toEqual([{ field: 'username', rule: 'isString', message: 'Texte requis.' }]);
  });

  it('reconnaît une panne réseau (statut 0)', () => {
    const e = toApiError(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));
    expect(e.isNetwork).toBe(true);
    expect(e.status).toBe(0);
  });

  it("ne plante pas sur un corps inattendu (HTML d'un proxy, texte, null)", () => {
    expect(toApiError(new HttpErrorResponse({ status: 502, error: '<html>Bad gateway</html>', statusText: 'Bad Gateway' }))).toMatchObject({ status: 502, code: 'UNKNOWN', message: 'Bad Gateway' });
    expect(toApiError(new HttpErrorResponse({ status: 500, error: null })).code).toBe('UNKNOWN');
    expect(toApiError(new Error('boum'))).toMatchObject({ code: 'UNKNOWN', message: 'boum' });
    expect(toApiError('texte').message).toBe('texte');
  });

  it('renvoie telle quelle une ApiError déjà convertie', () => {
    const original = new ApiError(403, 'FORBIDDEN', 'Non.');
    expect(toApiError(original)).toBe(original);
  });
});

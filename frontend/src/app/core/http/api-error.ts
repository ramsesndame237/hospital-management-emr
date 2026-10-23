import { HttpErrorResponse } from '@angular/common/http';

/** Erreur de validation d'un champ, telle que renvoyée par l'API (`code: 'VALIDATION_FAILED'`). */
export interface FieldError {
  readonly field: string;
  readonly rule: string;
  readonly message: string;
}

/**
 * Forme unique de toute erreur de l'API : `{ statusCode, code, message, errors? }`. Le `code` est stable (on s'en sert pour
 * réagir par programme), le `message` est déjà dans la langue de l'interface (l'API lit l'en-tête `X-Locale`).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: readonly FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean {
    return this.code === 'NETWORK';
  }
}

const UNKNOWN = 'UNKNOWN';

/** Convertit n'importe quelle erreur levée par `HttpClient` en `ApiError`. Ne lève jamais. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    // statut 0 : serveur injoignable, coupure réseau, CORS…
    if (error.status === 0) return new ApiError(0, 'NETWORK', error.message);
    const body = error.error as { code?: unknown; message?: unknown; errors?: unknown } | null;
    const code = typeof body?.code === 'string' ? body.code : UNKNOWN;
    const message = typeof body?.message === 'string' ? body.message : error.statusText;
    const fieldErrors = Array.isArray(body?.errors) ? (body.errors as FieldError[]).filter((e) => typeof e?.message === 'string') : [];
    return new ApiError(error.status, code, message, fieldErrors);
  }
  return new ApiError(0, UNKNOWN, error instanceof Error ? error.message : String(error));
}

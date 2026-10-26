import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { DANPHE_ENVELOPE, DanpheResponse, failed, ok } from './danphe-response';

/**
 * Reproduit le comportement des `InvokeHttpGetFunction` / `InvokeHttpPostFunction` du backend .NET pour les contrôleurs
 * marqués `@DanpheApi()` :
 *  - succès : le retour de l'action devient `{ Status: 'OK', Results }` ;
 *  - erreur métier : HTTP 200 + `{ Status: 'Failed', ErrorMessage }` (l'Angular affiche `ErrorMessage`) ;
 *  - 401/403 : le code HTTP est conservé (le front redirige sur ces codes), avec la même forme de corps.
 * C'est un intercepteur et non un filtre d'exceptions : seul l'intercepteur connaît le contrôleur courant.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Envelope');
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const wrap = this.reflector.getAllAndOverride<boolean>(DANPHE_ENVELOPE, [context.getHandler(), context.getClass()]);
    if (!wrap) return next.handle();
    return next.handle().pipe(
      map((value) => {
        // déjà enveloppé (l'action a choisi son Status) : on ne touche à rien
        if (value && typeof value === 'object' && 'Status' in (value as object)) return value as DanpheResponse;
        return ok(value);
      }),
      catchError((err: unknown) => {
        const status = err instanceof HttpException ? err.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        const message = this.messageOf(err);
        if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
          return throwError(() => new HttpException(failed(message), status));
        }
        if (!(err instanceof HttpException) || status >= 500) this.logger.error(message, err instanceof Error ? err.stack : undefined);
        return of(failed(message));
      }),
    );
  }

  private messageOf(err: unknown): string {
    if (err instanceof HttpException) {
      const r = err.getResponse();
      if (typeof r === 'string') return r;
      const m = (r as { message?: string | string[] }).message;
      return Array.isArray(m) ? m.join(' ; ') : (m ?? err.message);
    }
    return err instanceof Error ? err.message : String(err);
  }
}

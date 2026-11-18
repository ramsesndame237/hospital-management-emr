import { LogLevel, LoggerService } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Journaux d'exploitation. Règle absolue : AUCUNE donnée de santé ni personnelle dans ces lignes. On y met la méthode, le gabarit de la route
 * (`/api/v1/patients/:id`, jamais l'adresse réelle), le statut, la durée, l'adresse du poste et un identifiant de corrélation ; jamais la
 * chaîne de requête (elle peut porter un numéro de dossier), ni les en-têtes, ni le corps. Le « qui a fait quoi » métier reste dans le
 * journal d'audit en base.
 */

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;
const UUID_OR_NUMBER = /\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)(?=\/|$)/gi;
/** Sondes de supervision : des milliers de lignes sans intérêt. */
const QUIET = new Set(['/api/Health', '/healthz']);

/** Gabarit de la route ; à défaut (404), le chemin dont les identifiants sont masqués. */
export function routeOf(req: Pick<Request, 'baseUrl' | 'route' | 'path'>): string {
  const template = req.route?.path;
  if (typeof template === 'string') return `${req.baseUrl ?? ''}${template}`;
  return String(req.path).replace(UUID_OR_NUMBER, '/:id');
}

export interface RequestLogOptions {
  /** Reçoit une ligne par requête terminée. Par défaut : le journal Nest. */
  readonly write: (line: Record<string, unknown>) => void;
  readonly now?: () => number;
}

/** Une ligne par requête, avec un identifiant de corrélation renvoyé au client (`X-Request-Id`) pour retrouver l'incident dans les journaux. */
export function requestLogger(options: RequestLogOptions) {
  const now = options.now ?? (() => performance.now());
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', requestId);
    if (QUIET.has(req.path)) return next();
    const started = now();
    res.on('finish', () => {
      options.write({
        requestId,
        method: req.method,
        route: routeOf(req),
        status: res.statusCode,
        durationMs: Math.round(now() - started),
        ip: req.ip,
      });
    });
    next();
  };
}

/** Une ligne JSON par message (Docker, Loki, ELK…). Les erreurs vont sur stderr, le reste sur stdout. */
export class JsonLogger implements LoggerService {
  constructor(private readonly out: (stream: 'stdout' | 'stderr', line: string) => void = (s, l) => void process[s].write(l)) {}

  log(message: unknown, context?: string) { this.emit('log', message, context); }
  warn(message: unknown, context?: string) { this.emit('warn', message, context); }
  debug(message: unknown, context?: string) { this.emit('debug', message, context); }
  verbose(message: unknown, context?: string) { this.emit('verbose', message, context); }
  fatal(message: unknown, stack?: string, context?: string) { this.emit('fatal', message, context, stack); }
  error(message: unknown, stackOrContext?: string, context?: string) {
    // Nest appelle error(message, stack, context) ou error(message, context).
    this.emit('error', message, context ?? (stackOrContext && !stackOrContext.includes('\n') ? stackOrContext : undefined), context || stackOrContext?.includes('\n') ? stackOrContext : undefined);
  }
  setLogLevels(_levels: LogLevel[]) { /* tous les niveaux sont émis ; le filtrage se fait à la collecte */ }

  private emit(level: string, message: unknown, context?: string, stack?: string): void {
    const body = typeof message === 'object' && message !== null && !(message instanceof Error) ? message : { message: message instanceof Error ? message.message : String(message) };
    const line = JSON.stringify({ time: new Date().toISOString(), level, context, ...body, stack: stack ?? (message instanceof Error ? message.stack : undefined) });
    this.out(level === 'error' || level === 'fatal' ? 'stderr' : 'stdout', `${line}\n`);
  }
}

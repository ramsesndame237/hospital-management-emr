import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Localizer } from '../application/localizer';
import { TranslationParams } from '../domain/ports';

/**
 * Point unique de localisation des erreurs HTTP. Les couches métier ne portent qu'un `code` stable (`INVALID_CREDENTIALS`)
 * et d'éventuels paramètres ; c'est ici, à la frontière, que le code devient une phrase dans la langue de la requête.
 *
 *  - `code` présent et connu du catalogue → message traduit (`errors.<CODE>`) ;
 *  - pas de `code` → on déduit `HTTP_<statut>` (404, 429…) quand le catalogue le connaît ;
 *  - erreur inattendue (bug) → journalisée, jamais exposée : message générique localisé.
 * Un corps sans code ni entrée de catalogue reste tel quel, pour ne rien casser des routes historiques.
 */
@Catch()
export class LocalizedExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly localizer: Localizer,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;
    const { httpAdapter } = this.httpAdapterHost;
    const response = host.switchToHttp().getResponse();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!isHttp) this.logger.error(exception instanceof Error ? exception.message : String(exception), exception instanceof Error ? exception.stack : undefined);

    httpAdapter.reply(response, this.body(status, isHttp ? exception.getResponse() : undefined), status);
  }

  private body(status: number, raw: string | object | undefined): unknown {
    const original: Record<string, unknown> = typeof raw === 'string' ? { statusCode: status, message: raw } : { ...(raw as Record<string, unknown> | undefined) };
    const code = typeof original.code === 'string' ? original.code : `HTTP_${status}`;
    const { params, ...rest } = original as { params?: TranslationParams } & Record<string, unknown>;
    if (!this.localizer.hasError(code)) return raw === undefined ? { statusCode: status, message: 'Internal server error' } : original;
    return {
      ...rest,
      statusCode: status,
      code,
      message: this.localizer.error(code, params, typeof rest.message === 'string' ? rest.message : undefined),
    };
  }
}

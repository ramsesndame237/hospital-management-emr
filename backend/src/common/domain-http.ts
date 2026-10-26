import { HttpException, HttpStatus } from '@nestjs/common';
import { DomainError, Result } from '../shared-kernel/result';

/**
 * Conversion d'une erreur de domaine en réponse HTTP, pour un module : on fournit la table `code d'erreur → statut` ;
 * toute autre erreur de domaine est une saisie invalide (422). Le `message` est le texte de repli (français) : c'est le
 * filtre d'exceptions du module i18n qui le remplace par la traduction du `code`, avec les `params`.
 */
export function domainHttp(statuses: Readonly<Record<string, HttpStatus>>) {
  const toHttp = (error: DomainError): HttpException => {
    const status = statuses[error.code] ?? HttpStatus.UNPROCESSABLE_ENTITY;
    return new HttpException({ statusCode: status, code: error.code, message: error.message, params: error.details }, status);
  };
  /** Déballe un `Result` : la valeur en cas de succès, une exception HTTP typée sinon. */
  const unwrap = <T>(result: Result<T>): T => {
    if (result.ok) return result.value;
    throw toHttp(result.error);
  };
  return { toHttp, unwrap };
}

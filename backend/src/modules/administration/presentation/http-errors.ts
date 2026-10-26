import { HttpException, HttpStatus } from '@nestjs/common';
import { DomainError, Result } from '../../../shared-kernel/result';

const STATUS: Readonly<Record<string, HttpStatus>> = {
  ORGANIZATION_NOT_FOUND: HttpStatus.NOT_FOUND,
  FACILITY_NOT_FOUND: HttpStatus.NOT_FOUND,
  FACILITY_CODE_ALREADY_EXISTS: HttpStatus.CONFLICT,
};

/**
 * Toute autre erreur de domaine est une saisie invalide : 422. Le `message` est le texte de repli (français) ; le filtre
 * d'exceptions du module i18n le remplace par la traduction du `code`, avec les `params`.
 */
export function toHttp(error: DomainError): HttpException {
  const status = STATUS[error.code] ?? HttpStatus.UNPROCESSABLE_ENTITY;
  return new HttpException({ statusCode: status, code: error.code, message: error.message, params: error.details }, status);
}

/** Déballe un `Result` : la valeur en cas de succès, une exception HTTP typée sinon. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw toHttp(result.error);
}

import { HttpException, HttpStatus } from '@nestjs/common';
import { DomainError, Result } from '../../../shared-kernel/result';

const STATUS: Readonly<Record<string, HttpStatus>> = {
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  MFA_CODE_INVALID: HttpStatus.UNAUTHORIZED,
  SESSION_INVALID: HttpStatus.UNAUTHORIZED,
  SELF_MODIFICATION_FORBIDDEN: HttpStatus.FORBIDDEN,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  USER_ALREADY_EXISTS: HttpStatus.CONFLICT,
  MFA_ALREADY_ENABLED: HttpStatus.CONFLICT,
  MFA_NOT_STARTED: HttpStatus.CONFLICT,
};

/**
 * Toute autre erreur de domaine est une saisie invalide : 422. Le `message` ici est le texte de repli (français) ;
 * c'est le filtre d'exceptions du module i18n qui le remplace par la traduction du `code`, avec les `params`.
 */
export function toHttp(error: DomainError): HttpException {
  return new HttpException(
    { statusCode: STATUS[error.code] ?? HttpStatus.UNPROCESSABLE_ENTITY, code: error.code, message: error.message, params: error.details },
    STATUS[error.code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

/** Déballe un `Result` : la valeur en cas de succès, une exception HTTP typée sinon. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw toHttp(result.error);
}

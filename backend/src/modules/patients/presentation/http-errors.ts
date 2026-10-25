import { HttpException, HttpStatus } from '@nestjs/common';
import { domainHttp } from '../../../common/domain-http';
import { DomainError, Result } from '../../../shared-kernel/result';

const base = domainHttp({
  PATIENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PATIENT_POSSIBLE_DUPLICATE: HttpStatus.CONFLICT,
  PATIENT_ALREADY_DECEASED: HttpStatus.CONFLICT,
});

/**
 * Comme les autres modules, avec une exception : le refus pour doublon porte la liste des dossiers qui ressemblent (`candidates`,
 * des résumés), pour que l'interface puisse les montrer sans second appel. Aucune autre erreur n'expose de donnée.
 */
export function toHttp(error: DomainError): HttpException {
  const exception = base.toHttp(error);
  if (error.code !== 'PATIENT_POSSIBLE_DUPLICATE') return exception;
  return new HttpException({ ...(exception.getResponse() as object), candidates: error.details?.candidates ?? [] }, exception.getStatus());
}

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw toHttp(result.error);
}

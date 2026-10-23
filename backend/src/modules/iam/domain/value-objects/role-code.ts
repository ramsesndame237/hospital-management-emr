import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ValueObject } from '../../../../shared-kernel/value-object';

const PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;

export class RoleCode extends ValueObject<string> {
  static create(raw: string): Result<RoleCode> {
    const v = (raw ?? '').trim().toUpperCase();
    if (!PATTERN.test(v)) return err(new DomainError('ROLE_CODE_INVALID', 'Code de rôle invalide (MAJUSCULES_ET_TIRETS_BAS).'));
    return ok(new RoleCode(v));
  }
}

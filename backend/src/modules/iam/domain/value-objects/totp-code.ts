import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ValueObject } from '../../../../shared-kernel/value-object';

export class TotpCode extends ValueObject<string> {
  static create(raw: string): Result<TotpCode> {
    const v = (raw ?? '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(v)) return err(new DomainError('TOTP_CODE_INVALID', 'Le code doit comporter 6 chiffres.'));
    return ok(new TotpCode(v));
  }
}

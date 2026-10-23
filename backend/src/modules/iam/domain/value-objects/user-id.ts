import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ValueObject } from '../../../../shared-kernel/value-object';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UserId extends ValueObject<string> {
  static create(raw: string): Result<UserId> {
    if (!UUID.test(raw ?? '')) return err(new DomainError('USER_ID_INVALID', "Identifiant d'utilisateur invalide."));
    return ok(new UserId(raw.toLowerCase()));
  }
}

import {DomainError, err, ok, Result} from "../../../../shared-kernel/result";
import {ValueObject} from "../../../../shared-kernel/value-object";

export class FacilityId extends ValueObject<string> {
    static create(raw: string): Result<FacilityId> {
        const normalized = raw.trim()
        const uuidPartern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidPartern.test(normalized)) {
            return err(new DomainError('FACILITY_ID_INVALID', 'L\'identifiant de cet établissement est invalide'))
        }

        return ok(new FacilityId(normalized.toLowerCase()))
    }

    getValue(): string {
        return this.value;
    }
    equals(other:FacilityId): boolean {
        return this.value === other.value;
    }
}
import {DomainError, Result,err,ok} from "../../../../shared-kernel/result";
import {ValueObject} from "../../../../shared-kernel/value-object";

export class FacilityCode extends ValueObject<string> {

    static create(raw: string): Result<FacilityCode>{
        const normalized = raw.trim()

        const codePatern = /^[0-9A-Z]{4}-[0-9a-z]{3}-[0-9]{2}$/;

        if(normalized.length === 0 || !codePatern.test(normalized)) {
            return err(new DomainError('FACILITY_CODE_INVALID','Code de l\'établissement invalide', { value: raw }));
        }
        return ok(new FacilityCode(normalized));
    }

    getValue(): string{
        return this.value
    }

    equals(other:FacilityCode): boolean {
        return this.value === other.value;
    }
}
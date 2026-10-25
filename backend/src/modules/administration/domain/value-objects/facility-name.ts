import { DomainError,err,Result, ok } from "../../../../shared-kernel/result";
import {ValueObject} from "../../../../shared-kernel/value-object";

export class FacilityName extends ValueObject<string>{
    static create(raw:string):Result<FacilityName>{
        const normalized:string=raw.trim();

        if (normalized.length === 0){
            return err(new DomainError('FACILITY_NAME_INVALID','Nom d\'établissement invalide '));
        }
        return ok(new FacilityName(normalized));
    }

    getValue():string{
        return this.value;
    }
    equals(other:FacilityName): boolean {
        return this.value === other.value;
    }
}
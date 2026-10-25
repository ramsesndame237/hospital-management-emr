import { DomainError,err,ok,Result } from "../../../../shared-kernel/result";
import {ValueObject} from "../../../../shared-kernel/value-object";


export class OrganizationName extends ValueObject<string> {
    static create(value:string):Result<OrganizationName>{
        const normalized:string = value.trim();
        if(normalized.length ===0){
            return err(new DomainError('ORGANIZATION_NAME_INVALID','Nom d\'organisation invalide'))
        }
        return ok(new OrganizationName(normalized));
    }

    getValue():string{
        return this.value;
    }
    equals(other:OrganizationName): boolean {
        return this.value === other.value;
    }

}
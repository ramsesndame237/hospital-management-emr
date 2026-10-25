import {DomainError,err,ok,Result} from "../../../../shared-kernel/result";
import {ValueObject} from "../../../../shared-kernel/value-object";

export class OrganizationId extends ValueObject<string> {
    static create(value:string):Result<OrganizationId>{
        const normalized = value.trim();

        const uuidPartern =/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidPartern.test(normalized)) {
            return err(new DomainError('ORGANIZATION_ID_INVALID','id de l\'organisation est invalide'));
        }
        return ok(new OrganizationId(normalized.toLowerCase()));
    }

    getValue():string{
        return this.value;
    }
    equals(other:OrganizationId):boolean{
        return this.value === other.value;
    }
}
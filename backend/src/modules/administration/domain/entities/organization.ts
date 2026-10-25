import {OrganizationId} from "../value-objects/organization-id";
import {OrganizationName} from "../value-objects/organization-name";
import {Result,ok} from "../../../../shared-kernel/result";

export class Organization{
    private constructor(private  readonly id:OrganizationId,private  name:OrganizationName){}

    static create(id:OrganizationId,name:OrganizationName):Result<Organization>{
        return ok(new Organization(id, name))
    }

    getId():OrganizationId{
        return  this.id;
    }
    getName(): OrganizationName{
        return this.name;
    }
    updateName(name:OrganizationName):void{
        this.name = name;
    }
    testMatch(other:Organization):boolean{
        return this.id.equals(other.id);
    }
}
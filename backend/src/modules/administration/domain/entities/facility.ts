import {FacilityId} from "../value-objects/facility-id";
import {OrganizationId} from "../value-objects/organization-id";
import {FacilityCode} from "../value-objects/facility-code";
import {FacilityName} from "../value-objects/facility-name";
import {ok, Result} from "../../../../shared-kernel/result";
import { FacilityStatus, FacilityStatusEnum } from "../value-objects/FacilityStatus";

export class Facility {
    private constructor(private readonly id: FacilityId, private readonly organizationId: OrganizationId, private name: FacilityName, private code: FacilityCode,private status:FacilityStatus) {
    }

    static create(name:FacilityName, code: FacilityCode,id:FacilityId,organizationId:OrganizationId, initialStatus: FacilityStatus = FacilityStatus.fromEnum(FacilityStatusEnum.OPERATIONAL_UNDER_CONSTRUCTION)):Result<Facility> {
        return ok(new Facility(id,organizationId,name,code,initialStatus))
    }

    getId():FacilityId{
        return this.id
    }
    getOrganizationId():OrganizationId{
        return this.organizationId;
    }
    getName():FacilityName{
        return this.name;
    }

    getCode():FacilityCode{
        return this.code;
    }

    updateName(name:FacilityName):void{
        this.name = name
    }
    updateCode(code:FacilityCode):void{
        this.code = code
    }
    getStatus(): FacilityStatus {
        return this.status;
    }

    updateStatus(newStatus: FacilityStatus): void {
        this.status = newStatus;
    }

    isOperational(): boolean {
        return this.status.getValue() === FacilityStatusEnum.OPERATIONAL_OPEN;
    }
    equals(other:Facility):boolean{
        return this.id.equals(other.id)
    }

}
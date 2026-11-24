import {FacilityId} from "../value-objects/facility-id";
import {OrganizationId} from "../value-objects/organization-id";
import {FacilityCode} from "../value-objects/facility-code";
import {FacilityName} from "../value-objects/facility-name";
import {ok, Result} from "../../../../shared-kernel/result";
import { FacilityStatus, FacilityStatusEnum } from "../value-objects/FacilityStatus";
import { FacilityLocation } from "../value-objects/facility-location";

export class Facility {
    private constructor(private readonly id: FacilityId, private readonly organizationId: OrganizationId, private name: FacilityName, private code: FacilityCode,private status:FacilityStatus, private location: FacilityLocation | null = null) {
    }

    static create(name:FacilityName, code: FacilityCode,id:FacilityId,organizationId:OrganizationId, initialStatus: FacilityStatus = FacilityStatus.fromEnum(FacilityStatusEnum.OPERATIONAL_UNDER_CONSTRUCTION), location: FacilityLocation | null = null):Result<Facility> {
        return ok(new Facility(id,organizationId,name,code,initialStatus,location))
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
    /** Où se trouve l'établissement ; `null` pour un établissement créé avant la localisation. */
    getLocation(): FacilityLocation | null {
        return this.location;
    }

    updateLocation(location: FacilityLocation | null): void {
        this.location = location;
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
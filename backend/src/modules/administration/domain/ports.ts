import { Facility } from './entities/facility';
import { Organization } from './entities/organization';
import { FacilityCode } from './value-objects/facility-code';
import { FacilityId } from './value-objects/facility-id';

/** L'organisation est unique par installation (un hôpital ou un groupe par déploiement) : il n'y a donc pas de recherche par identifiant. */
export interface OrganizationRepository {
  find(): Promise<Organization | null>;
  /** Insère ou met à jour l'organisation. */
  save(organization: Organization): Promise<void>;
}

export interface FacilityRepository {
  findById(id: FacilityId): Promise<Facility | null>;
  findByCode(code: FacilityCode): Promise<Facility | null>;
  /** Insère ou met à jour l'établissement. */
  save(facility: Facility): Promise<void>;
  list(offset: number, limit: number): Promise<{ items: Facility[]; total: number }>;
}

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');
export const FACILITY_REPOSITORY = Symbol('FACILITY_REPOSITORY');

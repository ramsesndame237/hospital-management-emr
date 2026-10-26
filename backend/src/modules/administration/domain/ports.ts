import { Facility } from './entities/facility';
import { Organization } from './entities/organization';
import { StructureNode } from './structure/structure-node';
import { NodeCode, NodeId, SpecialtyCode } from './structure/values';
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

export interface StructureRepository {
  findById(id: NodeId): Promise<StructureNode | null>;
  /** Cherche parmi les éléments qui ont le même parent (pas de parent : les services de l'établissement). */
  findSibling(facilityId: FacilityId, parentId: NodeId | null, code: NodeCode): Promise<StructureNode | null>;
  /** Insère ou met à jour l'élément. */
  save(node: StructureNode): Promise<void>;
  /** Tous les éléments d'un établissement, dans l'ordre des codes (l'arbre est reconstitué par le cas d'usage). */
  listByFacility(facilityId: FacilityId, includeInactive: boolean): Promise<StructureNode[]>;
  hasActiveChildren(id: NodeId): Promise<boolean>;
}

/**
 * Les spécialités viennent du référentiel (autre module) : ce port est l'unique chose que l'administration en sait.
 * La racine de composition le branche sur le catalogue des spécialités du module référentiels.
 */
export interface SpecialtyDirectory {
  /** Vrai si la spécialité existe et est active. */
  isActive(code: SpecialtyCode): Promise<boolean>;
}

export const STRUCTURE_REPOSITORY = Symbol('STRUCTURE_REPOSITORY');
export const SPECIALTY_DIRECTORY = Symbol('SPECIALTY_DIRECTORY');

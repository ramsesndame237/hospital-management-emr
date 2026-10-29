/** Organisation de l'installation (une seule). */
export interface Organization {
  readonly id: string;
  readonly name: string;
}

/**
 * Statut d'un établissement : le code est stable, l'interface le traduit (`server.status.<CODE>`). Les trois familles sont
 * administratives (droit d'exercer), opérationnelles (état réel) et qualité (certification).
 */
export const FACILITY_STATUSES = [
  'ADMIN_AUTHORIZED', 'ADMIN_AUTHORIZATION_EXPIRED', 'ADMIN_SUSPENDED', 'ADMIN_LICENSE_REVOKED',
  'OPERATIONAL_OPEN', 'OPERATIONAL_TEMPORARILY_CLOSED', 'OPERATIONAL_PERMANENTLY_CLOSED', 'OPERATIONAL_UNDER_CONSTRUCTION',
  'QUALITY_CERTIFIED', 'QUALITY_CERTIFICATION_IN_PROGRESS', 'QUALITY_NOT_CERTIFIED',
] as const;
export type FacilityStatus = (typeof FACILITY_STATUSES)[number];

export interface Facility {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly status: FacilityStatus;
  /** Vrai seulement si l'établissement est ouvert. */
  readonly operational: boolean;
}

export interface FacilityInput {
  readonly name: string;
  readonly code: string;
  readonly status?: FacilityStatus;
}

/** Niveaux de la structure : service > unité > salle > lit. */
export type NodeKind = 'SERVICE' | 'UNIT' | 'ROOM' | 'BED';
export const SERVICE_TYPES = ['CLINICAL', 'MEDICO_TECHNICAL', 'ADMINISTRATIVE', 'SUPPORT'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** Niveau des éléments rattachables à un élément de ce niveau ; `null` pour un lit (une feuille). */
export function childKindOf(kind: NodeKind): NodeKind | null {
  return ({ SERVICE: 'UNIT', UNIT: 'ROOM', ROOM: 'BED', BED: null } as const)[kind];
}

export interface StructureNode {
  readonly id: string;
  readonly facilityId: string;
  readonly parentId: string | null;
  readonly kind: NodeKind;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
  readonly serviceType: ServiceType | null;
  readonly specialtyCode: string | null;
  readonly floor: string | null;
  readonly children: readonly StructureNode[];
}

/** Éléments actifs par niveau ; `beds` est la capacité d'accueil de l'établissement. */
export interface StructureTotals {
  readonly services: number;
  readonly units: number;
  readonly rooms: number;
  readonly beds: number;
}

export interface StructureTree {
  readonly facilityId: string;
  readonly totals: StructureTotals;
  readonly services: readonly StructureNode[];
}

export interface ServiceInput {
  readonly code: string;
  readonly name: string;
  readonly serviceType: ServiceType;
  readonly specialtyCode?: string;
}

export interface ChildInput {
  readonly code: string;
  readonly name: string;
  readonly floor?: string;
}

/** Champs absents : inchangés ; `null` retire la spécialité ou l'étage. */
export interface NodeChanges {
  readonly name?: string;
  readonly serviceType?: ServiceType;
  readonly specialtyCode?: string | null;
  readonly floor?: string | null;
}

/** Entrée d'une nomenclature, avec son libellé dans la langue courante. */
export interface ReferenceOption {
  readonly code: string;
  readonly label: string;
}

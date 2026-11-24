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

/** Où se trouve l'établissement (l'adresse d'un bâtiment) : le pays d'abord, puis, de plus en plus précis, la région, la commune, la rue et les coordonnées. */
export interface FacilityLocation {
  readonly countryCode: string;
  readonly region: string | null;
  readonly commune: string | null;
  readonly street: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface Facility {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly status: FacilityStatus;
  /** Vrai seulement si l'établissement est ouvert. */
  readonly operational: boolean;
  /** `null` pour un établissement créé avant la localisation. */
  readonly location: FacilityLocation | null;
}

export interface FacilityInput {
  readonly name: string;
  /** Absent : le code est composé d'après la localisation et le nom (la localisation est alors obligatoire). */
  readonly code?: string;
  readonly location?: FacilityLocation;
  readonly status?: FacilityStatus;
}

export interface FacilityChanges {
  readonly name?: string;
  readonly code?: string;
  /** Remplace la localisation ; `null` l'efface. Le code ne change pas tout seul. */
  readonly location?: FacilityLocation | null;
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
  /** Absent : le code est composé automatiquement. */
  readonly code?: string;
  readonly name: string;
  readonly serviceType: ServiceType;
  readonly specialtyCode?: string;
}

export interface ChildInput {
  /** Absent : le code est composé automatiquement. */
  readonly code?: string;
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

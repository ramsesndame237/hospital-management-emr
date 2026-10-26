import { PlainDate } from '../../../shared-kernel/temporal';
import { Assignment } from './assignment';
import { StaffMember } from './staff-member';
import { AssignmentId, FacilityRef, NodeRef, StaffId, StaffNumber, UserRef } from './values';

export type StaffStatusFilter = 'ACTIVE' | 'DEPARTED';

export interface StaffFilter {
  /** Recherche insensible à la casse dans le matricule, le nom, le prénom et l'e-mail. */
  readonly search?: string;
  /** Situation à la date `today` : en poste (`ACTIVE`) ou parti (`DEPARTED`). Absent : tous. */
  readonly status?: StaffStatusFilter;
  readonly professionCode?: string;
  readonly today: PlainDate;
}

export interface StaffRepository {
  findById(id: StaffId): Promise<StaffMember | null>;
  findByNumber(number: StaffNumber): Promise<StaffMember | null>;
  findByUserId(userId: UserRef): Promise<StaffMember | null>;
  /** Insère ou met à jour le membre. */
  save(staff: StaffMember): Promise<void>;
  /**
   * Enregistre le départ ET clôt, dans la même transaction, les affectations qui se poursuivent après cette date
   * (leur fin devient la date de départ) : on ne peut pas obtenir un parti qui garde une affectation ouverte.
   */
  saveDeparture(staff: StaffMember): Promise<void>;
  list(filter: StaffFilter, offset: number, limit: number): Promise<{ items: StaffMember[]; total: number }>;
}

/** Résumé d'une personne affichée avec une affectation. */
export interface StaffSummary {
  readonly id: StaffId;
  readonly staffNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly professionCode: string;
}

export interface AssignmentRepository {
  findById(id: AssignmentId): Promise<Assignment | null>;
  save(assignment: Assignment): Promise<void>;
  /** Toutes les affectations d'une personne, de la plus récente à la plus ancienne. */
  listByStaff(staffId: StaffId): Promise<Assignment[]>;
  /** Affectations d'un service ou d'une unité, avec la personne ; `includeEnded: false` écarte celles terminées avant `today`. */
  listByNode(nodeId: NodeRef, includeEnded: boolean, today: PlainDate): Promise<{ assignment: Assignment; staff: StaffSummary }[]>;
}

/** Ce que ce module sait d'un élément de la structure de l'établissement (service, unité, salle, lit). */
export interface NodeInfo {
  readonly facilityId: FacilityRef;
  readonly kind: 'SERVICE' | 'UNIT' | 'ROOM' | 'BED';
  readonly active: boolean;
}

/** La structure appartient au module Administration : la racine de composition branche ce port dessus. */
export interface StructureDirectory {
  describe(nodeId: NodeRef): Promise<NodeInfo | null>;
}

/** Les comptes appartiennent au module IAM : la racine de composition branche ce port dessus. */
export interface UserDirectory {
  exists(userId: UserRef): Promise<boolean>;
}

export type ReferenceCatalog = 'PROFESSION' | 'SPECIALTY';

/** Les nomenclatures appartiennent au module Référentiels : la racine de composition branche ce port dessus. */
export interface ReferenceCodes {
  /** Vrai si le code existe dans le catalogue et y est actif. */
  isActive(catalog: ReferenceCatalog, code: string): Promise<boolean>;
}

export const STAFF_REPOSITORY = Symbol('STAFF_REPOSITORY');
export const ASSIGNMENT_REPOSITORY = Symbol('ASSIGNMENT_REPOSITORY');
export const STRUCTURE_DIRECTORY = Symbol('STAFF_STRUCTURE_DIRECTORY');
export const USER_DIRECTORY = Symbol('STAFF_USER_DIRECTORY');
export const REFERENCE_CODES = Symbol('STAFF_REFERENCE_CODES');

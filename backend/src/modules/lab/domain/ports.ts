import { Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { LabTest } from './test';
import { Requisition, RequisitionStatus } from './requisition';
import { PatientRef, Priority, RequisitionId, RequisitionNumber, Section, SpecimenBarcode, SpecimenId, Source, TestCode, TestId } from './values';

export interface TestFilter {
  /** Texte cherché dans le code et le libellé (insensible à la casse). */
  readonly search?: string;
  readonly section?: Section;
  readonly includeInactive: boolean;
}

export interface TestRepository {
  findById(id: TestId): Promise<LabTest | null>;
  findByCode(code: TestCode): Promise<LabTest | null>;
  /** Plusieurs analyses d'un coup (celles d'une demande), dans un ordre quelconque. */
  findByIds(ids: readonly TestId[]): Promise<LabTest[]>;
  /** Refuse (`false`) un code déjà pris ; la vérification et l'écriture se font ensemble (index unique). */
  insert(test: LabTest): Promise<boolean>;
  /** Écrit l'analyse et ses valeurs de référence (remplacées d'un bloc). */
  update(test: LabTest): Promise<void>;
  list(filter: TestFilter, offset: number, limit: number): Promise<{ items: LabTest[]; total: number }>;
}

/** Une demande dans une liste : l'essentiel, sans ses échantillons. */
export interface RequisitionSummary {
  readonly id: string;
  readonly number: string;
  readonly patientId: string;
  readonly priority: Priority;
  readonly source: Source;
  readonly status: RequisitionStatus;
  readonly orderedAt: Instant;
  readonly orderedBy: string;
  readonly testCodes: readonly string[];
  readonly sections: readonly Section[];
}

export interface RequisitionFilter {
  readonly status?: RequisitionStatus;
  readonly priority?: Priority;
  readonly source?: Source;
  readonly section?: Section;
  readonly patientId?: PatientRef;
  readonly number?: RequisitionNumber;
  /** Demande qui porte un échantillon ayant ce code-barres. */
  readonly barcode?: SpecimenBarcode;
  /** Seulement les demandes passées par ce prescripteur (portée « own »). */
  readonly orderedBy?: string;
}

export interface RequisitionRepository {
  nextNumber(): Promise<RequisitionNumber>;
  /** Réserve `count` codes-barres consécutifs. */
  nextBarcodes(count: number): Promise<SpecimenBarcode[]>;
  findById(id: RequisitionId): Promise<Requisition | null>;
  findBySpecimen(id: SpecimenId): Promise<Requisition | null>;
  findByBarcode(barcode: SpecimenBarcode): Promise<Requisition | null>;
  insert(requisition: Requisition): Promise<void>;
  /**
   * Modifie une demande sous verrou (prélèvement, réception, rejet, annulation) : deux techniciens qui agissent en même temps se mettent en
   * file, et le second voit ce que le premier a fait. `mutate` applique la règle du domaine ; rien n'est écrit si elle refuse. `null` : demande introuvable.
   */
  mutate(id: RequisitionId, mutate: (requisition: Requisition) => Result<void>): Promise<Result<Requisition> | null>;
  /** Les plus prioritaires d'abord (STAT, urgent, routine), puis les plus anciennes. */
  list(filter: RequisitionFilter, offset: number, limit: number): Promise<{ items: RequisitionSummary[]; total: number }>;
}

export interface PatientInfo {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  /** Date de naissance (ISO 8601, `AAAA-MM-JJ`). */
  readonly birthDate: string;
}

/** Les patients appartiennent au module Patients : la racine de composition branche ce port dessus. */
export interface PatientDirectory {
  find(ids: readonly string[]): Promise<Map<string, PatientInfo>>;
}

/** Les comptes appartiennent à l'IAM : la racine de composition branche ce port dessus (nom du prescripteur, du préleveur). */
export interface UserDirectory {
  find(ids: readonly string[]): Promise<Map<string, { readonly id: string; readonly username: string }>>;
}

export const TEST_REPOSITORY = Symbol('LAB_TEST_REPOSITORY');
export const REQUISITION_REPOSITORY = Symbol('LAB_REQUISITION_REPOSITORY');
export const LAB_PATIENTS = Symbol('LAB_PATIENTS');
export const LAB_USERS = Symbol('LAB_USERS');

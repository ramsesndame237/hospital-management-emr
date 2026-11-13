import { Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { ExamType } from './exam-type';
import { ImagingOrder, OrderStatus } from './order';
import { ExamCode, ExamTypeId, Modality, OrderId, OrderNumber, PatientRef, Priority, Source } from './values';

export interface ExamTypeFilter {
  /** Texte cherché dans le code et le libellé (insensible à la casse). */
  readonly search?: string;
  readonly modality?: Modality;
  readonly includeInactive: boolean;
}

export interface ExamTypeRepository {
  findById(id: ExamTypeId): Promise<ExamType | null>;
  findByCode(code: ExamCode): Promise<ExamType | null>;
  /** Refuse (`false`) un code déjà pris ; la vérification et l'écriture se font ensemble (index unique). */
  insert(exam: ExamType): Promise<boolean>;
  update(exam: ExamType): Promise<void>;
  list(filter: ExamTypeFilter, offset: number, limit: number): Promise<{ items: ExamType[]; total: number }>;
}

/** Une demande dans une liste : l'essentiel, sans le compte rendu. */
export interface OrderSummary {
  readonly id: string;
  readonly number: string;
  readonly patientId: string;
  readonly examCode: string;
  readonly examName: string;
  readonly modality: Modality;
  readonly priority: Priority;
  readonly source: Source;
  readonly status: OrderStatus;
  readonly orderedAt: Instant;
  readonly orderedBy: string;
  readonly scheduledFor: Instant | null;
  readonly critical: boolean;
}

export interface OrderFilter {
  readonly status?: OrderStatus;
  readonly priority?: Priority;
  readonly source?: Source;
  readonly modality?: Modality;
  readonly patientId?: PatientRef;
  readonly number?: OrderNumber;
  /** Seulement les demandes passées par ce prescripteur (portée « own »). */
  readonly orderedBy?: string;
  /** Seulement les demandes prescrites pendant cette consultation. */
  readonly encounterId?: string;
}

export interface OrderRepository {
  nextNumber(): Promise<OrderNumber>;
  findById(id: OrderId): Promise<ImagingOrder | null>;
  insert(order: ImagingOrder): Promise<void>;
  /**
   * Modifie une demande sous verrou (planification, réalisation, compte rendu, annulation) : deux radiologues qui agissent en même temps se
   * mettent en file, et le second voit ce que le premier a fait. `mutate` applique la règle du domaine ; rien n'est écrit si elle refuse.
   * `null` : demande introuvable.
   */
  mutate(id: OrderId, mutate: (order: ImagingOrder) => Result<void>): Promise<Result<ImagingOrder> | null>;
  /** Les plus prioritaires d'abord (STAT, urgent, routine), puis les plus anciennes ; les terminées en dernier. */
  list(filter: OrderFilter, offset: number, limit: number): Promise<{ items: OrderSummary[]; total: number }>;
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

/** Les comptes appartiennent à l'IAM : la racine de composition branche ce port dessus (nom du prescripteur, du radiologue). */
export interface UserDirectory {
  find(ids: readonly string[]): Promise<Map<string, { readonly id: string; readonly username: string }>>;
}

/** Une consultation, telle que l'imagerie a besoin de la connaître pour y rattacher une demande. */
export interface EncounterInfo {
  readonly id: string;
  readonly patientId: string;
  /** `IN_PROGRESS`, `SIGNED` ou `CANCELLED`. */
  readonly status: string;
}

/** Les consultations appartiennent au module Clinique : la racine de composition branche ce port dessus. */
export interface EncounterDirectory {
  find(id: string): Promise<EncounterInfo | null>;
}

export const EXAM_TYPE_REPOSITORY = Symbol('IMAGING_EXAM_TYPE_REPOSITORY');
export const ORDER_REPOSITORY = Symbol('IMAGING_ORDER_REPOSITORY');
export const IMAGING_PATIENTS = Symbol('IMAGING_PATIENTS');
export const IMAGING_ENCOUNTERS = Symbol('IMAGING_ENCOUNTERS');
export const IMAGING_USERS = Symbol('IMAGING_USERS');

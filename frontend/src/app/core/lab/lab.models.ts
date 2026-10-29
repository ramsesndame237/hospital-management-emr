/** Les codes sont stables, l'interface les traduit (`lab.section.<CODE>`, `lab.priority.<CODE>`…). */
export const SECTIONS = ['HAEMATOLOGY', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'MICROBIOLOGY', 'HISTOLOGY', 'OTHER'] as const;
export type Section = (typeof SECTIONS)[number];

export const SPECIMEN_TYPES = ['BLOOD', 'SERUM', 'PLASMA', 'URINE', 'STOOL', 'SWAB', 'CSF', 'TISSUE', 'OTHER'] as const;
export type SpecimenType = (typeof SPECIMEN_TYPES)[number];

/** Couleur du bouchon pour un tube, sinon flacon ou écouvillon. */
export const CONTAINERS = ['RED', 'YELLOW', 'PURPLE', 'LIGHT_BLUE', 'GREEN', 'GREY', 'STERILE_CUP', 'SWAB', 'OTHER'] as const;
export type Container = (typeof CONTAINERS)[number];

export const RESULT_TYPES = ['NUMERIC', 'TEXT', 'CHOICE'] as const;
export type ResultType = (typeof RESULT_TYPES)[number];

export const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SOURCES = ['OPD', 'IPD', 'ER', 'EXTERNAL'] as const;
export type Source = (typeof SOURCES)[number];

export const REQUISITION_STATUSES = ['ORDERED', 'PARTIALLY_COLLECTED', 'COLLECTED', 'RECEIVED', 'CANCELLED'] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export const SPECIMEN_STATUSES = ['PENDING_COLLECTION', 'COLLECTED', 'RECEIVED', 'REJECTED'] as const;
export type SpecimenStatus = (typeof SPECIMEN_STATUSES)[number];

export const REJECTION_REASONS = ['HEMOLYSED', 'INSUFFICIENT_VOLUME', 'WRONG_CONTAINER', 'CLOTTED', 'MISLABELLED', 'UNLABELLED', 'LEAKING', 'CONTAMINATED', 'EXPIRED_CONTAINER', 'OTHER'] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

/** Valeurs de référence d'une analyse numérique pour un sexe et une tranche d'âge (en jours). */
export interface ReferenceRange {
  readonly sex: 'ANY' | 'FEMALE' | 'MALE';
  readonly ageMinDays: number;
  readonly ageMaxDays: number | null;
  readonly low: number | null;
  readonly high: number | null;
  readonly criticalLow: number | null;
  readonly criticalHigh: number | null;
}

export interface LabTest {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly section: Section;
  readonly specimenType: SpecimenType;
  readonly container: Container;
  readonly resultType: ResultType;
  readonly unit: string | null;
  readonly decimals: number;
  readonly choices: readonly string[];
  readonly tatMinutes: number;
  readonly instructions: string | null;
  readonly ranges: readonly ReferenceRange[];
  readonly active: boolean;
}

export interface TestFilter {
  readonly search?: string;
  readonly section?: Section;
}

export interface LabUser {
  readonly id: string;
  readonly username: string;
}

/** Le patient tel qu'une demande le résume : identité seulement. */
export interface LabPatient {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

export interface SpecimenEvent {
  readonly kind: 'CREATED' | 'COLLECTED' | 'RECEIVED' | 'REJECTED';
  readonly at: string;
  readonly actor: LabUser | null;
  readonly note: string | null;
}

export interface Specimen {
  readonly id: string;
  readonly barcode: string;
  readonly specimenType: SpecimenType;
  readonly container: Container;
  readonly status: SpecimenStatus;
  readonly collectedBy: LabUser | null;
  readonly collectedAt: string | null;
  readonly receivedBy: LabUser | null;
  readonly receivedAt: string | null;
  readonly rejectionReason: RejectionReason | null;
  readonly rejectionNote: string | null;
  readonly rejectedBy: LabUser | null;
  readonly rejectedAt: string | null;
  readonly recollectionOf: string | null;
  /** Chaîne de traçabilité, de la plus ancienne étape à la plus récente. */
  readonly events: readonly SpecimenEvent[];
}

export interface OrderedTest {
  readonly testId: string;
  readonly code: string;
  readonly name: string;
  readonly section: Section;
  readonly specimenId: string;
}

export interface Requisition {
  readonly id: string;
  readonly number: string;
  readonly status: RequisitionStatus;
  readonly patient: LabPatient | null;
  readonly priority: Priority;
  readonly source: Source;
  readonly clinicalNotes: string | null;
  readonly orderedBy: LabUser | null;
  readonly orderedAt: string;
  readonly tests: readonly OrderedTest[];
  readonly specimens: readonly Specimen[];
  readonly cancelledBy: LabUser | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
}

/** Une demande dans une liste. */
export interface RequisitionSummary {
  readonly id: string;
  readonly number: string;
  readonly status: RequisitionStatus;
  readonly priority: Priority;
  readonly source: Source;
  readonly patient: LabPatient | null;
  readonly orderedBy: LabUser | null;
  readonly orderedAt: string;
  readonly testCodes: readonly string[];
  readonly sections: readonly Section[];
}

export interface RequisitionFilter {
  readonly status?: RequisitionStatus;
  readonly priority?: Priority;
  readonly section?: Section;
  readonly source?: Source;
  readonly number?: string;
  readonly barcode?: string;
}

export interface OrderInput {
  readonly patientId: string;
  readonly testIds: readonly string[];
  readonly priority: Priority;
  readonly source: Source;
  readonly clinicalNotes?: string;
}

/** Les deux identifiants lus sur le bracelet : numéro de dossier ET date de naissance (`AAAA-MM-JJ`). */
export interface CollectInput {
  readonly patientNumber: string;
  readonly birthDate: string;
}

export interface RejectInput {
  readonly reason: RejectionReason;
  readonly note?: string;
}

/** Demande retrouvée par code-barres, avec l'échantillon scanné. */
export interface RequisitionBySpecimen extends Requisition {
  readonly specimenId: string;
}

/** Un échantillon attend son prélèvement. */
export const awaitsCollection = (s: Pick<Specimen, 'status'>): boolean => s.status === 'PENDING_COLLECTION';
/** Un échantillon prélevé attend sa réception au laboratoire. */
export const awaitsReceipt = (s: Pick<Specimen, 'status'>): boolean => s.status === 'COLLECTED';
/** Une demande se traite tant qu'elle n'est ni annulée ni entièrement reçue. */
export const isOpen = (r: Pick<Requisition, 'status'>): boolean => r.status !== 'CANCELLED' && r.status !== 'RECEIVED';
/** Les échantillons encore en jeu : ni rejetés (remplacés) ni annulés. */
export const activeSpecimens = (r: Pick<Requisition, 'specimens'>): readonly Specimen[] => r.specimens.filter((s) => s.status !== 'REJECTED');

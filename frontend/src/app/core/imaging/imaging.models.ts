/** Modalités d'imagerie ; les quatre premières irradient (radiographie, scanner, mammographie, scopie). */
export const MODALITIES = ['XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAPHY', 'FLUOROSCOPY', 'OTHER'] as const;
export type Modality = (typeof MODALITIES)[number];
export const IONIZING: readonly Modality[] = ['XRAY', 'CT', 'MAMMOGRAPHY', 'FLUOROSCOPY'];

export const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SOURCES = ['OPD', 'IPD', 'ER', 'EXTERNAL'] as const;
export type Source = (typeof SOURCES)[number];

export const ORDER_STATUSES = ['ORDERED', 'SCHEDULED', 'PERFORMED', 'REPORTED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const COMMUNICATION_METHODS = ['PHONE', 'IN_PERSON', 'SECURE_MESSAGE'] as const;
export type CommunicationMethod = (typeof COMMUNICATION_METHODS)[number];

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface UserSummary {
  readonly id: string;
  readonly username: string;
}

export interface ImagingPatient {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

export interface ExamType {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly modality: Modality;
  readonly bodyPart: string | null;
  readonly usesContrast: boolean;
  readonly durationMinutes: number;
  readonly preparation: string | null;
  readonly active: boolean;
}

export interface ExamTypeFilter {
  readonly search?: string;
  readonly modality?: Modality;
  readonly includeInactive?: boolean;
}

export interface ExamTypeInput {
  readonly code: string;
  readonly name: string;
  readonly modality: Modality;
  readonly bodyPart?: string | null;
  readonly usesContrast?: boolean;
  readonly durationMinutes?: number;
  readonly preparation?: string | null;
}

/** Champs absents : inchangés. Le code et la modalité ne changent jamais. */
export interface ExamTypeChanges {
  readonly name?: string;
  readonly bodyPart?: string | null;
  readonly usesContrast?: boolean;
  readonly durationMinutes?: number;
  readonly preparation?: string | null;
}

export interface OrderInput {
  readonly patientId: string;
  readonly examTypeId: string;
  readonly clinicalQuestion: string;
  readonly priority?: Priority;
  readonly source?: Source;
  readonly encounterId?: string | null;
}

export interface OrderFilter {
  readonly status?: OrderStatus;
  readonly priority?: Priority;
  readonly source?: Source;
  readonly modality?: Modality;
  readonly patientId?: string;
  readonly number?: string;
  readonly encounterId?: string;
}

export interface OrderSummary {
  readonly id: string;
  readonly number: string;
  readonly status: OrderStatus;
  readonly priority: Priority;
  readonly source: Source;
  readonly modality: Modality;
  readonly examCode: string;
  readonly examName: string;
  readonly patient: ImagingPatient | null;
  readonly orderedBy: UserSummary | null;
  readonly orderedAt: string;
  readonly scheduledFor: string | null;
  /** Le compte rendu signé signale une découverte critique. */
  readonly critical: boolean;
}

export interface Screening {
  readonly pregnant: boolean;
  readonly contrastAllergy: boolean;
  readonly overrideReason: string | null;
}

export interface ReportDraft {
  readonly technique: string | null;
  readonly findings: string | null;
  readonly impression: string | null;
  readonly critical: boolean;
  readonly by: UserSummary | null;
  readonly at: string;
}

export interface ReportVersion {
  readonly version: number;
  readonly technique: string | null;
  readonly findings: string;
  readonly impression: string;
  readonly critical: boolean;
  /** Motif de l'addendum ; absent du compte rendu initial. */
  readonly reason: string | null;
  readonly signedBy: UserSummary | null;
  readonly signedAt: string;
}

export interface Communication {
  readonly version: number;
  readonly notifiedName: string;
  readonly notifiedRole: string;
  readonly method: CommunicationMethod;
  readonly at: string;
  readonly by: UserSummary | null;
}

/** Le service d'imagerie voit le brouillon ; le prescripteur ne lit que les versions signées. */
export interface Report {
  readonly draft: ReportDraft | null;
  readonly versions: readonly ReportVersion[];
  readonly communications: readonly Communication[];
  /** Le brouillon signale une découverte critique : l'appel du clinicien conditionne la signature. */
  readonly criticalRequired: boolean;
  readonly criticalCommunicated: boolean;
}

export interface Order {
  readonly id: string;
  readonly number: string;
  readonly status: OrderStatus;
  readonly patient: ImagingPatient | null;
  readonly examTypeId: string;
  readonly examCode: string;
  readonly examName: string;
  readonly modality: Modality;
  /** Examen avec produit de contraste : une allergie connue doit être levée explicitement. */
  readonly usesContrast: boolean;
  readonly preparation: string | null;
  readonly priority: Priority;
  readonly source: Source;
  readonly clinicalQuestion: string;
  readonly encounterId: string | null;
  readonly orderedBy: UserSummary | null;
  readonly orderedAt: string;
  readonly scheduledFor: string | null;
  readonly scheduledBy: UserSummary | null;
  readonly performedAt: string | null;
  readonly performedBy: UserSummary | null;
  readonly techniqueNote: string | null;
  /** Visible du service d'imagerie seulement. */
  readonly screening: Screening | null;
  readonly report: Report;
  readonly cancelledBy: UserSummary | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
}

export interface PerformInput {
  readonly pregnant: boolean;
  readonly contrastAllergy: boolean;
  readonly overrideReason?: string | null;
  readonly techniqueNote?: string | null;
}

export interface DraftInput {
  readonly technique?: string | null;
  readonly findings?: string | null;
  readonly impression?: string | null;
  readonly critical?: boolean;
}

export interface CommunicationInput {
  readonly notifiedName: string;
  readonly notifiedRole: string;
  readonly method: CommunicationMethod;
  readonly readBackConfirmed: boolean;
}

export interface AddendumInput extends DraftInput {
  readonly reason: string;
  readonly communication?: CommunicationInput | null;
}

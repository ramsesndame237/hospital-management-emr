export const SEXES = ['FEMALE', 'MALE', 'UNDETERMINED'] as const;
export type Sex = (typeof SEXES)[number];

export const MARITAL_STATUSES = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED'] as const;
export const RELATIONSHIPS = ['SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'RELATIVE', 'FRIEND', 'GUARDIAN', 'OTHER'] as const;
export const DOCUMENT_TYPES = ['NATIONAL_ID', 'PASSPORT', 'BIRTH_CERTIFICATE', 'DRIVING_LICENSE', 'OTHER'] as const;

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

/** Résumé d'un dossier patient : identité et âge, jamais de donnée clinique. */
export interface PatientSummary {
  readonly id: string;
  readonly number: string;
  readonly identityStatus: 'CONFIRMED' | 'PROVISIONAL';
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: Sex;
  readonly birthDate: string;
  readonly birthDateEstimated: boolean;
  readonly ageYears: number;
  readonly status: 'ACTIVE' | 'DECEASED';
}

export interface Address {
  readonly line: string | null;
  readonly quarter: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly country: string | null;
}

export interface NextOfKin {
  readonly name: string;
  readonly relationship: string;
  readonly phone: string;
}

export interface Patient extends PatientSummary {
  readonly birthPlace: string | null;
  readonly nationality: string | null;
  readonly maritalStatus: string | null;
  readonly occupation: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: Address | null;
  readonly identityDocument: { readonly type: string; readonly number: string } | null;
  readonly nextOfKin: NextOfKin | null;
  readonly dateOfDeath: string | null;
}

/** Les champs d'un dossier à l'ouverture ou à la correction ; `null` retire une valeur facultative, l'absence la laisse. */
export interface PatientInput {
  readonly identityStatus?: 'CONFIRMED' | 'PROVISIONAL';
  readonly lastName?: string;
  readonly firstName?: string;
  readonly sex?: string;
  readonly birthDate?: string;
  readonly birthDateEstimated?: boolean;
  readonly birthPlace?: string | null;
  readonly nationality?: string | null;
  readonly maritalStatus?: string | null;
  readonly occupation?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly address?: Partial<Address> | null;
  readonly identityDocument?: { readonly type: string; readonly number: string } | null;
  readonly nextOfKin?: NextOfKin | null;
  readonly reason?: string;
  readonly ignoreDuplicates?: boolean;
}

export interface DuplicateCandidate extends PatientSummary {
  /** `IDENTITY_DOCUMENT`, `NAME_AND_BIRTH_DATE` ou `PHONE_AND_BIRTH_DATE`. */
  readonly reasons: readonly string[];
}

export interface PatientCriteria {
  readonly q?: string;
  readonly birthDate?: string;
  readonly phone?: string;
  readonly identityNumber?: string;
}

/** Un service actif, pour choisir où accueillir un patient. */
export interface Service {
  readonly id: string;
  readonly facilityId: string;
  readonly code: string;
  readonly name: string;
}

export const ADMISSION_TYPES = ['OUTPATIENT', 'EMERGENCY', 'INPATIENT'] as const;
export type AdmissionType = (typeof ADMISSION_TYPES)[number];
export const ADMISSION_STATUSES = ['IN_PROGRESS', 'DISCHARGED', 'CANCELLED'] as const;
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];
export const DISCHARGE_TYPES = ['HOME', 'TRANSFERRED_OUT', 'LEFT_AGAINST_ADVICE', 'DECEASED', 'OTHER'] as const;

export interface Admission {
  readonly id: string;
  readonly number: string;
  readonly type: AdmissionType;
  readonly status: AdmissionStatus;
  readonly patient: { readonly id: string; readonly number: string; readonly lastName: string; readonly firstName: string } | null;
  readonly serviceId: string;
  readonly bed: { readonly id: string; readonly code: string; readonly name: string; readonly location: string } | null;
  readonly appointmentId: string | null;
  readonly reasonCode: string | null;
  readonly admittedAt: string;
  readonly dischargedAt: string | null;
  readonly dischargeType: string | null;
  readonly cancellationReason: string | null;
}

export interface AdmissionFilter {
  readonly status?: AdmissionStatus;
  readonly type?: AdmissionType;
  readonly patientId?: string;
  readonly serviceId?: string;
}

export interface OpenAdmissionInput {
  readonly patientId: string;
  readonly type: AdmissionType;
  readonly serviceId?: string;
  readonly bedId?: string;
  readonly appointmentId?: string;
}

export interface OccupancyBed {
  readonly bedId: string;
  readonly code: string;
  readonly name: string;
  readonly location: string;
  readonly active: boolean;
  readonly occupied: boolean;
  readonly admissionId: string | null;
}

export interface Occupancy {
  readonly serviceId: string;
  readonly capacity: number;
  readonly occupied: number;
  readonly free: number;
  readonly beds: readonly OccupancyBed[];
}

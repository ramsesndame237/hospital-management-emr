import { Instant } from '../../../shared-kernel/temporal';

/** Le lien entre un compte de connexion et UN dossier patient. */
export interface PortalAccount {
  readonly userId: string;
  readonly patientId: string;
  readonly linkedBy: string;
  readonly linkedAt: Instant;
}

export interface PortalAccountRepository {
  findByUser(userId: string): Promise<PortalAccount | null>;
  findByPatient(patientId: string): Promise<PortalAccount | null>;
  /** Refuse (`false`) quand le compte ou le dossier est déjà relié ; la vérification et l'écriture se font ensemble (index uniques). */
  insert(account: PortalAccount): Promise<boolean>;
}

export interface PortalPatient {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

/** Les patients appartiennent au module Patients : la racine de composition branche ce port dessus. */
export interface PortalPatients {
  find(id: string): Promise<PortalPatient | null>;
}

export interface PortalUser {
  readonly id: string;
  readonly username: string;
  readonly roles: readonly string[];
  readonly active: boolean;
}

/** Les comptes appartiennent à l'IAM : la racine de composition branche ce port dessus. */
export interface PortalUsers {
  findByUsername(username: string): Promise<PortalUser | null>;
  find(ids: readonly string[]): Promise<Map<string, PortalUser>>;
}

export interface PortalAppointment {
  readonly number: string;
  readonly status: string;
  readonly startsAt: Instant;
  readonly endsAt: Instant;
}

export interface PortalResultItem {
  readonly testName: string;
  readonly value: string | null;
  readonly unit: string | null;
  /** `LOW`, `HIGH`, `CRITICAL_LOW`, `CRITICAL_HIGH`, `NORMAL` ou `null` : la position par rapport aux valeurs de référence. */
  readonly flag: string | null;
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly amended: boolean;
}

/** Un rapport d'analyses PUBLIÉ : jamais une valeur que le laboratoire n'a pas validée et publiée. */
export interface PortalResult {
  readonly number: string;
  readonly orderedAt: Instant;
  readonly items: readonly PortalResultItem[];
}

export interface PortalPrescriptionLine {
  readonly drugName: string;
  readonly strength: string | null;
  readonly dose: string;
  readonly frequency: string;
  readonly durationDays: number | null;
  readonly quantity: number;
  readonly unit: string;
}

export interface PortalPrescription {
  readonly number: string;
  readonly issuedAt: Instant;
  /** `ISSUED` ou `CANCELLED`. */
  readonly status: string;
  /** `NONE`, `PARTIAL` ou `COMPLETE` : ce que la pharmacie a délivré. */
  readonly dispensing: string;
  readonly lines: readonly PortalPrescriptionLine[];
}

export interface PortalInvoice {
  readonly number: string;
  readonly status: string;
  readonly currency: string;
  readonly total: number;
  readonly paid: number;
  readonly balance: number;
  readonly issuedAt: Instant | null;
}

/** Ce que le portail lit chez les autres modules, pour UN patient donné : la racine de composition branche chaque lecture sur son module. */
export interface PortalAppointments {
  listOf(patientId: string, limit: number): Promise<PortalAppointment[]>;
}

export interface PortalResults {
  listOf(patientId: string, limit: number): Promise<PortalResult[]>;
}

export interface PortalPrescriptions {
  listOf(patientId: string, limit: number): Promise<PortalPrescription[]>;
}

export interface PortalInvoices {
  listOf(patientId: string, limit: number): Promise<PortalInvoice[]>;
}

export const PORTAL_ACCOUNT_REPOSITORY = Symbol('PORTAL_ACCOUNT_REPOSITORY');
export const PORTAL_PATIENTS = Symbol('PORTAL_PATIENTS');
export const PORTAL_USERS = Symbol('PORTAL_USERS');
export const PORTAL_APPOINTMENTS = Symbol('PORTAL_APPOINTMENTS');
export const PORTAL_RESULTS = Symbol('PORTAL_RESULTS');
export const PORTAL_PRESCRIPTIONS = Symbol('PORTAL_PRESCRIPTIONS');
export const PORTAL_INVOICES = Symbol('PORTAL_INVOICES');

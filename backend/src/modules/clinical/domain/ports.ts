import { Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { Addendum, Encounter, EncounterStatus } from './encounter';
import { Allergy } from './allergy';
import { AllergyId, EncounterId, EncounterNumber, PatientRef } from './values';

export interface EncounterFilter {
  readonly patientId?: PatientRef;
  readonly status?: EncounterStatus;
  /** Seulement les consultations de ce médecin. */
  readonly doctorId?: string;
  /** `null` : tous les services. Sinon seulement ceux-ci (liste vide : aucun résultat). */
  readonly serviceIds: readonly string[] | null;
}

/** Une consultation dans une liste : l'essentiel, sans le texte de la note. */
export interface EncounterSummary {
  readonly id: string;
  readonly number: string;
  readonly patientId: string;
  readonly serviceId: string;
  readonly doctorId: string;
  readonly status: EncounterStatus;
  readonly startedAt: Instant;
  readonly signedAt: Instant | null;
  readonly primaryDiagnosis: { readonly code: string; readonly label: string } | null;
}

/** La consultation d'une admission : celle qui est en cours, sinon la dernière signée (une consultation annulée ne compte pas). */
export interface AdmissionEncounter {
  readonly id: string;
  readonly number: string;
  readonly doctorId: string;
  readonly status: EncounterStatus;
}

export interface EncounterRepository {
  nextNumber(): Promise<EncounterNumber>;
  /** Refuse (`false`) quand l'admission a déjà une consultation en cours ; la vérification et l'écriture se font ensemble (index unique). */
  insert(encounter: Encounter): Promise<boolean>;
  findById(id: EncounterId): Promise<Encounter | null>;
  /**
   * Modifie une consultation sous verrou (constantes, note, diagnostics, signature, annulation) : deux actions simultanées se mettent en file et la
   * seconde voit ce que la première a fait. Rien n'est écrit si la règle refuse. `null` : consultation introuvable.
   */
  mutate(id: EncounterId, mutate: (encounter: Encounter) => Result<void>): Promise<Result<Encounter> | null>;
  /** Ajoute un addendum à une consultation signée (ajout seul : la consultation elle-même n'est pas réécrite). `null` : introuvable. */
  addAddendum(id: EncounterId, add: (encounter: Encounter) => Result<Addendum>): Promise<Result<Encounter> | null>;
  /** Les plus récentes d'abord. */
  list(filter: EncounterFilter, offset: number, limit: number): Promise<{ items: EncounterSummary[]; total: number }>;
  /** Consultation de chacune de ces admissions (en cours, sinon signée), indexée par admission. */
  byAdmissions(admissionIds: readonly string[]): Promise<Map<string, AdmissionEncounter>>;
}

export interface AllergyRepository {
  insert(allergy: Allergy): Promise<void>;
  findById(id: AllergyId): Promise<Allergy | null>;
  /** Modifie une allergie sous verrou ; rien n'est écrit si la règle refuse. `null` : introuvable. */
  mutate(id: AllergyId, mutate: (allergy: Allergy) => Result<void>): Promise<Result<Allergy> | null>;
  /** Les plus récentes d'abord ; par défaut seules les allergies actives. */
  listOf(patientId: PatientRef, includeVoided: boolean): Promise<Allergy[]>;
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

/** Les comptes appartiennent à l'IAM : la racine de composition branche ce port dessus (nom du médecin, du soignant). */
export interface UserDirectory {
  find(ids: readonly string[]): Promise<Map<string, { readonly id: string; readonly username: string }>>;
}

export interface VisitInfo {
  readonly id: string;
  readonly number: string;
  readonly patientId: string;
  readonly serviceId: string;
  readonly type: 'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT';
  readonly inProgress: boolean;
  readonly admittedAt: Instant;
}

/** Les admissions appartiennent au module Admissions : la racine de composition branche ce port dessus (l'arrivée du patient ouvre la consultation). */
export interface VisitDirectory {
  find(admissionId: string): Promise<VisitInfo | null>;
  /** Admissions en cours, consultations externes et urgences, de ces services (`null` : tous), les plus anciennes d'abord. */
  waiting(serviceIds: readonly string[] | null, limit: number): Promise<VisitInfo[]>;
}

export const ENCOUNTER_REPOSITORY = Symbol('CLINICAL_ENCOUNTER_REPOSITORY');
export const ALLERGY_REPOSITORY = Symbol('CLINICAL_ALLERGY_REPOSITORY');
export const CLINICAL_PATIENTS = Symbol('CLINICAL_PATIENTS');
export const CLINICAL_USERS = Symbol('CLINICAL_USERS');
export const CLINICAL_VISITS = Symbol('CLINICAL_VISITS');

import { Instant, PlainDate } from '../../../shared-kernel/temporal';
import { Patient, PatientSnapshot } from './patient';
import { IdentityDocument, PatientId, PatientNumber, PhoneNumber } from './values';

/** Pourquoi deux dossiers peuvent concerner la même personne. */
export type DuplicateReason = 'IDENTITY_DOCUMENT' | 'NAME_AND_BIRTH_DATE' | 'PHONE_AND_BIRTH_DATE';

export interface DuplicateKey {
  /** Dossier à ignorer (celui que l'on est en train de corriger). */
  readonly excludeId?: PatientId;
  readonly nameKey: string;
  readonly birthDate: PlainDate;
  readonly phone: PhoneNumber | null;
  readonly identityDocument: IdentityDocument | null;
}

export interface DuplicateMatch {
  readonly patient: Patient;
  readonly reasons: readonly DuplicateReason[];
}

export interface PatientSearch {
  /** Numéro de dossier exact. */
  readonly number?: PatientNumber;
  /** Mots du nom/prénom, déjà normalisés (voir `nameKey`) : tous doivent figurer dans le nom du dossier. */
  readonly nameTokens?: readonly string[];
  readonly birthDate?: PlainDate;
  readonly phone?: PhoneNumber;
  readonly identityNumber?: string;
  readonly status?: 'ACTIVE' | 'DECEASED';
}

/** Ce qui est archivé avec chaque version du dossier. */
export interface RevisionInfo {
  readonly actorId: string;
  readonly at: Instant;
  /** Motif de la correction, saisi par l'utilisateur (facultatif). */
  readonly reason: string | null;
  /** Champs modifiés par cette version (`registration` pour la création). */
  readonly changedFields: readonly string[];
}

export interface PatientRevision {
  readonly revision: number;
  readonly changedAt: Instant;
  readonly changedBy: string;
  readonly reason: string | null;
  readonly changedFields: readonly string[];
  /** Le dossier tel qu'il était après cette version. */
  readonly snapshot: PatientSnapshot;
}

export interface PatientRepository {
  /** Prochain numéro de dossier. Jamais réutilisé, même si l'enregistrement qui suit échoue (des trous sont normaux). */
  nextNumber(): Promise<PatientNumber>;
  findById(id: PatientId): Promise<Patient | null>;
  /** Insère ou met à jour le dossier ET archive sa nouvelle version, dans la même transaction. */
  save(patient: Patient, revision: RevisionInfo): Promise<void>;
  /** Dossiers déjà enregistrés qui ressemblent à celui décrit. */
  findDuplicates(key: DuplicateKey): Promise<DuplicateMatch[]>;
  search(criteria: PatientSearch, offset: number, limit: number): Promise<{ items: Patient[]; total: number }>;
  /** Versions du dossier, de la plus récente à la plus ancienne. */
  history(id: PatientId): Promise<PatientRevision[]>;
}

export const PATIENT_REPOSITORY = Symbol('PATIENT_REPOSITORY');

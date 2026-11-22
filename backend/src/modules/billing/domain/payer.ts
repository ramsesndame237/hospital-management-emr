/** Assureur (tiers payant) : il prend en charge une part des factures de ses assurés. Rien n'est supprimé : un assureur retiré est désactivé. */
export interface Payer {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
}

/** Couverture d'un patient : son assureur, son numéro d'assuré, le pourcentage pris en charge et sa période de validité (dates `AAAA-MM-JJ`). */
export interface PatientCoverage {
  readonly id: string;
  readonly patientId: string;
  readonly payerId: string;
  readonly policyNumber: string;
  readonly percent: number;
  readonly validFrom: string;
  readonly validUntil: string | null;
  readonly active: boolean;
}

/** Une créance d'assureur : la part d'une facture émise qu'il doit régler, et si c'est fait. */
export interface Claim {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly patientId: string;
  readonly payerId: string;
  readonly payerName: string;
  readonly policyNumber: string | null;
  readonly percent: number;
  /** La part de l'assureur, entier dans la plus petite unité de la devise. */
  readonly amount: number;
  readonly issuedAt: string;
  readonly settledAt: string | null;
  readonly settlementReference: string | null;
}

export interface ClaimFilter {
  readonly payerId?: string;
  /** `true` : réglées ; `false` : à recouvrer ; absent : toutes. */
  readonly settled?: boolean;
}

export interface PayerFilter {
  readonly search?: string;
  readonly includeInactive: boolean;
}

export interface PayerRepository {
  /** Refuse (`false`) un code déjà pris ; la vérification et l'écriture se font ensemble (index unique). */
  insert(payer: Payer): Promise<boolean>;
  findById(id: string): Promise<Payer | null>;
  findByIds(ids: readonly string[]): Promise<Map<string, Payer>>;
  update(payer: Payer): Promise<void>;
  list(filter: PayerFilter, offset: number, limit: number): Promise<{ items: Payer[]; total: number }>;
}

export interface CoverageRepository {
  insert(coverage: PatientCoverage, createdBy: string): Promise<void>;
  findById(id: string): Promise<PatientCoverage | null>;
  deactivate(id: string): Promise<void>;
  /** Couvertures actives d'un patient, les plus récentes d'abord. */
  forPatient(patientId: string): Promise<PatientCoverage[]>;
}

export const PAYER_REPOSITORY = Symbol('BILLING_PAYER_REPOSITORY');
export const COVERAGE_REPOSITORY = Symbol('BILLING_COVERAGE_REPOSITORY');

import { PlainDate } from '../../../shared-kernel/temporal';
import { Patient } from '../domain/patient';
import { DuplicateMatch, PatientRevision } from '../domain/ports';

/** Données minimales qui permettent de reconnaître un patient dans une liste (principe du moindre accès). */
export interface PatientSummaryView {
  readonly id: string;
  readonly number: string;
  readonly identityStatus: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
  readonly birthDateEstimated: boolean;
  readonly ageYears: number;
  readonly status: 'ACTIVE' | 'DECEASED';
}

export interface PatientView extends PatientSummaryView {
  readonly birthPlace: string | null;
  readonly nationality: string | null;
  readonly maritalStatus: string | null;
  readonly occupation: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: { line: string | null; quarter: string | null; city: string | null; region: string | null; country: string | null } | null;
  readonly identityDocument: { type: string; number: string } | null;
  readonly nextOfKin: { name: string; relationship: string; phone: string } | null;
  readonly dateOfDeath: string | null;
}

export interface DuplicateCandidateView extends PatientSummaryView {
  readonly reasons: readonly string[];
}

export interface RevisionView {
  readonly revision: number;
  readonly changedAt: string;
  readonly changedBy: string;
  readonly reason: string | null;
  readonly changedFields: readonly string[];
  readonly snapshot: Readonly<Record<string, unknown>>;
}

export const toSummary = (p: Patient, today: PlainDate): PatientSummaryView => ({
  id: p.id.value,
  number: p.number.value,
  identityStatus: p.state.identityStatus,
  lastName: p.state.lastName.value,
  firstName: p.state.firstName.value,
  sex: p.state.sex,
  birthDate: p.state.birthDate.toString(),
  birthDateEstimated: p.state.birthDateEstimated,
  ageYears: p.ageYears(today),
  status: p.isDeceased ? 'DECEASED' : 'ACTIVE',
});

export const toView = (p: Patient, today: PlainDate): PatientView => {
  const s = p.state;
  const t = (v: { value: string } | null) => v?.value ?? null;
  return {
    ...toSummary(p, today),
    birthPlace: t(s.birthPlace),
    nationality: t(s.nationality),
    maritalStatus: s.maritalStatus,
    occupation: t(s.occupation),
    phone: t(s.phone),
    email: t(s.email),
    address: s.address && { line: t(s.address.line), quarter: t(s.address.quarter), city: t(s.address.city), region: t(s.address.region), country: t(s.address.country) },
    identityDocument: s.identityDocument && { type: s.identityDocument.type, number: s.identityDocument.number },
    nextOfKin: s.nextOfKin && { name: s.nextOfKin.name.value, relationship: s.nextOfKin.relationship, phone: s.nextOfKin.phone.value },
    dateOfDeath: s.dateOfDeath?.toString() ?? null,
  };
};

export const toCandidate = (m: DuplicateMatch, today: PlainDate): DuplicateCandidateView => ({ ...toSummary(m.patient, today), reasons: m.reasons });

export const toRevisionView = (r: PatientRevision): RevisionView => ({ ...r, changedAt: r.changedAt.toString() });

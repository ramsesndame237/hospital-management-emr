import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Calendar, Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Patient } from '../../domain/patient';
import { parsePatientInput, PatientInput } from '../../domain/patient-input';
import { DuplicateKey, PatientRepository, PatientSearch } from '../../domain/ports';
import { IdentityStatus, nameKey, parseDate, PatientId, PatientNumber, PhoneNumber, ShortText } from '../../domain/values';
import {
  DuplicateCandidateView, PatientSummaryView, PatientView, RevisionView, toCandidate, toRevisionView, toSummary, toView,
} from '../views';

const NOT_FOUND = new DomainError('PATIENT_NOT_FOUND', 'Patient introuvable.');
const required = (field: string) => new DomainError('PATIENT_FIELD_REQUIRED', `Le champ « ${field} » est obligatoire.`, { field });
const MAX_PAGE = 50; // volontairement bas : la recherche ne sert pas à parcourir tous les dossiers

/** Champs dont la modification peut faire d'un dossier le doublon d'un autre : on revérifie les doublons dans ce cas. */
const IDENTITY_FIELDS = ['lastName', 'firstName', 'birthDate', 'phone', 'identityDocument', 'identityStatus'];

async function loadPatient(patients: PatientRepository, rawId: string): Promise<Result<Patient>> {
  const id = PatientId.create(rawId);
  if (!id.ok) return err(NOT_FOUND); // un identifiant mal formé ne désigne aucun patient
  const found = await patients.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

function reasonOf(raw: string | null | undefined): Result<string | null> {
  if (raw === undefined || raw === null || raw.trim() === '') return ok(null);
  const r = ShortText.create(raw, 'reason', 200);
  return r.ok ? ok(r.value.value) : err(r.error);
}

function duplicateKey(patient: Patient, excludeId?: PatientId): DuplicateKey {
  const s = patient.state;
  return { excludeId, nameKey: patient.nameKey, birthDate: s.birthDate, phone: s.phone, identityDocument: s.identityDocument };
}

/** Qui fait quoi : le journal d'audit reçoit l'identifiant du compte et celui du dossier (jamais nom, date de naissance ni coordonnées). */
class Auditor {
  constructor(private readonly audit: AuditLog, private readonly clock: Clock) {}

  record(actorId: string, action: string, patient: Patient | null, metadata: Record<string, string | number | boolean | null> = {}): Promise<void> {
    return this.audit.record({
      action, outcome: 'SUCCESS', actorId, resourceType: patient ? 'patient' : undefined, resourceId: patient?.id.value,
      metadata: { ...(patient ? { patientNumber: patient.number.value } : {}), ...metadata }, occurredAt: this.clock.now(),
    });
  }
}

export class RegisterPatientUseCase {
  private readonly auditor: Auditor;

  constructor(
    private readonly patients: PatientRepository,
    private readonly ids: IdGenerator,
    audit: AuditLog,
    private readonly clock: Clock,
    private readonly calendar: Calendar,
  ) {
    this.auditor = new Auditor(audit, clock);
  }

  /**
   * Ouvre un dossier. Avant d'attribuer un numéro, cherche les dossiers qui lui ressemblent : s'il y en a, l'enregistrement est
   * refusé (409) avec la liste des candidats, sauf `ignoreDuplicates` (la personne est bien différente) ou identité `PROVISIONAL`
   * (patient non identifié : il n'y a encore rien à comparer).
   */
  async execute(actorId: string, input: PatientInput & { ignoreDuplicates?: boolean }): Promise<Result<PatientView>> {
    const parsed = parsePatientInput(input);
    if (!parsed.ok) return err(parsed.error);
    const p = parsed.value;
    if (!p.lastName) return err(required('lastName'));
    if (!p.firstName) return err(required('firstName'));
    if (!p.sex) return err(required('sex'));
    if (!p.birthDate) return err(required('birthDate'));

    const today = this.calendar.today();
    const identityStatus = p.identityStatus ?? IdentityStatus.CONFIRMED;
    const id = PatientId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    // Numéro provisoire pour valider l'état ; le vrai numéro n'est pris qu'après la recherche de doublons (pas de numéro gaspillé).
    const draft = Patient.register(
      {
        id: id.value, number: PLACEHOLDER_NUMBER, identityStatus, lastName: p.lastName, firstName: p.firstName, sex: p.sex, birthDate: p.birthDate,
        birthDateEstimated: p.birthDateEstimated ?? false, birthPlace: p.birthPlace ?? null, nationality: p.nationality ?? null, maritalStatus: p.maritalStatus ?? null,
        occupation: p.occupation ?? null, phone: p.phone ?? null, email: p.email ?? null, address: p.address ?? null, identityDocument: p.identityDocument ?? null,
        nextOfKin: p.nextOfKin ?? null,
      },
      today,
    );
    if (!draft.ok) return err(draft.error);

    const checkDuplicates = identityStatus === IdentityStatus.CONFIRMED && input.ignoreDuplicates !== true;
    if (checkDuplicates) {
      const matches = await this.patients.findDuplicates(duplicateKey(draft.value));
      if (matches.length > 0) {
        return err(new DomainError('PATIENT_POSSIBLE_DUPLICATE', 'Un dossier ressemblant existe déjà.', { count: matches.length, candidates: matches.map((m) => toCandidate(m, today)) }));
      }
    }

    const number = await this.patients.nextNumber();
    const patient = Patient.restore({ ...draft.value.state, number });
    await this.patients.save(patient, { actorId, at: this.clock.now(), reason: null, changedFields: ['registration'] });
    await this.auditor.record(actorId, 'patient.record.register', patient, { identityStatus, duplicatesIgnored: input.ignoreDuplicates === true });
    return ok(toView(patient, today));
  }
}

const PLACEHOLDER_NUMBER = (() => {
  const n = PatientNumber.fromSequence(0);
  if (!n.ok) throw new Error(n.error.message);
  return n.value;
})();

export class UpdatePatientUseCase {
  private readonly auditor: Auditor;

  constructor(private readonly patients: PatientRepository, audit: AuditLog, private readonly clock: Clock, private readonly calendar: Calendar) {
    this.auditor = new Auditor(audit, clock);
  }

  /**
   * Corrige le dossier (champs absents : inchangés ; `null` retire un champ facultatif). Chaque correction archive une nouvelle
   * version avec son auteur et son motif. Une correction qui rapproche le dossier d'un autre est refusée (409) sauf
   * `ignoreDuplicates`. Passer de `PROVISIONAL` à `CONFIRMED` (identité établie) déclenche la même vérification.
   */
  async execute(actorId: string, id: string, input: PatientInput & { reason?: string | null; ignoreDuplicates?: boolean }): Promise<Result<PatientView>> {
    const reason = reasonOf(input.reason);
    if (!reason.ok) return err(reason.error);
    const parsed = parsePatientInput(input);
    if (!parsed.ok) return err(parsed.error);
    const loaded = await loadPatient(this.patients, id);
    if (!loaded.ok) return err(loaded.error);
    const patient = loaded.value;
    const today = this.calendar.today();

    const changed = patient.apply(parsed.value, today);
    if (!changed.ok) return err(changed.error);
    if (changed.value.length === 0) return ok(toView(patient, today));

    const identityChanged = changed.value.some((f) => IDENTITY_FIELDS.includes(f));
    if (identityChanged && patient.state.identityStatus === IdentityStatus.CONFIRMED && input.ignoreDuplicates !== true) {
      const matches = await this.patients.findDuplicates(duplicateKey(patient, patient.id));
      if (matches.length > 0) {
        return err(new DomainError('PATIENT_POSSIBLE_DUPLICATE', 'Un dossier ressemblant existe déjà.', { count: matches.length, candidates: matches.map((m) => toCandidate(m, today)) }));
      }
    }

    await this.patients.save(patient, { actorId, at: this.clock.now(), reason: reason.value, changedFields: changed.value });
    await this.auditor.record(actorId, 'patient.record.update', patient, { changed: changed.value.join(','), duplicatesIgnored: input.ignoreDuplicates === true });
    return ok(toView(patient, today));
  }
}

export class RecordPatientDeathUseCase {
  private readonly auditor: Auditor;

  constructor(private readonly patients: PatientRepository, audit: AuditLog, private readonly clock: Clock, private readonly calendar: Calendar) {
    this.auditor = new Auditor(audit, clock);
  }

  /** Enregistre le décès (aujourd'hui par défaut), une seule fois. */
  async execute(actorId: string, id: string, input: { dateOfDeath?: string; reason?: string | null }): Promise<Result<PatientView>> {
    const today = this.calendar.today();
    const date = input.dateOfDeath ? parseDate(input.dateOfDeath, 'dateOfDeath') : ok(today);
    if (!date.ok) return err(date.error);
    const reason = reasonOf(input.reason);
    if (!reason.ok) return err(reason.error);
    const loaded = await loadPatient(this.patients, id);
    if (!loaded.ok) return err(loaded.error);
    const patient = loaded.value;

    const recorded = patient.recordDeath(date.value, today);
    if (!recorded.ok) return err(recorded.error);
    await this.patients.save(patient, { actorId, at: this.clock.now(), reason: reason.value, changedFields: ['dateOfDeath'] });
    await this.auditor.record(actorId, 'patient.record.death', patient, { dateOfDeath: date.value.toString() });
    return ok(toView(patient, today));
  }
}

/** Lecture d'un dossier : chaque consultation est inscrite au journal d'audit (qui a ouvert quel dossier, quand). */
export class GetPatientUseCase {
  private readonly auditor: Auditor;

  constructor(private readonly patients: PatientRepository, audit: AuditLog, clock: Clock, private readonly calendar: Calendar) {
    this.auditor = new Auditor(audit, clock);
  }

  async execute(actorId: string, id: string): Promise<Result<PatientView>> {
    const loaded = await loadPatient(this.patients, id);
    if (!loaded.ok) return err(loaded.error);
    await this.auditor.record(actorId, 'patient.record.read', loaded.value);
    return ok(toView(loaded.value, this.calendar.today()));
  }
}

export interface PatientSearchInput {
  q?: string;
  birthDate?: string;
  phone?: string;
  identityNumber?: string;
  status?: string;
  offset: number;
  limit: number;
}

/**
 * Recherche de patients. Il faut au moins un critère (nom, numéro de dossier, date de naissance, téléphone ou pièce d'identité) :
 * on ne parcourt pas la liste de tous les patients. Les résultats sont des résumés ; le dossier complet s'ouvre (et se trace) à part.
 * Le journal d'audit reçoit les critères utilisés (leurs noms, pas leurs valeurs) et le nombre de résultats.
 */
export class SearchPatientsUseCase {
  private readonly auditor: Auditor;

  constructor(private readonly patients: PatientRepository, audit: AuditLog, clock: Clock, private readonly calendar: Calendar) {
    this.auditor = new Auditor(audit, clock);
  }

  async execute(actorId: string, input: PatientSearchInput): Promise<Result<{ items: PatientSummaryView[]; total: number; offset: number; limit: number }>> {
    const criteria: Record<string, unknown> = {};
    const used: string[] = [];

    const q = input.q?.trim();
    if (q) {
      const digits = /^pat-?(\d{1,12})$/i.exec(q)?.[1];
      if (digits !== undefined) {
        const number = PatientNumber.fromSequence(Number(digits));
        if (!number.ok) return err(number.error);
        criteria.number = number.value;
        used.push('number');
      } else {
        const tokens = nameKey(q).split(' ').filter((t) => t.length >= 2);
        if (tokens.length === 0) return err(new DomainError('PATIENT_SEARCH_TOO_BROAD', 'Saisissez au moins 2 lettres d\'un nom ou d\'un prénom.'));
        criteria.nameTokens = tokens;
        used.push('name');
      }
    }
    if (input.birthDate?.trim()) {
      const date = parseDate(input.birthDate, 'birthDate');
      if (!date.ok) return err(date.error);
      criteria.birthDate = date.value;
      used.push('birthDate');
    }
    if (input.phone?.trim()) {
      const phone = PhoneNumber.create(input.phone);
      if (!phone.ok) return err(phone.error);
      criteria.phone = phone.value;
      used.push('phone');
    }
    if (input.identityNumber?.trim()) {
      const number = input.identityNumber.replace(/\s+/g, '').toUpperCase();
      if (number.length < 3) return err(new DomainError('PATIENT_SEARCH_TOO_BROAD', 'Saisissez au moins 3 caractères du numéro de pièce.'));
      criteria.identityNumber = number;
      used.push('identityNumber');
    }
    if (used.length === 0) return err(new DomainError('PATIENT_SEARCH_CRITERIA_REQUIRED', 'Indiquez au moins un critère : nom, numéro de dossier, date de naissance, téléphone ou pièce d\'identité.'));
    if (input.status?.trim()) {
      const status = input.status.trim().toUpperCase();
      if (status !== 'ACTIVE' && status !== 'DECEASED') return err(new DomainError('PATIENT_STATUS_FILTER_INVALID', 'Le filtre de situation doit valoir ACTIVE ou DECEASED.', { value: input.status }));
      criteria.status = status;
    }

    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(MAX_PAGE, Math.max(1, Math.trunc(input.limit)));
    const { items, total } = await this.patients.search(criteria as PatientSearch, offset, limit);
    await this.auditor.record(actorId, 'patient.record.search', null, { criteria: used.join(','), returned: items.length, total });
    const today = this.calendar.today();
    return ok({ items: items.map((p) => toSummary(p, today)), total, offset, limit });
  }
}

/** « Ce patient existe-t-il déjà ? » avant de saisir tout le dossier. */
export class CheckDuplicatesUseCase {
  private readonly auditor: Auditor;

  constructor(private readonly patients: PatientRepository, audit: AuditLog, clock: Clock, private readonly calendar: Calendar) {
    this.auditor = new Auditor(audit, clock);
  }

  async execute(actorId: string, input: Pick<PatientInput, 'lastName' | 'firstName' | 'birthDate' | 'phone' | 'identityDocument'>): Promise<Result<DuplicateCandidateView[]>> {
    const parsed = parsePatientInput(input);
    if (!parsed.ok) return err(parsed.error);
    const p = parsed.value;
    if (!p.lastName) return err(required('lastName'));
    if (!p.firstName) return err(required('firstName'));
    if (!p.birthDate) return err(required('birthDate'));
    const matches = await this.patients.findDuplicates({
      nameKey: nameKey(p.lastName.value, p.firstName.value), birthDate: p.birthDate, phone: p.phone ?? null, identityDocument: p.identityDocument ?? null,
    });
    await this.auditor.record(actorId, 'patient.record.duplicate-check', null, { candidates: matches.length });
    const today = this.calendar.today();
    return ok(matches.map((m) => toCandidate(m, today)));
  }
}

/** Historique des versions du dossier (qui a corrigé quoi, quand, pourquoi). Données d'identité : accès restreint et tracé. */
export class GetPatientHistoryUseCase {
  private readonly auditor: Auditor;

  constructor(private readonly patients: PatientRepository, audit: AuditLog, clock: Clock) {
    this.auditor = new Auditor(audit, clock);
  }

  async execute(actorId: string, id: string): Promise<Result<RevisionView[]>> {
    const loaded = await loadPatient(this.patients, id);
    if (!loaded.ok) return err(loaded.error);
    const revisions = await this.patients.history(loaded.value.id);
    await this.auditor.record(actorId, 'patient.history.read', loaded.value, { revisions: revisions.length });
    return ok(revisions.map(toRevisionView));
  }
}

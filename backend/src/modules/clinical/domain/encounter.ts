import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { Vitals } from './vitals';
import { Certainty, DiagnosisKind, EncounterId, EncounterNumber, IcdCode, parseClinicalText, PatientRef, requiredText } from './values';

export type EncounterStatus = 'IN_PROGRESS' | 'SIGNED' | 'CANCELLED';
export const ENCOUNTER_STATUSES: readonly EncounterStatus[] = ['IN_PROGRESS', 'SIGNED', 'CANCELLED'];
export const MAX_DIAGNOSES = 10;

/** La note de consultation, au format SOAP : motif et histoire (S), examen (O), évaluation (A), conduite à tenir (P). */
export interface Note {
  readonly chiefComplaint: string | null;
  readonly history: string | null;
  readonly examination: string | null;
  readonly assessment: string | null;
  readonly plan: string | null;
}

export type NoteInput = { readonly [K in keyof Note]?: string | null };

export interface Diagnosis {
  readonly code: IcdCode;
  readonly label: string;
  readonly kind: DiagnosisKind;
  readonly certainty: Certainty;
}

export interface Addendum {
  readonly seq: number;
  readonly text: string;
  readonly by: string;
  readonly at: Instant;
}

export interface EncounterState {
  readonly id: EncounterId;
  readonly number: EncounterNumber;
  readonly patientId: PatientRef;
  readonly serviceId: string;
  readonly admissionId: string | null;
  /** Le médecin qui conduit la consultation : lui seul la rédige, la signe et l'annule. */
  readonly doctorId: string;
  readonly status: EncounterStatus;
  readonly startedAt: Instant;
  readonly vitals: Vitals | null;
  readonly vitalsBy: string | null;
  readonly vitalsAt: Instant | null;
  readonly note: Note;
  readonly diagnoses: readonly Diagnosis[];
  readonly signedBy: string | null;
  readonly signedAt: Instant | null;
  readonly addenda: readonly Addendum[];
  readonly cancelledBy: string | null;
  readonly cancelledAt: Instant | null;
  readonly cancellationReason: string | null;
}

const NOT_IN_PROGRESS = (status: EncounterStatus) =>
  new DomainError('CLINICAL_ENCOUNTER_LOCKED', `Cette consultation est ${status === 'SIGNED' ? 'signée : elle ne se modifie plus, on y ajoute un addendum' : 'annulée : elle ne peut plus être modifiée'}.`, { status });
const NOT_AUTHOR = new DomainError('CLINICAL_NOT_AUTHOR', 'Seul le médecin qui conduit cette consultation peut la rédiger, la signer ou l’annuler.');

/**
 * Consultation : un médecin voit un patient. Elle se rédige tant qu'elle est en cours (note SOAP, diagnostics), se signe (elle est alors
 * verrouillée : le texte ne change plus, les corrections passent par des addenda datés et signés) ou s'annule avec un motif. Les constantes
 * peuvent être relevées par un autre soignant (infirmier) tant qu'elle est en cours.
 */
export class Encounter {
  private constructor(private current: EncounterState) {}

  static restore(state: EncounterState): Encounter {
    return new Encounter(state);
  }

  static start(input: { readonly id: EncounterId; readonly number: EncounterNumber; readonly patientId: PatientRef; readonly serviceId: string; readonly admissionId: string | null; readonly doctorId: string; readonly startedAt: Instant }): Encounter {
    return new Encounter({
      ...input, status: 'IN_PROGRESS', vitals: null, vitalsBy: null, vitalsAt: null, note: { chiefComplaint: null, history: null, examination: null, assessment: null, plan: null }, diagnoses: [],
      signedBy: null, signedAt: null, addenda: [], cancelledBy: null, cancelledAt: null, cancellationReason: null,
    });
  }

  get state(): EncounterState { return this.current; }
  get id(): EncounterId { return this.current.id; }
  get status(): EncounterStatus { return this.current.status; }

  private ensureAuthor(by: string): Result<void> {
    if (this.current.status !== 'IN_PROGRESS') return err(NOT_IN_PROGRESS(this.current.status));
    return by === this.current.doctorId ? ok(undefined) : err(NOT_AUTHOR);
  }

  /** Relevé des constantes (remplace le précédent) : par le médecin ou un autre soignant, tant que la consultation est en cours. */
  recordVitals(vitals: Vitals, by: string, at: Instant): Result<void> {
    if (this.current.status !== 'IN_PROGRESS') return err(NOT_IN_PROGRESS(this.current.status));
    this.current = { ...this.current, vitals, vitalsBy: by, vitalsAt: at };
    return ok(undefined);
  }

  /** Remplace les champs de la note donnés ; absent : inchangé ; vide ou `null` : effacé. Réservé au médecin de la consultation. */
  updateNote(by: string, input: NoteInput): Result<void> {
    const author = this.ensureAuthor(by);
    if (!author.ok) return author;
    const next: Record<string, string | null> = { ...this.current.note };
    const limits: Record<keyof Note, number> = { chiefComplaint: 500, history: 2000, examination: 2000, assessment: 2000, plan: 2000 };
    for (const key of Object.keys(limits) as (keyof Note)[]) {
      if (input[key] === undefined) continue;
      const parsed = parseClinicalText(input[key], limits[key], 'CLINICAL_NOTE_INVALID');
      if (!parsed.ok) return err(parsed.error);
      next[key] = parsed.value;
    }
    this.current = { ...this.current, note: next as unknown as Note };
    return ok(undefined);
  }

  /** Remplace d'un bloc les diagnostics : au plus 10, un seul principal, aucun code en double. */
  setDiagnoses(by: string, diagnoses: readonly Diagnosis[]): Result<void> {
    const author = this.ensureAuthor(by);
    if (!author.ok) return author;
    if (diagnoses.length > MAX_DIAGNOSES) return err(new DomainError('CLINICAL_DIAGNOSES_INVALID', `Au plus ${MAX_DIAGNOSES} diagnostics par consultation.`, { max: MAX_DIAGNOSES }));
    if (diagnoses.filter((d) => d.kind === 'PRIMARY').length > 1) return err(new DomainError('CLINICAL_DIAGNOSIS_PRIMARY_DUPLICATE', 'Une consultation n’a qu’un diagnostic principal.'));
    if (new Set(diagnoses.map((d) => d.code.value)).size !== diagnoses.length) return err(new DomainError('CLINICAL_DIAGNOSIS_DUPLICATE', 'Un même code ne figure qu’une fois dans les diagnostics.'));
    for (const d of diagnoses) {
      if (d.label.length < 1 || d.label.length > 150) return err(new DomainError('CLINICAL_DIAGNOSIS_LABEL_INVALID', 'Le libellé d’un diagnostic doit comporter de 1 à 150 caractères.'));
    }
    this.current = { ...this.current, diagnoses: [...diagnoses] };
    return ok(undefined);
  }

  /** Ce qu'il manque pour signer : un diagnostic principal et une évaluation. Vide : la consultation peut être signée. */
  missingForSignature(): readonly ('PRIMARY_DIAGNOSIS' | 'ASSESSMENT')[] {
    const missing: ('PRIMARY_DIAGNOSIS' | 'ASSESSMENT')[] = [];
    if (!this.current.diagnoses.some((d) => d.kind === 'PRIMARY')) missing.push('PRIMARY_DIAGNOSIS');
    if (this.current.note.assessment === null) missing.push('ASSESSMENT');
    return missing;
  }

  /** Signe et verrouille. Il faut un diagnostic principal et une évaluation (la liste de ce qui manque est donnée). */
  sign(by: string, at: Instant): Result<void> {
    const author = this.ensureAuthor(by);
    if (!author.ok) return author;
    const missing = this.missingForSignature();
    if (missing.length > 0) {
      return err(new DomainError('CLINICAL_SIGNATURE_INCOMPLETE', 'La consultation ne peut pas être signée : un diagnostic principal et une évaluation sont obligatoires.', { missing: missing.join(',') }));
    }
    this.current = { ...this.current, status: 'SIGNED', signedBy: by, signedAt: at };
    return ok(undefined);
  }

  /** Complète une consultation signée sans la modifier : daté, signé, ajout seul. Réservé au médecin de la consultation. */
  addAddendum(text: string, by: string, at: Instant): Result<Addendum> {
    if (this.current.status !== 'SIGNED') return err(new DomainError('CLINICAL_ENCOUNTER_NOT_SIGNED', 'Seule une consultation signée reçoit un addendum.'));
    if (by !== this.current.doctorId) return err(NOT_AUTHOR);
    const body = requiredText(text, 2000, 'CLINICAL_ADDENDUM_INVALID', 'L’addendum doit comporter de 1 à 2 000 caractères.');
    if (!body.ok) return err(body.error);
    const addendum: Addendum = { seq: this.current.addenda.length + 1, text: body.value, by, at };
    this.current = { ...this.current, addenda: [...this.current.addenda, addendum] };
    return ok(addendum);
  }

  /** Annule une consultation ouverte par erreur ; le motif est obligatoire. */
  cancel(reason: string, by: string, at: Instant): Result<void> {
    const author = this.ensureAuthor(by);
    if (!author.ok) return author;
    const why = requiredText(reason, 200, 'CLINICAL_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).');
    if (!why.ok) return err(why.error);
    this.current = { ...this.current, status: 'CANCELLED', cancelledBy: by, cancelledAt: at, cancellationReason: why.value };
    return ok(undefined);
  }
}

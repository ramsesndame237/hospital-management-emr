import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import {
  Container, PatientRef, Priority, Reason, RejectionReason, RequisitionId, RequisitionNumber, Section, SpecimenBarcode, SpecimenId, SpecimenType, Source, TestCode, TestId, TestName,
} from './values';

export const MAX_TESTS_PER_REQUISITION = 30;

export type SpecimenStatus = 'PENDING_COLLECTION' | 'COLLECTED' | 'RECEIVED' | 'REJECTED';
export type SpecimenEventKind = 'CREATED' | 'COLLECTED' | 'RECEIVED' | 'REJECTED';

/** Une étape de la vie d'un échantillon (chaîne de traçabilité) : qui, quand, et une précision éventuelle (motif d'un rejet…). */
export interface SpecimenEvent {
  readonly kind: SpecimenEventKind;
  readonly at: Instant;
  readonly actorId: string | null;
  readonly note: string | null;
}

export interface Specimen {
  readonly id: SpecimenId;
  readonly barcode: SpecimenBarcode;
  readonly specimenType: SpecimenType;
  readonly container: Container;
  readonly status: SpecimenStatus;
  readonly collectedBy: string | null;
  readonly collectedAt: Instant | null;
  readonly receivedBy: string | null;
  readonly receivedAt: Instant | null;
  readonly rejectionReason: RejectionReason | null;
  readonly rejectionNote: string | null;
  readonly rejectedBy: string | null;
  readonly rejectedAt: Instant | null;
  /** Échantillon rejeté que celui-ci remplace (nouveau prélèvement). */
  readonly recollectionOf: SpecimenId | null;
  readonly events: readonly SpecimenEvent[];
}

/** Une analyse demandée : copie du code et du libellé au moment de la demande, et l'échantillon qui doit la porter. */
export interface OrderedTest {
  readonly testId: TestId;
  readonly code: TestCode;
  readonly name: TestName;
  readonly section: Section;
  readonly specimenId: SpecimenId;
}

/** `ORDERED` (rien prélevé), `PARTIALLY_COLLECTED`, `COLLECTED` (tout prélevé, pas encore reçu au laboratoire), `RECEIVED` (tout reçu), `CANCELLED`. */
export type RequisitionStatus = 'ORDERED' | 'PARTIALLY_COLLECTED' | 'COLLECTED' | 'RECEIVED' | 'CANCELLED';

export interface RequisitionState {
  readonly id: RequisitionId;
  readonly number: RequisitionNumber;
  readonly patientId: PatientRef;
  readonly priority: Priority;
  readonly source: Source;
  readonly clinicalNotes: string | null;
  readonly orderedBy: string;
  readonly orderedAt: Instant;
  readonly tests: readonly OrderedTest[];
  readonly specimens: readonly Specimen[];
  readonly cancelledBy: string | null;
  readonly cancelledAt: Instant | null;
  readonly cancellationReason: Reason | null;
  /** Compteur de modifications : deux techniciens qui agissent sur la même demande ne s'écrasent pas. */
  readonly version: number;
}

export interface TestToOrder {
  readonly testId: TestId;
  readonly code: TestCode;
  readonly name: TestName;
  readonly section: Section;
  readonly specimenType: SpecimenType;
  readonly container: Container;
}

const key = (t: Pick<TestToOrder, 'specimenType' | 'container'>) => `${t.specimenType}|${t.container}`;

/** Une demande comporte de 1 à 30 analyses, chacune une seule fois. Contrôlé avant de consommer le moindre numéro. */
export function checkTests(tests: readonly Pick<TestToOrder, 'testId'>[]): Result<void> {
  if (tests.length === 0) return err(new DomainError('LAB_REQUISITION_EMPTY', 'Une demande comporte au moins une analyse.'));
  if (tests.length > MAX_TESTS_PER_REQUISITION) return err(new DomainError('LAB_TOO_MANY_TESTS', `Une demande comporte au plus ${MAX_TESTS_PER_REQUISITION} analyses.`, { max: MAX_TESTS_PER_REQUISITION }));
  if (new Set(tests.map((t) => t.testId.value)).size !== tests.length) return err(new DomainError('LAB_TEST_DUPLICATED', 'Une analyse ne peut figurer qu’une fois dans la demande.'));
  return ok(undefined);
}

/** Combien d'échantillons faut-il prélever pour ces analyses ? Un par couple (type d'échantillon, contenant) : deux analyses sur le même tube partagent l'échantillon. */
export function specimenCount(tests: readonly Pick<TestToOrder, 'specimenType' | 'container'>[]): number {
  return new Set(tests.map(key)).size;
}

const NOT_FOUND_SPECIMEN = new DomainError('LAB_SPECIMEN_NOT_FOUND', 'Échantillon introuvable.');

function event(kind: SpecimenEventKind, at: Instant, actorId: string | null, note: string | null = null): SpecimenEvent {
  return { kind, at, actorId, note };
}

/**
 * Demande d'analyses d'un patient : les analyses demandées, et les échantillons à prélever pour les réaliser. L'échantillon passe de
 * « à prélever » à « prélevé » puis « reçu » au laboratoire ; un échantillon inutilisable est rejeté et remplacé par un nouveau
 * prélèvement. Chaque étape est inscrite (qui, quand) : rien ne se supprime ni ne se réécrit.
 */
export class Requisition {
  private constructor(private current: RequisitionState) {}

  static restore(state: RequisitionState): Requisition {
    return new Requisition(state);
  }

  static order(input: {
    id: RequisitionId; number: RequisitionNumber; patientId: PatientRef; priority: Priority; source: Source; clinicalNotes: string | null; orderedBy: string; orderedAt: Instant;
    tests: readonly TestToOrder[]; specimenIds: readonly SpecimenId[]; barcodes: readonly SpecimenBarcode[];
  }): Result<Requisition> {
    const shape = checkTests(input.tests);
    if (!shape.ok) return err(shape.error);
    const groups = [...new Set(input.tests.map(key))];
    if (input.specimenIds.length !== groups.length || input.barcodes.length !== groups.length) throw new Error("Nombre d'échantillons incohérent avec les analyses");
    const specimens: Specimen[] = groups.map((g, i) => {
      const [specimenType, container] = g.split('|') as [SpecimenType, Container];
      return {
        id: input.specimenIds[i], barcode: input.barcodes[i], specimenType, container, status: 'PENDING_COLLECTION', collectedBy: null, collectedAt: null, receivedBy: null, receivedAt: null,
        rejectionReason: null, rejectionNote: null, rejectedBy: null, rejectedAt: null, recollectionOf: null, events: [event('CREATED', input.orderedAt, input.orderedBy)],
      };
    });
    const tests: OrderedTest[] = input.tests.map((t) => ({ testId: t.testId, code: t.code, name: t.name, section: t.section, specimenId: specimens[groups.indexOf(key(t))].id }));
    return ok(new Requisition({
      id: input.id, number: input.number, patientId: input.patientId, priority: input.priority, source: input.source, clinicalNotes: input.clinicalNotes, orderedBy: input.orderedBy,
      orderedAt: input.orderedAt, tests, specimens, cancelledBy: null, cancelledAt: null, cancellationReason: null, version: 0,
    }));
  }

  get state(): RequisitionState { return this.current; }
  get id(): RequisitionId { return this.current.id; }

  get status(): RequisitionStatus {
    if (this.current.cancelledAt) return 'CANCELLED';
    const active = this.current.specimens.filter((s) => s.status !== 'REJECTED');
    const pending = active.filter((s) => s.status === 'PENDING_COLLECTION').length;
    if (pending === active.length) return 'ORDERED';
    if (pending > 0) return 'PARTIALLY_COLLECTED';
    return active.every((s) => s.status === 'RECEIVED') ? 'RECEIVED' : 'COLLECTED';
  }

  findSpecimen(id: SpecimenId): Specimen | undefined {
    return this.current.specimens.find((s) => s.id.equals(id));
  }

  private open(): Result<void> {
    return this.current.cancelledAt ? err(new DomainError('LAB_REQUISITION_CANCELLED', 'Cette demande est annulée.')) : ok(undefined);
  }

  private replace(id: SpecimenId, change: (s: Specimen) => Specimen): void {
    this.current = { ...this.current, specimens: this.current.specimens.map((s) => (s.id.equals(id) ? change(s) : s)) };
  }

  /** Prélève l'échantillon. L'identité du patient a déjà été contrôlée (deux identifiants) par l'appelant. */
  collect(specimenId: SpecimenId, by: string, now: Instant): Result<void> {
    const open = this.open();
    if (!open.ok) return open;
    const s = this.findSpecimen(specimenId);
    if (!s) return err(NOT_FOUND_SPECIMEN);
    if (s.status !== 'PENDING_COLLECTION') return err(new DomainError('LAB_SPECIMEN_NOT_PENDING', 'Cet échantillon a déjà été prélevé ou rejeté.', { status: s.status }));
    this.replace(specimenId, (x) => ({ ...x, status: 'COLLECTED', collectedBy: by, collectedAt: now, events: [...x.events, event('COLLECTED', now, by)] }));
    return ok(undefined);
  }

  /** Réception au laboratoire : seul un échantillon prélevé peut être reçu. */
  receive(specimenId: SpecimenId, by: string, now: Instant): Result<void> {
    const open = this.open();
    if (!open.ok) return open;
    const s = this.findSpecimen(specimenId);
    if (!s) return err(NOT_FOUND_SPECIMEN);
    if (s.status !== 'COLLECTED') return err(new DomainError('LAB_SPECIMEN_NOT_COLLECTED', "Seul un échantillon prélevé peut être reçu : il n'a pas encore été prélevé, ou il est déjà reçu ou rejeté.", { status: s.status }));
    this.replace(specimenId, (x) => ({ ...x, status: 'RECEIVED', receivedBy: by, receivedAt: now, events: [...x.events, event('RECEIVED', now, by)] }));
    return ok(undefined);
  }

  /**
   * Rejette un échantillon inutilisable (hémolysé, volume insuffisant…) et le remplace par un nouveau prélèvement, auquel les analyses
   * sont rattachées. `OTHER` exige une précision. L'échantillon rejeté reste dans l'historique.
   */
  reject(specimenId: SpecimenId, by: string, now: Instant, reason: RejectionReason, note: string | null, replacement: { id: SpecimenId; barcode: SpecimenBarcode }): Result<void> {
    const open = this.open();
    if (!open.ok) return open;
    const s = this.findSpecimen(specimenId);
    if (!s) return err(NOT_FOUND_SPECIMEN);
    if (s.status === 'REJECTED') return err(new DomainError('LAB_SPECIMEN_ALREADY_REJECTED', 'Cet échantillon est déjà rejeté.'));
    const text = (note ?? '').trim();
    if (text.length > 200) return err(new DomainError('LAB_REASON_REQUIRED', 'La précision ne doit pas dépasser 200 caractères.'));
    if (reason === 'OTHER' && text === '') return err(new DomainError('LAB_REJECTION_NOTE_REQUIRED', 'Précisez le motif du rejet (200 caractères au plus).'));
    const detail = text === '' ? null : text;
    const fresh: Specimen = {
      id: replacement.id, barcode: replacement.barcode, specimenType: s.specimenType, container: s.container, status: 'PENDING_COLLECTION', collectedBy: null, collectedAt: null, receivedBy: null, receivedAt: null,
      rejectionReason: null, rejectionNote: null, rejectedBy: null, rejectedAt: null, recollectionOf: s.id, events: [event('CREATED', now, by, `Nouveau prélèvement de ${s.barcode.value}`)],
    };
    this.current = {
      ...this.current,
      specimens: [
        ...this.current.specimens.map((x) => (x.id.equals(specimenId)
          ? { ...x, status: 'REJECTED' as const, rejectionReason: reason, rejectionNote: detail, rejectedBy: by, rejectedAt: now, events: [...x.events, event('REJECTED', now, by, detail ? `${reason} : ${detail}` : reason)] }
          : x)),
        fresh,
      ],
      tests: this.current.tests.map((t) => (t.specimenId.equals(specimenId) ? { ...t, specimenId: fresh.id } : t)),
    };
    return ok(undefined);
  }

  /** Annule la demande, avec un motif. Impossible une fois un échantillon reçu au laboratoire : le travail est commencé. */
  cancel(reason: Reason, by: string, now: Instant): Result<void> {
    if (this.current.cancelledAt) return err(new DomainError('LAB_REQUISITION_ALREADY_CANCELLED', 'Cette demande est déjà annulée.'));
    if (this.current.specimens.some((s) => s.status === 'RECEIVED')) {
      return err(new DomainError('LAB_REQUISITION_IN_PROGRESS', "Un échantillon est déjà arrivé au laboratoire : la demande ne peut plus être annulée."));
    }
    this.current = { ...this.current, cancelledBy: by, cancelledAt: now, cancellationReason: reason };
    return ok(undefined);
  }
}

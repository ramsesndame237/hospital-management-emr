import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { CriticalNotification, criticalNotified, currentVersion, isCritical, NotificationMethod, ParsedValue, ResultFlag, ResultStatus, TestResult } from './result';
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
  /** Résultat de l'analyse, une fois saisi. */
  readonly result: TestResult | null;
}

/**
 * `ORDERED` (rien prélevé), `PARTIALLY_COLLECTED`, `COLLECTED` (tout prélevé, pas encore reçu), `RECEIVED` (tout reçu, aucun résultat), `IN_ANALYSIS` (des résultats
 * saisis, pas tous), `RESULTED` (tous saisis), `VERIFIED` (tous validés), `RELEASED` (tous publiés), `CANCELLED`.
 */
export type RequisitionStatus = 'ORDERED' | 'PARTIALLY_COLLECTED' | 'COLLECTED' | 'RECEIVED' | 'IN_ANALYSIS' | 'RESULTED' | 'VERIFIED' | 'RELEASED' | 'CANCELLED';

/** Une saisie de résultat prête à être enregistrée : valeur contrôlée, position par rapport aux valeurs de référence, alerte de variation. */
export interface ResultEntry {
  readonly parsed: ParsedValue;
  readonly flag: ResultFlag | null;
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly criticalLow: number | null;
  readonly criticalHigh: number | null;
  readonly unit: string | null;
  readonly previousValue: number | null;
  readonly deltaAlert: boolean;
  readonly comment: string | null;
}

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
    const tests: OrderedTest[] = input.tests.map((t) => ({ testId: t.testId, code: t.code, name: t.name, section: t.section, specimenId: specimens[groups.indexOf(key(t))].id, result: null }));
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
    if (!active.every((s) => s.status === 'RECEIVED')) return 'COLLECTED';
    const results = this.current.tests.map((t) => t.result);
    if (results.every((r) => r?.status === 'RELEASED')) return 'RELEASED';
    if (results.every((r) => r?.status === 'VERIFIED' || r?.status === 'RELEASED')) return 'VERIFIED';
    if (results.every((r) => r !== null && r.status !== 'RETURNED')) return 'RESULTED';
    return results.some((r) => r !== null) ? 'IN_ANALYSIS' : 'RECEIVED';
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
    if (this.current.tests.some((t) => t.specimenId.equals(specimenId) && t.result !== null)) {
      return err(new DomainError('LAB_SPECIMEN_HAS_RESULTS', 'Des résultats sont déjà saisis sur cet échantillon : il ne peut plus être rejeté.'));
    }
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

  // ---- Résultats -------------------------------------------------------------------------------------------------------

  private testOf(testId: TestId): OrderedTest | undefined {
    return this.current.tests.find((t) => t.testId.equals(testId));
  }

  private setResult(testId: TestId, result: TestResult): void {
    this.current = { ...this.current, tests: this.current.tests.map((t) => (t.testId.equals(testId) ? { ...t, result } : t)) };
  }

  /** L'analyse existe dans la demande, la demande est ouverte et son échantillon est arrivé au laboratoire. */
  private workable(testId: TestId): Result<OrderedTest> {
    const open = this.open();
    if (!open.ok) return open;
    const test = this.testOf(testId);
    if (!test) return err(new DomainError('LAB_TEST_NOT_IN_REQUISITION', "Cette analyse ne figure pas dans la demande."));
    return ok(test);
  }

  private withResult(testId: TestId): Result<{ test: OrderedTest; result: TestResult }> {
    const found = this.workable(testId);
    if (!found.ok) return found;
    if (!found.value.result) return err(new DomainError('LAB_RESULT_NOT_ENTERED', "Aucun résultat n'est saisi pour cette analyse."));
    return ok({ test: found.value, result: found.value.result });
  }

  private version(entry: ResultEntry, by: string, now: Instant, number: number, amendmentReason: string | null) {
    return {
      version: number, value: entry.parsed.value, valueNumber: entry.parsed.valueNumber, flag: entry.flag, refLow: entry.refLow, refHigh: entry.refHigh, criticalLow: entry.criticalLow,
      criticalHigh: entry.criticalHigh, unit: entry.unit, previousValue: entry.previousValue, deltaAlert: entry.deltaAlert, enteredBy: by, enteredAt: now, comment: entry.comment, amendmentReason,
    };
  }

  /**
   * Saisit (ou corrige, tant que rien n'est validé) le résultat d'une analyse. L'échantillon doit être arrivé au laboratoire. Chaque saisie est une
   * nouvelle version ; un résultat validé ou publié ne se retouche pas : on le renvoie, ou on l'amende avec un motif.
   */
  enterResult(testId: TestId, by: string, now: Instant, entry: ResultEntry): Result<void> {
    const found = this.workable(testId);
    if (!found.ok) return found;
    const test = found.value;
    if (this.findSpecimen(test.specimenId)?.status !== 'RECEIVED') return err(new DomainError('LAB_SPECIMEN_NOT_RECEIVED', "L'échantillon n'est pas encore arrivé au laboratoire : on ne saisit pas de résultat avant sa réception."));
    const before = test.result;
    if (before && before.status !== 'ENTERED' && before.status !== 'RETURNED') {
      return err(new DomainError('LAB_RESULT_LOCKED', before.status === 'VERIFIED' ? 'Ce résultat est validé : renvoyez-le pour le corriger.' : 'Ce résultat est publié : amendez-le avec un motif.', { status: before.status }));
    }
    const versions = [...(before?.versions ?? []), this.version(entry, by, now, (before?.versions.length ?? 0) + 1, null)];
    this.setResult(testId, {
      status: 'ENTERED', versions, releasedVersion: before?.releasedVersion ?? null, returnReason: null, verifiedBy: null, verifiedAt: null, releasedBy: before?.releasedBy ?? null,
      releasedAt: before?.releasedAt ?? null, notifications: before?.notifications ?? [],
    });
    return ok(undefined);
  }

  /** Validation par un autre technicien que l'auteur de la saisie (quatre yeux). */
  verifyResult(testId: TestId, by: string, now: Instant): Result<void> {
    const found = this.withResult(testId);
    if (!found.ok) return found;
    const { result } = found.value;
    if (result.status !== 'ENTERED') return err(new DomainError('LAB_RESULT_NOT_PENDING_VERIFICATION', "Ce résultat n'attend pas de validation.", { status: result.status }));
    if (currentVersion(result).enteredBy === by) return err(new DomainError('LAB_VERIFY_SELF', 'Vous ne pouvez pas valider un résultat que vous avez saisi.'));
    this.setResult(testId, { ...result, status: 'VERIFIED', verifiedBy: by, verifiedAt: now });
    return ok(undefined);
  }

  /** Renvoie un résultat saisi ou validé à son auteur, avec un motif : il devra le ressaisir. */
  returnResult(testId: TestId, reason: Reason): Result<void> {
    const found = this.withResult(testId);
    if (!found.ok) return found;
    const { result } = found.value;
    if (result.status !== 'ENTERED' && result.status !== 'VERIFIED') return err(new DomainError('LAB_RESULT_NOT_PENDING_VERIFICATION', "Ce résultat n'attend pas de validation.", { status: result.status }));
    this.setResult(testId, { ...result, status: 'RETURNED', returnReason: reason.value, verifiedBy: null, verifiedAt: null });
    return ok(undefined);
  }

  /** Documente l'appel du clinicien pour une valeur critique : à qui, comment, avec relecture de la valeur. Condition de la publication. */
  documentCritical(testId: TestId, by: string, now: Instant, input: { notifiedName: string; notifiedRole: string; method: NotificationMethod; readBackConfirmed: boolean }): Result<void> {
    const found = this.withResult(testId);
    if (!found.ok) return found;
    const { result } = found.value;
    if (result.status === 'RELEASED') return err(new DomainError('LAB_RESULT_LOCKED', 'Ce résultat est déjà publié.', { status: result.status }));
    const current = currentVersion(result);
    if (!isCritical(current.flag)) return err(new DomainError('LAB_RESULT_NOT_CRITICAL', "Ce résultat n'est pas une valeur critique."));
    if (!input.readBackConfirmed) return err(new DomainError('LAB_READBACK_REQUIRED', 'La relecture de la valeur par le clinicien doit être confirmée.'));
    const notification: CriticalNotification = { version: current.version, notifiedName: input.notifiedName, notifiedRole: input.notifiedRole, method: input.method, readBackConfirmed: true, at: now, by };
    this.setResult(testId, { ...result, notifications: [...result.notifications, notification] });
    return ok(undefined);
  }

  /** Publie un résultat validé : par un autre que l'auteur de la saisie, et, pour une valeur critique, après l'appel du clinicien. */
  releaseResult(testId: TestId, by: string, now: Instant): Result<void> {
    const found = this.withResult(testId);
    if (!found.ok) return found;
    const { result } = found.value;
    if (result.status !== 'VERIFIED') return err(new DomainError('LAB_RESULT_NOT_VERIFIED', "Seul un résultat validé peut être publié.", { status: result.status }));
    const current = currentVersion(result);
    if (current.enteredBy === by) return err(new DomainError('LAB_VERIFY_SELF', 'Vous ne pouvez pas publier un résultat que vous avez saisi.'));
    if (isCritical(current.flag) && !criticalNotified(result)) return err(new DomainError('LAB_CRITICAL_NOT_NOTIFIED', "Valeur critique : documentez l'appel du clinicien avant de publier."));
    this.setResult(testId, { ...result, status: 'RELEASED', releasedVersion: current.version, releasedBy: by, releasedAt: now });
    return ok(undefined);
  }

  /** Amende un résultat publié : nouvelle version avec son motif, à valider puis publier de nouveau. Le prescripteur continue de voir la version publiée. */
  amendResult(testId: TestId, by: string, now: Instant, entry: ResultEntry, reason: Reason): Result<void> {
    const found = this.withResult(testId);
    if (!found.ok) return found;
    const { result } = found.value;
    if (result.status !== 'RELEASED') return err(new DomainError('LAB_RESULT_NOT_RELEASED', "Seul un résultat publié s'amende.", { status: result.status }));
    this.setResult(testId, {
      ...result, status: 'ENTERED', versions: [...result.versions, this.version(entry, by, now, result.versions.length + 1, reason.value)], returnReason: null, verifiedBy: null, verifiedAt: null,
    });
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

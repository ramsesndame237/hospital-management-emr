import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ServiceAccess } from '../../../../shared-kernel/service-access';
import { criticalNotified, currentVersion, isCritical, ResultStatus, TestResult } from '../../domain/result';
import { checkTests, Requisition, RequisitionStatus, specimenCount, TestToOrder } from '../../domain/requisition';
import { PatientDirectory, PatientInfo, RequisitionRepository, TestRepository, UserDirectory } from '../../domain/ports';
import {
  parseNotes, parsePriority, parseRejectionReason, parseSection, parseSource, PatientRef, Priority, Reason, RejectionReason, RequisitionId, RequisitionNumber, Section, SpecimenBarcode, SpecimenId, Source, TestId,
} from '../../domain/values';

const NOT_FOUND = new DomainError('LAB_REQUISITION_NOT_FOUND', "Demande d'analyses introuvable.");
const SPECIMEN_NOT_FOUND = new DomainError('LAB_SPECIMEN_NOT_FOUND', 'Échantillon introuvable.');
const PATIENT_NOT_FOUND = new DomainError('LAB_PATIENT_NOT_FOUND', 'Patient introuvable.');
const TEST_NOT_FOUND = new DomainError('LAB_TEST_NOT_FOUND', 'Analyse introuvable.');
const TEST_INACTIVE = (code: string) => new DomainError('LAB_TEST_INACTIVE', `L'analyse ${code} est retirée du catalogue : on ne peut plus la demander.`, { code });
const IDENTITY_MISMATCH = new DomainError('LAB_IDENTITY_MISMATCH', "Le patient ne correspond pas à la demande : vérifiez le bracelet et la date de naissance avant de prélever.");
const CHANGED = new DomainError('LAB_REQUISITION_NOT_FOUND', "Demande d'analyses introuvable.");

export interface UserSummary {
  readonly id: string;
  readonly username: string;
}

export interface PatientSummary {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

export interface SpecimenEventView {
  readonly kind: string;
  readonly at: string;
  readonly actor: UserSummary | null;
  readonly note: string | null;
}

export interface SpecimenView {
  readonly id: string;
  readonly barcode: string;
  readonly specimenType: string;
  readonly container: string;
  readonly status: string;
  readonly collectedBy: UserSummary | null;
  readonly collectedAt: string | null;
  readonly receivedBy: UserSummary | null;
  readonly receivedAt: string | null;
  readonly rejectionReason: string | null;
  readonly rejectionNote: string | null;
  readonly rejectedBy: UserSummary | null;
  readonly rejectedAt: string | null;
  readonly recollectionOf: string | null;
  /** Chaîne de traçabilité : toutes les étapes, de la plus ancienne à la plus récente. */
  readonly events: readonly SpecimenEventView[];
}

export interface ResultVersionView {
  readonly version: number;
  readonly value: string;
  readonly flag: string | null;
  readonly unit: string | null;
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly criticalLow: number | null;
  readonly criticalHigh: number | null;
  /** Dernier résultat publié du même patient, au moment de la saisie. */
  readonly previousValue: number | null;
  /** Variation importante par rapport au résultat précédent (delta check). */
  readonly deltaAlert: boolean;
  readonly enteredBy: UserSummary | null;
  readonly enteredAt: string;
  readonly comment: string | null;
  readonly amendmentReason: string | null;
}

export interface CriticalNotificationView {
  readonly version: number;
  readonly notifiedName: string;
  readonly notifiedRole: string;
  readonly method: string;
  readonly at: string;
  readonly by: UserSummary | null;
}

/**
 * Le résultat d'une analyse. Le laboratoire voit tout (toutes les versions) ; le prescripteur ne voit que ce qui est **publié** : tant qu'aucune
 * version n'est publiée il lit `IN_PROGRESS`, sans valeur.
 */
export interface ResultView {
  readonly status: ResultStatus | 'IN_PROGRESS';
  readonly currentVersion: number | null;
  readonly releasedVersion: number | null;
  readonly versions: readonly ResultVersionView[];
  readonly returnReason: string | null;
  readonly verifiedBy: UserSummary | null;
  readonly verifiedAt: string | null;
  readonly releasedBy: UserSummary | null;
  readonly releasedAt: string | null;
  /** La version courante est une valeur critique : l'appel du clinicien conditionne sa publication. */
  readonly criticalRequired: boolean;
  readonly criticalNotified: boolean;
  readonly notifications: readonly CriticalNotificationView[];
  /** Une version amendée attend sa validation : la version publiée reste celle du prescripteur. */
  readonly amendmentPending: boolean;
}

export interface OrderedTestView {
  readonly testId: string;
  readonly code: string;
  readonly name: string;
  readonly section: string;
  readonly specimenId: string;
  readonly resultType: string;
  readonly unit: string | null;
  readonly decimals: number;
  readonly choices: readonly string[];
  readonly result: ResultView | null;
}

export interface RequisitionView {
  readonly id: string;
  readonly number: string;
  readonly status: RequisitionStatus;
  readonly patient: PatientSummary | null;
  readonly priority: string;
  readonly source: string;
  readonly clinicalNotes: string | null;
  readonly orderedBy: UserSummary | null;
  readonly orderedAt: string;
  readonly tests: readonly OrderedTestView[];
  readonly specimens: readonly SpecimenView[];
  readonly cancelledBy: UserSummary | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
}

export interface RequisitionDependencies {
  readonly requisitions: RequisitionRepository;
  readonly tests: TestRepository;
  readonly patients: PatientDirectory;
  readonly users: UserDirectory;
  readonly access: ServiceAccess;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

const summaryOf = (p: PatientInfo): PatientSummary => ({ id: p.id, number: p.number, lastName: p.lastName, firstName: p.firstName, sex: p.sex, birthDate: p.birthDate });

export async function toView(d: RequisitionDependencies, actorId: string, requisition: Requisition): Promise<RequisitionView> {
  const s = requisition.state;
  const reviewer = await isReviewer(d, actorId);
  const userIds = new Set<string>([s.orderedBy]);
  if (s.cancelledBy) userIds.add(s.cancelledBy);
  for (const t of s.tests) {
    for (const id of [t.result?.verifiedBy, t.result?.releasedBy, ...(t.result?.versions.map((v) => v.enteredBy) ?? []), ...(t.result?.notifications.map((n) => n.by) ?? [])]) if (id) userIds.add(id);
  }
  for (const sp of s.specimens) {
    for (const id of [sp.collectedBy, sp.receivedBy, sp.rejectedBy, ...sp.events.map((e) => e.actorId)]) if (id) userIds.add(id);
  }
  const users = await d.users.find([...userIds]);
  const who = (id: string | null): UserSummary | null => (id && users.get(id) ? { id, username: users.get(id)!.username } : null);
  const patient = (await d.patients.find([s.patientId.value])).get(s.patientId.value) ?? null;
  const catalogue = new Map((await d.tests.findByIds(s.tests.map((t) => t.testId))).map((t) => [t.id.value, t.state]));
  return {
    id: s.id.value, number: s.number.value, status: requisition.status, patient: patient ? summaryOf(patient) : null, priority: s.priority, source: s.source, clinicalNotes: s.clinicalNotes,
    orderedBy: who(s.orderedBy), orderedAt: s.orderedAt.toString(),
    tests: s.tests.map((t): OrderedTestView => {
      const c = catalogue.get(t.testId.value);
      return {
        testId: t.testId.value, code: t.code.value, name: t.name.value, section: t.section, specimenId: t.specimenId.value, resultType: c?.resultType ?? 'TEXT', unit: c?.unit ?? null, decimals: c?.decimals ?? 0,
        choices: c?.choices ?? [], result: t.result ? resultView(t.result, reviewer, who) : null,
      };
    }),
    specimens: s.specimens.map((sp): SpecimenView => ({
      id: sp.id.value, barcode: sp.barcode.value, specimenType: sp.specimenType, container: sp.container, status: sp.status, collectedBy: who(sp.collectedBy), collectedAt: sp.collectedAt?.toString() ?? null,
      receivedBy: who(sp.receivedBy), receivedAt: sp.receivedAt?.toString() ?? null, rejectionReason: sp.rejectionReason, rejectionNote: sp.rejectionNote, rejectedBy: who(sp.rejectedBy),
      rejectedAt: sp.rejectedAt?.toString() ?? null, recollectionOf: sp.recollectionOf?.value ?? null,
      events: sp.events.map((e) => ({ kind: e.kind, at: e.at.toString(), actor: who(e.actorId), note: e.note })),
    })),
    cancelledBy: who(s.cancelledBy), cancelledAt: s.cancelledAt?.toString() ?? null, cancellationReason: s.cancellationReason?.value ?? null,
  };
}

function versionView(v: TestResult['versions'][number], who: (id: string | null) => UserSummary | null): ResultVersionView {
  return {
    version: v.version, value: v.value, flag: v.flag, unit: v.unit, refLow: v.refLow, refHigh: v.refHigh, criticalLow: v.criticalLow, criticalHigh: v.criticalHigh, previousValue: v.previousValue,
    deltaAlert: v.deltaAlert, enteredBy: who(v.enteredBy), enteredAt: v.enteredAt.toString(), comment: v.comment, amendmentReason: v.amendmentReason,
  };
}

function resultView(r: TestResult, reviewer: boolean, who: (id: string | null) => UserSummary | null): ResultView {
  const current = currentVersion(r);
  if (!reviewer) {
    // Le prescripteur ne lit que la version publiée : ni la saisie en cours, ni une valeur non validée.
    const released = r.versions.find((v) => v.version === r.releasedVersion);
    if (!released) {
      return { status: 'IN_PROGRESS', currentVersion: null, releasedVersion: null, versions: [], returnReason: null, verifiedBy: null, verifiedAt: null, releasedBy: null, releasedAt: null, criticalRequired: false, criticalNotified: false, notifications: [], amendmentPending: false };
    }
    return {
      status: 'RELEASED', currentVersion: released.version, releasedVersion: released.version, versions: [versionView(released, who)], returnReason: null, verifiedBy: null, verifiedAt: null,
      releasedBy: who(r.releasedBy), releasedAt: r.releasedAt?.toString() ?? null, criticalRequired: false, criticalNotified: false, notifications: [], amendmentPending: current.version !== released.version,
    };
  }
  return {
    status: r.status, currentVersion: current.version, releasedVersion: r.releasedVersion, versions: r.versions.map((v) => versionView(v, who)), returnReason: r.returnReason, verifiedBy: who(r.verifiedBy),
    verifiedAt: r.verifiedAt?.toString() ?? null, releasedBy: who(r.releasedBy), releasedAt: r.releasedAt?.toString() ?? null, criticalRequired: isCritical(current.flag), criticalNotified: criticalNotified(r),
    notifications: r.notifications.map((n) => ({ version: n.version, notifiedName: n.notifiedName, notifiedRole: n.notifiedRole, method: n.method, at: n.at.toString(), by: who(n.by) })),
    amendmentPending: r.releasedVersion !== null && current.version !== r.releasedVersion,
  };
}

/** Le laboratoire (et l'administrateur système) voit toutes les demandes (portée « all ») ; un prescripteur, seulement les siennes. */
export async function isReviewer(d: RequisitionDependencies, actorId: string): Promise<boolean> {
  return (await d.access.visibleServices(actorId, 'lab.requisitions:read')) === 'ALL';
}

export async function loadFor(d: RequisitionDependencies, actorId: string, rawId: string): Promise<Result<Requisition>> {
  const id = RequisitionId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.requisitions.findById(id.value);
  // Une demande qui n'est pas la sienne (et qu'on n'a pas à traiter) est « introuvable » : on ne révèle pas son existence.
  if (!found || (found.state.orderedBy !== actorId && !(await isReviewer(d, actorId)))) return err(NOT_FOUND);
  return ok(found);
}

function record(d: RequisitionDependencies, actorId: string, action: string, requisition: Requisition, extra: Record<string, string | number | boolean | null> = {}, reason?: string, outcome: 'SUCCESS' | 'FAILURE' = 'SUCCESS'): Promise<void> {
  const s = requisition.state;
  return d.audit.record({
    action, outcome, actorId, resourceType: 'lab-requisition', resourceId: s.id.value, ...(reason ? { reason } : {}),
    metadata: { requisitionNumber: s.number.value, patientId: s.patientId.value, ...extra }, occurredAt: d.clock.now(),
  });
}

export interface OrderInput {
  patientId: string;
  priority?: string;
  source?: string;
  clinicalNotes?: string | null;
  testIds: readonly string[];
}

export class OrderRequisitionUseCase {
  constructor(private readonly d: RequisitionDependencies, private readonly ids: IdGenerator) {}

  /** Demande d'analyses pour un patient. Les analyses doivent exister et être actives ; un échantillon est prévu par couple (type, contenant). */
  async execute(actorId: string, input: OrderInput): Promise<Result<RequisitionView>> {
    const patientRef = PatientRef.create(input.patientId);
    if (!patientRef.ok) return err(patientRef.error);
    const priority = parsePriority(input.priority ?? 'ROUTINE');
    if (!priority.ok) return err(priority.error);
    const source = parseSource(input.source ?? 'OPD');
    if (!source.ok) return err(source.error);
    const notes = parseNotes(input.clinicalNotes);
    if (!notes.ok) return err(notes.error);
    if (!(await this.d.patients.find([patientRef.value.value])).has(patientRef.value.value)) return err(PATIENT_NOT_FOUND);

    const testIds: TestId[] = [];
    for (const raw of input.testIds) {
      const id = TestId.create(raw);
      if (!id.ok) return err(TEST_NOT_FOUND);
      testIds.push(id.value);
    }
    const found = new Map((await this.d.tests.findByIds(testIds)).map((t) => [t.id.value, t]));
    const toOrder: TestToOrder[] = [];
    for (const id of testIds) {
      const test = found.get(id.value);
      if (!test) return err(TEST_NOT_FOUND);
      if (!test.active) return err(TEST_INACTIVE(test.state.code.value));
      const s = test.state;
      toOrder.push({ testId: s.id, code: s.code, name: s.name, section: s.section, specimenType: s.specimenType, container: s.container });
    }

    const shape = checkTests(toOrder);
    if (!shape.ok) return err(shape.error);
    const id = RequisitionId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const count = specimenCount(toOrder);
    const specimenIds: SpecimenId[] = [];
    for (let i = 0; i < count; i++) {
      const sid = SpecimenId.create(this.ids.next());
      if (!sid.ok) return err(sid.error);
      specimenIds.push(sid.value);
    }
    const requisition = Requisition.order({
      id: id.value, number: await this.d.requisitions.nextNumber(), patientId: patientRef.value, priority: priority.value, source: source.value, clinicalNotes: notes.value, orderedBy: actorId,
      orderedAt: this.d.clock.now(), tests: toOrder, specimenIds, barcodes: await this.d.requisitions.nextBarcodes(count),
    });
    if (!requisition.ok) return err(requisition.error);
    await this.d.requisitions.insert(requisition.value);
    await record(this.d, actorId, 'lab.requisition.order', requisition.value, { priority: priority.value, source: source.value, tests: toOrder.length, specimens: count });
    return ok(await toView(this.d, actorId, requisition.value));
  }
}

export class GetRequisitionUseCase {
  constructor(private readonly d: RequisitionDependencies) {}

  async execute(actorId: string, id: string): Promise<Result<RequisitionView>> {
    const loaded = await loadFor(this.d, actorId, id);
    if (!loaded.ok) return err(loaded.error);
    await record(this.d, actorId, 'lab.requisition.read', loaded.value);
    return ok(await toView(this.d, actorId, loaded.value));
  }
}

export class FindBySpecimenUseCase {
  constructor(private readonly d: RequisitionDependencies) {}

  /** Retrouve la demande d'un échantillon d'après son code-barres (scan à la réception). */
  async execute(actorId: string, rawBarcode: string): Promise<Result<RequisitionView & { specimenId: string }>> {
    const barcode = SpecimenBarcode.create(rawBarcode);
    if (!barcode.ok) return err(SPECIMEN_NOT_FOUND);
    const found = await this.d.requisitions.findByBarcode(barcode.value);
    if (!found || (found.state.orderedBy !== actorId && !(await isReviewer(this.d, actorId)))) return err(SPECIMEN_NOT_FOUND);
    const specimen = found.state.specimens.find((s) => s.barcode.equals(barcode.value))!;
    await record(this.d, actorId, 'lab.specimen.find', found, { barcode: barcode.value.value });
    return ok({ ...(await toView(this.d, actorId, found)), specimenId: specimen.id.value });
  }
}

export interface RequisitionListInput {
  status?: string;
  priority?: string;
  source?: string;
  section?: string;
  patientId?: string;
  number?: string;
  barcode?: string;
  offset: number;
  limit: number;
}

export interface RequisitionSummaryView {
  readonly id: string;
  readonly number: string;
  readonly status: string;
  readonly priority: string;
  readonly source: string;
  readonly patient: PatientSummary | null;
  readonly orderedBy: UserSummary | null;
  readonly orderedAt: string;
  readonly testCodes: readonly string[];
  readonly sections: readonly string[];
}

const STATUSES: readonly RequisitionStatus[] = ['ORDERED', 'PARTIALLY_COLLECTED', 'COLLECTED', 'RECEIVED', 'IN_ANALYSIS', 'RESULTED', 'VERIFIED', 'RELEASED', 'CANCELLED'];

export class ListRequisitionsUseCase {
  constructor(private readonly d: RequisitionDependencies) {}

  async execute(actorId: string, input: RequisitionListInput): Promise<Result<{ items: RequisitionSummaryView[]; total: number; offset: number; limit: number }>> {
    const status = input.status?.trim() ? (STATUSES.find((s) => s === input.status!.trim().toUpperCase()) ?? null) : undefined;
    if (status === null) return err(new DomainError('LAB_STATUS_FILTER_INVALID', `Statut de demande invalide : « ${input.status} ».`, { value: input.status ?? '' }));
    const priority = input.priority?.trim() ? parsePriority(input.priority) : ok(undefined);
    if (!priority.ok) return err(priority.error);
    const source = input.source?.trim() ? parseSource(input.source) : ok(undefined);
    if (!source.ok) return err(source.error);
    const section = input.section?.trim() ? parseSection(input.section) : ok(undefined);
    if (!section.ok) return err(section.error);
    const patientId = input.patientId?.trim() ? PatientRef.create(input.patientId) : ok(undefined);
    if (!patientId.ok) return err(patientId.error);
    const number = input.number?.trim() ? RequisitionNumber.create(input.number) : ok(undefined);
    if (!number.ok) return err(number.error);
    const barcode = input.barcode?.trim() ? SpecimenBarcode.create(input.barcode) : ok(undefined);
    if (!barcode.ok) return err(barcode.error);

    const reviewer = await isReviewer(this.d, actorId);
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.d.requisitions.list(
      { status, priority: priority.value as Priority | undefined, source: source.value as Source | undefined, section: section.value as Section | undefined, patientId: patientId.value, number: number.value, barcode: barcode.value, orderedBy: reviewer ? undefined : actorId },
      offset, limit,
    );
    const patients = await this.d.patients.find([...new Set(page.items.map((i) => i.patientId))]);
    const users = await this.d.users.find([...new Set(page.items.map((i) => i.orderedBy))]);
    await this.d.audit.record({
      action: 'lab.requisition.list', outcome: 'SUCCESS', actorId,
      metadata: { criteria: ['status', 'priority', 'source', 'section', 'patientId', 'number', 'barcode'].filter((k) => (input as unknown as Record<string, unknown>)[k]).join(','), returned: page.items.length, total: page.total },
      occurredAt: this.d.clock.now(),
    });
    return ok({
      items: page.items.map((i): RequisitionSummaryView => {
        const p = patients.get(i.patientId);
        const u = users.get(i.orderedBy);
        return {
          id: i.id, number: i.number, status: i.status, priority: i.priority, source: i.source, patient: p ? summaryOf(p) : null, orderedBy: u ? { id: u.id, username: u.username } : null,
          orderedAt: i.orderedAt.toString(), testCodes: i.testCodes, sections: i.sections,
        };
      }),
      total: page.total, offset, limit,
    });
  }
}

export class CancelRequisitionUseCase {
  constructor(private readonly d: RequisitionDependencies) {}

  /** Le prescripteur annule sa demande, le laboratoire n'importe laquelle ; impossible une fois un échantillon reçu. Le motif est obligatoire et tracé. */
  async execute(actorId: string, rawId: string, rawReason: string): Promise<Result<RequisitionView>> {
    const reason = Reason.create(rawReason);
    if (!reason.ok) return err(reason.error);
    const loaded = await loadFor(this.d, actorId, rawId);
    if (!loaded.ok) return err(loaded.error);
    const done = await this.d.requisitions.mutate(loaded.value.id, (r) => r.cancel(reason.value, actorId, this.d.clock.now()));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'lab.requisition.cancel', done.value, {}, reason.value.value);
    return ok(await toView(this.d, actorId, done.value));
  }
}

export class SpecimenUseCases {
  constructor(private readonly d: RequisitionDependencies, private readonly ids: IdGenerator) {}

  private async requisitionOf(rawSpecimenId: string): Promise<Result<{ requisition: Requisition; specimenId: SpecimenId }>> {
    const id = SpecimenId.create(rawSpecimenId);
    if (!id.ok) return err(SPECIMEN_NOT_FOUND);
    const requisition = await this.d.requisitions.findBySpecimen(id.value);
    return requisition ? ok({ requisition, specimenId: id.value }) : err(SPECIMEN_NOT_FOUND);
  }

  /**
   * Prélèvement. Avant de prélever, le préleveur confirme deux identifiants lus sur le bracelet : le numéro de dossier ET la date de
   * naissance. Un écart bloque le prélèvement (409) et la tentative est inscrite au journal.
   */
  async collect(actorId: string, rawSpecimenId: string, input: { patientNumber: string; birthDate: string }): Promise<Result<RequisitionView>> {
    const found = await this.requisitionOf(rawSpecimenId);
    if (!found.ok) return err(found.error);
    const { requisition, specimenId } = found.value;
    const patient = (await this.d.patients.find([requisition.state.patientId.value])).get(requisition.state.patientId.value);
    const specimen = requisition.findSpecimen(specimenId)!;
    if (!patient || patient.number.toUpperCase() !== (input.patientNumber ?? '').trim().toUpperCase() || patient.birthDate !== (input.birthDate ?? '').trim()) {
      await record(this.d, actorId, 'lab.specimen.collect', requisition, { barcode: specimen.barcode.value }, 'Identité du patient non confirmée', 'FAILURE');
      return err(IDENTITY_MISMATCH);
    }
    const done = await this.d.requisitions.mutate(requisition.id, (r) => r.collect(specimenId, actorId, this.d.clock.now()));
    if (!done) return err(CHANGED);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'lab.specimen.collect', done.value, { barcode: specimen.barcode.value });
    return ok(await toView(this.d, actorId, done.value));
  }

  async receive(actorId: string, rawSpecimenId: string): Promise<Result<RequisitionView>> {
    const found = await this.requisitionOf(rawSpecimenId);
    if (!found.ok) return err(found.error);
    const { requisition, specimenId } = found.value;
    const done = await this.d.requisitions.mutate(requisition.id, (r) => r.receive(specimenId, actorId, this.d.clock.now()));
    if (!done) return err(CHANGED);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'lab.specimen.receive', done.value, { barcode: requisition.findSpecimen(specimenId)!.barcode.value });
    return ok(await toView(this.d, actorId, done.value));
  }

  /** Rejette l'échantillon (motif de la liste, précision obligatoire pour « autre ») ; un nouveau prélèvement est créé et le demandeur peut le suivre. */
  async reject(actorId: string, rawSpecimenId: string, input: { reason: string; note?: string | null }): Promise<Result<RequisitionView>> {
    const reason = parseRejectionReason(input.reason);
    if (!reason.ok) return err(reason.error);
    const found = await this.requisitionOf(rawSpecimenId);
    if (!found.ok) return err(found.error);
    const { requisition, specimenId } = found.value;
    const replacementId = SpecimenId.create(this.ids.next());
    if (!replacementId.ok) return err(replacementId.error);
    const [barcode] = await this.d.requisitions.nextBarcodes(1);
    const done = await this.d.requisitions.mutate(requisition.id, (r) => r.reject(specimenId, actorId, this.d.clock.now(), reason.value as RejectionReason, input.note ?? null, { id: replacementId.value, barcode }));
    if (!done) return err(CHANGED);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'lab.specimen.reject', done.value, { barcode: requisition.findSpecimen(specimenId)!.barcode.value, rejection: reason.value, recollection: barcode.value }, input.note?.trim() || undefined);
    return ok(await toView(this.d, actorId, done.value));
  }
}

import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ServiceAccess } from '../../../../shared-kernel/service-access';
import { Temporal } from '../../../../shared-kernel/temporal';
import { ImagingOrder, OrderStatus } from '../../domain/order';
import { EncounterDirectory, ExamTypeRepository, OrderRepository, PatientDirectory, PatientInfo, UserDirectory } from '../../domain/ports';
import { ExamTypeId, OrderId, OrderNumber, parseModality, parseOptionalText, parsePriority, parseSource, PatientRef, Priority, Reason, Source } from '../../domain/values';

const NOT_FOUND = new DomainError('IMG_ORDER_NOT_FOUND', "Demande d'examen introuvable.");
const PATIENT_NOT_FOUND = new DomainError('IMG_PATIENT_NOT_FOUND', 'Patient introuvable.');
const EXAM_NOT_FOUND = new DomainError('IMG_EXAM_NOT_FOUND', 'Examen introuvable.');
const EXAM_INACTIVE = (code: string) => new DomainError('IMG_EXAM_INACTIVE', `L'examen ${code} est retiré du catalogue : on ne peut plus le demander.`, { code });

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

export interface ScreeningView {
  readonly pregnant: boolean;
  readonly contrastAllergy: boolean;
  readonly overrideReason: string | null;
}

export interface ReportDraftView {
  readonly technique: string | null;
  readonly findings: string | null;
  readonly impression: string | null;
  readonly critical: boolean;
  readonly by: UserSummary | null;
  readonly at: string;
}

export interface ReportVersionView {
  readonly version: number;
  readonly technique: string | null;
  readonly findings: string;
  readonly impression: string;
  readonly critical: boolean;
  /** Motif de l'addendum (absent pour le compte rendu initial). */
  readonly reason: string | null;
  readonly signedBy: UserSummary | null;
  readonly signedAt: string;
}

export interface CommunicationView {
  readonly version: number;
  readonly notifiedName: string;
  readonly notifiedRole: string;
  readonly method: string;
  readonly at: string;
  readonly by: UserSummary | null;
}

/**
 * Le compte rendu. Le radiologue voit tout, brouillon compris ; le prescripteur ne voit que ce qui est **signé** : tant que rien n'est signé, il
 * ne lit ni brouillon, ni découverte critique à venir.
 */
export interface ReportView {
  readonly draft: ReportDraftView | null;
  readonly versions: readonly ReportVersionView[];
  readonly communications: readonly CommunicationView[];
  /** Le brouillon signale une découverte critique : l'appel du clinicien conditionne la signature (radiologue seulement). */
  readonly criticalRequired: boolean;
  readonly criticalCommunicated: boolean;
}

export interface OrderView {
  readonly id: string;
  readonly number: string;
  readonly status: OrderStatus;
  readonly patient: PatientSummary | null;
  readonly examTypeId: string;
  readonly examCode: string;
  readonly examName: string;
  readonly modality: string;
  /** L'examen se fait avec un produit de contraste : une allergie connue doit être levée explicitement avant de le réaliser. */
  readonly usesContrast: boolean;
  /** Préparation du patient donnée avec le rendez-vous (à jeun, vessie pleine…). */
  readonly preparation: string | null;
  readonly priority: string;
  readonly source: string;
  readonly clinicalQuestion: string;
  /** La consultation qui a prescrit cet examen. */
  readonly encounterId: string | null;
  readonly orderedBy: UserSummary | null;
  readonly orderedAt: string;
  readonly scheduledFor: string | null;
  readonly scheduledBy: UserSummary | null;
  readonly performedAt: string | null;
  readonly performedBy: UserSummary | null;
  readonly techniqueNote: string | null;
  /** Dépistage de sécurité (grossesse, allergie) : visible du service d'imagerie seulement. */
  readonly screening: ScreeningView | null;
  readonly report: ReportView;
  readonly cancelledBy: UserSummary | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
}

export interface OrderDependencies {
  readonly orders: OrderRepository;
  readonly exams: ExamTypeRepository;
  readonly patients: PatientDirectory;
  readonly encounters: EncounterDirectory;
  readonly users: UserDirectory;
  readonly access: ServiceAccess;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

const summaryOf = (p: PatientInfo): PatientSummary => ({ id: p.id, number: p.number, lastName: p.lastName, firstName: p.firstName, sex: p.sex, birthDate: p.birthDate });

/** Le service d'imagerie (et l'administrateur système) voit toutes les demandes (portée « all ») ; un prescripteur, seulement les siennes. */
export async function isReviewer(d: OrderDependencies, actorId: string): Promise<boolean> {
  return (await d.access.visibleServices(actorId, 'imaging.orders:read')) === 'ALL';
}

export async function toView(d: OrderDependencies, actorId: string, order: ImagingOrder): Promise<OrderView> {
  const s = order.state;
  const reviewer = await isReviewer(d, actorId);
  const userIds = new Set<string>([s.orderedBy]);
  for (const id of [s.scheduledBy, s.performedBy, s.cancelledBy, s.draft?.by, ...s.versions.map((v) => v.signedBy), ...s.communications.map((c) => c.by)]) if (id) userIds.add(id);
  const users = await d.users.find([...userIds]);
  const who = (id: string | null | undefined): UserSummary | null => (id && users.get(id) ? { id, username: users.get(id)!.username } : null);
  const patient = (await d.patients.find([s.patientId.value])).get(s.patientId.value) ?? null;
  const draft = reviewer ? s.draft : null;
  const exam = (await d.exams.findById(s.examTypeId))?.state;
  return {
    id: s.id.value, number: s.number.value, status: order.status, patient: patient ? summaryOf(patient) : null, examTypeId: s.examTypeId.value, examCode: s.examCode.value, examName: s.examName.value,
    modality: s.modality, usesContrast: exam?.usesContrast ?? false, preparation: exam?.preparation ?? null, priority: s.priority, source: s.source, clinicalQuestion: s.clinicalQuestion, encounterId: s.encounterId, orderedBy: who(s.orderedBy), orderedAt: s.orderedAt.toString(),
    scheduledFor: s.scheduledFor?.toString() ?? null, scheduledBy: who(s.scheduledBy), performedAt: s.performedAt?.toString() ?? null, performedBy: who(s.performedBy), techniqueNote: s.techniqueNote,
    screening: reviewer ? s.screening : null,
    report: {
      draft: draft ? { technique: draft.technique, findings: draft.findings, impression: draft.impression, critical: draft.critical, by: who(draft.by), at: draft.at.toString() } : null,
      versions: s.versions.map((v) => ({ version: v.version, technique: v.technique, findings: v.findings, impression: v.impression, critical: v.critical, reason: v.reason, signedBy: who(v.signedBy), signedAt: v.signedAt.toString() })),
      communications: s.communications.filter((c) => s.versions.some((v) => v.version === c.version)).map((c) => ({ version: c.version, notifiedName: c.notifiedName, notifiedRole: c.notifiedRole, method: c.method, at: c.at.toString(), by: who(c.by) })),
      criticalRequired: reviewer && draft?.critical === true,
      criticalCommunicated: reviewer && draft?.critical === true && s.communications.some((c) => c.version === s.versions.length + 1),
    },
    cancelledBy: who(s.cancelledBy), cancelledAt: s.cancelledAt?.toString() ?? null, cancellationReason: s.cancellationReason?.value ?? null,
  };
}

export async function loadFor(d: OrderDependencies, actorId: string, rawId: string): Promise<Result<ImagingOrder>> {
  const id = OrderId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.orders.findById(id.value);
  // Une demande qui n'est pas la sienne (et qu'on n'a pas à traiter) est « introuvable » : on ne révèle pas son existence.
  if (!found || (found.state.orderedBy !== actorId && !(await isReviewer(d, actorId)))) return err(NOT_FOUND);
  return ok(found);
}

/** L'audit ne contient jamais de texte clinique (question, constatations, impression) : seulement des identifiants et des états. */
export function record(
  d: OrderDependencies, actorId: string, action: string, order: ImagingOrder, extra: Record<string, string | number | boolean | null> = {}, reason?: string, outcome: 'SUCCESS' | 'FAILURE' = 'SUCCESS',
): Promise<void> {
  const s = order.state;
  return d.audit.record({
    action, outcome, actorId, resourceType: 'imaging-order', resourceId: s.id.value, ...(reason ? { reason } : {}),
    metadata: { orderNumber: s.number.value, patientId: s.patientId.value, examCode: s.examCode.value, modality: s.modality, ...extra }, occurredAt: d.clock.now(),
  });
}

export interface OrderInput {
  patientId: string;
  examTypeId: string;
  clinicalQuestion: string;
  priority?: string;
  source?: string;
  /** La consultation qui prescrit cet examen (facultatif) : elle doit concerner le même patient et ne pas être annulée. */
  encounterId?: string | null;
}

export class OrderImagingUseCase {
  constructor(private readonly d: OrderDependencies, private readonly ids: IdGenerator) {}

  /** Demande d'un examen pour un patient. L'examen doit exister et être actif ; la question clinique est obligatoire (elle justifie l'examen). */
  async execute(actorId: string, input: OrderInput): Promise<Result<OrderView>> {
    const patientRef = PatientRef.create(input.patientId);
    if (!patientRef.ok) return err(patientRef.error);
    const priority = parsePriority(input.priority ?? 'ROUTINE');
    if (!priority.ok) return err(priority.error);
    const source = parseSource(input.source ?? 'OPD');
    if (!source.ok) return err(source.error);
    const question = parseOptionalText(input.clinicalQuestion, 500, 'IMG_CLINICAL_QUESTION_REQUIRED');
    if (!question.ok) return err(question.error);
    if (question.value === null) return err(new DomainError('IMG_CLINICAL_QUESTION_REQUIRED', 'La question clinique est obligatoire (500 caractères au plus) : elle justifie l’examen.'));
    if (!(await this.d.patients.find([patientRef.value.value])).has(patientRef.value.value)) return err(PATIENT_NOT_FOUND);
    const encounterId = (input.encounterId ?? '').trim().toLowerCase() || null;
    if (encounterId) {
      const encounter = await this.d.encounters.find(encounterId);
      if (!encounter) return err(new DomainError('IMG_ENCOUNTER_NOT_FOUND', 'Consultation introuvable.'));
      if (encounter.patientId !== patientRef.value.value) return err(new DomainError('IMG_ENCOUNTER_PATIENT_MISMATCH', 'Cette consultation concerne un autre patient.'));
      if (encounter.status === 'CANCELLED') return err(new DomainError('IMG_ENCOUNTER_CANCELLED', 'Cette consultation est annulée : on ne lui rattache plus de demande.'));
    }
    const examId = ExamTypeId.create(input.examTypeId);
    if (!examId.ok) return err(EXAM_NOT_FOUND);
    const exam = await this.d.exams.findById(examId.value);
    if (!exam) return err(EXAM_NOT_FOUND);
    if (!exam.active) return err(EXAM_INACTIVE(exam.state.code.value));
    const id = OrderId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const order = ImagingOrder.order({
      id: id.value, number: await this.d.orders.nextNumber(), patientId: patientRef.value, examTypeId: exam.state.id, examCode: exam.state.code, examName: exam.state.name, modality: exam.state.modality,
      priority: priority.value, source: source.value, clinicalQuestion: question.value, encounterId, orderedBy: actorId, orderedAt: this.d.clock.now(),
    });
    if (!order.ok) return err(order.error);
    await this.d.orders.insert(order.value);
    await record(this.d, actorId, 'imaging.order.create', order.value, { priority: priority.value, source: source.value, ...(encounterId ? { encounterId } : {}) });
    return ok(await toView(this.d, actorId, order.value));
  }
}

export class GetOrderUseCase {
  constructor(private readonly d: OrderDependencies) {}

  async execute(actorId: string, id: string): Promise<Result<OrderView>> {
    const loaded = await loadFor(this.d, actorId, id);
    if (!loaded.ok) return err(loaded.error);
    await record(this.d, actorId, 'imaging.order.read', loaded.value);
    return ok(await toView(this.d, actorId, loaded.value));
  }
}

export interface OrderListInput {
  status?: string;
  priority?: string;
  source?: string;
  modality?: string;
  patientId?: string;
  number?: string;
  encounterId?: string;
  offset: number;
  limit: number;
}

export interface OrderSummaryView {
  readonly id: string;
  readonly number: string;
  readonly status: string;
  readonly priority: string;
  readonly source: string;
  readonly modality: string;
  readonly examCode: string;
  readonly examName: string;
  readonly patient: PatientSummary | null;
  readonly orderedBy: UserSummary | null;
  readonly orderedAt: string;
  readonly scheduledFor: string | null;
  /** Le compte rendu signé signale une découverte critique. */
  readonly critical: boolean;
}

const STATUSES: readonly OrderStatus[] = ['ORDERED', 'SCHEDULED', 'PERFORMED', 'REPORTED', 'CANCELLED'];

export class ListOrdersUseCase {
  constructor(private readonly d: OrderDependencies) {}

  async execute(actorId: string, input: OrderListInput): Promise<Result<{ items: OrderSummaryView[]; total: number; offset: number; limit: number }>> {
    const status = input.status?.trim() ? (STATUSES.find((s) => s === input.status!.trim().toUpperCase()) ?? null) : undefined;
    if (status === null) return err(new DomainError('IMG_STATUS_FILTER_INVALID', `Statut de demande invalide : « ${input.status} ».`, { value: input.status ?? '' }));
    const priority = input.priority?.trim() ? parsePriority(input.priority) : ok(undefined);
    if (!priority.ok) return err(priority.error);
    const source = input.source?.trim() ? parseSource(input.source) : ok(undefined);
    if (!source.ok) return err(source.error);
    const modality = input.modality?.trim() ? parseModality(input.modality) : ok(undefined);
    if (!modality.ok) return err(modality.error);
    const patientId = input.patientId?.trim() ? PatientRef.create(input.patientId) : ok(undefined);
    if (!patientId.ok) return err(patientId.error);
    const number = input.number?.trim() ? OrderNumber.create(input.number) : ok(undefined);
    if (!number.ok) return err(number.error);
    const encounterId = input.encounterId?.trim().toLowerCase() || undefined;

    const reviewer = await isReviewer(this.d, actorId);
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.d.orders.list(
      { status, priority: priority.value as Priority | undefined, source: source.value as Source | undefined, modality: modality.value, patientId: patientId.value, number: number.value, encounterId, orderedBy: reviewer ? undefined : actorId },
      offset, limit,
    );
    const patients = await this.d.patients.find([...new Set(page.items.map((i) => i.patientId))]);
    const users = await this.d.users.find([...new Set(page.items.map((i) => i.orderedBy))]);
    await this.d.audit.record({
      action: 'imaging.order.list', outcome: 'SUCCESS', actorId,
      metadata: { criteria: ['status', 'priority', 'source', 'modality', 'patientId', 'number', 'encounterId'].filter((k) => (input as unknown as Record<string, unknown>)[k]).join(','), returned: page.items.length, total: page.total },
      occurredAt: this.d.clock.now(),
    });
    return ok({
      items: page.items.map((i): OrderSummaryView => {
        const p = patients.get(i.patientId);
        const u = users.get(i.orderedBy);
        return {
          id: i.id, number: i.number, status: i.status, priority: i.priority, source: i.source, modality: i.modality, examCode: i.examCode, examName: i.examName, patient: p ? summaryOf(p) : null,
          orderedBy: u ? { id: u.id, username: u.username } : null, orderedAt: i.orderedAt.toString(), scheduledFor: i.scheduledFor?.toString() ?? null, critical: i.critical,
        };
      }),
      total: page.total, offset, limit,
    });
  }
}

export class OrderActionUseCases {
  constructor(private readonly d: OrderDependencies) {}

  /** Le prescripteur annule sa demande, le service d'imagerie n'importe laquelle ; le motif est obligatoire. Refusé une fois l'examen réalisé. */
  async cancel(actorId: string, id: string, rawReason: string): Promise<Result<OrderView>> {
    const loaded = await loadFor(this.d, actorId, id);
    if (!loaded.ok) return err(loaded.error);
    const reason = Reason.create(rawReason);
    if (!reason.ok) return err(reason.error);
    const done = await this.d.orders.mutate(loaded.value.id, (o) => o.cancel(actorId, this.d.clock.now(), reason.value));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'imaging.order.cancel', done.value, {}, reason.value.value);
    return ok(await toView(this.d, actorId, done.value));
  }

  /** (Re)planifie l'examen à l'instant donné (ISO 8601) : pas dans le passé, pas après la réalisation. */
  async schedule(actorId: string, id: string, rawWhen: string): Promise<Result<OrderView>> {
    const loaded = await loadFor(this.d, actorId, id);
    if (!loaded.ok) return err(loaded.error);
    let when;
    try {
      when = Temporal.Instant.from((rawWhen ?? '').trim());
    } catch {
      return err(new DomainError('IMG_SCHEDULE_INVALID', 'Date et heure du créneau invalides (format ISO 8601, par exemple 2026-11-20T09:30:00Z).'));
    }
    const now = this.d.clock.now();
    const done = await this.d.orders.mutate(loaded.value.id, (o) => o.schedule(actorId, when, now));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'imaging.order.schedule', done.value, { scheduledFor: when.toString() });
    return ok(await toView(this.d, actorId, done.value));
  }

  /** Réalise l'examen après dépistage de sécurité. Une contre-indication refusée est inscrite au journal ; une dérogation l'est avec son motif. */
  async perform(actorId: string, id: string, input: { pregnant: boolean; contrastAllergy: boolean; overrideReason?: string | null; techniqueNote?: string | null }): Promise<Result<OrderView>> {
    const loaded = await loadFor(this.d, actorId, id);
    if (!loaded.ok) return err(loaded.error);
    const override = input.overrideReason?.trim() ? Reason.create(input.overrideReason) : ok(null);
    if (!override.ok) return err(override.error);
    const note = parseOptionalText(input.techniqueNote, 500, 'IMG_TECHNIQUE_NOTE_INVALID');
    if (!note.ok) return err(note.error);
    // Si le catalogue ne répond plus, on suppose un produit de contraste : c'est le choix prudent.
    const usesContrast = (await this.d.exams.findById(loaded.value.state.examTypeId))?.state.usesContrast ?? true;
    const done = await this.d.orders.mutate(loaded.value.id, (o) => o.perform(
      { by: actorId, at: this.d.clock.now(), pregnant: input.pregnant === true, contrastAllergy: input.contrastAllergy === true, overrideReason: override.value?.value ?? null, techniqueNote: note.value },
      usesContrast,
    ));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) {
      if (done.error.code === 'IMG_PREGNANCY_RISK' || done.error.code === 'IMG_CONTRAST_ALLERGY') {
        // Ni la nature de la contre-indication ni le motif de dérogation (données de santé) n'entrent dans le journal : ils sont sur la demande.
        await record(this.d, actorId, 'imaging.order.perform', loaded.value, { blocked: true }, undefined, 'FAILURE');
      }
      return err(done.error);
    }
    await record(this.d, actorId, 'imaging.order.perform', done.value, { overridden: done.value.state.screening?.overrideReason != null });
    return ok(await toView(this.d, actorId, done.value));
  }
}

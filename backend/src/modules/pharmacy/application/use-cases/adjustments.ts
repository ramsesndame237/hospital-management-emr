import { IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ADJUSTMENT_STATUSES, AdjustmentStatus, StockAdjustment } from '../../domain/adjustment';
import { Batch } from '../../domain/batch';
import { Drug } from '../../domain/drug';
import { AdjustmentId, BatchId, DrugId, parseAdjustmentReason, parseDirection, parseOptionalText, Quantity, Reason } from '../../domain/values';
import { DrugSummaryView, PharmacyDependencies, UserSummary, pageOf, toDrugSummary, userSummaries } from '../views';

const NOT_FOUND = new DomainError('PHARMACY_ADJUSTMENT_NOT_FOUND', 'Ajustement introuvable.');
const BATCH_NOT_FOUND = new DomainError('PHARMACY_BATCH_NOT_FOUND', 'Lot introuvable.');

export interface AdjustmentView {
  readonly id: string;
  readonly number: string;
  readonly drug: DrugSummaryView | null;
  readonly batch: { id: string; batchNumber: string; expiry: string; quantity: number } | null;
  readonly direction: string;
  readonly quantity: number;
  readonly reason: string;
  readonly note: string | null;
  readonly status: string;
  readonly requestedBy: UserSummary | null;
  readonly requestedAt: string;
  readonly decidedBy: UserSummary | null;
  readonly decidedAt: string | null;
  readonly decisionComment: string | null;
}

async function toViews(d: PharmacyDependencies, items: readonly StockAdjustment[]): Promise<AdjustmentView[]> {
  const distinct = [...new Map(items.map((a) => [a.state.drugId.value, a.state.drugId])).values()];
  const drugs = new Map<string, Drug>((await d.drugs.findByIds(distinct)).map((x) => [x.id.value, x]));
  const batches = new Map<string, Batch>();
  for (const id of new Set(items.map((a) => a.state.batchId.value))) {
    const parsed = BatchId.create(id);
    const batch = parsed.ok ? await d.stock.findBatch(parsed.value) : null;
    if (batch) batches.set(id, batch);
  }
  const who = await userSummaries(d, items.flatMap((a) => [a.state.requestedBy, a.state.decidedBy]));
  return items.map((a): AdjustmentView => {
    const s = a.state;
    const drug = drugs.get(s.drugId.value);
    const batch = batches.get(s.batchId.value);
    return {
      id: s.id.value, number: s.number.value, drug: drug ? toDrugSummary(drug) : null,
      batch: batch ? { id: batch.id.value, batchNumber: batch.state.batchNumber.value, expiry: batch.state.expiry.toString(), quantity: batch.state.quantity } : null,
      direction: s.direction, quantity: s.quantity, reason: s.reason, note: s.note, status: s.status, requestedBy: who(s.requestedBy), requestedAt: s.requestedAt.toString(),
      decidedBy: who(s.decidedBy), decidedAt: s.decidedAt?.toString() ?? null, decisionComment: s.decisionComment,
    };
  });
}

export interface RequestAdjustmentInput {
  batchId: string;
  direction: string;
  quantity: number;
  reason: string;
  note?: string | null;
}

export class AdjustmentUseCases {
  constructor(private readonly d: PharmacyDependencies, private readonly ids: IdGenerator) {}

  private audit(actorId: string, action: string, a: StockAdjustment, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
    const s = a.state;
    return this.d.audit.record({
      action, outcome: 'SUCCESS', actorId, resourceType: 'pharmacy-adjustment', resourceId: s.id.value,
      metadata: { number: s.number.value, drugId: s.drugId.value, batchId: s.batchId.value, direction: s.direction, quantity: s.quantity, reason: s.reason, ...extra }, occurredAt: this.d.clock.now(),
    });
  }

  /**
   * Demande de correction du stock d'un lot. Elle ne change rien tant qu'un AUTRE pharmacien ne l'a pas approuvée. Les refus évidents sont
   * donnés tout de suite (sortie supérieure au stock, entrée dans un lot périmé, demande déjà en attente sur ce lot).
   */
  async request(actorId: string, input: RequestAdjustmentInput): Promise<Result<AdjustmentView>> {
    const batchId = BatchId.create(input.batchId);
    if (!batchId.ok) return err(BATCH_NOT_FOUND);
    const direction = parseDirection(input.direction);
    if (!direction.ok) return err(direction.error);
    const reason = parseAdjustmentReason(input.reason);
    if (!reason.ok) return err(reason.error);
    const quantity = Quantity.create(input.quantity);
    if (!quantity.ok) return err(quantity.error);
    const note = parseOptionalText(input.note, 200, 'PHARMACY_NOTES_INVALID');
    if (!note.ok) return err(note.error);
    const batch = await this.d.stock.findBatch(batchId.value);
    if (!batch) return err(BATCH_NOT_FOUND);
    // Essai à blanc sur une copie du lot : le même contrôle qu'à l'approbation, pour refuser tout de suite ce qui ne passera jamais.
    const probe = Batch.restore(batch.state).adjust(direction.value, quantity.value.value, this.d.calendar.today(), null, 'probe');
    if (!probe.ok) return err(probe.error);
    if (await this.d.adjustments.hasPending(batchId.value)) {
      return err(new DomainError('PHARMACY_ADJUSTMENT_PENDING_EXISTS', 'Une demande d’ajustement est déjà en attente sur ce lot : faites-la décider avant d’en créer une autre.'));
    }
    const id = AdjustmentId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const adjustment = StockAdjustment.request({
      id: id.value, number: await this.d.adjustments.nextNumber(), drugId: batch.state.drugId, batchId: batchId.value, direction: direction.value, quantity: quantity.value, reason: reason.value,
      note: note.value, requestedBy: actorId, requestedAt: this.d.clock.now(),
    });
    if (!adjustment.ok) return err(adjustment.error);
    await this.d.adjustments.insert(adjustment.value);
    await this.audit(actorId, 'pharmacy.adjustment.request', adjustment.value);
    return ok((await toViews(this.d, [adjustment.value]))[0]);
  }

  async get(rawId: string): Promise<Result<AdjustmentView>> {
    const id = AdjustmentId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const found = await this.d.adjustments.findById(id.value);
    return found ? ok((await toViews(this.d, [found]))[0]) : err(NOT_FOUND);
  }

  async list(input: { status?: string; drugId?: string; batchId?: string; mine?: string; offset: number; limit: number }): Promise<Result<{ items: AdjustmentView[]; total: number; offset: number; limit: number }>> {
    const status = input.status?.trim() ? ADJUSTMENT_STATUSES.find((s) => s === input.status!.trim().toUpperCase()) : undefined;
    if (input.status?.trim() && !status) return err(new DomainError('PHARMACY_ADJUSTMENT_STATUS_INVALID', `Statut d'ajustement invalide : « ${input.status} ».`, { value: input.status }));
    const drugId = input.drugId ? DrugId.create(input.drugId) : ok(undefined);
    if (!drugId.ok) return err(new DomainError('PHARMACY_DRUG_NOT_FOUND', 'Médicament introuvable.'));
    const batchId = input.batchId ? BatchId.create(input.batchId) : ok(undefined);
    if (!batchId.ok) return err(BATCH_NOT_FOUND);
    const { offset, limit } = pageOf(input.offset, input.limit);
    const page = await this.d.adjustments.list({ status: status as AdjustmentStatus | undefined, drugId: drugId.value, batchId: batchId.value, requestedBy: input.mine }, offset, limit);
    return ok({ items: await toViews(this.d, page.items), total: page.total, offset, limit });
  }

  /** Applique l'ajustement au lot, par un autre que le demandeur. Si le stock a changé entre-temps et ne suffit plus, la demande reste en attente. */
  async approve(actorId: string, rawId: string, comment?: string | null): Promise<Result<AdjustmentView>> {
    const id = AdjustmentId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const note = parseOptionalText(comment, 200, 'PHARMACY_NOTES_INVALID');
    if (!note.ok) return err(note.error);
    const at = this.d.clock.now();
    const today = this.d.calendar.today();
    const done = await this.d.adjustments.decide(id.value, actorId, at, (adjustment, batch) => adjustment.approve(actorId, at, batch, today, note.value));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await this.audit(actorId, 'pharmacy.adjustment.approve', done.value, { requestedBy: done.value.state.requestedBy });
    return ok((await toViews(this.d, [done.value]))[0]);
  }

  async reject(actorId: string, rawId: string, comment: string): Promise<Result<AdjustmentView>> {
    const id = AdjustmentId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const reason = Reason.create(comment);
    if (!reason.ok) return err(new DomainError('PHARMACY_ADJUSTMENT_COMMENT_REQUIRED', 'Le motif du refus est obligatoire (200 caractères au plus).'));
    const at = this.d.clock.now();
    const done = await this.d.adjustments.decide(id.value, actorId, at, (adjustment) => {
      const rejected = adjustment.reject(actorId, at, reason.value);
      return rejected.ok ? ok(null) : rejected;
    });
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await this.audit(actorId, 'pharmacy.adjustment.reject', done.value, { requestedBy: done.value.state.requestedBy });
    return ok((await toViews(this.d, [done.value]))[0]);
  }
}

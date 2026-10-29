import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { allocateFefo, stockLevel, StockLevel } from '../../domain/batch';
import { StockSummary } from '../../domain/ports';
import { BatchId, DrugId, Quantity, Reason } from '../../domain/values';
import { BatchView, DrugSummaryView, DrugView, PharmacyDependencies, StockRowView, UserSummary, pageOf, toBatchView, toDrugSummary, toDrugView, toStockRowView, userSummaries } from '../views';

const DRUG_NOT_FOUND = new DomainError('PHARMACY_DRUG_NOT_FOUND', 'Médicament introuvable.');
const BATCH_NOT_FOUND = new DomainError('PHARMACY_BATCH_NOT_FOUND', 'Lot introuvable.');
const LEVELS: readonly StockLevel[] = ['OK', 'LOW', 'OUT'];

export interface StockListInput {
  search?: string;
  level?: string;
  expiring?: boolean;
  hasExpired?: boolean;
  includeInactive: boolean;
  offset: number;
  limit: number;
}

export class ListStockUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(input: StockListInput): Promise<Result<{ items: StockRowView[]; total: number; offset: number; limit: number; expiryAlertDays: number }>> {
    const level = input.level?.trim() ? LEVELS.find((l) => l === input.level!.trim().toUpperCase()) : undefined;
    if (input.level?.trim() && !level) return err(new DomainError('PHARMACY_STOCK_LEVEL_INVALID', `Niveau de stock invalide : « ${input.level} ».`, { value: input.level }));
    const { offset, limit } = pageOf(input.offset, input.limit);
    const page = await this.d.stock.overview(
      { search: input.search?.trim() || undefined, level, expiring: input.expiring || undefined, hasExpired: input.hasExpired || undefined, includeInactive: input.includeInactive },
      this.d.calendar.today(), this.d.expiryAlertDays, offset, limit,
    );
    return ok({ items: page.items.map(toStockRowView), total: page.total, offset, limit, expiryAlertDays: this.d.expiryAlertDays });
  }
}

export interface StockSummaryView extends StockSummary {
  readonly expiryAlertDays: number;
}

export class StockSummaryUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(): Promise<StockSummaryView> {
    return { ...(await this.d.stock.summary(this.d.calendar.today(), this.d.expiryAlertDays)), expiryAlertDays: this.d.expiryAlertDays };
  }
}

export interface DrugStockView {
  readonly drug: DrugView;
  readonly dispensable: number;
  readonly quarantined: number;
  readonly expired: number;
  readonly expiringSoon: number;
  readonly nextExpiry: string | null;
  readonly level: StockLevel;
  readonly value: number;
  readonly expiryAlertDays: number;
  /** Lots en stock, ceux qui périment le plus tôt d'abord. */
  readonly batches: BatchView[];
}

export class GetDrugStockUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(rawId: string): Promise<Result<DrugStockView>> {
    const id = DrugId.create(rawId);
    if (!id.ok) return err(DRUG_NOT_FOUND);
    const drug = await this.d.drugs.findById(id.value);
    if (!drug) return err(DRUG_NOT_FOUND);
    const today = this.d.calendar.today();
    const batches = await this.d.stock.batchesOf(id.value, false);
    const who = await userSummaries(this.d, batches.map((b) => b.state.quarantinedBy));
    const views = batches.map((b) => toBatchView(b, today, this.d.expiryAlertDays, who));
    const sum = (pick: (v: BatchView) => boolean) => views.filter(pick).reduce((n, v) => n + v.quantity, 0);
    const dispensable = sum((v) => v.dispensable);
    const usable = views.filter((v) => v.dispensable);
    return ok({
      drug: toDrugView(drug), dispensable, quarantined: sum((v) => v.status === 'QUARANTINED'), expired: sum((v) => v.status === 'AVAILABLE' && v.expired), expiringSoon: sum((v) => v.dispensable && v.expiringSoon),
      nextExpiry: usable[0]?.expiry ?? null, level: stockLevel(dispensable, drug.state.reorderLevel), value: views.reduce((n, v) => n + v.quantity * v.unitCost, 0),
      expiryAlertDays: this.d.expiryAlertDays, batches: views,
    });
  }
}

export interface FefoView {
  readonly drug: DrugSummaryView;
  readonly requested: number;
  readonly allocations: { batchId: string; batchNumber: string; expiry: string; quantity: number }[];
  /** Ce qui manque ; 0 si le stock délivrable suffit. */
  readonly shortfall: number;
}

export class SuggestBatchesUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  /** Lots à prélever pour une quantité, « premier périmé, premier sorti » : sert de suggestion à la dispensation. */
  async execute(rawId: string, rawQuantity: number): Promise<Result<FefoView>> {
    const id = DrugId.create(rawId);
    if (!id.ok) return err(DRUG_NOT_FOUND);
    const quantity = Quantity.create(rawQuantity);
    if (!quantity.ok) return err(quantity.error);
    const drug = await this.d.drugs.findById(id.value);
    if (!drug) return err(DRUG_NOT_FOUND);
    const plan = allocateFefo(await this.d.stock.batchesOf(id.value, false), quantity.value.value, this.d.calendar.today());
    return ok({
      drug: toDrugSummary(drug), requested: quantity.value.value, shortfall: plan.shortfall,
      allocations: plan.allocations.map((a) => ({ batchId: a.batchId, batchNumber: a.batchNumber, expiry: a.expiry.toString(), quantity: a.quantity })),
    });
  }
}

export interface ExpiryRowView extends BatchView {
  readonly drug: DrugSummaryView;
}

export class ListExpiryUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  /** Lots en stock qui périment dans `days` jours au plus (par défaut la fenêtre d'alerte), périmés compris ; `quarantinedOnly` : lots mis de côté. */
  async execute(input: { days?: number; quarantinedOnly?: boolean; offset: number; limit: number }): Promise<Result<{ items: ExpiryRowView[]; total: number; offset: number; limit: number; expiryAlertDays: number }>> {
    const days = input.days ?? this.d.expiryAlertDays;
    if (!Number.isInteger(days) || days < 0 || days > 3650) return err(new DomainError('PHARMACY_DAYS_INVALID', 'Le nombre de jours doit être un entier de 0 à 3 650.'));
    const { offset, limit } = pageOf(input.offset, input.limit);
    const today = this.d.calendar.today();
    const page = await this.d.stock.listBatches({ expiresBy: input.quarantinedOnly ? undefined : today.add({ days }), quarantinedOnly: input.quarantinedOnly || undefined }, offset, limit);
    const who = await userSummaries(this.d, page.items.map((i) => i.batch.state.quarantinedBy));
    return ok({
      total: page.total, offset, limit, expiryAlertDays: this.d.expiryAlertDays,
      items: page.items.map((i) => ({ ...toBatchView(i.batch, today, this.d.expiryAlertDays, who), drug: { id: i.drug.id, code: i.drug.code, name: i.drug.name, genericName: i.drug.genericName, strength: i.drug.strength, unit: i.drug.unit } })),
    });
  }
}

export interface MovementView {
  readonly id: string;
  readonly drugId: string;
  readonly batchId: string;
  readonly batchNumber: string;
  readonly type: string;
  readonly delta: number;
  readonly balance: number;
  readonly reason: string | null;
  readonly reference: string | null;
  readonly by: UserSummary | null;
  readonly at: string;
}

export class ListMovementsUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(input: { drugId?: string; batchId?: string; offset: number; limit: number }): Promise<Result<{ items: MovementView[]; total: number; offset: number; limit: number }>> {
    const drugId = input.drugId ? DrugId.create(input.drugId) : ok(undefined);
    if (!drugId.ok) return err(DRUG_NOT_FOUND);
    const batchId = input.batchId ? BatchId.create(input.batchId) : ok(undefined);
    if (!batchId.ok) return err(BATCH_NOT_FOUND);
    const { offset, limit } = pageOf(input.offset, input.limit);
    const page = await this.d.stock.movements({ drugId: drugId.value, batchId: batchId.value }, offset, limit);
    const who = await userSummaries(this.d, page.items.map((m) => m.by));
    return ok({
      total: page.total, offset, limit,
      items: page.items.map((m) => ({ id: m.id, drugId: m.drugId, batchId: m.batchId, batchNumber: m.batchNumber, type: m.type, delta: m.delta, balance: m.balance, reason: m.reason, reference: m.reference, by: who(m.by), at: m.at.toString() })),
    });
  }
}

export class BatchActionUseCases {
  constructor(private readonly d: PharmacyDependencies) {}

  private async audit(actorId: string, action: string, batchId: string, extra: Record<string, string | number | boolean | null>): Promise<void> {
    await this.d.audit.record({ action, outcome: 'SUCCESS', actorId, resourceType: 'pharmacy-batch', resourceId: batchId, metadata: extra, occurredAt: this.d.clock.now() });
  }

  private async view(batchId: BatchId): Promise<BatchView> {
    const batch = (await this.d.stock.findBatch(batchId))!;
    return toBatchView(batch, this.d.calendar.today(), this.d.expiryAlertDays, await userSummaries(this.d, [batch.state.quarantinedBy]));
  }

  /** Met un lot de côté (rappel, doute sur la conservation) : plus délivrable, mais son stock reste visible. Le motif est obligatoire. */
  async quarantine(actorId: string, rawId: string, rawReason: string): Promise<Result<BatchView>> {
    const id = BatchId.create(rawId);
    if (!id.ok) return err(BATCH_NOT_FOUND);
    const reason = Reason.create(rawReason);
    if (!reason.ok) return err(reason.error);
    const done = await this.d.stock.mutateBatch(id.value, (b) => b.quarantine(reason.value, actorId, this.d.clock.now()));
    if (!done) return err(BATCH_NOT_FOUND);
    if (!done.ok) return err(done.error);
    await this.audit(actorId, 'pharmacy.batch.quarantine', id.value.value, { batch: done.value.state.batchNumber.value, drugId: done.value.state.drugId.value, reason: reason.value.value });
    return ok(await this.view(id.value));
  }

  async release(actorId: string, rawId: string): Promise<Result<BatchView>> {
    const id = BatchId.create(rawId);
    if (!id.ok) return err(BATCH_NOT_FOUND);
    const done = await this.d.stock.mutateBatch(id.value, (b) => b.release());
    if (!done) return err(BATCH_NOT_FOUND);
    if (!done.ok) return err(done.error);
    await this.audit(actorId, 'pharmacy.batch.release', id.value.value, { batch: done.value.state.batchNumber.value, drugId: done.value.state.drugId.value });
    return ok(await this.view(id.value));
  }
}

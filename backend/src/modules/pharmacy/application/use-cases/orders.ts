import { IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../../shared-kernel/temporal';
import { ORDER_STATUSES, OrderLineInput, OrderStatus, PurchaseOrder } from '../../domain/purchase-order';
import { StockLevel } from '../../domain/batch';
import { Drug } from '../../domain/drug';
import { DrugId, Money, PurchaseOrderId, Reason, SupplierId } from '../../domain/values';
import { DrugSummaryView, PharmacyDependencies, UserSummary, pageOf, toDrugSummary, userSummaries } from '../views';

const NOT_FOUND = new DomainError('PHARMACY_ORDER_NOT_FOUND', 'Bon de commande introuvable.');
const SUPPLIER_NOT_FOUND = new DomainError('PHARMACY_SUPPLIER_NOT_FOUND', 'Fournisseur introuvable.');
const DRUG_NOT_FOUND = new DomainError('PHARMACY_DRUG_NOT_FOUND', 'Médicament introuvable.');

export interface OrderLineView {
  readonly drug: DrugSummaryView | null;
  readonly quantity: number;
  readonly unitCost: number;
  readonly received: number;
  readonly outstanding: number;
  readonly value: number;
}

export interface OrderView {
  readonly id: string;
  readonly number: string;
  readonly supplier: { readonly id: string; readonly code: string; readonly name: string } | null;
  readonly status: OrderStatus;
  readonly expectedOn: string | null;
  readonly notes: string | null;
  readonly createdBy: UserSummary | null;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly approvedBy: UserSummary | null;
  readonly approvedAt: string | null;
  readonly rejectionReason: string | null;
  readonly closedBy: UserSummary | null;
  readonly closedAt: string | null;
  readonly closedReason: string | null;
  readonly units: number;
  readonly receivedUnits: number;
  readonly value: number;
  readonly currency: string;
  readonly lines: OrderLineView[];
}

async function toView(d: PharmacyDependencies, order: PurchaseOrder): Promise<OrderView> {
  const s = order.state;
  const supplier = (await d.suppliers.findByIds([s.supplierId]))[0];
  const drugs = new Map((await d.drugs.findByIds(s.lines.map((l) => l.drugId))).map((x) => [x.id.value, x]));
  const who = await userSummaries(d, [s.createdBy, s.approvedBy, s.closedBy]);
  const lines = s.lines.map((l): OrderLineView => ({
    drug: drugs.get(l.drugId.value) ? toDrugSummary(drugs.get(l.drugId.value)!) : null, quantity: l.quantity, unitCost: l.unitCost.value, received: l.received, outstanding: l.quantity - l.received, value: l.quantity * l.unitCost.value,
  }));
  return {
    id: s.id.value, number: s.number.value, supplier: supplier ? { id: supplier.id.value, code: supplier.state.code.value, name: supplier.state.name } : null, status: s.status, expectedOn: s.expectedOn?.toString() ?? null, notes: s.notes,
    createdBy: who(s.createdBy), createdAt: s.createdAt.toString(), submittedAt: s.submittedAt?.toString() ?? null, approvedBy: who(s.approvedBy), approvedAt: s.approvedAt?.toString() ?? null,
    rejectionReason: s.rejectionReason, closedBy: who(s.closedBy), closedAt: s.closedAt?.toString() ?? null, closedReason: s.closedReason, units: lines.reduce((n, l) => n + l.quantity, 0),
    receivedUnits: lines.reduce((n, l) => n + l.received, 0), value: order.value, currency: d.currency, lines,
  };
}

async function loadOrder(d: PharmacyDependencies, rawId: string): Promise<Result<PurchaseOrder>> {
  const id = PurchaseOrderId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.orders.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

function record(d: PharmacyDependencies, actorId: string, action: string, order: PurchaseOrder, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  return d.audit.record({
    action, outcome: 'SUCCESS', actorId, resourceType: 'pharmacy-order', resourceId: order.id.value,
    metadata: { number: order.state.number.value, supplierId: order.state.supplierId.value, ...extra }, occurredAt: d.clock.now(),
  });
}

export interface OrderLineInputDto {
  drugId: string;
  quantity: number;
  unitCost?: number;
}

export interface OrderInput {
  supplierId: string;
  expectedOn?: string | null;
  notes?: string | null;
  lines: readonly OrderLineInputDto[];
}

/** Contenu d'un bon à partir de la saisie : fournisseur actif, médicaments actifs, coût d'achat par défaut = celui du dernier lot reçu. */
async function parseContent(d: PharmacyDependencies, input: OrderInput, today: PlainDate): Promise<Result<{ supplierId: SupplierId; lines: OrderLineInput[]; expectedOn: PlainDate | null; notes: string | null }>> {
  const supplierId = SupplierId.create(input.supplierId);
  if (!supplierId.ok) return err(SUPPLIER_NOT_FOUND);
  const supplier = await d.suppliers.findById(supplierId.value);
  if (!supplier) return err(SUPPLIER_NOT_FOUND);
  if (!supplier.active) return err(new DomainError('PHARMACY_SUPPLIER_INACTIVE', `Le fournisseur ${supplier.state.code.value} est écarté : on ne lui passe plus de commande.`, { code: supplier.state.code.value }));
  let expectedOn: PlainDate | null = null;
  if (input.expectedOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expectedOn.trim())) return err(new DomainError('PHARMACY_ORDER_DATE_INVALID', 'La date de livraison attendue doit être au format AAAA-MM-JJ.'));
    try {
      expectedOn = Temporal.PlainDate.from(input.expectedOn.trim(), { overflow: 'reject' });
    } catch {
      return err(new DomainError('PHARMACY_ORDER_DATE_INVALID', 'La date de livraison attendue doit être au format AAAA-MM-JJ.'));
    }
    if (Temporal.PlainDate.compare(expectedOn, today) < 0) return err(new DomainError('PHARMACY_ORDER_DATE_PAST', 'La date de livraison attendue ne peut pas être passée.'));
  }
  const ids: DrugId[] = [];
  for (const l of input.lines ?? []) {
    const id = DrugId.create(l.drugId);
    if (!id.ok) return err(DRUG_NOT_FOUND);
    ids.push(id.value);
  }
  const drugs = new Map<string, Drug>((await d.drugs.findByIds(ids)).map((x) => [x.id.value, x]));
  const costs = await d.stock.lastUnitCosts(ids);
  const lines: OrderLineInput[] = [];
  for (const [i, l] of (input.lines ?? []).entries()) {
    const drug = drugs.get(ids[i].value);
    if (!drug) return err(DRUG_NOT_FOUND);
    if (!drug.active) return err(new DomainError('PHARMACY_DRUG_INACTIVE', `Le médicament ${drug.state.code.value} est retiré du formulaire : il ne peut plus être commandé.`, { code: drug.state.code.value }));
    const cost = Money.create(l.unitCost ?? costs.get(ids[i].value) ?? 0);
    if (!cost.ok) return err(cost.error);
    lines.push({ drugId: ids[i], quantity: l.quantity, unitCost: cost.value });
  }
  return ok({ supplierId: supplierId.value, lines, expectedOn, notes: input.notes ?? null });
}

export class OrderUseCases {
  constructor(private readonly d: PharmacyDependencies, private readonly ids: IdGenerator) {}

  /** Établit un bon en brouillon : rien n'est commandé tant qu'il n'est pas soumis puis approuvé par un autre. */
  async create(actorId: string, input: OrderInput): Promise<Result<OrderView>> {
    const content = await parseContent(this.d, input, this.d.calendar.today());
    if (!content.ok) return err(content.error);
    const id = PurchaseOrderId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const order = PurchaseOrder.create({ id: id.value, number: await this.d.orders.nextNumber(), createdBy: actorId, createdAt: this.d.clock.now(), content: content.value });
    if (!order.ok) return err(order.error);
    await this.d.orders.insert(order.value);
    await record(this.d, actorId, 'pharmacy.order.create', order.value, { lines: order.value.state.lines.length, value: order.value.value });
    return ok(await toView(this.d, order.value));
  }

  /** Remplace le contenu d'un brouillon (celui d'un bon refusé aussi). */
  async update(actorId: string, rawId: string, input: OrderInput): Promise<Result<OrderView>> {
    const id = PurchaseOrderId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const content = await parseContent(this.d, input, this.d.calendar.today());
    if (!content.ok) return err(content.error);
    const done = await this.d.orders.mutate(id.value, (o) => o.edit(content.value));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'pharmacy.order.update', done.value, { lines: done.value.state.lines.length, value: done.value.value });
    return ok(await toView(this.d, done.value));
  }

  async submit(actorId: string, rawId: string): Promise<Result<OrderView>> {
    return this.act(rawId, actorId, 'pharmacy.order.submit', (o) => o.submit(this.d.clock.now()));
  }

  /** Approuve un bon : jamais par son auteur. Le bon est alors prêt à recevoir ses livraisons. */
  async approve(actorId: string, rawId: string): Promise<Result<OrderView>> {
    return this.act(rawId, actorId, 'pharmacy.order.approve', (o) => o.approve(actorId, this.d.clock.now()), (o) => ({ createdBy: o.state.createdBy, value: o.value }));
  }

  async reject(actorId: string, rawId: string, comment: string): Promise<Result<OrderView>> {
    const reason = Reason.create(comment);
    if (!reason.ok) return err(new DomainError('PHARMACY_ORDER_REASON_REQUIRED', 'Le motif du refus est obligatoire (200 caractères au plus).'));
    return this.act(rawId, actorId, 'pharmacy.order.reject', (o) => o.reject(actorId, reason.value), (o) => ({ createdBy: o.state.createdBy }));
  }

  async cancel(actorId: string, rawId: string, comment: string): Promise<Result<OrderView>> {
    const reason = Reason.create(comment);
    if (!reason.ok) return err(new DomainError('PHARMACY_ORDER_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).'));
    return this.act(rawId, actorId, 'pharmacy.order.cancel', (o) => o.cancel(actorId, this.d.clock.now(), reason.value), (o) => ({ reason: o.state.closedReason }));
  }

  /** Clôt un bon partiellement reçu dont le solde ne viendra pas ; ce qui est arrivé reste en stock. */
  async close(actorId: string, rawId: string, comment: string): Promise<Result<OrderView>> {
    const reason = Reason.create(comment);
    if (!reason.ok) return err(new DomainError('PHARMACY_ORDER_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).'));
    return this.act(rawId, actorId, 'pharmacy.order.close', (o) => o.close(actorId, this.d.clock.now(), reason.value), (o) => ({ reason: o.state.closedReason }));
  }

  private async act(
    rawId: string, actorId: string, action: string, apply: (order: PurchaseOrder) => Result<void>, extra?: (order: PurchaseOrder) => Record<string, string | number | boolean | null>,
  ): Promise<Result<OrderView>> {
    const id = PurchaseOrderId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const done = await this.d.orders.mutate(id.value, apply);
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, action, done.value, extra?.(done.value));
    return ok(await toView(this.d, done.value));
  }

  async get(rawId: string): Promise<Result<OrderView>> {
    const loaded = await loadOrder(this.d, rawId);
    return loaded.ok ? ok(await toView(this.d, loaded.value)) : err(loaded.error);
  }
}

export interface OrderSummaryView {
  readonly id: string;
  readonly number: string;
  readonly supplier: { readonly id: string; readonly name: string };
  readonly status: OrderStatus;
  readonly createdBy: UserSummary | null;
  readonly createdAt: string;
  readonly expectedOn: string | null;
  readonly lines: number;
  readonly units: number;
  readonly receivedUnits: number;
  readonly value: number;
}

export class ListOrdersUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(input: { status?: string; supplierId?: string; drugId?: string; mine?: string; offset: number; limit: number }): Promise<Result<{ items: OrderSummaryView[]; total: number; offset: number; limit: number; currency: string }>> {
    const status = input.status?.trim() ? ORDER_STATUSES.find((s) => s === input.status!.trim().toUpperCase()) : undefined;
    if (input.status?.trim() && !status) return err(new DomainError('PHARMACY_ORDER_STATUS_INVALID', `Statut de bon de commande invalide : « ${input.status} ».`, { value: input.status }));
    const supplierId = input.supplierId ? SupplierId.create(input.supplierId) : ok(undefined);
    if (!supplierId.ok) return err(SUPPLIER_NOT_FOUND);
    const drugId = input.drugId ? DrugId.create(input.drugId) : ok(undefined);
    if (!drugId.ok) return err(DRUG_NOT_FOUND);
    const { offset, limit } = pageOf(input.offset, input.limit);
    const page = await this.d.orders.list({ status, supplierId: supplierId.value, drugId: drugId.value, createdBy: input.mine }, offset, limit);
    const who = await userSummaries(this.d, page.items.map((o) => o.createdBy));
    return ok({
      total: page.total, offset, limit, currency: this.d.currency,
      items: page.items.map((o) => ({
        id: o.id, number: o.number, supplier: { id: o.supplierId, name: o.supplierName }, status: o.status, createdBy: who(o.createdBy), createdAt: o.createdAt.toString(), expectedOn: o.expectedOn?.toString() ?? null,
        lines: o.lines, units: o.units, receivedUnits: o.received, value: o.value,
      })),
    });
  }
}

export interface SuggestionView {
  readonly drug: DrugSummaryView;
  readonly level: StockLevel;
  readonly dispensable: number;
  readonly reorderLevel: number;
  /** Déjà commandé et pas encore reçu (bons approuvés). */
  readonly onOrder: number;
  /** Quantité proposée pour revenir à deux fois le seuil de réapprovisionnement. */
  readonly suggested: number;
  /** Coût d'achat du dernier lot reçu. */
  readonly lastUnitCost: number | null;
}

export class SuggestOrdersUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  /**
   * Médicaments à recommander : ceux dont le stock délivrable, augmenté de ce qui est déjà commandé, n'excède pas le seuil de réapprovisionnement
   * (les médicaments sans seuil ne sont jamais proposés). Quantité proposée : de quoi revenir à deux fois le seuil.
   */
  async execute(): Promise<{ items: SuggestionView[]; currency: string }> {
    const today = this.d.calendar.today();
    const rows = [
      ...(await this.d.stock.overview({ level: 'OUT', includeInactive: false }, today, this.d.expiryAlertDays, 0, 200)).items,
      ...(await this.d.stock.overview({ level: 'LOW', includeInactive: false }, today, this.d.expiryAlertDays, 0, 200)).items,
    ].filter((r) => r.reorderLevel > 0);
    const onOrder = await this.d.orders.onOrder();
    const ids = rows.map((r) => DrugId.create(r.drugId)).filter((r) => r.ok).map((r) => (r as { value: DrugId }).value);
    const costs = await this.d.stock.lastUnitCosts(ids);
    const items: SuggestionView[] = [];
    for (const r of rows) {
      const pending = onOrder.get(r.drugId) ?? 0;
      const covered = r.dispensable + pending;
      if (covered > r.reorderLevel) continue;
      items.push({
        drug: { id: r.drugId, code: r.code, name: r.name, genericName: r.genericName, strength: r.strength, unit: r.unit }, level: r.level, dispensable: r.dispensable, reorderLevel: r.reorderLevel,
        onOrder: pending, suggested: Math.max(1, 2 * r.reorderLevel - covered), lastUnitCost: costs.get(r.drugId) ?? null,
      });
    }
    return { items, currency: this.d.currency };
  }
}

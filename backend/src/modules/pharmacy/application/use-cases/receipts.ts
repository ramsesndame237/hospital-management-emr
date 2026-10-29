import { IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Drug } from '../../domain/drug';
import { GoodsReceipt, ReceiptLine } from '../../domain/receipt';
import { BatchId, BatchNumber, DrugId, Money, parseExpiry, Quantity, ReceiptId } from '../../domain/values';
import { DrugSummaryView, PharmacyDependencies, UserSummary, pageOf, toDrugSummary, userSummaries } from '../views';

const NOT_FOUND = new DomainError('PHARMACY_RECEIPT_NOT_FOUND', 'Réception introuvable.');

export interface ReceiptLineView {
  readonly drug: DrugSummaryView | null;
  readonly batchId: string;
  readonly batchNumber: string;
  readonly expiry: string;
  readonly quantity: number;
  readonly unitCost: number;
  readonly value: number;
}

export interface ReceiptView {
  readonly id: string;
  readonly number: string;
  readonly supplier: string;
  readonly deliveryNote: string | null;
  readonly notes: string | null;
  readonly receivedBy: UserSummary | null;
  readonly receivedAt: string;
  readonly units: number;
  readonly value: number;
  readonly currency: string;
  readonly lines: ReceiptLineView[];
}

async function toView(d: PharmacyDependencies, receipt: GoodsReceipt, known?: Map<string, Drug>): Promise<ReceiptView> {
  const s = receipt.state;
  const drugs = known ?? new Map((await d.drugs.findByIds(s.lines.map((l) => l.drugId))).map((x) => [x.id.value, x]));
  const who = await userSummaries(d, [s.receivedBy]);
  const lines = s.lines.map((l): ReceiptLineView => ({
    drug: drugs.get(l.drugId.value) ? toDrugSummary(drugs.get(l.drugId.value)!) : null, batchId: l.batchId.value, batchNumber: l.batchNumber.value, expiry: l.expiry.toString(),
    quantity: l.quantity, unitCost: l.unitCost.value, value: l.quantity * l.unitCost.value,
  }));
  return {
    id: s.id.value, number: s.number.value, supplier: s.supplier, deliveryNote: s.deliveryNote, notes: s.notes, receivedBy: who(s.receivedBy), receivedAt: s.receivedAt.toString(),
    units: lines.reduce((n, l) => n + l.quantity, 0), value: lines.reduce((n, l) => n + l.value, 0), currency: d.currency, lines,
  };
}

export interface ReceiptLineInput {
  drugId: string;
  batchNumber: string;
  expiry: string;
  quantity: number;
  unitCost?: number;
}

export interface PostReceiptInput {
  supplier: string;
  deliveryNote?: string | null;
  notes?: string | null;
  lines: readonly ReceiptLineInput[];
}

export class PostReceiptUseCase {
  constructor(private readonly d: PharmacyDependencies, private readonly ids: IdGenerator) {}

  /** Enregistre une livraison et met à jour les lots, tout ou rien. Un médicament inconnu ou retiré du formulaire, un lot périmé, une péremption qui contredit un lot existant font tout refuser. */
  async execute(actorId: string, input: PostReceiptInput): Promise<Result<ReceiptView>> {
    const lines: ReceiptLine[] = [];
    for (const raw of input.lines ?? []) {
      const drugId = DrugId.create(raw.drugId);
      if (!drugId.ok) return err(new DomainError('PHARMACY_DRUG_NOT_FOUND', 'Médicament introuvable.'));
      const batchNumber = BatchNumber.create(raw.batchNumber);
      if (!batchNumber.ok) return err(batchNumber.error);
      const expiry = parseExpiry(raw.expiry);
      if (!expiry.ok) return err(expiry.error);
      const quantity = Quantity.create(raw.quantity);
      if (!quantity.ok) return err(quantity.error);
      const cost = Money.create(raw.unitCost ?? 0);
      if (!cost.ok) return err(cost.error);
      const batchId = BatchId.create(this.ids.next());
      if (!batchId.ok) return err(batchId.error);
      lines.push({ drugId: drugId.value, batchId: batchId.value, batchNumber: batchNumber.value, expiry: expiry.value, quantity: quantity.value.value, unitCost: cost.value });
    }
    const drugs = new Map((await this.d.drugs.findByIds(lines.map((l) => l.drugId))).map((x) => [x.id.value, x]));
    for (const line of lines) {
      const drug = drugs.get(line.drugId.value);
      if (!drug) return err(new DomainError('PHARMACY_DRUG_NOT_FOUND', 'Médicament introuvable.'));
      if (!drug.active) return err(new DomainError('PHARMACY_DRUG_INACTIVE', `Le médicament ${drug.state.code.value} est retiré du formulaire : il ne peut plus être reçu.`, { code: drug.state.code.value }));
    }
    const id = ReceiptId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const receipt = GoodsReceipt.create(
      { id: id.value, number: await this.d.stock.nextReceiptNumber(), supplier: input.supplier, deliveryNote: input.deliveryNote, notes: input.notes, receivedBy: actorId, receivedAt: this.d.clock.now(), lines },
      this.d.calendar.today(),
    );
    if (!receipt.ok) return err(receipt.error);
    const posted = await this.d.stock.postReceipt(receipt.value);
    if (!posted.ok) return err(posted.error);
    const view = await toView(this.d, posted.value, drugs);
    await this.d.audit.record({
      action: 'pharmacy.receipt.post', outcome: 'SUCCESS', actorId, resourceType: 'pharmacy-receipt', resourceId: view.id,
      metadata: { number: view.number, supplier: view.supplier, lines: view.lines.length, units: view.units, value: view.value }, occurredAt: this.d.clock.now(),
    });
    return ok(view);
  }
}

export class GetReceiptUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(rawId: string): Promise<Result<ReceiptView>> {
    const id = ReceiptId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const receipt = await this.d.stock.findReceipt(id.value);
    return receipt ? ok(await toView(this.d, receipt)) : err(NOT_FOUND);
  }
}

export interface ReceiptSummaryView {
  readonly id: string;
  readonly number: string;
  readonly supplier: string;
  readonly deliveryNote: string | null;
  readonly receivedBy: UserSummary | null;
  readonly receivedAt: string;
  readonly lines: number;
  readonly units: number;
  readonly value: number;
}

export class ListReceiptsUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(input: { supplier?: string; drugId?: string; offset: number; limit: number }): Promise<Result<{ items: ReceiptSummaryView[]; total: number; offset: number; limit: number; currency: string }>> {
    const drugId = input.drugId ? DrugId.create(input.drugId) : ok(undefined);
    if (!drugId.ok) return err(new DomainError('PHARMACY_DRUG_NOT_FOUND', 'Médicament introuvable.'));
    const { offset, limit } = pageOf(input.offset, input.limit);
    const page = await this.d.stock.listReceipts({ supplier: input.supplier?.trim() || undefined, drugId: drugId.value }, offset, limit);
    const who = await userSummaries(this.d, page.items.map((r) => r.receivedBy));
    return ok({
      total: page.total, offset, limit, currency: this.d.currency,
      items: page.items.map((r) => ({ id: r.id, number: r.number, supplier: r.supplier, deliveryNote: r.deliveryNote, receivedBy: who(r.receivedBy), receivedAt: r.receivedAt.toString(), lines: r.lines, units: r.units, value: r.value })),
    });
  }
}

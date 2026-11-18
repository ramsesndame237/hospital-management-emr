import { IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Invoice, InvoiceLine } from '../../domain/invoice';
import { BillableItem } from '../../domain/item';
import { BillableSource, CATEGORY_OF_SOURCE, SourceDirectory, SourceType } from '../../domain/ports';
import { InvoiceId, LineId, PatientRef, Quantity } from '../../domain/values';
import { InvoiceDependencies, InvoiceView, record, toView } from './invoices';

const SOURCE_NOT_FOUND = new DomainError('BILLING_SOURCE_NOT_FOUND', 'Demande, examen ou délivrance introuvable, ou impossible à facturer (demande annulée, examen pas encore réalisé).');
const ALREADY_BILLED = new DomainError('BILLING_SOURCE_ALREADY_BILLED', 'Cet élément est déjà facturé.');
const TYPE_INVALID = (raw: string) => new DomainError('BILLING_SOURCE_TYPE_INVALID', `Type d'élément à facturer invalide : « ${raw} ».`, { value: raw });
const PATIENT_NOT_FOUND = new DomainError('BILLING_PATIENT_NOT_FOUND', 'Patient introuvable.');

export const SOURCE_TYPES: readonly SourceType[] = ['LAB_REQUISITION', 'IMAGING_ORDER', 'DISPENSATION'];

export function parseSourceType(raw: string | undefined): Result<SourceType> {
  const text = String(raw ?? '').trim().toUpperCase();
  const found = SOURCE_TYPES.find((t) => t === text);
  return found ? ok(found) : err(TYPE_INVALID(text));
}

export interface BillableLineView {
  readonly code: string;
  readonly label: string;
  readonly quantity: number;
  /** Acte du catalogue qui tarifie cette ligne ; absent : aucun prix n'est configuré pour ce code. */
  readonly itemName: string | null;
  readonly unitPrice: number | null;
}

export interface BillableView {
  readonly type: SourceType;
  readonly id: string;
  readonly reference: string;
  readonly patient: { readonly id: string; readonly number: string; readonly lastName: string; readonly firstName: string } | null;
  readonly occurredAt: string;
  readonly lines: readonly BillableLineView[];
  /** Codes sans acte du catalogue : tant qu'ils ne sont pas tarifés (Catalogue → « Code source »), la facture ne peut pas être établie. */
  readonly unpriced: readonly string[];
  /** Total d'après les prix du catalogue ; `null` si au moins une ligne n'a pas de prix. */
  readonly total: number | null;
}

export interface SourceDependencies {
  readonly sources: SourceDirectory;
}

/** Les actes du catalogue qui tarifient chaque ligne d'une source (par code), dans la catégorie de ce type de source. */
async function priceLines(d: InvoiceDependencies, source: BillableSource): Promise<{ priced: Map<string, BillableItem>; unpriced: string[] }> {
  const category = CATEGORY_OF_SOURCE[source.type];
  const priced = new Map<string, BillableItem>();
  const unpriced: string[] = [];
  for (const line of source.lines) {
    if (priced.has(line.code) || unpriced.includes(line.code)) continue;
    const item = await d.items.findBySource(category, line.code);
    if (item) priced.set(line.code, item);
    else unpriced.push(line.code);
  }
  return { priced, unpriced };
}

/** « À facturer » : ce qui a été fait (analyses, examens réalisés, délivrances) et n'a pas encore de facture, avec le prix issu du catalogue. */
export class ListBillableUseCase {
  constructor(private readonly d: InvoiceDependencies, private readonly s: SourceDependencies) {}

  async execute(input: { type: string | undefined; offset: number; limit: number }): Promise<Result<{ items: BillableView[]; total: number; offset: number; limit: number; currency: string }>> {
    const type = parseSourceType(input.type);
    if (!type.ok) return err(type.error);
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(100, Math.max(1, Math.trunc(input.limit)));
    const page = await this.s.sources.pending(type.value, offset, limit);
    const patients = await this.d.patients.find([...new Set(page.items.map((i) => i.patientId))]);
    const items: BillableView[] = [];
    for (const source of page.items) {
      const { priced, unpriced } = await priceLines(this.d, source);
      const lines = source.lines.map((l): BillableLineView => {
        const item = priced.get(l.code);
        return { code: l.code, label: l.label, quantity: l.quantity, itemName: item?.state.name.value ?? null, unitPrice: item?.state.unitPrice.value ?? null };
      });
      const patient = patients.get(source.patientId);
      items.push({
        type: source.type, id: source.id, reference: source.reference, occurredAt: source.occurredAt,
        patient: patient ? { id: patient.id, number: patient.number, lastName: patient.lastName, firstName: patient.firstName } : null,
        lines, unpriced,
        total: unpriced.length === 0 ? lines.reduce((sum, l) => sum + (l.unitPrice ?? 0) * l.quantity, 0) : null,
      });
    }
    return ok({ items, total: page.total, offset, limit, currency: this.d.currency.value });
  }
}

/**
 * Établit la facture (brouillon) d'une demande d'analyses, d'un examen réalisé ou d'une délivrance : une ligne par code, au prix du catalogue,
 * quantités d'après ce qui a été fait. Un code sans prix configuré refuse la facture (rien n'est facturé en silence ni à zéro) ; une source ne
 * porte qu'une facture non annulée.
 */
export class BillFromSourceUseCase {
  constructor(private readonly d: InvoiceDependencies, private readonly s: SourceDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, input: { type: string | undefined; sourceId: string }): Promise<Result<InvoiceView>> {
    const type = parseSourceType(input.type);
    if (!type.ok) return err(type.error);
    const source = await this.s.sources.find(type.value, input.sourceId);
    if (!source) return err(SOURCE_NOT_FOUND);

    const { priced, unpriced } = await priceLines(this.d, source);
    if (unpriced.length > 0) {
      return err(new DomainError('BILLING_SOURCE_UNPRICED', `Aucun acte du catalogue ne tarifie : ${unpriced.join(', ')}. Renseignez leur « code source » dans le catalogue des actes.`, { codes: unpriced.join(',') }));
    }

    const patientRef = PatientRef.create(source.patientId);
    if (!patientRef.ok) return err(PATIENT_NOT_FOUND);
    const invoiceId = InvoiceId.create(this.ids.next());
    if (!invoiceId.ok) return err(invoiceId.error);
    const invoice = Invoice.draft({
      id: invoiceId.value, number: await this.d.invoices.nextInvoiceNumber(), patientId: patientRef.value, admissionId: null, currency: this.d.currency, note: source.reference, createdBy: actorId,
    });
    for (const wanted of source.lines) {
      const item = priced.get(wanted.code) as BillableItem;
      const quantity = Quantity.create(wanted.quantity);
      if (!quantity.ok) return err(quantity.error);
      const lineId = LineId.create(this.ids.next());
      if (!lineId.ok) return err(lineId.error);
      const s = item.state;
      const line: InvoiceLine = { id: lineId.value, itemId: s.id, itemCode: s.code, itemName: s.name, unitPrice: s.unitPrice, quantity: quantity.value };
      const added = invoice.addLine(line);
      if (!added.ok) return err(added.error);
    }

    if ((await this.d.invoices.insertFromSource(invoice, type.value, source.id)) === 'ALREADY_BILLED') return err(ALREADY_BILLED);
    await record(this.d, actorId, 'billing.invoice.create-from-source', invoice, { sourceType: type.value, sourceReference: source.reference, lines: invoice.state.lines.length });
    return ok(await toView(this.d, invoice));
  }
}

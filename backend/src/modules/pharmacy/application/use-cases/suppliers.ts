import { IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Supplier } from '../../domain/supplier';
import { SupplierCode, SupplierId } from '../../domain/values';
import { PharmacyDependencies, pageOf } from '../views';

const NOT_FOUND = new DomainError('PHARMACY_SUPPLIER_NOT_FOUND', 'Fournisseur introuvable.');
const CODE_TAKEN = new DomainError('PHARMACY_SUPPLIER_CODE_ALREADY_EXISTS', 'Un fournisseur utilise déjà ce code.');

export interface SupplierView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly paymentTermsDays: number;
  readonly notes: string | null;
  readonly active: boolean;
}

export function toSupplierView(supplier: Supplier): SupplierView {
  const s = supplier.state;
  return { id: s.id.value, code: s.code.value, name: s.name, contactName: s.contactName, phone: s.phone, email: s.email, address: s.address, paymentTermsDays: s.paymentTermsDays, notes: s.notes, active: s.active };
}

/** Texte facultatif : absent → `undefined` (inchangé), vide ou `null` → `null` (effacé), sinon rogné. */
const optional = (raw: string | null | undefined): string | null | undefined => (raw === undefined ? undefined : raw === null || raw.trim() === '' ? null : raw.trim().replace(/\s+/g, ' '));

async function loadSupplier(d: PharmacyDependencies, rawId: string): Promise<Result<Supplier>> {
  const id = SupplierId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.suppliers.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

function record(d: PharmacyDependencies, actorId: string, action: string, supplier: Supplier, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  return d.audit.record({ action, outcome: 'SUCCESS', actorId, resourceType: 'pharmacy-supplier', resourceId: supplier.id.value, metadata: { code: supplier.state.code.value, ...extra }, occurredAt: d.clock.now() });
}

export interface CreateSupplierInput {
  code: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  paymentTermsDays?: number;
  notes?: string | null;
}

export class CreateSupplierUseCase {
  constructor(private readonly d: PharmacyDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, input: CreateSupplierInput): Promise<Result<SupplierView>> {
    const code = SupplierCode.create(input.code);
    if (!code.ok) return err(code.error);
    const id = SupplierId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const supplier = Supplier.create({
      id: id.value, code: code.value, name: (input.name ?? '').trim().replace(/\s+/g, ' '), contactName: optional(input.contactName) ?? null, phone: optional(input.phone) ?? null, email: optional(input.email) ?? null,
      address: optional(input.address) ?? null, paymentTermsDays: input.paymentTermsDays ?? 30, notes: optional(input.notes) ?? null,
    });
    if (!supplier.ok) return err(supplier.error);
    if (!(await this.d.suppliers.insert(supplier.value))) return err(CODE_TAKEN);
    await record(this.d, actorId, 'pharmacy.supplier.create', supplier.value, { paymentTermsDays: supplier.value.state.paymentTermsDays });
    return ok(toSupplierView(supplier.value));
  }
}

export interface UpdateSupplierInput {
  name?: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  paymentTermsDays?: number;
  notes?: string | null;
}

export class ManageSupplierUseCases {
  constructor(private readonly d: PharmacyDependencies) {}

  /** Champs absents : inchangés ; `null` efface contact, téléphone, e-mail, adresse ou remarques. Le code ne change pas. */
  async update(actorId: string, id: string, input: UpdateSupplierInput): Promise<Result<SupplierView>> {
    const loaded = await loadSupplier(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const supplier = loaded.value;
    const before = supplier.state;
    const done = supplier.update({
      name: input.name === undefined ? undefined : input.name.trim().replace(/\s+/g, ' '), contactName: optional(input.contactName), phone: optional(input.phone), email: optional(input.email), address: optional(input.address),
      paymentTermsDays: input.paymentTermsDays, notes: optional(input.notes),
    });
    if (!done.ok) return err(done.error);
    const after = supplier.state;
    const changed = (Object.keys(before) as (keyof typeof before)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(String);
    if (changed.length === 0) return ok(toSupplierView(supplier));
    await this.d.suppliers.update(supplier);
    await record(this.d, actorId, 'pharmacy.supplier.update', supplier, { changed: changed.join(',') });
    return ok(toSupplierView(supplier));
  }

  async setActive(actorId: string, id: string, active: boolean): Promise<Result<SupplierView>> {
    const loaded = await loadSupplier(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const supplier = loaded.value;
    if (supplier.active === active) return ok(toSupplierView(supplier));
    supplier.setActive(active);
    await this.d.suppliers.update(supplier);
    await record(this.d, actorId, active ? 'pharmacy.supplier.activate' : 'pharmacy.supplier.deactivate', supplier);
    return ok(toSupplierView(supplier));
  }
}

export class GetSupplierUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(id: string): Promise<Result<SupplierView>> {
    const loaded = await loadSupplier(this.d, id);
    return loaded.ok ? ok(toSupplierView(loaded.value)) : err(loaded.error);
  }
}

export class ListSuppliersUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(input: { search?: string; includeInactive: boolean; offset: number; limit: number }): Promise<Result<{ items: SupplierView[]; total: number; offset: number; limit: number }>> {
    const { offset, limit } = pageOf(input.offset, input.limit);
    const page = await this.d.suppliers.list({ search: input.search?.trim() || undefined, includeInactive: input.includeInactive }, offset, limit);
    return ok({ items: page.items.map(toSupplierView), total: page.total, offset, limit });
  }
}

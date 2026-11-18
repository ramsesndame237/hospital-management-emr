import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { BillableItem } from '../../domain/item';
import { ItemRepository, ServiceDirectory } from '../../domain/ports';
import { Amount, Currency, ItemCategory, ItemCode, ItemId, ItemName, parseCategory, ServiceRef } from '../../domain/values';

const NOT_FOUND = new DomainError('BILLING_ITEM_NOT_FOUND', 'Acte introuvable.');
const SERVICE_NOT_FOUND = new DomainError('BILLING_SERVICE_NOT_FOUND', 'Service introuvable.');
const SERVICE_INACTIVE = new DomainError('BILLING_SERVICE_INACTIVE', 'Ce service est désactivé.');
const CODE_TAKEN = new DomainError('BILLING_ITEM_CODE_ALREADY_EXISTS', 'Un acte utilise déjà ce code.');
const SOURCE_CODE_INVALID = new DomainError('BILLING_ITEM_SOURCE_CODE_INVALID', "Le code source est invalide (lettres, chiffres, « _ », « - », « . », 30 caractères au plus).");
const SOURCE_CATEGORY = new DomainError('BILLING_ITEM_SOURCE_CATEGORY', "Seuls les actes de laboratoire, de radiologie et de pharmacie peuvent être mis en correspondance avec une analyse, un examen ou un médicament.");
const SOURCE_TAKEN = new DomainError('BILLING_ITEM_SOURCE_ALREADY_MAPPED', 'Un autre acte actif tarifie déjà ce code : deux prix pour la même analyse, le même examen ou le même médicament seraient ambigus.');
const SOURCE_CATEGORIES: readonly string[] = [ItemCategory.LABORATORY, ItemCategory.RADIOLOGY, ItemCategory.PHARMACY];

/** Code source normalisé en majuscules ; vide = aucun. */
function parseSourceCode(raw: string | null | undefined): Result<string | null> {
  const text = String(raw ?? '').trim().toUpperCase();
  if (text === '') return ok(null);
  return /^[A-Z0-9][A-Z0-9_.-]{0,29}$/.test(text) ? ok(text) : err(SOURCE_CODE_INVALID);
}

/** Cohérence d'une correspondance : catégorie compatible, et un seul acte actif par code. */
async function checkSource(d: CatalogDependencies, category: ItemCategory, sourceCode: string | null, ownId: string | null): Promise<Result<void>> {
  if (sourceCode === null) return ok(undefined);
  if (!SOURCE_CATEGORIES.includes(category)) return err(SOURCE_CATEGORY);
  const other = await d.items.findBySource(category, sourceCode);
  return other && other.id.value !== ownId ? err(SOURCE_TAKEN) : ok(undefined);
}

export interface ItemView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: string;
  /** Prix unitaire, entier dans la plus petite unité de la devise (le franc CFA n'a pas de centimes). */
  readonly unitPrice: number;
  readonly currency: string;
  readonly serviceId: string | null;
  /** Code de l'analyse, de l'examen d'imagerie ou du médicament que cet acte tarifie. */
  readonly sourceCode: string | null;
  readonly active: boolean;
}

export interface CatalogDependencies {
  readonly items: ItemRepository;
  readonly services: ServiceDirectory;
  readonly currency: Currency;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

export function toItemView(d: Pick<CatalogDependencies, 'currency'>, item: BillableItem): ItemView {
  const s = item.state;
  return { id: s.id.value, code: s.code.value, name: s.name.value, category: s.category, unitPrice: s.unitPrice.value, currency: d.currency.value, serviceId: s.serviceId?.value ?? null, sourceCode: s.sourceCode, active: s.active };
}

async function loadItem(d: CatalogDependencies, rawId: string): Promise<Result<BillableItem>> {
  const id = ItemId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.items.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

/** Le service doit exister et être actif : on ne rattache pas un acte à un service fermé. */
async function checkService(d: CatalogDependencies, raw: string): Promise<Result<ServiceRef>> {
  const ref = ServiceRef.create(raw);
  if (!ref.ok) return err(ref.error);
  const service = await d.services.find(ref.value);
  if (!service) return err(SERVICE_NOT_FOUND);
  return service.active ? ok(ref.value) : err(SERVICE_INACTIVE);
}

function record(d: CatalogDependencies, actorId: string, action: string, item: BillableItem, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  return d.audit.record({
    action, outcome: 'SUCCESS', actorId, resourceType: 'billing-item', resourceId: item.id.value,
    metadata: { code: item.state.code.value, ...extra }, occurredAt: d.clock.now(),
  });
}

export class CreateItemUseCase {
  constructor(private readonly d: CatalogDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, input: { code: string; name: string; category: string; unitPrice: number; serviceId?: string | null; sourceCode?: string | null }): Promise<Result<ItemView>> {
    const code = ItemCode.create(input.code);
    if (!code.ok) return err(code.error);
    const name = ItemName.create(input.name);
    if (!name.ok) return err(name.error);
    const category = parseCategory(input.category);
    if (!category.ok) return err(category.error);
    const price = Amount.create(input.unitPrice);
    if (!price.ok) return err(price.error);
    const sourceCode = parseSourceCode(input.sourceCode);
    if (!sourceCode.ok) return err(sourceCode.error);
    const source = await checkSource(this.d, category.value as ItemCategory, sourceCode.value, null);
    if (!source.ok) return err(source.error);
    let serviceId: ServiceRef | null = null;
    if (input.serviceId !== undefined && input.serviceId !== null) {
      const service = await checkService(this.d, input.serviceId);
      if (!service.ok) return err(service.error);
      serviceId = service.value;
    }
    const id = ItemId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const item = BillableItem.create({ id: id.value, code: code.value, name: name.value, category: category.value as ItemCategory, unitPrice: price.value, serviceId, sourceCode: sourceCode.value });
    if (!(await this.d.items.insert(item))) return err(CODE_TAKEN);
    await record(this.d, actorId, 'billing.item.create', item, { unitPrice: price.value.value, category: category.value });
    return ok(toItemView(this.d, item));
  }
}

export class ManageItemUseCases {
  constructor(private readonly d: CatalogDependencies) {}

  /** Champs absents : inchangés ; `serviceId: null` détache l'acte. Le changement de prix est inscrit au journal avec l'ancien prix. */
  async update(actorId: string, id: string, input: { name?: string; category?: string; unitPrice?: number; serviceId?: string | null; sourceCode?: string | null }): Promise<Result<ItemView>> {
    const loaded = await loadItem(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const item = loaded.value;
    const before = item.state;

    const name = input.name === undefined ? ok(undefined) : ItemName.create(input.name);
    if (!name.ok) return err(name.error);
    const category = input.category === undefined ? ok(undefined) : parseCategory(input.category);
    if (!category.ok) return err(category.error);
    const price = input.unitPrice === undefined ? ok(undefined) : Amount.create(input.unitPrice);
    if (!price.ok) return err(price.error);
    let serviceId: ServiceRef | null | undefined;
    if (input.serviceId === null) serviceId = null;
    else if (input.serviceId !== undefined) {
      const service = await checkService(this.d, input.serviceId);
      if (!service.ok) return err(service.error);
      serviceId = service.value;
    }

    let sourceCode: string | null | undefined;
    if (input.sourceCode !== undefined) {
      const parsed = parseSourceCode(input.sourceCode);
      if (!parsed.ok) return err(parsed.error);
      sourceCode = parsed.value;
    }
    // La correspondance finale (nouvelle ou conservée) doit rester cohérente avec la catégorie finale.
    const finalCategory = (category.value as ItemCategory | undefined) ?? before.category;
    const finalSource = sourceCode === undefined ? before.sourceCode : sourceCode;
    const consistent = await checkSource(this.d, finalCategory, finalSource, item.id.value);
    if (!consistent.ok) return err(consistent.error);

    item.update({ name: name.value, category: category.value as ItemCategory | undefined, unitPrice: price.value, serviceId, sourceCode });
    const after = item.state;
    const changed = [
      after.name.value !== before.name.value && 'name', after.category !== before.category && 'category', after.unitPrice.value !== before.unitPrice.value && 'price',
      (after.serviceId?.value ?? null) !== (before.serviceId?.value ?? null) && 'service', after.sourceCode !== before.sourceCode && 'source',
    ].filter(Boolean) as string[];
    if (changed.length === 0) return ok(toItemView(this.d, item));
    await this.d.items.update(item);
    await record(this.d, actorId, 'billing.item.update', item, {
      changed: changed.join(','), ...(changed.includes('price') ? { previousUnitPrice: before.unitPrice.value, unitPrice: after.unitPrice.value } : {}),
    });
    return ok(toItemView(this.d, item));
  }

  async setActive(actorId: string, id: string, active: boolean): Promise<Result<ItemView>> {
    const loaded = await loadItem(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const item = loaded.value;
    if (item.active === active) return ok(toItemView(this.d, item));
    // Réactiver un acte ne doit pas créer un doublon de correspondance.
    if (active) {
      const consistent = await checkSource(this.d, item.state.category, item.state.sourceCode, item.id.value);
      if (!consistent.ok) return err(consistent.error);
    }
    item.setActive(active);
    await this.d.items.update(item);
    await record(this.d, actorId, active ? 'billing.item.activate' : 'billing.item.deactivate', item);
    return ok(toItemView(this.d, item));
  }
}

export class GetItemUseCase {
  constructor(private readonly d: CatalogDependencies) {}

  async execute(id: string): Promise<Result<ItemView>> {
    const loaded = await loadItem(this.d, id);
    return loaded.ok ? ok(toItemView(this.d, loaded.value)) : err(loaded.error);
  }
}

export interface ItemListInput {
  search?: string;
  category?: string;
  serviceId?: string;
  includeInactive: boolean;
  offset: number;
  limit: number;
}

export class ListItemsUseCase {
  constructor(private readonly d: CatalogDependencies) {}

  async execute(input: ItemListInput): Promise<Result<{ items: ItemView[]; total: number; offset: number; limit: number }>> {
    const category = input.category?.trim() ? parseCategory(input.category) : ok(undefined);
    if (!category.ok) return err(category.error);
    const serviceId = input.serviceId?.trim() ? ServiceRef.create(input.serviceId) : ok(undefined);
    if (!serviceId.ok) return err(serviceId.error);
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.d.items.list(
      { search: input.search?.trim() || undefined, category: category.value as ItemCategory | undefined, serviceId: serviceId.value, includeInactive: input.includeInactive },
      offset, limit,
    );
    return ok({ items: page.items.map((i) => toItemView(this.d, i)), total: page.total, offset, limit });
  }
}

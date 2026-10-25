import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Catalog } from '../../domain/entities/catalog';
import { CatalogEntry } from '../../domain/entities/catalog-entry';
import { CatalogRepository, EntryRepository } from '../../domain/ports';
import { CatalogCode, EntryCode, EntryId, SortOrder } from '../../domain/value-objects/codes';
import { LocalizedLabels } from '../../domain/value-objects/localized-labels';

const CATALOG_NOT_FOUND = new DomainError('REFERENTIAL_CATALOG_NOT_FOUND', 'Catalogue introuvable.');
const ENTRY_NOT_FOUND = new DomainError('REFERENTIAL_ENTRY_NOT_FOUND', 'Entrée introuvable.');
const DUPLICATE_CODE = new DomainError('REFERENTIAL_ENTRY_CODE_ALREADY_EXISTS', 'Une entrée de ce catalogue utilise déjà ce code.');

export interface CatalogView {
  readonly code: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly entryCount: number;
  readonly activeEntryCount: number;
}

export interface EntryView {
  readonly id: string;
  readonly catalog: string;
  readonly code: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly sortOrder: number;
  readonly active: boolean;
}

export const toEntryView = (e: CatalogEntry): EntryView => ({
  id: e.id.value,
  catalog: e.catalogCode.value,
  code: e.code.value,
  labels: e.labels.toRecord(),
  sortOrder: e.sortOrder.value,
  active: e.active,
});

async function loadCatalog(catalogs: CatalogRepository, rawCode: string): Promise<Result<Catalog>> {
  const code = CatalogCode.create(rawCode);
  if (!code.ok) return err(CATALOG_NOT_FOUND); // un code mal formé ne désigne aucun catalogue
  const catalog = await catalogs.findByCode(code.value);
  return catalog ? ok(catalog) : err(CATALOG_NOT_FOUND);
}

async function loadEntry(catalogs: CatalogRepository, entries: EntryRepository, rawCatalog: string, rawId: string): Promise<Result<CatalogEntry>> {
  const catalog = await loadCatalog(catalogs, rawCatalog);
  if (!catalog.ok) return err(catalog.error);
  const id = EntryId.create(rawId);
  if (!id.ok) return err(ENTRY_NOT_FOUND);
  const entry = await entries.findById(id.value);
  // Une entrée n'est joignable que par son propre catalogue : pas de lecture ni de modification en passant par un autre.
  return entry && entry.catalogCode.equals(catalog.value.code) ? ok(entry) : err(ENTRY_NOT_FOUND);
}

export class ListCatalogsUseCase {
  constructor(private readonly catalogs: CatalogRepository) {}

  async execute(): Promise<CatalogView[]> {
    const [catalogs, counts] = await Promise.all([this.catalogs.findAll(), this.catalogs.countEntries()]);
    return catalogs.map((c) => ({
      code: c.code.value,
      labels: c.labels.toRecord(),
      entryCount: counts[c.code.value]?.total ?? 0,
      activeEntryCount: counts[c.code.value]?.active ?? 0,
    }));
  }
}

export class ListEntriesUseCase {
  constructor(private readonly catalogs: CatalogRepository, private readonly entries: EntryRepository) {}

  async execute(
    catalog: string,
    options: { includeInactive: boolean; search?: string; offset: number; limit: number },
  ): Promise<Result<{ items: EntryView[]; total: number; offset: number; limit: number }>> {
    const found = await loadCatalog(this.catalogs, catalog);
    if (!found.ok) return err(found.error);
    const offset = Math.max(0, Math.trunc(options.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(options.limit)));
    const search = options.search?.trim();
    const { items, total } = await this.entries.list(found.value.code, { activeOnly: !options.includeInactive, search: search || undefined }, offset, limit);
    return ok({ items: items.map(toEntryView), total, offset, limit });
  }
}

/** Gestion des entrées d'un catalogue. Chaque changement est journalisé ; rien n'est écrit si rien ne change. */
export class ManageEntriesUseCases {
  constructor(
    private readonly catalogs: CatalogRepository,
    private readonly entries: EntryRepository,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async create(actorId: string, catalog: string, input: { code: string; labels: Record<string, unknown>; sortOrder?: number }): Promise<Result<EntryView>> {
    const code = EntryCode.create(input.code);
    if (!code.ok) return err(code.error);
    const labels = LocalizedLabels.create(input.labels);
    if (!labels.ok) return err(labels.error);
    const sortOrder = SortOrder.create(input.sortOrder ?? 0);
    if (!sortOrder.ok) return err(sortOrder.error);
    const found = await loadCatalog(this.catalogs, catalog);
    if (!found.ok) return err(found.error);
    if (await this.entries.findByCode(found.value.code, code.value)) return err(DUPLICATE_CODE);

    const id = EntryId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const entry = CatalogEntry.create({ id: id.value, catalogCode: found.value.code, code: code.value, labels: labels.value, sortOrder: sortOrder.value });
    await this.entries.save(entry);
    await this.record(actorId, 'referentials.entry.create', entry, {});
    return ok(toEntryView(entry));
  }

  /** Libellés et/ou ordre d'affichage. Le code ne change jamais. */
  async update(actorId: string, catalog: string, id: string, input: { labels?: Record<string, unknown>; sortOrder?: number }): Promise<Result<EntryView>> {
    const labels = input.labels === undefined ? undefined : LocalizedLabels.create(input.labels);
    if (labels && !labels.ok) return err(labels.error);
    const sortOrder = input.sortOrder === undefined ? undefined : SortOrder.create(input.sortOrder);
    if (sortOrder && !sortOrder.ok) return err(sortOrder.error);
    const loaded = await loadEntry(this.catalogs, this.entries, catalog, id);
    if (!loaded.ok) return err(loaded.error);
    const entry = loaded.value;

    const changes: Record<string, string | number> = {};
    if (labels?.ok && !entry.labels.equals(labels.value)) {
      entry.relabel(labels.value);
      changes.labelsChanged = 'true';
    }
    if (sortOrder?.ok && !entry.sortOrder.equals(sortOrder.value)) {
      changes.previousSortOrder = entry.sortOrder.value;
      entry.reorder(sortOrder.value);
    }
    if (Object.keys(changes).length === 0) return ok(toEntryView(entry));

    await this.entries.save(entry);
    await this.record(actorId, 'referentials.entry.update', entry, changes);
    return ok(toEntryView(entry));
  }

  async setActive(actorId: string, catalog: string, id: string, active: boolean): Promise<Result<EntryView>> {
    const loaded = await loadEntry(this.catalogs, this.entries, catalog, id);
    if (!loaded.ok) return err(loaded.error);
    const entry = loaded.value;
    if (entry.active === active) return ok(toEntryView(entry));
    if (active) entry.activate();
    else entry.deactivate();
    await this.entries.save(entry);
    await this.record(actorId, active ? 'referentials.entry.activate' : 'referentials.entry.deactivate', entry, {});
    return ok(toEntryView(entry));
  }

  private record(actorId: string, action: string, entry: CatalogEntry, changes: Record<string, string | number>): Promise<void> {
    return this.audit.record({
      action,
      outcome: 'SUCCESS',
      actorId,
      resourceType: 'referential-entry',
      resourceId: entry.id.value,
      metadata: { catalog: entry.catalogCode.value, code: entry.code.value, active: entry.active, ...changes },
      occurredAt: this.clock.now(),
    });
  }
}

import { ListCatalogsUseCase, ListEntriesUseCase, ManageEntriesUseCases } from '../../src/modules/referentials/application/use-cases/referentials';
import { Catalog } from '../../src/modules/referentials/domain/entities/catalog';
import { CatalogEntry } from '../../src/modules/referentials/domain/entities/catalog-entry';
import { CatalogRepository, EntryFilter, EntryRepository } from '../../src/modules/referentials/domain/ports';
import { CatalogCode, EntryCode, EntryId, SortOrder } from '../../src/modules/referentials/domain/value-objects/codes';
import { LocalizedLabels } from '../../src/modules/referentials/domain/value-objects/localized-labels';
import { FixedClock, MemoryAudit, must, SeqIds } from '../iam/fakes';

class InMemoryCatalogs implements CatalogRepository {
  constructor(private readonly entries: InMemoryEntries) {}
  private readonly all = [new Catalog(must(CatalogCode.create('SPECIALTY')), must(LocalizedLabels.create({ fr: 'Spécialités' }))),
    new Catalog(must(CatalogCode.create('MEASUREMENT_UNIT')), must(LocalizedLabels.create({ fr: 'Unités' })))];
  async findByCode(code: CatalogCode) { return this.all.find((c) => c.code.equals(code)) ?? null; }
  async findAll() { return this.all; }
  async countEntries() {
    const out: Record<string, { total: number; active: number }> = {};
    for (const e of this.entries.byId.values()) {
      const c = (out[e.catalogCode.value] ??= { total: 0, active: 0 });
      c.total += 1;
      if (e.active) c.active += 1;
    }
    return out;
  }
}

class InMemoryEntries implements EntryRepository {
  readonly byId = new Map<string, CatalogEntry>();
  async findById(id: EntryId) { return this.byId.get(id.value) ?? null; }
  async findByCode(catalog: CatalogCode, code: EntryCode) {
    return [...this.byId.values()].find((e) => e.catalogCode.equals(catalog) && e.code.equals(code)) ?? null;
  }
  async save(e: CatalogEntry) { this.byId.set(e.id.value, e); }
  async list(catalog: CatalogCode, filter: EntryFilter, offset: number, limit: number) {
    const all = [...this.byId.values()]
      .filter((e) => e.catalogCode.equals(catalog) && (!filter.activeOnly || e.active))
      .filter((e) => !filter.search || (e.code.value + JSON.stringify(e.labels.toRecord())).toLowerCase().includes(filter.search.toLowerCase()))
      .sort((a, b) => a.sortOrder.value - b.sortOrder.value || a.code.value.localeCompare(b.code.value));
    return { items: all.slice(offset, offset + limit), total: all.length };
  }
}

function build() {
  const entries = new InMemoryEntries();
  const catalogs = new InMemoryCatalogs(entries);
  const audit = new MemoryAudit();
  return {
    audit,
    catalogs: new ListCatalogsUseCase(catalogs),
    list: new ListEntriesUseCase(catalogs, entries),
    manage: new ManageEntriesUseCases(catalogs, entries, new SeqIds(), audit, new FixedClock()),
  };
}

const ACTOR = 'admin-1';
const PEDIATRICS = { code: 'pediatrics', labels: { fr: 'Pédiatrie', en: 'Paediatrics' }, sortOrder: 30 };
const fail = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);

describe('référentiels : valeurs', () => {
  it('normalise les codes et refuse les formes invalides', () => {
    expect(must(EntryCode.create(' a01.1-x ')).value).toBe('A01.1-X');
    expect(must(CatalogCode.create('specialty')).value).toBe('SPECIALTY');
    for (const bad of ['', ' ', '-A', 'a b', 'é', 'A'.repeat(33)]) expect(fail(EntryCode.create(bad))).toBe('REFERENTIAL_ENTRY_CODE_INVALID');
    expect(fail(CatalogCode.create('1X'))).toBe('REFERENTIAL_CATALOG_CODE_INVALID');
    expect(fail(SortOrder.create(-1))).toBe('REFERENTIAL_SORT_ORDER_INVALID');
    expect(fail(SortOrder.create(1.5))).toBe('REFERENTIAL_SORT_ORDER_INVALID');
  });

  it('valide les libellés : objet non vide, langues sobres, textes bornés', () => {
    expect(must(LocalizedLabels.create({ fr: ' Pédiatrie ', 'pt-BR': 'Pediatria' })).toRecord()).toEqual({ fr: 'Pédiatrie', 'pt-BR': 'Pediatria' });
    for (const bad of [null, [], {}, { fr: '' }, { fr: '  ' }, { fr: 42 }, { FR: 'x' }, { french: 'x' }, { fr: 'x'.repeat(201) }]) {
      expect(fail(LocalizedLabels.create(bad as never))).toBe('REFERENTIAL_LABELS_INVALID');
    }
  });

  it('choisit le libellé dans la langue demandée, sinon la langue de repli, sinon le premier', () => {
    const labels = must(LocalizedLabels.create({ en: 'Paediatrics', fr: 'Pédiatrie' }));
    expect(labels.in('fr')).toBe('Pédiatrie');
    expect(labels.in('es', 'en')).toBe('Paediatrics');
    expect(labels.in('es')).toBe('Paediatrics'); // premier par ordre alphabétique des langues : « en »
    expect(labels.equals(must(LocalizedLabels.create({ fr: 'Pédiatrie', en: 'Paediatrics' })))).toBe(true);
  });
});

describe('référentiels : catalogues et entrées', () => {
  it('crée une entrée active (code en majuscules) avec audit', async () => {
    const w = build();
    const e = must(await w.manage.create(ACTOR, 'specialty', PEDIATRICS));
    expect(e).toMatchObject({ catalog: 'SPECIALTY', code: 'PEDIATRICS', sortOrder: 30, active: true, labels: { fr: 'Pédiatrie', en: 'Paediatrics' } });
    expect(w.audit.last('referentials.entry.create')).toMatchObject({ actorId: ACTOR, resourceType: 'referential-entry', resourceId: e.id });
  });

  it('refuse un catalogue inconnu (ou mal formé), un code déjà pris, et des données invalides', async () => {
    const w = build();
    must(await w.manage.create(ACTOR, 'SPECIALTY', PEDIATRICS));
    expect(fail(await w.manage.create(ACTOR, 'NOPE', PEDIATRICS))).toBe('REFERENTIAL_CATALOG_NOT_FOUND');
    expect(fail(await w.manage.create(ACTOR, '1!', PEDIATRICS))).toBe('REFERENTIAL_CATALOG_NOT_FOUND');
    expect(fail(await w.manage.create(ACTOR, 'SPECIALTY', { ...PEDIATRICS, code: 'Pediatrics' }))).toBe('REFERENTIAL_ENTRY_CODE_ALREADY_EXISTS');
    // même code dans un autre catalogue : permis
    must(await w.manage.create(ACTOR, 'MEASUREMENT_UNIT', PEDIATRICS));
    expect(fail(await w.manage.create(ACTOR, 'SPECIALTY', { code: 'X', labels: {} }))).toBe('REFERENTIAL_LABELS_INVALID');
    expect(fail(await w.manage.create(ACTOR, 'SPECIALTY', { code: 'Y', labels: { fr: 'Y' }, sortOrder: -3 }))).toBe('REFERENTIAL_SORT_ORDER_INVALID');
  });

  it('modifie libellés et ordre, journalise l\'ancien ordre, et ne fait rien si rien ne change', async () => {
    const w = build();
    const e = must(await w.manage.create(ACTOR, 'SPECIALTY', PEDIATRICS));
    const updated = must(await w.manage.update(ACTOR, 'SPECIALTY', e.id, { labels: { fr: 'Pédiatrie générale' }, sortOrder: 5 }));
    expect(updated).toMatchObject({ code: 'PEDIATRICS', sortOrder: 5, labels: { fr: 'Pédiatrie générale' } });
    expect(w.audit.last('referentials.entry.update')?.metadata).toMatchObject({ previousSortOrder: 30, labelsChanged: 'true', code: 'PEDIATRICS' });
    const before = w.audit.entries.length;
    must(await w.manage.update(ACTOR, 'SPECIALTY', e.id, { labels: { fr: 'Pédiatrie générale' }, sortOrder: 5 }));
    must(await w.manage.update(ACTOR, 'SPECIALTY', e.id, {}));
    expect(w.audit.entries).toHaveLength(before);
    expect(fail(await w.manage.update(ACTOR, 'SPECIALTY', e.id, { labels: { fr: '' } }))).toBe('REFERENTIAL_LABELS_INVALID');
  });

  it('ne joint une entrée que par son propre catalogue', async () => {
    const w = build();
    const e = must(await w.manage.create(ACTOR, 'SPECIALTY', PEDIATRICS));
    expect(fail(await w.manage.update(ACTOR, 'MEASUREMENT_UNIT', e.id, { sortOrder: 1 }))).toBe('REFERENTIAL_ENTRY_NOT_FOUND');
    expect(fail(await w.manage.setActive(ACTOR, 'MEASUREMENT_UNIT', e.id, false))).toBe('REFERENTIAL_ENTRY_NOT_FOUND');
    expect(fail(await w.manage.setActive(ACTOR, 'SPECIALTY', 'pas-un-uuid', false))).toBe('REFERENTIAL_ENTRY_NOT_FOUND');
    expect(fail(await w.manage.setActive(ACTOR, 'SPECIALTY', '00000000-0000-4000-8000-0000000000ff', false))).toBe('REFERENTIAL_ENTRY_NOT_FOUND');
  });

  it('désactive puis réactive (idempotent, journalisé une seule fois par changement réel)', async () => {
    const w = build();
    const e = must(await w.manage.create(ACTOR, 'SPECIALTY', PEDIATRICS));
    expect(must(await w.manage.setActive(ACTOR, 'SPECIALTY', e.id, false)).active).toBe(false);
    const before = w.audit.entries.length;
    must(await w.manage.setActive(ACTOR, 'SPECIALTY', e.id, false));
    expect(w.audit.entries).toHaveLength(before);
    expect(w.audit.last('referentials.entry.deactivate')?.metadata).toMatchObject({ active: false });
    expect(must(await w.manage.setActive(ACTOR, 'SPECIALTY', e.id, true)).active).toBe(true);
    expect(w.audit.last('referentials.entry.activate')).toBeDefined();
  });

  it('liste seulement les entrées actives par défaut, trie par ordre puis code, recherche et pagine', async () => {
    const w = build();
    const a = must(await w.manage.create(ACTOR, 'SPECIALTY', { code: 'B', labels: { fr: 'Bravo' }, sortOrder: 2 }));
    must(await w.manage.create(ACTOR, 'SPECIALTY', { code: 'A', labels: { fr: 'Alpha' }, sortOrder: 2 }));
    must(await w.manage.create(ACTOR, 'SPECIALTY', { code: 'C', labels: { fr: 'Charlie' }, sortOrder: 1 }));
    await w.manage.setActive(ACTOR, 'SPECIALTY', a.id, false);

    const active = must(await w.list.execute('SPECIALTY', { includeInactive: false, offset: 0, limit: 50 }));
    expect(active.items.map((e) => e.code)).toEqual(['C', 'A']);
    const all = must(await w.list.execute('SPECIALTY', { includeInactive: true, offset: 0, limit: 50 }));
    expect(all.items.map((e) => e.code)).toEqual(['C', 'A', 'B']);
    expect(must(await w.list.execute('SPECIALTY', { includeInactive: true, search: ' CHAR ', offset: 0, limit: 50 })).items.map((e) => e.code)).toEqual(['C']);
    expect(must(await w.list.execute('SPECIALTY', { includeInactive: true, offset: 1, limit: 1 }))).toMatchObject({ total: 3, items: [{ code: 'A' }] });
    expect(must(await w.list.execute('SPECIALTY', { includeInactive: true, offset: -4, limit: 9999 }))).toMatchObject({ offset: 0, limit: 200 });
    expect(fail(await w.list.execute('NOPE', { includeInactive: false, offset: 0, limit: 10 }))).toBe('REFERENTIAL_CATALOG_NOT_FOUND');
  });

  it('dénombre les entrées par catalogue (totales et actives)', async () => {
    const w = build();
    const e = must(await w.manage.create(ACTOR, 'SPECIALTY', PEDIATRICS));
    must(await w.manage.create(ACTOR, 'SPECIALTY', { code: 'X', labels: { fr: 'X' } }));
    await w.manage.setActive(ACTOR, 'SPECIALTY', e.id, false);
    const views = await w.catalogs.execute();
    expect(views.find((c) => c.code === 'SPECIALTY')).toMatchObject({ entryCount: 2, activeEntryCount: 1 });
    expect(views.find((c) => c.code === 'MEASUREMENT_UNIT')).toMatchObject({ entryCount: 0, activeEntryCount: 0 });
  });
});

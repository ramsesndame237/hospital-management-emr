import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { CatalogEntry } from '../../src/modules/referentials/domain/entities/catalog-entry';
import { CatalogCode, EntryCode, EntryId, SortOrder } from '../../src/modules/referentials/domain/value-objects/codes';
import { LocalizedLabels } from '../../src/modules/referentials/domain/value-objects/localized-labels';
import { PgCatalogRepository } from '../../src/modules/referentials/infrastructure/persistence/pg-catalog.repository';
import { PgEntryRepository } from '../../src/modules/referentials/infrastructure/persistence/pg-entry.repository';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';

const schema = (file: string) => fs.readFileSync(path.join(__dirname, '../../migration/schema', file), 'utf8');
const DDL = ['iam.pg.sql', 'administration.pg.sql', 'referentials.pg.sql'].map(schema);

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SPECIALTY = must(CatalogCode.create('SPECIALTY'));
const entry = (n: number, code: string, labels: Record<string, string> = { fr: code }, sortOrder = 0, active = true) =>
  CatalogEntry.create({ id: must(EntryId.create(uuid(n))), catalogCode: SPECIALTY, code: must(EntryCode.create(code)), labels: must(LocalizedLabels.create(labels)), sortOrder: must(SortOrder.create(sortOrder)), active });

describe('schéma référentiels sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  beforeEach(async () => {
    db = new PGlite();
    for (const ddl of DDL) await db.exec(ddl);
    sql = new PgliteSql(db);
  });
  afterEach(() => db.close());

  it('est idempotent et ne ramène jamais une entrée modifiée ou désactivée à son état d\'origine', async () => {
    await sql.query("UPDATE referentials_entries SET active = false, labels = '{\"fr\":\"Modifié\"}' WHERE catalog_code = 'SPECIALTY' AND code = 'PEDIATRICS'");
    const [{ n }] = await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM referentials_entries');
    for (const ddl of DDL) await db.exec(ddl);
    const [{ n: again }] = await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM referentials_entries');
    expect(again).toBe(n);
    const [row] = await sql.query<{ active: boolean; labels: { fr: string } }>("SELECT active, labels FROM referentials_entries WHERE code = 'PEDIATRICS'");
    expect(row).toEqual({ active: false, labels: { fr: 'Modifié' } });
  });

  it('fournit quatre catalogues de départ, bilingues, que le dépôt relit sans erreur', async () => {
    const catalogs = new PgCatalogRepository(sql);
    expect((await catalogs.findAll()).map((c) => c.code.value)).toEqual(['MEASUREMENT_UNIT', 'PROFESSION', 'SPECIALTY', 'VISIT_REASON']);
    const counts = await catalogs.countEntries();
    expect(counts.SPECIALTY.total).toBeGreaterThan(5);
    const { items } = await new PgEntryRepository(sql).list(SPECIALTY, { activeOnly: true }, 0, 200);
    expect(items.every((e) => e.labels.toRecord().fr && e.labels.toRecord().en)).toBe(true);
  });

  it("accorde la lecture à tout le personnel (pas au patient) et la gestion au seul administrateur système", async () => {
    const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, r.permissions.map((p) => p.value)]));
    for (const [code, permissions] of roles) {
      expect({ code, read: permissions.includes('referentials:read:all') }).toEqual({ code, read: code !== 'PATIENT' });
      expect({ code, manage: permissions.includes('referentials:manage:all') }).toEqual({ code, manage: code === 'SYSTEM_ADMIN' });
    }
  });

  describe('entrées', () => {
    it('conserve libellés (accents compris), ordre et état, et les retrouve par id ou par code', async () => {
      const repo = new PgEntryRepository(sql);
      await repo.save(entry(1, 'NEPHROLOGY', { fr: 'Néphrologie', en: 'Nephrology' }, 7));
      const byId = (await repo.findById(must(EntryId.create(uuid(1)))))!;
      expect(byId.labels.toRecord()).toEqual({ en: 'Nephrology', fr: 'Néphrologie' });
      expect(byId.sortOrder.value).toBe(7);
      expect((await repo.findByCode(SPECIALTY, must(EntryCode.create('NEPHROLOGY'))))!.id.value).toBe(uuid(1));
      expect(await repo.findByCode(SPECIALTY, must(EntryCode.create('NOPE')))).toBeNull();
    });

    it('met à jour libellés, ordre et état sur place, sans jamais toucher au code ni au catalogue', async () => {
      const repo = new PgEntryRepository(sql);
      const e = entry(1, 'NEPHROLOGY');
      await repo.save(e);
      e.relabel(must(LocalizedLabels.create({ fr: 'Néphro' })));
      e.reorder(must(SortOrder.create(3)));
      e.deactivate();
      await repo.save(e);
      const again = (await repo.findById(e.id))!;
      expect(again).toMatchObject({ code: e.code, catalogCode: e.catalogCode, active: false });
      expect(again.labels.toRecord()).toEqual({ fr: 'Néphro' });
      expect(again.sortOrder.value).toBe(3);
    });

    it('garantit un code unique par catalogue même si le contrôle applicatif est contourné', async () => {
      const repo = new PgEntryRepository(sql);
      await repo.save(entry(1, 'NEPHROLOGY'));
      await expect(repo.save(entry(2, 'NEPHROLOGY'))).rejects.toThrow();
    });

    it('refuse en base un code, des libellés ou un catalogue invalides', async () => {
      const insert = (catalog: string, code: string, labels: string) =>
        sql.query('INSERT INTO referentials_entries (id, catalog_code, code, labels) VALUES ($1, $2, $3, $4::jsonb)', [uuid(9), catalog, code, labels]);
      await expect(insert('SPECIALTY', 'bad code', '{"fr":"x"}')).rejects.toThrow();
      await expect(insert('SPECIALTY', 'OK', '{}')).rejects.toThrow();
      await expect(insert('SPECIALTY', 'OK', '[]')).rejects.toThrow();
      await expect(insert('UNKNOWN', 'OK', '{"fr":"x"}')).rejects.toThrow();
    });

    it('filtre les actives, cherche sans caractères joker, trie et pagine', async () => {
      const repo = new PgEntryRepository(sql);
      await repo.save(entry(1, 'ZZ_C', { fr: 'Charlie 100%' }, 1));
      await repo.save(entry(2, 'ZZ_A', { fr: 'Alpha' }, 2));
      await repo.save(entry(3, 'ZZ_B', { fr: 'Bravo' }, 2, false));
      const list = (filter: { activeOnly: boolean; search?: string }) => repo.list(SPECIALTY, filter, 0, 500);
      const codes = (r: Awaited<ReturnType<typeof list>>) => r.items.map((e) => e.code.value).filter((c) => c.startsWith('ZZ_'));
      expect(codes(await list({ activeOnly: true, search: 'zz_' }))).toEqual(['ZZ_C', 'ZZ_A']);
      expect(codes(await list({ activeOnly: false, search: 'zz_' }))).toEqual(['ZZ_C', 'ZZ_A', 'ZZ_B']);
      expect(codes(await list({ activeOnly: false, search: 'CHARLIE' }))).toEqual(['ZZ_C']);
      expect((await list({ activeOnly: false, search: '%' })).total).toBe(1); // « % » est cherché tel quel (pas un joker)
      expect((await list({ activeOnly: false, search: '_' })).total).toBeGreaterThan(0); // le « _ » littéral des codes
      const page = await repo.list(SPECIALTY, { activeOnly: false, search: 'zz_' }, 1, 1);
      expect(page.total).toBe(3);
      expect(page.items.map((e) => e.code.value)).toEqual(['ZZ_A']);
    });
  });
});

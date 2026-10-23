import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { getMetadataArgsStorage } from 'typeorm';
import { ALL_ENTITIES } from '../src/database/entities';

const DDL = fs.readFileSync(path.join(__dirname, '../migration/schema/schema.pg.sql'), 'utf8');
const ddlTables = [...DDL.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map((m) => m[1]);

describe('schéma PostgreSQL généré', () => {
  it('est valide : toutes les tables se créent sur un vrai moteur PostgreSQL', async () => {
    const db = new PGlite();
    await db.exec(DDL);
    const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
    expect(rows[0].n).toBe(ddlTables.length);
    expect(ddlTables.length).toBeGreaterThan(400);
    await db.close();
  });

  it('la clé auto-incrémentée fonctionne (identité)', async () => {
    const db = new PGlite();
    await db.exec(DDL);
    const r = await db.query<{ appointment_id: number }>(
      `INSERT INTO "pat_appointment" ("appointment_date","appointment_time","created_on") VALUES ('2026-10-07 00:00:00','08:30:00','2026-10-07 07:00:00') RETURNING appointment_id`,
    );
    expect(r.rows[0].appointment_id).toBe(1);
    await db.close();
  });

  it('chaque entité TypeORM correspond à une table du DDL, et réciproquement', () => {
    const entityTables = new Set(
      getMetadataArgsStorage().tables.filter((t) => ALL_ENTITIES.includes(t.target as never)).map((t) => t.name as string),
    );
    expect([...entityTables].sort()).toEqual([...ddlTables].sort());
  });

  it('les colonnes des entités sont celles du DDL (aucune dérive entre les deux générations)', () => {
    const storage = getMetadataArgsStorage();
    const cols = new Map<string, Set<string>>();
    for (const t of storage.tables) cols.set(t.name as string, new Set());
    for (const c of storage.columns) {
      const t = storage.tables.find((x) => x.target === c.target);
      if (t) cols.get(t.name as string)?.add((c.options.name as string) ?? c.propertyName);
    }
    for (const t of ddlTables) {
      const block = DDL.slice(DDL.indexOf(`"${t}" (`));
      const body = block.slice(0, block.indexOf('\n);'));
      const ddlCols = [...body.matchAll(/^  "([^"]+)" /gm)].map((m) => m[1]);
      for (const c of ddlCols) expect(cols.get(t)).toContain(c);
    }
  });
});

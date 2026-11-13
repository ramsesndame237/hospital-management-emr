// Applique des scripts SQL idempotents (CREATE ... IF NOT EXISTS, upserts), chacun dans sa transaction.
// Lit DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL comme l'API. Rejouable à chaque déploiement.
// Un verrou consultatif empêche deux instances qui démarrent en même temps de migrer simultanément : la seconde attend la première.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const MIGRATION_LOCK = 7_430_001;

export async function applyFiles(files, log = console.log) {
  const client = new pg.Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'sanjeevani',
    user: process.env.DB_USER ?? 'sanjeevani',
    password: process.env.DB_PASSWORD ?? '',
    ssl: ['1', 'true', 'yes'].includes(String(process.env.DB_SSL ?? '').toLowerCase()) ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    for (const file of files) {
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(file, 'utf8'));
        await client.query('COMMIT');
        log(`[sql] ${file} appliqué`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`${file} : ${e.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

// Applique des scripts SQL idempotents (CREATE ... IF NOT EXISTS, upserts) dans une transaction.
// Usage : node tools/apply-sql.mjs migration/schema/iam.pg.sql [autre.sql ...]
// Lit DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL comme l'API. Rejouable à chaque déploiement.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage : node tools/apply-sql.mjs <fichier.sql> [...]');
  process.exit(2);
}

const client = new pg.Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'sanjeevani',
  user: process.env.DB_USER ?? 'sanjeevani',
  password: process.env.DB_PASSWORD ?? '',
  ssl: ['1', 'true', 'yes'].includes(String(process.env.DB_SSL ?? '').toLowerCase()) ? { rejectUnauthorized: false } : false,
});

try {
  await client.connect();
  for (const file of files) {
    await client.query('BEGIN');
    try {
      await client.query(readFileSync(file, 'utf8'));
      await client.query('COMMIT');
      console.log(`[sql] ${file} appliqué`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`${file} : ${e.message}`);
    }
  }
} catch (e) {
  console.error(`[sql] échec : ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

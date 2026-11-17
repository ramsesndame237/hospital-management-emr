// Applique des scripts SQL idempotents, chacun dans sa transaction.
// Usage : node tools/apply-sql.mjs migration/schema/iam.pg.sql [autre.sql ...]
import { applyFiles } from './lib/sql-runner.mjs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage : node tools/apply-sql.mjs <fichier.sql> [...]');
  process.exit(2);
}
applyFiles(files).catch((e) => {
  console.error(`[sql] échec : ${e.message}`);
  process.exit(1);
});

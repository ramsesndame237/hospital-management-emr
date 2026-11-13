// Applique TOUT le schéma de l'application, dans l'ordre de migration/schema/manifest.json (source unique : le conteneur, les tests et `npm run db:migrate` l'utilisent).
// Idempotent : on peut le rejouer à chaque démarrage et à chaque mise à jour.
// Usage : node tools/migrate.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyFiles } from './lib/sql-runner.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migration', 'schema');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
applyFiles(manifest.map((f) => join(dir, f))).then(
  () => console.log(`[sql] ${manifest.length} scripts appliqués`),
  (e) => {
    console.error(`[sql] échec : ${e.message}`);
    process.exit(1);
  },
);

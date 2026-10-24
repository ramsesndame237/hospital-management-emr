#!/usr/bin/env node
/**
 * Synchronise les messages « partagés » avec le backend : validation (`validation.json`), noms de champs (`fields.json`)
 * et erreurs métier (`errors.json`). Le backend est la source de vérité de ces phrases ; le frontend les embarque pour que
 * le même contrôle (« champ obligatoire », « mot de passe trop court »…) dise exactement la même chose des deux côtés, y
 * compris hors ligne. Les textes propres à l'interface (libellés, titres) restent dans `src/app/i18n/catalogs/<langue>.json`.
 *
 *   node scripts/sync-i18n.mjs          écrit src/app/i18n/catalogs/<langue>.server.json
 *   node scripts/sync-i18n.mjs --check  échoue (code 1) si les fichiers générés ne sont pas à jour (CI)
 *
 * Sans le dossier backend (build du frontend seul), le script ne fait rien et réussit : les fichiers générés sont commités.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '..', 'backend', 'src', 'modules', 'i18n', 'catalogs');
const target = resolve(root, 'src', 'app', 'i18n', 'catalogs');
const SHARED = ['validation', 'fields', 'errors'];
const check = process.argv.includes('--check');

if (!existsSync(source)) {
  console.log(`[i18n] catalogues du backend introuvables (${source}) : synchronisation ignorée.`);
  process.exit(0);
}

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const locales = readdirSync(source, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
let stale = 0;

mkdirSync(target, { recursive: true });
for (const locale of locales) {
  const merged = Object.fromEntries(SHARED.map((name) => [name, read(join(source, locale, `${name}.json`))]));
  const output = `${JSON.stringify(merged, null, 2)}\n`;
  const file = join(target, `${locale}.server.json`);
  const current = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (current === output) continue;
  if (check) {
    stale++;
    console.error(`[i18n] ${locale}.server.json n'est pas à jour : lancez « npm run i18n:sync ».`);
  } else {
    writeFileSync(file, output);
    console.log(`[i18n] ${locale}.server.json mis à jour.`);
  }
}

if (check && stale > 0) process.exit(1);
if (!check) console.log(`[i18n] ${locales.length} langue(s) synchronisée(s) : ${locales.join(', ')}.`);

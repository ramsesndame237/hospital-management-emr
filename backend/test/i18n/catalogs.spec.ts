import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CATALOGS_DIR } from '../../src/modules/i18n/localization.module';

const LOCALES = ['fr', 'en'];
const SRC = path.join(__dirname, '../../src');

type Flat = Map<string, string>;
function load(locale: string): Flat {
  const dir = path.join(DEFAULT_CATALOGS_DIR, locale);
  const out: Flat = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const walk = (node: unknown, prefix: string): void => {
      if (typeof node === 'string') out.set(prefix, node);
      else for (const [k, v] of Object.entries(node as object)) walk(v, `${prefix}.${k}`);
    };
    walk(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), f.slice(0, -5));
  }
  return out;
}

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sources(p) : e.name.endsWith('.ts') ? [p] : [];
  });
}
const allSource = sources(SRC).map((p) => fs.readFileSync(p, 'utf8')).join('\n');
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('catalogues de traduction', () => {
  const catalogs = Object.fromEntries(LOCALES.map((l) => [l, load(l)]));

  it('ont exactement les mêmes clés dans toutes les langues (aucune traduction oubliée)', () => {
    const [ref, ...others] = LOCALES;
    for (const o of others) {
      expect([...catalogs[o].keys()].sort()).toEqual([...catalogs[ref].keys()].sort());
    }
  });

  it('utilisent les mêmes paramètres {…} dans toutes les langues (pas de {min} perdu à la traduction)', () => {
    for (const [key, fr] of catalogs.fr) {
      for (const l of LOCALES.filter((x) => x !== 'fr')) expect({ key, params: placeholders(catalogs[l].get(key) as string) }).toEqual({ key, params: placeholders(fr) });
    }
  });

  it('ne contiennent aucun message vide', () => {
    for (const l of LOCALES) for (const [k, v] of catalogs[l]) expect({ l, k, ok: v.trim().length > 0 }).toEqual({ l, k, ok: true });
  });

  it('couvrent TOUS les codes d\'erreur utilisés dans le code (ajouter un code sans traduction fait échouer le test)', () => {
    const codes = new Set<string>();
    for (const m of allSource.matchAll(/new DomainError\(\s*'([A-Z][A-Z0-9_]+)'/g)) codes.add(m[1]);
    for (const m of allSource.matchAll(/\bcode:\s*'([A-Z][A-Z0-9_]+)'/g)) codes.add(m[1]);
    for (const m of allSource.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):\s*HttpStatus\./gm)) codes.add(m[1]); // table code → statut HTTP
    expect(codes.size).toBeGreaterThan(25);
    const missing = [...codes].filter((c) => !catalogs.fr.has(`errors.${c}`));
    expect(missing).toEqual([]);
  });

  it('couvrent les règles de validation et les clés de message utilisées par les DTO', () => {
    const used = new Set<string>();
    for (const m of allSource.matchAll(/message:\s*'validation\.(\w+)'/g)) used.add(m[1]);
    for (const k of used) expect(catalogs.fr.has(`validation.${k}`)).toBe(true);
    const rules = ['isString', 'isNotEmpty', 'minLength', 'maxLength', 'isEmail', 'matches', 'isArray', 'arrayMinSize', 'arrayMaxSize', 'isUuid', 'isInt', 'generic'];
    for (const r of rules) expect(catalogs.fr.has(`validation.${r}`)).toBe(true);
  });

  it('chaque message de validation sait afficher le nom du champ', () => {
    for (const l of LOCALES) for (const [k, v] of catalogs[l]) if (k.startsWith('validation.')) expect({ l, k, v: v.includes('{field}') }).toEqual({ l, k, v: true });
  });

  it('les noms de champs des DTO ont un libellé', () => {
    const dto = fs.readFileSync(path.join(SRC, 'modules/iam/presentation/dto/auth.dto.ts'), 'utf8');
    const fields = new Set([...dto.matchAll(/^\s+(\w+)[!?]?:\s/gm)].map((m) => m[1]));
    expect(fields.size).toBeGreaterThan(5);
    for (const f of fields) expect({ f, ok: catalogs.fr.has(`fields.${f}`) }).toEqual({ f, ok: true });
  });
});

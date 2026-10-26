// Inventaire des entités : DbContext EF6 + classes modèle C# -> tables et colonnes (schéma « code-first » estimé).
//   node tools/inventory-entities.mjs   ->   migration/inventory/entities.json
// Source de vérité du schéma réel = la base SQL Server (.bak). Ce schéma déduit du code sert à démarrer et sera comparé
// à la base une fois restaurée (voir docs/migration/NESTJS_MIGRATION.md, « Blocage FILESTREAM »).
import fs from 'node:fs';
import path from 'node:path';
import { CODE, REPO, listCs, read, mask, matchBrace, splitParams } from './lib/cs.mjs';

const OUT = path.resolve(import.meta.dirname, '../migration/inventory');
fs.mkdirSync(OUT, { recursive: true });
const files = listCs(CODE);

// ── classes C# : nom -> définitions (corps, base, fichier) ──
const classDefs = new Map();
for (const f of files) {
  const src = read(f);
  const m = mask(src), mk = mask(src, { keepStrings: true });
  const re = /\b(?:class)\s+(\w+)\s*(?::\s*([\w\.<>, ]+?))?\s*\{/g;
  let r;
  while ((r = re.exec(m))) {
    const open = r.index + r[0].length - 1;
    const close = matchBrace(m, open);
    const before = mk.slice(Math.max(0, r.index - 500), r.index);
    const attrs = before.slice(Math.max(before.lastIndexOf(';'), before.lastIndexOf('}'), before.lastIndexOf('{')) + 1);
    const def = { name: r[1], base: (r[2] || '').split(',')[0].trim(), file: f, open, close, m, mk, attrs };
    const arr = classDefs.get(r[1]) || [];
    arr.push(def); classDefs.set(r[1], arr);
  }
}

const PRIMS = {
  int: 'integer', Int32: 'integer', long: 'bigint', Int64: 'bigint', short: 'smallint', Int16: 'smallint', byte: 'smallint', sbyte: 'smallint',
  bool: 'boolean', Boolean: 'boolean', string: 'text', String: 'text', decimal: 'numeric', Decimal: 'numeric', double: 'double precision', Double: 'double precision',
  float: 'real', Single: 'real', DateTime: 'timestamp', DateTimeOffset: 'timestamptz', TimeSpan: 'interval', Guid: 'uuid', 'byte[]': 'bytea', Byte: 'smallint', char: 'text',
};

const members = (def) => {
  const out = [];
  let i = def.open + 1, hdr = i;
  while (i < def.close) {
    const ch = def.m[i];
    if (ch === '{') {
      const end = matchBrace(def.m, i);
      const header = def.mk.slice(hdr, i);
      const body = def.m.slice(i, end + 1);
      out.push({ header, body, isProp: !/\(/.test(header.replace(/\[[^\]]*\]/g, '')) });
      i = end + 1; hdr = i; continue;
    }
    if (ch === ';') hdr = i + 1;
    i++;
  }
  return out;
};

function propsOf(def, depth = 0) {
  const props = [];
  const base = def.base && classDefs.get(def.base);
  if (base && depth < 5) props.push(...propsOf(base[0], depth + 1));
  for (const mem of members(def)) {
    if (!mem.isProp) continue;
    const attrs = mem.header.slice(0, mem.header.lastIndexOf(']') + 1);
    const sig = mem.header.replace(/\[[^\]]*\]/g, ' ').trim();
    const mm = /^(?:public|internal)\s+((?:static|virtual|override|new)\s+)*([\w\.<>\[\]\?, ]+?)\s+(\w+)\s*$/.exec(sig);
    if (!mm) continue;
    const [, , rawType, name] = mm;
    if (/\bstatic\b/.test(sig)) continue;
    const hasSet = /\bset\s*;|\bset\s*\{|\bprivate\s+set|\binit\b/.test(mem.body);
    const hasGet = /\bget\b/.test(mem.body);
    if (!hasGet || !hasSet) continue; // propriété calculée
    const notMapped = /\[\s*NotMapped/.test(attrs);
    const nullable = /\?$/.test(rawType) || /^Nullable</.test(rawType);
    const t = rawType.replace(/\?$/, '').replace(/^Nullable<(.+)>$/, '$1').trim();
    const pg = PRIMS[t];
    const col = (attrs.match(/\[\s*Column\s*\(\s*(?:Name\s*=\s*)?"([^"]+)"/) || [])[1];
    const maxLen = Number((attrs.match(/\[\s*(?:MaxLength|StringLength)\s*\(\s*(\d+)/) || [])[1]) || null;
    props.push({
      prop: name, csType: rawType, pgType: pg || null, nullable: pg === 'text' ? !/\[\s*Required/.test(attrs) : nullable,
      key: /\[\s*Key\b/.test(attrs), column: col || null, maxLength: maxLen,
      generated: (attrs.match(/DatabaseGeneratedOption\.(\w+)/) || [])[1] || null,
      mapped: !notMapped && !!pg, nav: !pg && !notMapped ? rawType : null,
    });
  }
  // une propriété redéfinie (new/override) remplace celle de la base
  const seen = new Map();
  for (const p of props) seen.set(p.prop, p);
  return [...seen.values()];
}

// ── DbContext : DbSet + ToTable ──
const contexts = [];
const tables = new Map(); // clé = nom de table -> entité
for (const f of files) {
  const src = read(f);
  if (!/:\s*(?:\w+\.)?\w*DbContext\b/.test(src)) continue;
  const m = mask(src), mk = mask(src, { keepStrings: true });
  const re = /\bclass\s+(\w+)\s*:\s*(?:\w+\.)?\w*DbContext\s*\{/g;
  let r;
  while ((r = re.exec(m))) {
    const open = r.index + r[0].length - 1, close = matchBrace(m, open);
    const body = mk.slice(open, close);
    const ctx = { name: r[1], file: path.relative(REPO, f).split(path.sep).join('/'), sets: [] };
    for (const s of body.matchAll(/\bDbSet<(\w+)>\s+(\w+)/g)) ctx.sets.push({ model: s[1], set: s[2] });
    const tableOf = new Map();
    for (const t of body.matchAll(/Entity<(\w+)>\(\)\s*\.ToTable\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g)) tableOf.set(t[1], { table: t[2], schema: t[3] || null });
    const keysOf = new Map();
    for (const k of body.matchAll(/Entity<(\w+)>\(\)\s*\.HasKey\(\s*\w+\s*=>\s*(?:new\s*\{([^}]*)\}|\w+\.(\w+))/g)) keysOf.set(k[1], (k[2] ? k[2].split(',').map((x) => x.trim().replace(/^\w+\./, '')) : [k[3]]));
    contexts.push(ctx);
    for (const s of ctx.sets) {
      const defs = classDefs.get(s.model);
      const tbl = tableOf.get(s.model) || { table: s.model, schema: null, byConvention: true };
      const key = `${tbl.schema || 'dbo'}.${tbl.table}`.toLowerCase();
      const ent = tables.get(key) || { table: tbl.table, schema: tbl.schema, byConvention: !!tbl.byConvention, model: s.model, contexts: new Set(), sets: new Set(), explicitKeys: keysOf.get(s.model) || null, def: defs ? defs[0] : null };
      ent.contexts.add(ctx.name); ent.sets.add(s.set);
      if (!ent.def && defs) ent.def = defs[0];
      tables.set(key, ent);
    }
  }
}

// ── colonnes ──
const entities = [];
const warnings = [];
for (const e of tables.values()) {
  if (!e.def) { warnings.push(`modèle introuvable : ${e.model} (table ${e.table})`); continue; }
  const props = propsOf(e.def).filter((p) => p.mapped);
  const classTable = (e.def.attrs.match(/\[\s*Table\s*\(\s*"([^"]+)"/) || [])[1];
  let pk = props.filter((p) => p.key).map((p) => p.prop);
  if (e.explicitKeys) pk = e.explicitKeys;
  if (!pk.length) {
    const guess = props.find((p) => p.prop === 'Id' || p.prop === `${e.model.replace(/Model$/, '')}Id` || p.prop === `${e.model}Id`);
    if (guess) pk = [guess.prop]; else warnings.push(`aucune clé primaire détectée : ${e.model} (${e.table})`);
  }
  const rel = path.relative(CODE, e.def.file).split(path.sep);
  const sm = rel.indexOf('DanpheEMR.ServerModel');
  const folder = sm >= 0 && rel.length > sm + 2 ? rel[sm + 1] : sm >= 0 ? 'Common' : rel[0] === 'Websites' ? 'Websites' : rel[1] || 'Common';
  entities.push({
    table: classTable || e.table, schema: e.schema, model: e.model, folder, byConvention: e.byConvention,
    contexts: [...e.contexts].sort(), sets: [...e.sets].sort(), pk,
    file: path.relative(REPO, e.def.file).split(path.sep).join('/'),
    columns: props.map((p) => ({ prop: p.prop, column: p.column || p.prop, pgType: p.pgType, nullable: p.nullable && !pk.includes(p.prop), maxLength: p.maxLength, generated: p.generated })),
    navigations: propsOf(e.def).filter((p) => p.nav).length,
  });
}
entities.sort((a, b) => a.table.localeCompare(b.table));
fs.writeFileSync(path.join(OUT, 'entities.json'), JSON.stringify({ contexts, count: entities.length, warnings, entities }, null, 1));
const cols = entities.reduce((s, e) => s + e.columns.length, 0);
console.log(`${contexts.length} DbContext, ${entities.length} tables distinctes, ${cols} colonnes, ${warnings.length} avertissements`);
console.log('dossiers :', Object.entries(entities.reduce((a, e) => ((a[e.folder] = (a[e.folder] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${v}`).join(' '));
console.log(warnings.slice(0, 8).join('\n'));

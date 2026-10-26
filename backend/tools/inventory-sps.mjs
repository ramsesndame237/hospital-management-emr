// Inventaire des procédures stockées appelées par le backend .NET.
//   node tools/inventory-sps.mjs   ->   migration/inventory/stored-procedures.json
// Les DÉFINITIONS (corps T-SQL) ne sont pas dans le dépôt : elles vivent dans la sauvegarde .bak. Cet inventaire dit
// quelles procédures existent, qui les appelle et avec quels paramètres ; le corps doit être extrait de SQL Server.
import fs from 'node:fs';
import path from 'node:path';
import { CODE, REPO, listCs, read, mask, lineOf } from './lib/cs.mjs';

const OUT = path.resolve(import.meta.dirname, '../migration/inventory');
fs.mkdirSync(OUT, { recursive: true });
const files = listCs(CODE);

// 1. Constantes ENUM_StoredProcedures.Nom -> "SP_..."
const enumMap = new Map();
for (const f of files) {
  const src = read(f);
  const mk = mask(src, { keepStrings: true });
  const m = /class\s+ENUM_StoredProcedures\s*\{/.exec(mk);
  if (!m) continue;
  const body = mk.slice(m.index);
  for (const x of body.matchAll(/\b(?:const|static\s+readonly)\s+string\s+(\w+)\s*=\s*"([^"]+)"/g)) enumMap.set(x[1], x[2]);
}

// 2. Sites d'appel
const FN = /\b(GetDataTableFromStoredProc|GetDatasetFromStoredProc2|GetDatasetFromStoredProc|ExecuteStoredProcedure|ExecuteStoredProc)\s*\(\s*(?:ENUM_StoredProcedures\.(\w+)|"([^"]+)")/g;
const RAW = /"\s*(?:exec(?:ute)?\s+)?((?:SP|sp)_[A-Za-z0-9_]+)/g;
const sps = new Map();
const unresolved = [];
const add = (name, call) => {
  const e = sps.get(name) || { name, calls: [], params: new Set(), modules: new Set() };
  e.calls.push(call); e.modules.add(call.module); (call.params || []).forEach((p) => e.params.add(p));
  sps.set(name, e);
};
const moduleOf = (file) => {
  const rel = path.relative(CODE, file).split(path.sep);
  const c = rel.indexOf('Controllers');
  if (c >= 0) return rel[c + 1] && rel[c + 2] ? rel[c + 1] : 'Root';
  return rel[0] === 'Components' ? rel[1].replace(/^DanpheEMR\./, '') : rel[0];
};
const METHOD = /\b(?:public|private|protected|internal)\s+(?:static\s+|async\s+)*[\w<>\[\],\.\?\s]+?\s+(\w+)\s*\([^)]*\)\s*\{/g;

for (const f of files) {
  const src = read(f);
  if (!/StoredProc|SP_|sp_/.test(src)) continue;
  const mk = mask(src, { keepStrings: true });
  const methods = [...mk.matchAll(METHOD)].map((x) => ({ i: x.index, n: x[1] }));
  const enclosing = (idx) => { let n = null; for (const m of methods) { if (m.i > idx) break; n = m.n; } return n; };
  const seen = new Set();
  const base = (idx, kind, extra = {}) => {
    const window = mk.slice(Math.max(0, idx - 2500), idx + 300);
    const params = [...new Set([...window.matchAll(/new\s+SqlParameter\s*\(\s*"@?(\w+)"/g)].map((x) => x[1]))];
    return { file: path.relative(REPO, f).split(path.sep).join('/'), line: lineOf(src, idx), method: enclosing(idx), module: moduleOf(f), kind, params, ...extra };
  };
  let r;
  FN.lastIndex = 0;
  while ((r = FN.exec(mk))) {
    const name = r[3] || enumMap.get(r[2]);
    seen.add(r.index);
    if (!name) { unresolved.push({ enum: r[2], file: path.relative(REPO, f), line: lineOf(src, r.index) }); continue; }
    add(name, base(r.index, r[1].replace('GetDataTableFromStoredProc', 'table').replace(/GetDatasetFromStoredProc2?/, 'dataset').replace(/Execute\w+/, 'exec')));
  }
  RAW.lastIndex = 0;
  while ((r = RAW.exec(mk))) {
    const near = [...seen].some((p) => Math.abs(p - r.index) < 200);
    if (!near) add(r[1], base(r.index, 'literal'));
  }
}

const list = [...sps.values()].map((e) => ({ name: e.name, callCount: e.calls.length, modules: [...e.modules].sort(), params: [...e.params].sort(), calls: e.calls }))
  .sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(path.join(OUT, 'stored-procedures.json'), JSON.stringify({ count: list.length, unresolvedEnum: unresolved, procedures: list }, null, 1));
const byMod = {};
for (const e of list) for (const m of e.modules) byMod[m] = (byMod[m] || 0) + 1;
console.log(`${list.length} procédures distinctes, ${list.reduce((s, e) => s + e.callCount, 0)} appels, ${unresolved.length} appels non résolus`);
console.log('par module :', Object.entries(byMod).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}=${v}`).join(' '));

// Inventaire des endpoints du backend .NET : un enregistrement par action de contrôleur.
//   node tools/inventory-endpoints.mjs   ->   migration/inventory/endpoints.json
// Sert de cahier des charges de la migration : route, verbe, paramètres, taille, tables et procédures stockées touchées.
import fs from 'node:fs';
import path from 'node:path';
import { CODE, REPO, listCs, read, mask, matchBrace, matchParen, lineOf, codeLines, splitParams } from './lib/cs.mjs';

const OUT = path.resolve(import.meta.dirname, '../migration/inventory');
fs.mkdirSync(OUT, { recursive: true });

const files = listCs(CODE);
const classes = []; // { name, base, route, file, bodyStart, bodyEnd, mk, m }

// ── 1re passe : toutes les classes dérivées d'un contrôleur (pour résoudre la route héritée) ──
for (const file of files) {
  const src = read(file);
  if (!/Controller\b/.test(src)) continue;
  const mk = mask(src, { keepStrings: true });
  const m = mask(src);
  const re = /\bclass\s+(\w+)\s*(?::\s*([\w\.<>, ]+?))?\s*\{/g;
  let r;
  while ((r = re.exec(m))) {
    const name = r[1];
    const open = r.index + r[0].length - 1;
    const before = mk.slice(Math.max(0, r.index - 600), r.index);
    const attrBlock = before.slice(Math.max(before.lastIndexOf(';'), before.lastIndexOf('}'), before.lastIndexOf('{')) + 1);
    const route = (attrBlock.match(/\[\s*Route\s*\(\s*"([^"]*)"\s*\)\s*\]/) || [])[1] || null;
    classes.push({ name, base: (r[2] || '').split(',')[0].trim(), route, file, open, close: matchBrace(m, open), mk, m, src });
  }
}
const byName = new Map(classes.map((c) => [c.name, c]));
const isController = (c) => /Controller$/.test(c.name) && c.name !== 'Controller';
const baseRoute = (c, depth = 0) => {
  if (c.route) return c.route;
  const b = byName.get(c.base);
  if (b && depth < 6) return baseRoute(b, depth + 1);
  return c.base === 'CommonController' || c.base === 'Controller' || c.base === 'ControllerBase' ? (c.base === 'CommonController' ? 'api/[controller]' : null) : null;
};

const moduleOf = (file) => {
  const rel = path.relative(CODE, file).split(path.sep);
  const i = rel.indexOf('Controllers');
  return i >= 0 && rel[i + 2] ? rel[i + 1] : 'Root';
};

const HTTP_RE = /\b(Http(?:Get|Post|Put|Delete|Patch))\b(?:\s*\(\s*"([^"]*)"\s*\))?/g;
const endpoints = [];

for (const c of classes.filter(isController)) {
  const ctrl = c.name.replace(/Controller$/, '');
  const classRoute = (baseRoute(c) || `api/${ctrl}`).replace('[controller]', ctrl);
  const { m, mk, src } = c;
  let i = c.open + 1, hdrStart = i;
  while (i < c.close) {
    const ch = m[i];
    if (ch === '{') {
      const end = matchBrace(m, i);
      const header = m.slice(hdrStart, i);
      const headerK = mk.slice(hdrStart, i);
      const sig = header.replace(/\[[^\]]*\]/g, ' ');
      const mm = /^\s*(public)\s[^=;(]*?\b(\w+)\s*(?:<[^>]*>)?\s*\(/.exec(sig);
      if (mm && mm[2] !== c.name) {
        const actionName = mm[2];
        const returns = sig.slice(0, sig.indexOf(actionName)).replace(/(public|static|virtual|override|async|internal|protected)/g, '').trim();
        const parenAt = header.indexOf('(', header.indexOf(actionName, header.lastIndexOf(']') + 1));
        const parenEnd = matchParen(header + ')', parenAt);
        const params = splitParams(header.slice(parenAt + 1, parenEnd)).map((p) => {
          const t = p.replace(/\[[^\]]*\]/g, '').trim().split(/\s+/);
          return { name: (t[t.length - 1] || '').split('=')[0], type: t.slice(0, -1).join(' '), fromBody: /\[\s*FromBody/.test(p), fromQuery: /\[\s*FromQuery/.test(p) };
        });
        const attrs = headerK.slice(0, headerK.lastIndexOf(']') + 1);
        const verbs = [], templates = [];
        let h;
        HTTP_RE.lastIndex = 0;
        while ((h = HTTP_RE.exec(attrs))) { verbs.push(h[1].replace('Http', '').toUpperCase()); if (h[2] !== undefined) templates.push(h[2]); }
        const rt = [...attrs.matchAll(/\bRoute\s*\(\s*"([^"]*)"\s*\)/g)].map((x) => x[1]);
        const tpl = (rt[0] ?? templates[0] ?? '').replace('[action]', actionName).replace('[controller]', ctrl);
        const route = tpl.startsWith('/') || tpl.startsWith('~/') ? tpl.replace(/^~?\//, '') : [classRoute, tpl].filter(Boolean).join('/');
        const bodyM = m.slice(i, end + 1), bodyK = mk.slice(i, end + 1);
        const ctxFields = [...new Set([...bodyK.matchAll(/\b(_?\w*[dD]b[cC]ontext\w*)\s*\./g)].map((x) => x[1]))];
        const ctxTypes = [...new Set([...bodyK.matchAll(/\bnew\s+(\w+DbContext)\s*\(/g)].map((x) => x[1]))];
        const sets = [...new Set([...bodyK.matchAll(/\b_?\w*[dD]b[cC]ontext\w*\s*\.\s*([A-Z]\w*)/g)].map((x) => x[1]))].filter((s) => !/^(SaveChanges|Database|Configuration|Entry|Set|AddAuditCustomField|Dispose|Entry)/.test(s));
        const sps = [...new Set([...bodyK.matchAll(/"((?:SP|sp)_[A-Za-z0-9_]+)"/g)].map((x) => x[1]))];
        const reqTypes = [...new Set([...bodyK.matchAll(/reqType\s*==\s*"([^"]+)"/g)].map((x) => x[1]))];
        const flags = [];
        if (/ReadPostData\(\)|\[\s*FromBody/.test(bodyK + headerK)) flags.push('body');
        if (/HttpContext\.Session|\bSession\.Get/.test(bodyK)) flags.push('session');
        if (/RbacUser|currentuser/i.test(bodyK)) flags.push('currentUser');
        if (/IFormFile|ReadFiles\(\)|Request\.Form\.Files/.test(bodyK + headerK)) flags.push('upload');
        if (/ExcelPackage|FileStreamResult|\bFile\(|PhysicalFile|\.ToArray\(\)\s*,\s*"application\//.test(bodyK)) flags.push('file');
        if (/HttpClient|WebRequest|RestClient/.test(bodyK)) flags.push('externalHttp');
        if (/ExecuteSqlCommand|SqlQuery|FromSql|SqlCommand/.test(bodyK)) flags.push('rawSql');
        if (/\basync\b/.test(sig)) flags.push('async');
        if (/\[\s*AllowAnonymous/.test(attrs)) flags.push('anonymous');
        endpoints.push({
          module: moduleOf(c.file), controller: ctrl, class: c.name, action: actionName,
          verbs: verbs.length ? verbs : ['LEGACY'], route, legacy: verbs.length === 0, returns,
          // api : action HTTP déclarée ; view : renvoie une vue Razor ; helper : méthode publique sans lien HTTP ; legacy : action sans attribut de verbe
          kind: verbs.length ? 'api' : /View\(/.test(bodyK) || /ViewController$/.test(c.name) ? 'view' : /ActionResult|JsonResult|ContentResult|FileResult|^string$|^object$/.test(returns) ? 'legacy' : 'helper',
          params, loc: codeLines(bodyM), ctxFields, ctxTypes, sets, sps, reqTypes, flags,
          file: path.relative(REPO, c.file).split(path.sep).join('/'), line: lineOf(src, i),
        });
      }
      i = end + 1; hdrStart = i; continue;
    }
    if (ch === ';') hdrStart = i + 1;
    i++;
  }
}

endpoints.sort((a, b) => (a.module + a.route).localeCompare(b.module + b.route));
fs.writeFileSync(path.join(OUT, 'endpoints.json'), JSON.stringify(endpoints, null, 1));

const byModule = {};
for (const e of endpoints) {
  const x = (byModule[e.module] ||= { endpoints: 0, loc: 0, sps: new Set(), controllers: new Set() });
  x.endpoints++; x.loc += e.loc; e.sps.forEach((s) => x.sps.add(s)); x.controllers.add(e.controller);
}
console.log(`${endpoints.length} actions dans ${new Set(endpoints.map((e) => e.class)).size} contrôleurs, ${endpoints.reduce((s, e) => s + e.loc, 0)} lignes`);
console.log('types :', Object.entries(endpoints.reduce((a, e) => ((a[e.kind] = (a[e.kind] || 0) + 1), a), {})).map(([k, v]) => `${k}=${v}`).join(' '));
console.log('verbes :', Object.entries(endpoints.reduce((a, e) => ((a[e.verbs.join('+')] = (a[e.verbs.join('+')] || 0) + 1), a), {})).map(([k, v]) => `${k}=${v}`).join(' '));
console.table(Object.fromEntries(Object.entries(byModule).sort((a, b) => b[1].loc - a[1].loc).slice(0, 12).map(([k, v]) => [k, { contrôleurs: v.controllers.size, actions: v.endpoints, lignes: v.loc, procédures: v.sps.size }])));

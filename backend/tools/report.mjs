// Rapport lisible de l'inventaire : docs/migration/INVENTORY.md (régénéré par `npm run inventory`).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const inv = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/inventory', f), 'utf8'));
const endpoints = inv('endpoints.json');
const sps = inv('stored-procedures.json');
const ents = inv('entities.json');
const gen = inv('entity-generation-report.json');

// Estimation d'effort (jours-personne) par action à migrer : barème volontairement simple, à recalibrer après le premier module.
const effort = (e) => (e.loc <= 12 ? 0.25 : e.loc <= 40 ? 0.5 : e.loc <= 100 ? 1 : 2) + (e.sps.length ? 0.5 : 0) + (e.flags.includes('file') || e.flags.includes('upload') ? 0.5 : 0);
const api = endpoints.filter((e) => e.kind === 'api' || e.kind === 'legacy');
const views = endpoints.filter((e) => e.kind === 'view');

const mods = {};
for (const e of api) {
  const m = (mods[e.module] ||= { ctrl: new Set(), n: 0, loc: 0, sp: new Set(), session: 0, days: 0, file: 0 });
  m.ctrl.add(e.controller); m.n++; m.loc += e.loc; e.sps.forEach((s) => m.sp.add(s)); m.days += effort(e);
  if (e.flags.includes('session') || e.flags.includes('currentUser')) m.session++;
  if (e.flags.includes('file') || e.flags.includes('upload')) m.file++;
}
const rows = Object.entries(mods).sort((a, b) => b[1].days - a[1].days);
const totalDays = rows.reduce((s, [, m]) => s + m.days, 0);
const pct = (a, b) => `${Math.round((100 * a) / b)} %`;

const topSp = [...sps.procedures].sort((a, b) => b.callCount - a.callCount).slice(0, 15);
const bigEnt = [...ents.entities].sort((a, b) => b.columns.length - a.columns.length).slice(0, 10);
const byVerb = api.reduce((a, e) => ((a[e.verbs.join('+')] = (a[e.verbs.join('+')] || 0) + 1), a), {});

const md = `# Inventaire de la migration .NET → NestJS

> Généré par \`backend/tools\` (\`npm run inventory\` dans \`backend/\`). Ne pas modifier à la main.
> Source : analyse statique du code C# (EF6, ASP.NET Core) du dépôt. Les procédures stockées n'ont pas de corps dans le dépôt (voir « Blocages »).

## En chiffres

| | |
|---|---|
| Contrôleurs analysés | ${new Set(endpoints.map((e) => e.class)).size} |
| Actions d'API à migrer | **${api.length}** (${Object.entries(byVerb).map(([k, v]) => `${k} ${v}`).join(', ')}) |
| Actions qui servent des vues Razor (remplacées par Angular, hors périmètre API) | ${views.length} |
| Méthodes publiques « assistants » (non HTTP) | ${endpoints.filter((e) => e.kind === 'helper').length} |
| Actions qui dépendent de la session serveur / de l'utilisateur courant | ${api.filter((e) => e.flags.includes('session') || e.flags.includes('currentUser')).length} (${pct(api.filter((e) => e.flags.includes('session') || e.flags.includes('currentUser')).length, api.length)}) → à remplacer par le JWT |
| Actions qui génèrent ou reçoivent des fichiers | ${api.filter((e) => e.flags.includes('file') || e.flags.includes('upload')).length} |
| Procédures stockées distinctes appelées | **${sps.count}** (${sps.procedures.reduce((s, p) => s + p.callCount, 0)} sites d'appel) |
| DbContext EF6 | ${ents.contexts.length} |
| Tables déduites du code | **${ents.count}** (${ents.entities.reduce((s, e) => s + e.columns.length, 0)} colonnes) ; ${gen.generated} entités TypeORM générées, ${gen.skipped.length} à traiter à la main |

## Par module (ordre décroissant d'effort estimé)

Effort = barème indicatif : 0,25 j par action courte, 0,5 j moyenne, 1 à 2 j longue, +0,5 j par procédure stockée à porter, +0,5 j pour fichiers. Il couvre le **contrôleur**, pas la logique des couches \`DalLayer\`/BL (voir le plan).

| Module | Contrôleurs | Actions | Lignes | Procédures | Dépend de la session | Fichiers | Effort (j) |
|---|---:|---:|---:|---:|---:|---:|---:|
${rows.map(([k, m]) => `| ${k} | ${m.ctrl.size} | ${m.n} | ${m.loc} | ${m.sp.size} | ${m.session} | ${m.file} | ${m.days.toFixed(1)} |`).join('\n')}
| **Total** | ${new Set(api.map((e) => e.class)).size} | **${api.length}** | ${api.reduce((s, e) => s + e.loc, 0)} | ${sps.count} | | | **${totalDays.toFixed(0)}** |

## Procédures stockées les plus appelées

| Procédure | Appels | Modules |
|---|---:|---|
${topSp.map((p) => `| \`${p.name}\` | ${p.callCount} | ${p.modules.join(', ')} |`).join('\n')}

## Plus grosses tables (colonnes)

| Table | Modèle | Colonnes |
|---|---|---:|
${bigEnt.map((e) => `| \`${e.table}\` | ${e.model} | ${e.columns.length} |`).join('\n')}

## Entités non générées (à traiter à la main)

${gen.skipped.length ? gen.skipped.map((s) => `- \`${s.table}\` (${s.model}) : ${s.reason}`).join('\n') : 'Aucune.'}
`;
fs.mkdirSync(path.resolve(ROOT, '../docs/migration'), { recursive: true });
fs.writeFileSync(path.resolve(ROOT, '../docs/migration/INVENTORY.md'), md);
console.log(`docs/migration/INVENTORY.md écrit : ${api.length} actions d'API, effort contrôleurs ≈ ${totalDays.toFixed(0)} j`);

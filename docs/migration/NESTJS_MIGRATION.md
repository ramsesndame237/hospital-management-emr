# Migration vers NestJS + PostgreSQL + Angular moderne

Décisions prises avec le commanditaire (08/10/2026) : **migration complète, module par module** ; **PostgreSQL** ; **API d'abord, Angular ensuite** ; hébergement **VPS Contabo + Dokploy** (conteneurs Linux).

Chiffres d'appui : [INVENTORY.md](INVENTORY.md) (généré). Code : `backend/` (NestJS). Branche : `feature/nestjs-migration`.

## 1. Pourquoi c'est un grand chantier

| Élément | Volume |
|---|---|
| Actions d'API à migrer | ≈ 1 725 (132 contrôleurs) |
| Code C# total | ≈ 226 000 lignes, dont seulement ≈ 26 000 dans les contrôleurs : **l'essentiel de la logique est dans les couches `DalLayer`/BL et les modèles** |
| Tables | ≈ 450 déduites du code (la base réelle en contient davantage, certaines ne sont lues que par des procédures) |
| Procédures stockées | **483** distinctes, dont le corps T‑SQL n'est pas dans le dépôt |
| Front Angular | Angular 7.1 / TypeScript 3.1, 1 159 composants |
| Dépendance forte à la session serveur | 29 % des actions (`HttpContext.Session`, `RbacUser`) |

Ordre de grandeur honnête : le seul portage des contrôleurs est estimé à ≈ 665 jours‑personne avec le barème de `INVENTORY.md`, sans compter les procédures stockées à réécrire, la migration des données, l'Angular et la recette. À une personne, c'est **plusieurs années** ; la livraison doit donc être **incrémentale** (voir §3), pas « tout puis rien ».

## 2. Architecture cible

```
Angular (statique, nginx)  ──HTTP JSON, mêmes routes ("api/<Contrôleur>/<action>")──►  API NestJS  ──►  PostgreSQL
        │                                                                                │
        └── JWT Bearer (déjà utilisé par l'Angular actuel) ─────────────────────────────┘
```

- **Contrat d'API préservé** : mêmes routes, mêmes verbes, mêmes noms de champs (PascalCase), même enveloppe `{ Status, Results, ErrorMessage }` et même particularité (erreur métier = HTTP 200 + `Status: 'Failed'`). L'Angular 7 actuel doit fonctionner **sans modification** sur NestJS. Cela permet de migrer le backend sans toucher au front, puis le front sans toucher au backend.
- **Authentification** : l'Angular envoie déjà `Authorization: Bearer <jwt>` (`token-interceptor.service.ts`). NestJS émet et valide ce JWT (`@nestjs/jwt`). Les 496 actions qui lisaient la session serveur lisent désormais l'utilisateur dans le JWT (`@CurrentUser()`), sans état côté serveur.
- **ORM** : TypeORM, entités **générées** depuis les modèles C# (`backend/tools/generate-entities.mjs`). Propriétés TypeScript en PascalCase (JSON identique), colonnes PostgreSQL en snake_case.
- **Formats** : `timestamp` renvoyé en texte sans « Z » (`2026-10-07T08:30:00`), `interval` en `HH:MM:SS`, `bigint`/`numeric` en nombres (`src/database/pg-types.ts`, `transformers.ts`) : sinon l'Angular décalerait les heures ou recevrait des chaînes.
- **Déploiement** : `backend/Dockerfile` + `docker-compose.yml` (API + PostgreSQL 17), prêt pour Dokploy.

## 3. Stratégie : étrangler l'ancien backend, module par module

1. **Socle** (fait, phase 0) : projet NestJS, enveloppe, filtre d'erreurs, configuration validée, santé, entités et schéma générés, tests.
2. **Socle fonctionnel (phase 1)** : `security` (connexion, JWT, permissions, routes valides), `core` (paramètres, lookups, masters), utilisateur courant. Sans cela aucun écran ne s'affiche (l'Angular les appelle au démarrage : voir `app.component.ts`).
3. **Tranches verticales** par module, dans cet ordre (dépendances croissantes) : Patient → Appointment → Billing → Lab → Pharmacy/Dispensary → Inventory/WardSupply → ADT/Admission → Settings → Reporting → le reste.
4. **Définition de « terminé » pour un module** : (a) toutes ses actions d'API existent avec la même route/verbe/forme de réponse ; (b) tests de **parité** verts (voir §4) ; (c) procédures stockées du module portées ou explicitement conservées ; (d) aucune lecture de session serveur ; (e) documenté dans `INVENTORY.md` (case cochée).
5. **Basculement progressif** : un proxy (nginx/Dokploy) route chaque préfixe `api/<X>` vers NestJS dès que le module est terminé et vers l'ancien .NET sinon ; la bascule est réversible module par module. (Utile seulement tant que le .NET tourne quelque part ; sans accès à un Windows, on migre jusqu'à la parité d'un lot cohérent avant de déployer.)

### Modules de la première livraison démontrable

Le film montre : connexion, tableau de bord, rendez-vous, facturation, laboratoire, pharmacie. Les endpoints de ces écrans (≈ 40, voir `video/mock-api/server.js`) forment la **première livraison déployable** : c'est le critère pour sortir du .NET pour la démo, avant la migration complète.

## 4. Preuve de parité (comment savoir qu'un endpoint migré est juste)

- **Tests de contrat** : pour chaque action migrée, un test envoie la requête à NestJS et compare la réponse à un **enregistrement de référence** pris sur le .NET d'origine (même base de test). Le diff ignore les champs volatils (horodatages, identifiants générés).
- **Schémas** : comparer le schéma PostgreSQL généré au schéma réel SQL Server restauré (colonnes, types, nullabilité) ; tout écart est un défaut du générateur ou du code C#.
- **Données** : après migration des données, comparer les comptages et des sommes de contrôle par table.
- Les **tests existants** de ce dépôt (`backend/test`) couvrent déjà l'enveloppe, la configuration et la validité du schéma sur un vrai moteur PostgreSQL (PGlite).

## 5. Procédures stockées (483)

Le corps T‑SQL n'est **pas** dans le dépôt : il est dans la sauvegarde `Dev_DanpheEMR_INT1.bak`. Il faut donc d'abord le **scripter** depuis SQL Server (voir §7). Ensuite, pour chaque procédure, trois options (choisies au cas par cas, consigner le choix dans l'inventaire) :

| Option | Quand | Coût |
|---|---|---|
| Fonction/vue PL/pgSQL équivalente | requête de lecture/rapport lourde, peu de logique | faible à moyen (traduction T‑SQL → PL/pgSQL) |
| Service TypeScript (QueryBuilder/SQL) | logique métier, transactions, calculs | moyen |
| Abandon | procédure morte (appelée nulle part) | nul |

Les plus appelées et les modules les plus chargés en procédures (Reporting, Patient, Billing) seront portés en premier ; la liste, avec sites d'appel et paramètres, est dans `backend/migration/inventory/stored-procedures.json`.

## 6. Angular (phase 2, après stabilisation de l'API)

- Le front reste en Angular 7 pendant la phase API (il fonctionne déjà avec contournements sous Node 24).
- Montée de version **par paliers** avec `ng update` (7 → 8 → … → version courante), un palier = un build vert + les écrans du film rendus à l'identique. Tests de non‑régression visuelle avec les captures de `video/`.
- Les vues Razor (`Login`, `ChangePassword`, `LicenseExpired`, shell `Home/Index`) sont **réécrites en Angular** (179 actions « vue » à retirer du périmètre API) ; la connexion appelle `POST api/Account/Login` côté NestJS.
- Internationalisation (ngx-translate/i18n, français) : à faire pendant la montée de version, pas avant.

## 7. Blocages et décisions en attente

| # | Blocage | Qui | Effet |
|---|---|---|---|
| 1 | **FILESTREAM désactivé** sur SQL Server local (niveau 0) : la sauvegarde ne se restaure pas | commanditaire (droits administrateur) | sans restauration : pas de corps des 483 procédures, pas de schéma réel, pas de données de démonstration réelles |
| 2 | Données des colonnes FILESTREAM (documents/images) : où les stocker dans PostgreSQL/Linux ? | décision | proposition : stockage objet (MinIO/S3) ou disque + table de métadonnées |
| 3 | Environnement de recette .NET pour enregistrer les réponses de référence (§4) | commanditaire | sans lui, la parité se prouve seulement sur le code lu (moins fiable) |
| 4 | Capacité : ≈ 665 j de contrôleurs + procédures + Angular | commanditaire | à planifier (équipe, calendrier, lots) |

Procédure FILESTREAM (rappel) : *SQL Server Configuration Manager* → services SQL Server → instance `SQLEXPRESS` → onglet *FILESTREAM* → cocher « Activer FILESTREAM pour l'accès Transact‑SQL », puis redémarrer le service et exécuter `EXEC sp_configure 'filestream access level', 2; RECONFIGURE;`.

## 8. Comment relancer l'inventaire

```bash
cd backend
npm install
npm run inventory     # endpoints, procédures, entités, schéma PostgreSQL, rapport
npm test              # enveloppe, configuration, validité du schéma
npm run build
```

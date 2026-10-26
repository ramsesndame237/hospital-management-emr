# Sanjeevani API (NestJS)

Remplaçant progressif du backend ASP.NET Core / .NET Framework 4.6.1 (Windows uniquement). Plan, décisions et blocages : [`docs/migration/NESTJS_MIGRATION.md`](../docs/migration/NESTJS_MIGRATION.md). Chiffres par module : [`docs/migration/INVENTORY.md`](../docs/migration/INVENTORY.md).

## État (phase 0 : socle)

- Enveloppe de réponse `{ Status, Results, ErrorMessage }` identique à .NET (`src/common`), configuration validée, sonde `GET /api/Health`.
- 447 entités TypeORM et le schéma PostgreSQL **générés** depuis les modèles C# (`tools/`).
- Inventaire automatique : 1 725 actions d'API, 483 procédures stockées, 451 tables.
- **Module 1 — Identité & accès (`/api/v1`)** : authentification (Argon2id, MFA TOTP, sessions rotatives), rôles/permissions, journal d'audit chaîné, cache et sessions Redis. Architecture, API, exploitation : [`docs/migration/IAM_FILES_MODULE.md`](../docs/migration/IAM_FILES_MODULE.md). Premier administrateur : `npm run iam:bootstrap-admin`.
- Les autres modules métier (compatibilité `api/<Contrôleur>/<action>`) restent à migrer.

## Essayer sans rien installer

```bash
npm run playground      # API complète en mémoire + compte de démonstration par profil
# puis http://localhost:3100/api-docs   (connexion : system_admin + code de /dev/totp, ou cashier)
```

## Démarrer

```bash
npm install
cp .env.example .env     # puis renseigner DB_PASSWORD et JWT_SECRET
npm run build
npm test                 # enveloppe, configuration, schéma validé sur un vrai PostgreSQL embarqué (PGlite)
npm run start:dev        # nécessite PostgreSQL ; DB_ENABLED=false pour démarrer sans base
docker compose up --build
```

## Régénérer l'inventaire et les entités

```bash
npm run inventory   # lit ../Code (C#) -> migration/inventory/*.json, src/database/entities/, migration/schema/schema.pg.sql, docs
```

Les fichiers `src/database/entities/*.entities.ts` et `migration/schema/schema.pg.sql` sont **générés** : on corrige l'outil ou le code C# source, pas le résultat.

## Conventions

- Modules historiques : mêmes routes que .NET (`api/<Contrôleur>/<action>`), pas de préfixe global. Nouveaux modules (IAM, fichiers) : `/api/v1`, le .NET n'est pas une référence.
- Temps : `Temporal` (`src/shared-kernel/temporal.ts`), pas `Date`.
- Propriétés des entités en PascalCase (JSON identique), colonnes PostgreSQL en snake_case.
- Un contrôleur dont les réponses doivent être enveloppées porte `@DanpheApi()`.
- Pas de secret dans le dépôt : tout passe par les variables d'environnement (`.env.example`).

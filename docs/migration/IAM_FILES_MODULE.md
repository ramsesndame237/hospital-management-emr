# Module 1 — Identité & accès (IAM) + Fichiers

Branche : `feature/iam-files-module`. Décisions du commanditaire : API propre `/api/v1`, nouvelle app Angular moderne (`frontend/`) avec ng-shadcn, profils hospitaliers standards, MFA TOTP, stockage objet **RustFS** (compatible S3), cache **Redis**.

## 0. Source de vérité

**Le backend .NET n'est pas la référence.** Ses choix (mots de passe réversibles en 3DES, sessions serveur, erreur métier en HTTP 200…) ne sont ni repris ni imités. Ce module se conforme aux référentiels du §2. Le code C# n'est lu que pour une chose : **reconnaître les anciens mots de passe** afin de convertir les comptes existants (§7). Le contrat d'API « historique » (`api/<Contrôleur>/<action>`, enveloppe `Status/Results`) ne s'applique pas ici : ce module expose `/api/v1`.

**Temps** : toute l'application utilise `Temporal` (`Instant`, `Duration`), jamais `Date`, sauf à la frontière du pilote `pg` (`database/temporal-mapping.ts`). `shared-kernel/temporal.ts` prend le `Temporal` natif s'il existe (Node récent), sinon le polyfill `temporal-polyfill` : Node 24.22 (V8 13.6) ne l'expose pas encore sans l'option `--harmony-temporal`.

## 1. Périmètre

| Sous-module | Contenu |
|---|---|
| `iam` | Comptes, connexion, MFA TOTP, sessions (access + refresh rotatif), rôles/permissions, verrouillage, changement/réinitialisation de mot de passe |
| `files` | Dossiers, fichiers, images ; classification de sensibilité ; accès par permission + ACL ; URL pré-signées courtes |
| `audit` | Journal d'audit append-only chaîné par hachage (qui, quoi, quand, d'où, résultat) |
| `cache` | Port `CachePort` + adaptateur Redis ; règles strictes pour les données de santé |
| `shared-kernel` | `Result`, erreurs de domaine, base `ValueObject`/`AggregateRoot`, ports transverses (`Clock`, `IdGenerator`) |

Hors périmètre ici : portail patient complet, SSO/SAML, signature électronique, DICOM.

## 2. Référentiels de protection appliqués (on ne réinvente pas)

Ce module est **aligné sur** ces référentiels ; l'alignement n'est pas une certification, qui relève de l'exploitant (audit, politique, hébergement).

| Exigence | Référentiel | Mise en œuvre |
|---|---|---|
| Contrôle d'accès, moindre privilège, séparation des tâches | HIPAA §164.312(a), ISO 27001 A.5.15/A.8.3, RGPD art. 32 | RBAC par permissions fines + portée (`own`/`department`/`all`) ; l'admin système **n'a pas** accès aux données cliniques |
| Authentification | NIST SP 800-63B, OWASP ASVS V2 | Argon2id, longueur ≥ 12 sans règle de composition, refus des mots de passe courants/compromis et dérivés du nom, MFA TOTP obligatoire pour les profils cliniques et admin, verrouillage progressif, limitation de débit |
| Gestion de session | OWASP ASVS V3 | Access JWT court (15 min), refresh opaque rotatif à usage unique avec détection de rejeu (révocation de la famille), cookies `httpOnly` + `Secure` + `SameSite=Strict`, révocation côté serveur (Redis) |
| Journal d'audit | HIPAA §164.312(b), RGPD art. 30/33 | Toute lecture/écriture de donnée sensible journalisée, immuable, chaînée par hachage, sans donnée de santé dans les logs |
| Intégrité | HIPAA §164.312(c) | Empreinte SHA-256 de chaque fichier vérifiée à l'écriture et au téléchargement |
| Confidentialité au repos / en transit | RGPD art. 32, HIPAA §164.312(e) | TLS obligatoire en production, chiffrement serveur du stockage objet (SSE), colonnes sensibles (secret TOTP) chiffrées AES-256-GCM |
| Minimisation, limitation de conservation | RGPD art. 5 | TTL de cache courts, pas de PHI dans le cache sans clé scopée utilisateur, suppression logique puis purge planifiée |
| Résilience des accès d'urgence | pratique hospitalière | Accès « bris de glace » : permission dédiée, motif obligatoire, alerte et journal renforcé |
| Vulnérabilités applicatives | OWASP Top 10 / ASVS | validation stricte des entrées (DTO), en-têtes `helmet`, CORS restreint, requêtes paramétrées, pas de secret dans le dépôt |

## 3. Architecture (Clean Architecture, ports & adapters)

Règle de dépendance : **`domain` ← `application` ← `infrastructure`/`presentation`**. Le domaine et l'application n'importent ni NestJS, ni TypeORM, ni Redis, ni AWS SDK, ni argon2.

```
src/
  shared-kernel/           Result, DomainError, ValueObject, AggregateRoot, ports Clock/IdGenerator
  modules/
    iam/
      domain/              value-objects/, entities (User, Role, Session), events, ports (UserRepository, PasswordHasher, TokenIssuer, TotpService, SessionStore…)
      application/         use-cases/ (Login, RefreshSession, Logout, EnrollMfa, VerifyMfa, ChangePassword, CreateUser…)
      infrastructure/      adapters: Argon2PasswordHasher, JwtTokenIssuer, OtplibTotpService, TypeOrm*Repository, RedisSessionStore
      presentation/        controllers, guards, décorateurs, DTO
    files/ …               même découpage ; port ObjectStorage → adaptateur S3 (RustFS)
    audit/ cache/ …
```

Conséquences concrètes :

- **Aucune bibliothèque n'« envahit » le métier** : on peut remplacer RustFS par MinIO/S3/Azure Blob (un seul adaptateur), Redis par un autre cache, Argon2 par autre chose, TypeORM par Prisma, sans toucher au domaine ni aux cas d'usage. Les tests du domaine et des cas d'usage tournent avec des fakes en mémoire, sans réseau.
- **Value Objects immuables** qui valident à la construction : un état incohérent est **impossible à représenter** (`Email`, `Username`, `PlainPassword`, `PasswordHash`, `RoleCode`, `Permission`, `TotpCode`, `FileName`, `MimeType`, `FileSize`, `Checksum`, `StorageKey`, `Sensitivity`, `FolderPath`…). Les entités n'exposent pas de setters : seulement des comportements (`user.lockFor(...)`, `file.moveTo(folder)`).
- **Result<T, E>** au lieu d'exceptions pour les erreurs attendues ; les contrôleurs traduisent en codes HTTP (401/403/404/409/422/429).
- **Modèles de persistance séparés** des entités de domaine (mappers) ; les entités TypeORM générées pour la migration (`database/entities`) ne sont pas modifiées. Nouvelles tables préfixées `iam_`, `files_`, `audit_`, avec `legacy_rbac_user_id` pour relier les anciens comptes.
- Patterns : Repository, Strategy (politique de mot de passe, classification), Factory (création d'agrégats), Adapter (stockage/cache), Decorator (cache en lecture), Specification (règles d'accès aux fichiers), Domain Events (audit).

## 4. Profils et permissions

Permissions = `ressource:action[:portée]`. Les rôles sont des **données** (table `iam_roles`), pas du code : un établissement peut en créer d'autres. Rôles fournis par défaut :

| Rôle | MFA | Accès principaux |
|---|---|---|
| `SYSTEM_ADMIN` | oui | gestion des comptes/rôles, paramétrage ; **aucun** accès aux dossiers cliniques |
| `DOCTOR` | oui | fichiers cliniques de ses patients, prescriptions, imagerie |
| `NURSE` | oui | fichiers cliniques du service, saisie de soins |
| `PHARMACIST` | oui | ordonnances, dispensation, stock |
| `LAB_TECHNICIAN` | oui | résultats de laboratoire (dépôt/lecture) |
| `RADIOLOGIST` | oui | imagerie, comptes rendus |
| `CASHIER` | non | facturation, encaissements ; pièces administratives uniquement |
| `RECEPTIONIST` | non | admission, rendez-vous ; pièces d'identité administratives |
| `ACCOUNTANT` | non | comptabilité, pièces comptables |
| `DPO_AUDITOR` | oui | lecture du journal d'audit, demandes RGPD ; pas d'écriture clinique |
| `PATIENT` | recommandé | ses propres documents uniquement (`own`) |

Sensibilité des fichiers : `PUBLIC` < `INTERNAL` < `CONFIDENTIAL` < `CLINICAL` (donnée de santé). Un fichier `CLINICAL` exige la permission `files.clinical:read` **et** une relation de soin (patient rattaché au service/médecin) ou le bris de glace.

## 5. Fichiers : RustFS

- Un seul bucket **privé** (`sanjeevani-files`) ; jamais d'URL publique. Les clés d'objet sont opaques (`{tenant}/{yyyy}/{uuid}`), le nom d'origine n'existe qu'en base.
- Envoi : validation côté serveur du type réel par **magic bytes** (pas seulement l'extension/`Content-Type`), liste blanche de types, taille maximale par type, nettoyage du nom, empreinte SHA-256, hook d'analyse antivirus (port `MalwareScanner`, ClamAV en option).
- Lecture : contrôle d'accès dans l'API, puis **URL pré-signée de 60 s** ou flux proxifié pour les `CLINICAL`.
- Suppression : logique (corbeille), purge planifiée ; versionnage du bucket activé.
- Dossiers : arbre (`FolderPath` value object, profondeur et caractères bornés, anti `..`), ACL héritée.

## 6. Cache Redis

- `CachePort { get, set(ttl), delete, deleteByTag }` ; cache **en lecture** via décorateur de repository.
- Clés : `v1:{contexte}:{entité}:{id}` ; données de santé : clé incluant l'identité de l'appelant, TTL ≤ 60 s, invalidation par tag à l'écriture ; **aucune** donnée de santé en cache partagé inter-utilisateurs.
- Redis sert aussi : sessions/refresh tokens, limitation de débit, verrouillage. Panne Redis ⇒ le cache se dégrade (on lit la base), mais l'authentification **refuse** (échec fermé).
- Redis protégé par mot de passe, réseau privé, sans port exposé en production.

## 7. Migration des comptes existants

Les mots de passe .NET sont chiffrés en 3DES‑ECB avec sel statique (`DanpheRBAC.EncryptPassword`) : **réversibles**, donc inacceptables. À la première connexion réussie d'un compte hérité, on vérifie avec l'ancien schéma (clé fournie par variable d'environnement, jamais commitée), puis on stocke un hash Argon2id et on efface l'ancien. Le compte est marqué `must_change_password`. Recommandation : forcer la rotation de tous les mots de passe à la bascule.

## 8. Frontend (`frontend/`)

Angular récent (standalone, signals), Tailwind, **ng-shadcn**. Écrans : connexion, MFA, changement de mot de passe, gestion des utilisateurs/rôles, explorateur de fichiers (dossiers, aperçu images, envoi, déplacement, corbeille), journal d'audit. Garde de routes et directive `*hasPermission` pilotées par les permissions renvoyées par `/api/v1/auth/me`. Jeton d'accès en mémoire, refresh en cookie `httpOnly`.

## 9. Plan de livraison

1. Shared kernel + value objects + tests (domaine pur)
2. IAM : domaine → cas d'usage → adaptateurs → API ; tests unitaires + intégration
3. Audit + cache + Redis
4. Files + RustFS (docker-compose)
5. Frontend Angular + ng-shadcn
6. Durcissement : en-têtes, limitation de débit, revue de sécurité, documentation d'exploitation

## 10. État d'avancement

| Lot | État |
|---|---|
| Noyau, value objects, agrégat `User`, cas d'usage IAM | fait |
| Adaptateurs : Argon2id, 3DES hérité (lecture), TOTP, AES‑256‑GCM, JWT, HIBP, PostgreSQL, Redis (sessions, cache), journal d'audit chaîné | fait |
| API `/api/v1` (auth, MFA, comptes, rôles), gardes globaux, limitation de débit, `helmet`, cookies | fait |
| Docker (PostgreSQL + Redis + API), migrations SQL au démarrage, amorçage du premier administrateur | fait, **vérifié sur une pile réelle** |
| Fichiers + RustFS | à faire |
| Frontend Angular + ng‑shadcn | à faire |

Tests : `npm test` — 158 tests, dont 33 de bout en bout (HTTP réel, PostgreSQL embarqué, Argon2id réel).

## 11. API `/api/v1`

| Route | Accès | Rôle |
|---|---|---|
| `POST /auth/login` | public, 10/min/IP | identifiant + mot de passe (+ `totpCode` ou `recoveryCode`). Réponse : `authenticated` (jeton d'accès, portée `full` ou `setup`) ou `mfa_required` |
| `POST /auth/refresh` | public (cookie), 10/min/IP | rotation du cookie de rafraîchissement ; recalcule la portée |
| `POST /auth/logout` | public (cookie) | révoque la famille de sessions |
| `GET /auth/me` | `setup` autorisé | profil, rôles, permissions (pilote l'interface) |
| `POST /auth/password/change` | `setup` autorisé | change le mot de passe, révoque toutes les sessions |
| `POST /auth/mfa/enroll`, `/auth/mfa/activate` | `setup` autorisé | inscription TOTP, remise unique de 10 codes de secours |
| `GET/POST /users`, `PUT /users/:id/roles`, `POST /users/:id/{enable,disable,unlock,reset-mfa}` | `iam.users:read` / `iam.users:manage` | administration ; interdit sur soi‑même (rôles, désactivation) |
| `GET /roles` | `iam.roles:read` | rôles et permissions |

Erreurs : `{ statusCode, code, message }` — 401 identifiants/session, 403 permission ou `SETUP_REQUIRED`, 404, 409 doublon, 422 saisie invalide (politique de mot de passe…), 429 débit.

## 12. Exploitation

```bash
# 1. secrets (jamais dans le dépôt)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # SECRET_ENCRYPTION_KEY
# 2. démarrer : le schéma IAM est appliqué (idempotent) à chaque démarrage de l'API
docker compose up -d --build
# 3. créer le premier administrateur (refuse s'il existe déjà un compte)
docker compose exec -e BOOTSTRAP_ADMIN_EMAIL=dsi@hopital.example api node dist/cli/bootstrap-admin.js
```

L'administrateur doit, à sa première connexion, changer son mot de passe puis inscrire la MFA (jeton `setup` tant que ce n'est pas fait). Variables : voir `backend/.env.example`. En production l'API refuse de démarrer sans `REDIS_URL`, `SECRET_ENCRYPTION_KEY`, `JWT_SECRET` ≥ 32 caractères, ni avec `COOKIE_SECURE=false`.

**Reprise des comptes .NET** : renseigner `LEGACY_PASSWORD_SALT` (sel du code historique) ; sans lui les comptes hérités ne peuvent pas se connecter. L'import des lignes `rbac_user` vers `iam_users` (colonne `legacy_rbac_user_id`, hash au format `legacy-3des$<base64>`) reste à écrire ; **valider d'abord la lecture 3DES sur un vrai mot de passe issu de la base .NET**, le test actuel ne fait que vérifier la cohérence interne.

## 13. Reste à durcir (hors lot actuel)

- **Rejeu d'un code TOTP** dans sa fenêtre de 30 s : à interdire (mémoriser le dernier pas accepté par compte).
- **Limitation de débit partagée** : le compteur actuel est en mémoire ; avec plusieurs instances de l'API, passer à un stockage Redis.
- **Mot de passe oublié** par e‑mail (jeton à usage unique) : aujourd'hui seul un administrateur peut réinitialiser (`reset-mfa`, recréation).
- **Rotation de la clé** `SECRET_ENCRYPTION_KEY` : le format `v1.` prépare la migration, l'outil reste à faire.
- **Consultation du journal d'audit** (`audit:read`) et export pour le DPO ; purge/archivage selon la durée de conservation légale.
- Sauvegarde et surveillance de `audit_log` (vérification périodique de `verifyChain`).

## 14. Internationalisation (module `i18n`)

Objectif : changer de bibliothèque d'i18n sans réécrire l'application. `@nestjs/i18n` n'est importé que dans `modules/i18n/infrastructure/nestjs-i18n/`.

| Patron | Où | Rôle |
|---|---|---|
| Port / Adaptateur | `domain/ports.ts` → `NestI18nTranslator`, `JsonCatalogTranslator` | `Translator.translate(clé, langue, paramètres) → string \| null` ; deux adaptateurs interchangeables (choix : `I18N_ADAPTER`) |
| Stratégie + chaîne de responsabilité | `application/locale-strategies.ts`, `LocaleResolver` | langue = `?lang=` > `X-Locale` > `Accept-Language` (poids RFC 9110) > défaut ; ajouter une source = une classe |
| Décorateur | `FallbackTranslator` | repli « langue demandée → langue par défaut », identique pour tous les adaptateurs |
| Façade | `Localizer` | `text`, `error(code)`, `field(nom)` ; ne lève jamais d'erreur |
| Valeur-objet | `Locale` | BCP 47 normalisé (`fr_cm` → `fr-CM`) |
| Contexte de requête | `AsyncLocalStorageLocaleContext` | langue disponible dans toutes les couches sans paramètre |

**Les couches métier ne portent que des codes d'erreur** (`INVALID_CREDENTIALS`) et des paramètres ; c'est le filtre `LocalizedExceptionFilter`, à la frontière HTTP, qui les transforme en phrase (`errors.<CODE>` dans `catalogs/<langue>/errors.json`). La validation des entrées renvoie `{ statusCode: 400, code: 'VALIDATION_FAILED', errors: [{ field, rule, message }] }` avec le libellé du champ traduit. Le `code` ne change jamais avec la langue : les clients s'appuient dessus.

Garde-fous : le test de **contrat** exécute les mêmes vérifications sur les deux adaptateurs (il a révélé que `@nestjs/i18n` sert silencieusement la langue par défaut pour une langue non supportée, ce que l'adaptateur absorbe désormais) ; le test des **catalogues** impose mêmes clés et mêmes paramètres dans toutes les langues, et fait échouer le build si un code d'erreur du code n'a pas de traduction.

Ajouter une langue : créer `catalogs/<langue>/*.json`, l'ajouter à `I18N_LOCALES`. Ajouter un message : une clé dans chaque langue (le test le rappelle).

## 15. Documentation de l'API (module `api-docs`)

Même principe : `@nestjs/swagger` n'est importé que dans `modules/api-docs/infrastructure/swagger/`. Les contrôleurs et les DTO importent la **façade** `modules/api-docs` (`@DocGroup`, `@DocOperation`, `@DocProperty`…).

- **Une seule source de vérité** : `@RequirePermissions('iam.users:manage')` contrôle l'accès *et* ajoute « Permissions requises » à la documentation ; elles ne peuvent pas diverger.
- Chaque opération a un résumé, des réponses typées, les erreurs possibles (schéma `ErrorBodyDto`) et des exemples pré-remplis dans « Try it out ». Un test impose qu'**aucun endpoint de `/api/v1` ne soit non documenté**.
- **Accès** : `GET /api-docs` affiche une **page d'accueil de connexion** (FR/EN, thème clair/sombre, MFA, mobile). Tout le reste sous `/api-docs/` (document JSON/YAML, scripts de l'interface) répond 401 sans session : le document décrit tout l'inventaire de l'API, il ne doit pas être public.
- La connexion échange le jeton d'accès contre un cookie `httpOnly`, `SameSite=Strict`, limité à `/api-docs`, **revérifié à chaque requête** : compte désactivé ou permission retirée = accès fermé immédiatement. Il faut un compte en session complète avec la permission **`api.docs:read`** (donnée par défaut au seul `SYSTEM_ADMIN` ; les rôles étant des données, un établissement peut l'ajouter à d'autres).
- Dans Swagger, le jeton est **pré-rempli** dans *Authorize* (et renouvelé), rien n'est stocké dans le navigateur ; une barre « utilisateur · Se déconnecter » est ajoutée.
- `API_DOCS_ENABLED` : vrai hors production, **faux par défaut en production** (Docker). Sans système d'identité (base désactivée), la documentation n'est pas publiée (échec fermé).
- `npm run playground` : démarre l'API complète en mémoire (aucun PostgreSQL ni Redis) avec un compte par profil, sur http://localhost:3100/api-docs. **Bac à sable uniquement.**

## 16. Garde-fous d'architecture

`test/architecture.spec.ts` fait respecter mécaniquement :

1. `domain/`, `application/`, `shared-kernel/` n'importent aucun framework ni bibliothèque d'infrastructure ;
2. le domaine ne dépend jamais de l'infrastructure ni de la présentation ;
3. chaque bibliothèque (Swagger, i18n, argon2, otplib, ioredis, jwt, pg, typeorm, temporal-polyfill) n'est importée que par son adaptateur ;
4. les modules ne se connaissent pas (`iam` → `audit`, `cache`, façade `api-docs` ; `i18n` et `api-docs` → rien) ; seule la racine de composition `src/integration/` les relie.

Une règle qui ne vise rien est elle-même testée (« chaque bibliothèque confinée est bien utilisée par son adaptateur »).

**Piège connu** : sous `NestFactory`, `app.get()` sur un fournisseur absent arrête le processus au lieu de lever une erreur rattrapable ; `Test.createTestingModule` ne le reproduit pas. D'où des fournisseurs toujours enregistrés (valeur `null`) et un test qui démarre par `NestFactory`.


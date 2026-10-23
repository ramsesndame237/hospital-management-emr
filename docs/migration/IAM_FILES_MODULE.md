# Module 1 — Identité & accès (IAM) + Fichiers

Branche : `feature/iam-files-module`. Décisions du commanditaire : API propre `/api/v1`, nouvelle app Angular moderne (`frontend/`) avec ng-shadcn, profils hospitaliers standards, MFA TOTP, stockage objet **RustFS** (compatible S3), cache **Redis**.

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

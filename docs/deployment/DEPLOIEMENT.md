# Installer Sanjeevani EMR

Ce guide installe l'application complète (base de données, API, interface web) sur **un serveur Linux avec Docker**. Compter une demi-heure.

## 1. Ce qu'il faut

| Élément | Minimum conseillé |
|---|---|
| Serveur | Linux 64 bits, 2 cœurs, 4 Go de mémoire, 40 Go de disque (la base grossit avec l'activité) |
| Logiciels | Docker Engine 24+ avec le plugin Compose v2 (`docker compose version`) |
| Réseau | Un nom de domaine (ex. `emr.hopital.example`) et un certificat TLS : l'application ne doit jamais être servie en HTTP clair en dehors d'un essai local |
| Poste de l'administrateur | Une application d'authentification (Google Authenticator, FreeOTP, Aegis…) : le compte administrateur exige la double authentification |

## 2. Récupérer le code et configurer

```bash
git clone <adresse du dépôt> sanjeevani && cd sanjeevani
cp .env.example .env
```

Éditer `.env` et remplacer chaque `change-me` :

| Variable | Rôle | Comment la produire |
|---|---|---|
| `DB_PASSWORD`, `REDIS_PASSWORD` | Mots de passe internes (jamais exposés hors du réseau Docker) | `openssl rand -base64 24` |
| `JWT_SECRET` | Signature des jetons (32 caractères minimum) | `openssl rand -base64 48` |
| `SECRET_ENCRYPTION_KEY` | Chiffre les secrets de double authentification | `openssl rand -base64 32` |
| `TIME_ZONE` | Fuseau de l'établissement : il décide du « jour » (agenda, caisse, affectations) | nom IANA, ex. `Africa/Douala` |
| `BILLING_CURRENCY` | Devise de facturation, en plus petite unité entière | ex. `XAF` |
| `COOKIE_SECURE` | `true` en production (HTTPS) | laisser `true` |

> ⚠️ **Sauvegarder `SECRET_ENCRYPTION_KEY` en lieu sûr, à part de la base.** Sans elle, les comptes protégés par la double authentification ne pourront plus se connecter après une restauration.

`BREACH_CHECK_ENABLED=true` interroge un service public (k-anonymité : 5 caractères d'un hachage sont envoyés) ; mettre `false` pour un site sans accès Internet.

## 3. Démarrer

```bash
docker compose up -d --build
docker compose ps          # db, redis, api et web doivent être « healthy »
```

Au premier démarrage, l'API crée tout le schéma de la base. Chaque démarrage suivant le rejoue sans risque : **c'est ainsi que les mises à jour mettent la base à niveau** (voir § 6).

## 4. Créer le premier administrateur

À faire **une seule fois** (la commande refuse s'il existe déjà un compte) :

```bash
docker compose run --rm -e BOOTSTRAP_ADMIN_EMAIL=dsi@hopital.example api node dist/cli/bootstrap-admin.js
```

Elle affiche un **mot de passe temporaire, une seule fois**. À la première connexion (`admin`), l'interface demande de le changer, puis d'inscrire l'application d'authentification (scanner le QR code) et de noter les **codes de récupération** (à imprimer et ranger : ils servent si le téléphone est perdu).

Ensuite, depuis l'interface : **Organisation → Sites → Structure** (services, unités, lits), puis **Utilisateurs** (un compte par personne, avec son rôle).

> ⚠️ **Limite actuelle :** il n'existe pas encore d'écran pour le **personnel** (fiches, affectations aux services, lien compte ↔ fiche). C'est pourtant ce lien qui limite un médecin ou un infirmier aux patients de son service : tant qu'il n'est pas fait, ces comptes ne voient aucun patient. Pour l'instant il se fait par l'API (documentation interactive `/api-docs`, avec `API_DOCS_ENABLED=true`, section « Personnel » et « Affectations »). Écran prévu au prochain lot.

## 5. Vérifier l'installation

```bash
cd backend && npm ci
BASE_URL=http://localhost:8080 SMOKE_ADMIN_TEMP_PASSWORD='<mot de passe temporaire>' node tools/smoke.mjs
```

Le test de fumée refait la première connexion et vérifie que chaque module répond (patients, facturation, laboratoire, imagerie, pharmacie, audit) et que le journal d'audit est intact. Il s'exécute **sur une base neuve** (il consomme l'amorçage) : à utiliser pour valider un serveur avant d'y saisir de vraies données. Une exécution réussie affiche `Installation opérationnelle.`

## 6. Mettre à jour

```bash
git pull
docker compose up -d --build
```

L'API redémarre et rejoue les scripts de schéma (idempotents, verrouillés pour qu'une seule instance migre à la fois). Les données sont conservées (volume `pgdata`). **Sauvegarder avant chaque mise à jour.**

## 7. Servir en HTTPS

L'interface écoute sur `WEB_PORT` (8080). Placer devant un reverse proxy qui termine le TLS et relaie vers ce port (Caddy, Traefik, nginx, Dokploy…). Exigences :

- transmettre `X-Forwarded-For` et `X-Forwarded-Proto` (l'adresse réelle des postes sert à la limitation de débit et au journal d'audit) ;
- redirection HTTP → HTTPS et en-tête `Strict-Transport-Security` (à ajouter au niveau du proxy, qui connaît le domaine) ;
- ne pas publier les ports de la base (5432) ni de Redis (6379) : ils ne le sont pas dans ce `docker-compose.yml`.

Exemple Caddy (`/etc/caddy/Caddyfile`) :

```
emr.hopital.example {
  reverse_proxy localhost:8080
  header Strict-Transport-Security "max-age=31536000"
}
```

## 8. Dépannage rapide

| Symptôme | Piste |
|---|---|
| `docker compose up` refuse de démarrer : « … est obligatoire » | Une variable de `.env` manque (message explicite). |
| L'API redémarre en boucle | `docker compose logs api` : le plus souvent un secret trop court ou `COOKIE_SECURE=false` en production. |
| La page de connexion s'affiche mais la connexion échoue en HTTP | Normal : le cookie de session est `Secure`. Utiliser HTTPS (ou `http://localhost`). |
| Page sans style | Reconstruire l'interface : `docker compose build --no-cache web` (le build vérifie la présence des styles et échoue sinon). |
| Mot de passe oublié | **Il n'existe pas encore de réinitialisation de mot de passe** (ni par l'utilisateur, ni par un administrateur ; l'écran « Mot de passe oublié » renvoie vers l'administrateur, qui n'a pas d'action pour le faire). Action prévue au prochain lot. D'ici là, désactiver le compte et en créer un nouveau. |
| Téléphone perdu (double authentification) | Un administrateur : Utilisateurs → « Réinitialiser la double authentification » ; l'utilisateur s'inscrit de nouveau à la prochaine connexion. |

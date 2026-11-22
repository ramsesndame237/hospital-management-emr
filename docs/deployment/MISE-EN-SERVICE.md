# Mise en service de Sanjeevani EMR : check-list

À dérouler **dans l'ordre** pour passer d'un serveur vide à un pilote hospitalier. Les détails sont dans `DEPLOIEMENT.md` (installation) et `EXPLOITATION.md` (sauvegardes, journaux, HTTPS) ; les scénarios de validation sont dans `docs/recette/SCENARIOS.md`.

## 0. Décisions à prendre avant

- [ ] **Qui est le DSI** (administrateur système) ? C'est lui qui reçoit le premier compte et gère tous les autres.
- [ ] **Fuseau horaire** (`TIME_ZONE`) et **devise** (`BILLING_CURRENCY`) de l'établissement : ils décident du « jour » (agenda, caisse) et des montants.
- [ ] **Accès Internet du serveur** ? Oui → HTTPS automatique (Caddy). Non → proxy et certificat de l'établissement ; mettre `BREACH_CHECK_ENABLED=false`.
- [ ] **Où sont copiées les sauvegardes hors du serveur** (autre site, NAS, stockage objet) et **qui les surveille** ?
- [ ] **Qui détient `SECRET_ENCRYPTION_KEY`** en dehors du serveur (coffre) ?

## 1. Serveur et installation

- [ ] Serveur Linux (2 cœurs, 4 Go, 40 Go), Docker Engine 24+ avec Compose v2, **pare-feu** : seuls 22 (restreint), 80 et 443 ouverts.
- [ ] `.env` rempli : secrets longs et aléatoires (`openssl rand`), `COOKIE_SECURE=true`, `CORS_ORIGINS=https://votre-domaine`.
- [ ] **`SECRET_ENCRYPTION_KEY` copiée dans un coffre**, à part de la base.
- [ ] `docker compose up -d --build` (avec `-f docker-compose.tls.yml` si HTTPS automatique). `docker compose ps` : tout « healthy ».
- [ ] `https://votre-domaine/api/Health` répond `"status":"up"`.
- [ ] **Test de fumée** sur le serveur neuf (`DEPLOIEMENT.md` § 5) : « Installation opérationnelle ».

## 2. Le premier administrateur

- [ ] Créer le compte (`DEPLOIEMENT.md` § 4), changer le mot de passe, **inscrire la double authentification**, **ranger les codes de récupération**.
- [ ] Mettre à jour le système et activer les **mises à jour de sécurité automatiques**.

## 3. Paramétrer l'établissement (DSI)

Dans l'ordre (chaque étape dépend de la précédente) :

- [ ] **Organisation → Sites → Structure** : services, unités, salles, **lits**.
- [ ] **Catalogue** (par les responsables de chaque métier) : médicaments (pharmacie), analyses (laboratoire), examens (imagerie), puis **Catalogue des tarifs**.
  - [ ] **Chaque acte de laboratoire, de radiologie et de pharmacie porte le *code source*** de ce qu'il tarifie. Sans lui, la demande réalisée ne peut pas être facturée (l'écran « À facturer » le signale).
- [ ] **Assureurs** (comptabilité) : la liste, si le tiers payant est utilisé.
- [ ] **Personnel** : une **fiche par soignant**, **affectée à un service**, avec son **compte relié**. *Sans ce lien, un médecin ou un infirmier ne voit aucun patient.*
- [ ] **Utilisateurs** : un compte **par personne** avec son rôle (jamais de compte partagé). Remettre le mot de passe provisoire par un canal sûr.
- [ ] **Caisses** : définir les postes ; chaque caissier ouvre sa session le matin.

## 4. Recette sur place

- [ ] Dérouler `docs/recette/SCENARIOS.md` (S1 à S10) avec de **vrais comptes de test** sur l'installation réelle (pas le bac à sable).
- [ ] Lancer `ops/backup.sh` puis **`ops/restore-test.sh`** : « Test de restauration réussi ».
- [ ] Vérifier la chaîne d'audit : `GET /api/v1/audit/verify` → `valid: true`.
- [ ] Supprimer les comptes et données de test avant l'ouverture (ou les désactiver ; rien n'est supprimé, tout est tracé).

## 5. Formation

- [ ] Remettre `docs/guides/GUIDE-UTILISATEUR.md` à chaque métier ; faire pratiquer **leur** scénario de recette (S2 à S9).
- [ ] Rappeler : **aucun compte partagé**, **ne jamais laisser un dossier ouvert**, un oubli de mot de passe se règle **auprès de l'administrateur**, l'**addendum** / l'**amendement** corrige sans réécrire l'historique.

## 6. Exploitation courante (voir `EXPLOITATION.md`)

- [ ] `ops/backup.sh` planifié **chaque nuit** et **avant chaque mise à jour** ; copie **hors serveur** en place.
- [ ] **Test de restauration mensuel** (`ops/restore-test.sh`).
- [ ] Sonde externe sur `/api/Health` avec alerte ; surveillance de l'espace disque.
- [ ] Revue **mensuelle** du journal d'audit par le DPO / l'auditeur.

## 7. Ce que le pilote ne couvre pas encore (à dire clairement aux utilisateurs)

- Hospitalisation : **pas** de plan de soins, de bilan hydrique, de transfusion, de blocs opératoires, de maternité, de passation de service structurée. Les **constantes (NEWS2)**, l'**administration des médicaments** et les **notes** sont couvertes.
- Assurances : une couverture à **pourcentage unique** par facture ; pas de plafonds, de franchises, de listes d'actes couverts, ni d'**accord préalable**. Les **créances** se suivent et se règlent facture par facture.
- Pas de **remboursement / avoir** automatisé : une facture encaissée ne s'annule pas.
- Pas d'écran d'**audit** dans l'interface (consultation par l'API) ; pas d'enregistrement du **profil** par l'utilisateur lui-même.
- Pas de **réinitialisation de mot de passe en libre-service** par e-mail.

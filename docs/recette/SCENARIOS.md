# Recette de Sanjeevani EMR : scénarios à dérouler

Ce document sert à **valider l'application avant de la mettre en service**, rôle par rôle. Chaque scénario dit **qui fait quoi** et **ce qu'on doit voir**. Un scénario est réussi seulement si **tous** ses résultats attendus sont observés ; sinon, noter l'écart (écran, compte, heure) et le remonter.

## Avant de commencer

- **Données de démonstration** : `npm run playground` (API) puis `npm run demo:pilot` (peuplement), dans `backend/` ; l'interface s'ouvre avec `npm run start:playground` dans `frontend/` (http://localhost:4200).
  Tous les comptes ont le mot de passe `Demo-Passw0rd-2026`. Les comptes « MFA » demandent un code à 6 chiffres : le lire sur http://localhost:3100/dev/totp (valable 30 secondes).
- **Sur une installation réelle** (pas le bac à sable) : créer les comptes et les données à la main (voir `docs/deployment/MISE-EN-SERVICE.md`), puis refaire les scénarios avec de vrais comptes de test.
- **Test automatique équivalent** : `npm test -- test/recette` (dans `backend/`) rejoue le parcours complet par l'API ; les scénarios ci-dessous le rejouent **à l'écran**.

| Compte | Rôle | MFA |
|---|---|---|
| `receptionist` | Accueil | non |
| `doctor` | Médecin | oui |
| `nurse` | Infirmier(ère) | oui |
| `pharmacist`, `pharmacist2` | Pharmacien(ne) | oui |
| `lab_technician` | Laboratoire | oui |
| `radiologist` | Radiologue | oui |
| `cashier` | Caisse | non |
| `accountant` | Comptabilité | non |
| `system_admin` | Administrateur système (DSI) | oui |

---

## S1 · Connexion et sécurité (tous)

1. Ouvrir l'application, saisir un mauvais mot de passe. → Message d'erreur **sans dire** si l'identifiant existe.
2. Se connecter avec `doctor` : le code à 6 chiffres est demandé. Saisir un faux code. → Refusé. Saisir le bon. → Tableau de bord.
3. Ouvrir `system_admin` → Utilisateurs → **Réinitialiser le mot de passe** de `receptionist`. → Un mot de passe provisoire s'affiche **une seule fois**.
4. Se déconnecter, se connecter avec ce mot de passe provisoire. → L'application impose de le **changer** avant tout autre écran.
5. Laisser la session inactive (voir le délai du bandeau d'inactivité). → Avertissement, puis déconnexion.

**À constater :** un compte ne voit que les menus de son rôle ; aucune donnée n'apparaît avant l'authentification complète.

## S2 · Accueil : patient, rendez-vous, admission (`receptionist`)

1. **Accueil → Dossiers patients** : chercher « Mbarga ». → Le dossier apparaît avec son numéro `PAT-…`.
2. Ouvrir une **nouvelle fiche** avec un nom/prénom/date de naissance déjà existants. → L'application signale un **doublon possible** et propose d'ouvrir le dossier existant.
3. **Agenda** : prendre un rendez-vous avec le médecin pour le patient ; tenter le **même créneau** une seconde fois. → Refusé (créneau pris).
4. Marquer l'arrivée du patient, **ouvrir une admission** (consultation externe) dans le service. → Le patient apparaît dans la file du médecin.

## S3 · Consultation (`doctor`)

1. **Tableau de bord** : les chiffres du jour (rendez-vous, patients en attente) correspondent à la réalité.
2. **Consultations** : ouvrir la consultation d'Élisabeth Mbarga. Saisir les constantes, la note (évaluation obligatoire), un diagnostic principal.
3. Prescrire l'**Amoxicilline** (essayer une dose/fréquence). Demander une **NFS** et la **radiographie du thorax** depuis la consultation.
4. **Signer** la consultation. → Elle se verrouille ; toute correction passe par un **addendum** daté et signé.
5. Tenter de lire une consultation d'un **autre service**. → Introuvable (rien ne fuit).

**À constater :** une ordonnance annulée n'apparaît plus ; une consultation ne s'annule pas tant qu'il reste une ordonnance en cours.

## S4 · Laboratoire (`lab_technician`, puis `pharmacist` n'a pas accès)

1. **Laboratoire → Liste de travail** : la demande de NFS d'Élisabeth est reçue. Prélever (saisir le **numéro de dossier et la date de naissance** pour confirmer l'identité), puis recevoir l'échantillon.
2. Saisir un résultat **critique** (ex. hémoglobine 5). → L'application exige l'**appel du clinicien** (nom, rôle, relecture) avant de publier.
3. **Valider et publier avec un AUTRE compte** (un second laborantin) : un même compte ne peut pas saisir et valider.
4. Retourner chez `doctor` → **Résultats** : seul le résultat **publié** est lisible.

## S5 · Imagerie (`radiologist`)

1. **Imagerie → Liste de travail** : la radiographie du thorax est « réalisée ». Rédiger le compte rendu (technique, résultats, conclusion), **signer**.
2. Tenter de modifier le compte rendu signé. → Impossible ; un **addendum** est la seule voie.

## S6 · Pharmacie (`pharmacist`)

1. **Pharmacie → Ordonnances** : l'ordonnance d'Élisabeth est en file. **Délivrer** la quantité demandée. → Le stock baisse du nombre délivré ; l'ordonnance sort de la file.
2. Tenter de délivrer **plus** que prescrit. → Refusé.
3. **Stock** : l'Amoxicilline apparaît avec ses lots et dates de péremption. Faire un **ajustement** de stock : il demande la validation d'un **autre** pharmacien (`pharmacist2`).

## S7 · Facturation et assurance (`cashier`, `accountant`)

1. **Ouvrir sa caisse** (Facturation → Ma caisse) en comptant le fonds.
2. **À facturer → Analyses** : la demande de NFS d'Élisabeth est à **3 500 FCFA**. La demande de Berthe Ndom (avec TSH) est **bloquée** : « aucun acte du catalogue ne tarifie TSH ». Avec `system_admin`, **Catalogue des tarifs** → ajouter un acte « Laboratoire » avec le code source `TSH` : la demande devient facturable.
3. **Établir la facture** de la NFS, puis celles de l'**imagerie** et des **médicaments**. Chaque facture s'ouvre en **brouillon** au prix du catalogue.
4. Sur la facture des médicaments, section **Assurance** : appliquer la couverture **Assurance Santé Plus (80 %)**. → « Part de l'assureur » et « À payer par le patient » apparaissent ; le patient ne doit que 20 %.
5. **Émettre**, puis **encaisser** la part du patient (espèces avec rendu de monnaie, puis Mobile Money avec référence). → Statut « Payée » ; un **reçu** numéroté s'imprime.
6. Tenter de réimprimer le reçu. → Un **motif** est exigé et la copie porte la mention « duplicata ».
7. Tenter une **remise** supérieure au seuil. → Demande d'approbation envoyée à un responsable (qui est un **autre** compte).
8. `accountant` → **Créances assureurs** : la part de l'assureur est « À recouvrer ». **Constater le règlement** avec une référence (ex. VIR-0042). → Passe à « Réglée » ; une seconde tentative est refusée.
9. Fermer la caisse en comptant ce qu'elle contient. → Si l'écart dépasse le seuil, la clôture attend la **contre-signature** d'un responsable.

## S8 · Hospitalisation (`receptionist`, `doctor`, `nurse`)

1. `receptionist` : admettre un patient en **hospitalisation** dans un **lit libre**. → Le lit n'est plus libre ; un patient n'a qu'**une** hospitalisation en cours.
2. `doctor` : ouvrir le dossier de soins du patient hospitalisé (**Patients hospitalisés**) puis **Faire la tournée** : une consultation s'ouvre sur son admission ; prescrire un médicament.
3. `nurse` → **Patients hospitalisés** : le patient est listé avec son lit. Ouvrir son **dossier de soins**.
4. **Constantes** : saisir un relevé normal. → Score NEWS2 faible. Saisir un relevé **dégradé** (ex. SpO₂ 90 %, pouls 135, tension 85). → Bandeau rouge **« Prévenez le médecin sans attendre »** ; le patient apparaît en rouge dans la liste.
5. **Médicaments** : noter l'Amoxicilline **donnée**. Noter un **refus** sans motif. → Refusé : le motif est obligatoire. Avec motif → enregistré.
6. Ajouter une **note de soins**. Vérifier qu'aucune note ne peut être **modifiée**.
7. `receptionist` : enregistrer la **sortie**. → Le dossier de soins reste lisible mais n'accepte plus rien (« Hospitalisation terminée »).
8. `doctor` d'un **autre service** : le dossier de soins est introuvable.

## S9 · Administration (`system_admin`)

1. **Personnel** : créer la fiche d'une nouvelle infirmière, l'**affecter** à un service, **relier** son compte. → Une fois relié, elle voit les patients de son service ; **sans lien, elle n'en voit aucun**.
2. **Utilisateurs** : créer un compte (mot de passe provisoire affiché une fois), changer ses rôles, le **désactiver**. → Une désactivation coupe ses sessions **immédiatement**.
3. **Structure** : ajouter un service, une unité, une salle, un lit ; désactiver un lit occupé. → Refusé tant qu'il est occupé.
4. L'administrateur système n'a **aucun accès** aux dossiers cliniques (séparation des tâches) : tenter d'ouvrir un dossier de soins. → Refusé.

## S10 · Traçabilité (contrôle)

Avec le compte de contrôle (DPO / auditeur), via l'API (`GET /api/v1/audit/events`, `GET /api/v1/audit/verify`) :

1. Chaque consultation de dossier, signature, encaissement, réinitialisation de mot de passe et administration de médicament est inscrit **avec son auteur et l'heure**.
2. Le journal ne contient **aucun contenu clinique** ni mot de passe.
3. La vérification de la chaîne répond `valid: true`.

---

## Critères de réussite de la recette

- Les scénarios **S1 à S10** sont réussis sans écart bloquant.
- Aucun écran ne montre de donnée **inventée** (chiffres du tableau de bord, listes) : tout correspond à ce qui a été saisi.
- Aucun message technique (SQL, pile d'erreur) n'est visible par l'utilisateur.
- Les sauvegardes et la restauration ont été **testées** (`docs/deployment/EXPLOITATION.md` § 2).

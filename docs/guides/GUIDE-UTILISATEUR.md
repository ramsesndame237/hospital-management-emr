# Guide d'utilisation de Sanjeevani EMR

Un guide court **par métier**. Le menu de gauche ne montre que ce que votre rôle permet ; si un écran manque, c'est que votre rôle n'y a pas droit (ou que votre compte n'est pas relié à votre fiche : voir « Premier jour »).

## Premier jour (tout le monde)

1. **Connexion.** Votre identifiant et votre mot de passe **provisoire** vous sont remis par l'administrateur. À la première connexion, l'application vous fait :
   - **changer le mot de passe** (au moins 12 caractères, jamais un mot de passe déjà divulgué publiquement) ;
   - si votre rôle l'exige (médecins, infirmiers, pharmaciens, laboratoire, radiologie, administrateur) : **inscrire l'application d'authentification** sur votre téléphone en scannant le QR code, puis **ranger les codes de récupération** (imprimés, en lieu sûr) : ils servent si le téléphone est perdu.
2. **Mot de passe oublié ?** Il n'y a pas de réinitialisation en libre-service : demandez à l'administrateur (Utilisateurs → *Réinitialiser le mot de passe*). **Téléphone perdu ?** Idem : *Réinitialiser la double authentification*.
3. **Je ne vois aucun patient.** Un soignant ne voit que les patients **de son service**. Il faut que l'administrateur ait créé votre **fiche** (Personnel), vous ait **affecté** à un service et **relié votre compte** à la fiche.
4. **Déconnexion automatique** après un temps d'inactivité : un avertissement s'affiche avant. Ne laissez pas un dossier ouvert sans surveillance.

> **Règle d'or :** tout ce que vous consultez ou modifiez est **inscrit au journal d'audit avec votre identité**. N'ouvrez que les dossiers dont vous avez besoin pour soigner.

---

## Accueil (réceptionniste)

- **Chercher ou créer un patient** (Accueil → Dossiers patients). Cherchez **avant** de créer : si une fiche semble déjà exister (même nom, prénom, naissance), l'application le signale. Corriger une fiche exige un **motif**.
- **Rendez-vous** (Agenda) : choisir le service, le praticien, le créneau. Un créneau déjà pris est refusé. À l'arrivée du patient, marquer **Arrivé**.
- **Admissions** : ouvrir l'admission d'un patient (consultation externe, urgence ou **hospitalisation** avec un **lit libre**). Un patient n'a qu'une hospitalisation en cours. **Sortie** et **transfert** se font depuis la liste des admissions.
- **Assurance du patient** : l'accueil peut enregistrer sa **couverture** (assureur, numéro d'assuré, pourcentage, validité) depuis la facture.

## Médecin

- **Tableau de bord** : rendez-vous du jour, patients en attente, résultats publiés.
- **Consultations** : ouvrir la consultation d'un patient en attente → constantes, note (l'**évaluation** est obligatoire pour signer), diagnostic **principal** (CIM-10), **ordonnance** (une alerte signale une allergie connue : il faut un motif pour passer outre), **analyses** et **imagerie** demandées depuis la consultation.
- **Signer** verrouille la consultation. Pour corriger après signature : **addendum** (daté, signé).
- **Résultats** : vous ne voyez que les résultats **publiés** (validés par le laboratoire). Un résultat critique vous est téléphoné par le laboratoire.
- **Patients hospitalisés** : votre liste, avec le dernier score d'alerte. **Faire la tournée** ouvre une consultation sur l'hospitalisation (prescription comprise). Un patient en **rouge** (score NEWS2 élevé) est à voir sans attendre.

## Infirmier(ère)

- **Patients hospitalisés** : vos patients par lit ; ouvrir le **dossier de soins**.
- **Constantes** : température, pouls, tension, fréquence respiratoire, SpO₂, oxygène, conscience. L'application calcule le **score NEWS2**. S'il est élevé, un bandeau rouge dit **de prévenir le médecin sans attendre**.
- **Médicaments** : la liste vient des ordonnances de la tournée. **Donné**, **Refusé** (par le patient) ou **Suspendu** : le refus et la suspension exigent un **motif**. Une mention « prescrit malgré une allergie connue » demande une vérification avant d'administrer.
- **Notes de soins** : ajout seul (une note ne se modifie pas ; elle est signée par son auteur). Une erreur se corrige par une nouvelle note.
- Après la **sortie** du patient, le dossier reste lisible mais n'accepte plus rien.

## Pharmacien(ne)

- **Ordonnances** : la file des prescriptions à délivrer. **Délivrer** sélectionne les lots **péremption la plus proche d'abord** ; on ne peut pas délivrer plus que prescrit. Une ordonnance annulée disparaît.
- **Stock** : niveaux par médicament (OK / bas / rupture), lots, péremptions, quarantaine. Les **réceptions** de marchandises sont « tout ou rien ». Un **ajustement** de stock doit être **approuvé par un autre pharmacien**.
- **Approvisionnement** : fournisseurs, bons de commande (l'auteur ne peut pas être l'approbateur).

## Laboratoire

- **Liste de travail** : demandes d'analyses. **Prélever** (confirmer l'identité du patient : **numéro de dossier et date de naissance**), **recevoir** l'échantillon, **saisir** les résultats (drapeaux bas/haut/critique d'après le sexe et l'âge, contrôle du delta par rapport au résultat précédent).
- **Valider et publier** : par **une autre personne** que celle qui a saisi. Un résultat **critique** exige l'enregistrement de l'**appel du clinicien**. Après publication, une correction passe par un **amendement** motivé.
- **Rejet d'échantillon** : avec motif ; une **recollection** est proposée.

## Radiologie

- **Liste de travail** : demandes d'examens (les plus urgentes d'abord). **Planifier**, **réaliser** (dépistage grossesse / allergie au produit de contraste), **rédiger** le compte rendu, **signer**.
- Un compte rendu **signé** ne se modifie pas (addendum). Une découverte **critique** exige l'enregistrement de l'appel au prescripteur.

## Caisse

- **Ma caisse** : **ouvrir** en comptant le fonds ; sans caisse ouverte, aucun encaissement. **Fermer** en comptant ; un écart trop grand attend la **contre-signature** d'un responsable.
- **À facturer** : ce qui a été **fait** (analyses, examens réalisés, médicaments délivrés) et n'a pas de facture. **Établir la facture** crée un **brouillon** au prix du catalogue. Si un acte n'a pas de prix configuré, la facture est **refusée** (jamais à zéro) : prévenir l'administrateur (Catalogue des tarifs → *code source*).
- **Factures** : ajouter des actes, appliquer une **remise** (au-delà du seuil, elle part en **demande d'approbation**), **assurance**, **émettre**, **encaisser** (espèces avec rendu de monnaie, carte, Mobile Money, chèque, virement). Une facture **émise** ne se modifie plus ; une facture **non encaissée** s'annule avec un **motif** (émise : avec l'accord d'un responsable).
- **Reçus** : numérotés ; une réimpression exige un motif et porte la mention « duplicata ».

## Comptabilité

- **Factures** et **sessions de caisse** en lecture ; **Approbations** à décider (le demandeur ne peut pas approuver sa propre demande).
- **Créances assureurs** : la part des factures que les assureurs doivent régler. **Constater le règlement** (une seule fois) avec la **référence** du virement ou du bordereau. Une facture dont l'assureur a payé ne peut plus être annulée.
- **Assureurs** : tenir la liste (créer, renommer, retirer).

## Administrateur système (DSI)

- **Organisation, Sites, Structure** : services, unités, salles, lits.
- **Personnel** : fiches, **affectations**, **départ**, **lien avec le compte** (indispensable : voir « Premier jour »).
- **Utilisateurs** : créer un compte (mot de passe provisoire affiché **une fois**), changer les **rôles**, **désactiver** (coupe les sessions tout de suite), **déverrouiller**, **réinitialiser le mot de passe** ou la **double authentification**. Vous ne pouvez pas modifier vos propres rôles.
- **Catalogue des tarifs** : actes et prix ; pour un acte de laboratoire / radiologie / pharmacie, le **code source** de l'analyse, de l'examen ou du médicament qu'il tarifie.
- Vous n'avez **volontairement aucun accès** aux dossiers cliniques (séparation des tâches).
- Exploitation (sauvegardes, journaux, mises à jour) : `docs/deployment/EXPLOITATION.md`.

## Patient (portail)

- Le portail ne montre que **votre** dossier : rendez-vous, résultats **publiés**, ordonnances, factures. Votre compte est relié à votre dossier par l'accueil.

---

## En cas de problème

| Je constate… | Je fais… |
|---|---|
| « Introuvable » sur un patient que je dois soigner | Vérifier avec l'administrateur que mon compte est relié à ma fiche et que je suis affecté au bon service. |
| Un chiffre ou un écran qui me semble faux | Noter l'écran, l'heure et le patient (numéro de dossier), et prévenir l'administrateur. Ne rien « corriger » en double. |
| Une erreur « momentanément indisponible » | Réessayer dans un instant ; si cela persiste, prévenir l'administrateur (il vérifie `/api/Health`). |
| Une erreur de saisie dans un dossier signé ou publié | Utiliser l'**addendum** (consultation, compte rendu) ou l'**amendement** (résultat) : on ne réécrit pas l'historique. |

# Prompt Figma — Sanjeevani EMR (tous les écrans de tous les profils)

Ce dossier contient le prompt complet destiné à l'IA de Figma (Figma Make / First Draft), **en anglais** (les IA de design donnent de meilleurs résultats en anglais) ; les textes d'interface à produire sont en **français** avec parité anglaise.

## Fichiers
| Fichier | Contenu | Écrans |
|---|---|---:|
| `FIGMA_PROMPT_COMPLET.md` | **Tout le prompt en un seul fichier** (parties 0 à 13) | 716 |
| `00-global-design-system.md` | Brief global, design system (couleurs, typo, composants), règles d'états, accessibilité, sécurité | — |
| `01-shared-auth-shell-files.md` | Connexion, cycle de vie du compte, coque d'application, recherche/dossier patient, gestionnaire de fichiers, impressions, écrans TV | 74 |
| `02-patient.md` … `12-system-admin.md` | Un profil par fichier, **du moins de fonctionnalités au plus** | 47 → 97 |
| `13-end-to-end-journeys-and-checklist.md` | 14 parcours bout en bout entre profils + liste de contrôle finale | — |

Ordre des profils : Patient (47) → Réceptionniste (51) → Caissier (42) → DPO/Auditeur (37) → Comptable (64) → Laborantin (47) → Radiologue (41) → Pharmacien (66) → Infirmier (70) → Médecin (80) → Administrateur système (97).

## Comment l'utiliser dans Figma
1. **Collez toujours la partie 0 en premier** : elle définit le design system et les règles communes à tous les écrans.
2. Selon la taille de prompt acceptée par l'outil :
   - **si tout passe** : collez `FIGMA_PROMPT_COMPLET.md` ;
   - **sinon, par étapes** : `00` (design system) → `01` (écrans partagés) → un profil à la fois (`02`, `03`…) en recollant à chaque fois un court rappel (« Use the design system from Part 0, keep the same tokens and components ») → `13` à la fin pour les parcours et la vérification.
3. Demandez à l'IA, après chaque partie, d'**imprimer l'inventaire des écrans créés** (`ID · titre`) et de le comparer au « Screen count » de la partie.
4. Les écrans marqués ★ sont des **propositions** qui n'existent pas dans l'ancienne application : à valider ou retirer.

## Hypothèses à confirmer
- Ordre « du plus petit profil au plus riche » interprété comme **du moins de fonctionnalités vers le plus**.
- Données d'exemple : établissement **francophone d'Afrique** (noms, +237, **FCFA**) ; à changer si besoin.
- Portail patient, vérifications et mobile money : conçus comme cibles ; certains modules (messagerie sécurisée, télémédecine, etc.) sont marqués ★.

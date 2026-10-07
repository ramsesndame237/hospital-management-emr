# Déploiement de démo sur Azure (App Service + Azure SQL, paliers gratuits)

Backend : ASP.NET Core hébergé sur **.NET Framework 4.6.1** (Windows uniquement). Il ne peut pas tourner dans un conteneur Linux ; la cible est donc **Azure App Service, plan Windows**.

> État : le package se compile et se publie (voir §2). **Il n'a pas encore été exécuté** contre une base : la migration de la base (§3) est en attente.

## 1. Ressources Azure

| Ressource | Offre | Remarques |
|---|---|---|
| App Service (Windows) | F1 (gratuit) | 60 min CPU/jour, 1 Go RAM, 1 Go disque, mise en veille après 20 min, pas de SLA, 32 bits. Démo uniquement. |
| Azure SQL Database x2 (EMR + Admin) | Offre gratuite serverless | 32 Go max chacune. |

Si l'app dépasse les limites du F1 (probable avec ~40 modules), passer au plan B1 payant.

## 2. Construire le package

1. **Angular** (le `dist` est ignoré par git et doit être reconstruit après chaque changement de `src/`) :
   ```bash
   cd Code/Websites/DanpheEMR/wwwroot/DanpheApp
   npm install --legacy-peer-deps
   NODE_OPTIONS=--openssl-legacy-provider npx ng build
   ```
   Angular 7 est incompatible avec Node récent (testé sur Node 24) : le build exige `--openssl-legacy-provider` et un correctif local de `node_modules/http-deceiver/lib/deceiver.js` (le `process.binding('http_parser')` n'existe plus). Une version de Node ancienne (12/14) devrait éviter ces contournements (non testé). Le build prend 10 à 20 min.
2. **Backend** (nécessite une restauration NuGet de la solution car certains projets utilisent `packages.config`) :
   ```bash
   nuget restore Code/Solutions/DanpheEMR.sln
   cd Code/Websites/DanpheEMR
   dotnet publish DanpheEMR.csproj -c Release -o ../../../_publish_azure
   ```
   Le dossier produit contient `DanpheEMR.exe`, `web.config`, `appsettings.json` et `wwwroot/` (avec `DanpheApp/dist`). Vérifier le code de sortie du build (pas seulement la fin du log).
3. Zipper le **contenu** de `_publish_azure`.

## 3. Base de données

Les sauvegardes `.bak` ne se restaurent pas sur Azure SQL Database ; il faut passer par un `.bacpac`.

1. Décompresser `Database/2. EMR-Db/DanpheInternationalDB/Dev_DanpheEMR_INT1.zip` et restaurer le `.bak` sur un SQL Server local.
2. **Blocage connu : la base contient un filegroup FILESTREAM** (`Danphe_PatientFiles`, pièces jointes patients). Il faut activer FILESTREAM sur l'instance locale pour restaurer, et **Azure SQL Database ne supporte pas FILESTREAM** : les objets qui l'utilisent devront être retirés ou migrés (par ex. vers Azure Blob Storage) avant l'export. Les tables concernées n'ont pas encore été inspectées.
3. Exporter : `sqlpackage /Action:Export /SourceServerName:<local> /SourceDatabaseName:<db> /TargetFile:emr.bacpac`
4. Importer dans Azure : `sqlpackage /Action:Import /SourceFile:emr.bacpac /TargetConnectionString:"<chaîne Azure SQL>"`
5. Faire de même avec `Database/1. Admin-Db/1. DanpheAdmin_CompleteDB.sql` pour la base Admin.

La compatibilité complète du schéma avec Azure SQL Database (requêtes inter-bases, CLR, etc.) n'est pas vérifiée.

## 4. Configuration (Application settings du portail)

`Startup.cs` charge `appsettings.json` puis les variables d'environnement : tout réglage ci-dessous écrase le fichier. Une clé imbriquée s'écrit avec `__`.

| Clé | Valeur |
|---|---|
| `Connectionstring` | `Server=tcp:<serveur>.database.windows.net,1433;Initial Catalog=<db emr>;User ID=<user>;Password=<mdp>;MultipleActiveResultSets=True;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;` |
| `ConnectionStringAdmin` | idem, base Admin |
| `ConnectionStringPACSServer` | à renseigner seulement si le module PACS est utilisé |
| `JwtTokenConfig__JwtKey` | **nouvelle** clé secrète (32+ caractères). La clé de `appsettings.json` est publique dans le dépôt. |
| `JwtTokenConfig__JwtIssuer` / `JwtTokenConfig__JwtAudience` | URL du site |

Le `appsettings.json` publié contient les valeurs de développement (serveur `LAPTOP-...`, clé JWT publique) : ne pas s'y fier.

## 5. Déploiement

```bash
az webapp deploy --resource-group <rg> --name <app> --src-path package.zip --type zip
```

Puis vérifier les logs (`Log stream`) au premier démarrage ; `web.config` autorise un démarrage jusqu'à 1 h.

## Limites et points ouverts

- Non testé de bout en bout (pas d'exécution contre une base, pas de test sur Azure).
- FILESTREAM / pièces jointes patients : décision à prendre (§3).
- Les fichiers uploadés (`wwwroot/fileuploads`) vivent sur le disque de l'App Service (1 Go, non pérenne sur F1).
- Le logo, l'écran de file d'attente et la vue patient modifiés après le dernier `ng build` n'apparaissent qu'après un nouveau build Angular.

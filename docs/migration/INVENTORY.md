# Inventaire de la migration .NET → NestJS

> Généré par `backend/tools` (`npm run inventory` dans `backend/`). Ne pas modifier à la main.
> Source : analyse statique du code C# (EF6, ASP.NET Core) du dépôt. Les procédures stockées n'ont pas de corps dans le dépôt (voir « Blocages »).

## En chiffres

| | |
|---|---|
| Contrôleurs analysés | 132 |
| Actions d'API à migrer | **1725** (PUT 326, DELETE 18, GET 969, POST 331, LEGACY 81) |
| Actions qui servent des vues Razor (remplacées par Angular, hors périmètre API) | 179 |
| Méthodes publiques « assistants » (non HTTP) | 50 |
| Actions qui dépendent de la session serveur / de l'utilisateur courant | 496 (29 %) → à remplacer par le JWT |
| Actions qui génèrent ou reçoivent des fichiers | 53 |
| Procédures stockées distinctes appelées | **483** (539 sites d'appel) |
| DbContext EF6 | 49 |
| Tables déduites du code | **451** (6299 colonnes) ; 447 entités TypeORM générées, 4 à traiter à la main |

## Par module (ordre décroissant d'effort estimé)

Effort = barème indicatif : 0,25 j par action courte, 0,5 j moyenne, 1 à 2 j longue, +0,5 j par procédure stockée à porter, +0,5 j pour fichiers. Il couvre le **contrôleur**, pas la logique des couches `DalLayer`/BL (voir le plan).

| Module | Contrôleurs | Actions | Lignes | Procédures | Dépend de la session | Fichiers | Effort (j) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pharmacy | 17 | 235 | 5603 | 12 | 52 | 6 | 91.3 |
| Inventory | 8 | 169 | 1563 | 0 | 14 | 1 | 56.8 |
| Settings | 6 | 166 | 1177 | 1 | 57 | 0 | 47.8 |
| Billing | 9 | 131 | 1258 | 9 | 34 | 0 | 45.3 |
| Reporting | 4 | 54 | 1032 | 14 | 0 | 31 | 44.5 |
| WardSupply | 2 | 72 | 2155 | 0 | 21 | 1 | 40.8 |
| Lab | 4 | 101 | 939 | 4 | 45 | 0 | 34.0 |
| Accounting | 3 | 66 | 940 | 1 | 28 | 0 | 25.5 |
| Clinical | 1 | 89 | 637 | 0 | 46 | 2 | 25.5 |
| FixedAsset | 4 | 35 | 1295 | 0 | 22 | 2 | 23.0 |
| Insurance | 2 | 72 | 607 | 1 | 15 | 0 | 22.8 |
| Patient | 2 | 38 | 467 | 11 | 6 | 2 | 20.3 |
| Maternity | 1 | 26 | 431 | 1 | 12 | 2 | 14.5 |
| MedicalRecords | 1 | 39 | 402 | 3 | 12 | 0 | 14.0 |
| Appointment | 2 | 45 | 317 | 2 | 9 | 0 | 13.8 |
| Emergency | 1 | 27 | 206 | 1 | 10 | 2 | 9.3 |
| Dispensary | 3 | 21 | 230 | 0 | 6 | 0 | 8.5 |
| Incentive | 1 | 23 | 175 | 3 | 9 | 0 | 8.5 |
| Verification | 1 | 21 | 341 | 0 | 18 | 0 | 8.5 |
| Radiology | 2 | 24 | 202 | 0 | 6 | 2 | 8.0 |
| Core | 4 | 23 | 237 | 0 | 6 | 0 | 7.5 |
| Vaccination | 1 | 15 | 244 | 0 | 3 | 0 | 7.5 |
| Fraction | 3 | 16 | 215 | 0 | 3 | 0 | 7.3 |
| ClaimManagement | 1 | 27 | 120 | 0 | 12 | 0 | 6.8 |
| Nursing | 1 | 17 | 136 | 2 | 10 | 0 | 6.0 |
| Security | 1 | 22 | 92 | 0 | 5 | 0 | 5.5 |
| SocialServiceUnit | 1 | 5 | 347 | 0 | 5 | 0 | 5.5 |
| Payroll | 1 | 4 | 549 | 0 | 2 | 0 | 5.3 |
| Root | 3 | 12 | 241 | 0 | 5 | 0 | 5.3 |
| DicomViewer | 1 | 5 | 246 | 0 | 1 | 2 | 5.0 |
| Master | 1 | 18 | 115 | 0 | 0 | 0 | 5.0 |
| SSF | 1 | 9 | 161 | 0 | 1 | 0 | 4.5 |
| MarketingReferral | 1 | 16 | 71 | 0 | 7 | 0 | 4.0 |
| Scheduling | 1 | 4 | 263 | 0 | 0 | 0 | 3.8 |
| SystemAdmin | 1 | 12 | 76 | 0 | 0 | 0 | 3.5 |
| Doctors | 2 | 13 | 69 | 0 | 5 | 0 | 3.3 |
| Helpdesk | 1 | 6 | 53 | 1 | 0 | 0 | 2.3 |
| QueueManagement | 1 | 5 | 60 | 0 | 1 | 0 | 2.3 |
| Utilities | 1 | 8 | 35 | 0 | 3 | 0 | 2.0 |
| Order | 1 | 7 | 28 | 0 | 0 | 0 | 1.8 |
| CSSD | 1 | 3 | 41 | 0 | 2 | 0 | 1.5 |
| NepaliReceipt | 1 | 3 | 39 | 0 | 0 | 0 | 1.5 |
| Admission | 1 | 5 | 20 | 0 | 0 | 0 | 1.3 |
| Dashboard | 1 | 4 | 22 | 0 | 0 | 0 | 1.3 |
| Notification | 1 | 4 | 22 | 0 | 2 | 0 | 1.0 |
| Employee | 1 | 3 | 13 | 0 | 0 | 0 | 0.8 |
| OperationTheatre | 1 | 3 | 15 | 0 | 1 | 0 | 0.8 |
| Stickers | 1 | 2 | 21 | 0 | 0 | 0 | 0.8 |
| **Total** | 110 | **1725** | 23528 | 483 | | | **665** |

## Procédures stockées les plus appelées

| Procédure | Appels | Modules |
|---|---:|---|
| `SP_Bill_OrderStatusUpdate` | 4 | Lab, Websites |
| `SP_ACC_GetLedgerList` | 3 | Accounting, Websites |
| `SP_BIL_Update_Duplicate_Invoice_If_Exists` | 3 | Admission, Billing, Insurance |
| `SP_Bill_OrderStatusUpdate_Radiology` | 3 | Radiology |
| `SP_PHRM_UserwiseCollectionReport` | 3 | DalLayer, Pharmacy |
| `SP_Report_BIL_DailySales` | 3 | DalLayer, Reporting |
| `SP_VISIT_SetNGetQueueNo` | 3 | Appointment, Insurance, Websites |
| `SP_ACC_AccountClosure` | 2 | Accounting, Websites |
| `SP_ACC_BankReconcilationDetail` | 2 | Accounting, Websites |
| `SP_ACC_GetAllEmployee_LedgerList` | 2 | Accounting, Websites |
| `SP_ACC_GetTransactionDates` | 2 | Accounting, Websites |
| `SP_ACC_RPT_SubLedgerReport` | 2 | Accounting, Websites |
| `SP_ADT_GetBedOccupanciesOfAllWards` | 2 | DalLayer |
| `SP_Billing_PatientsListWithVisitinformation` | 2 | Emergency, Patient |
| `SP_Claim_GenerateNewClaimCode` | 2 | Admission, Appointment |

## Plus grosses tables (colonnes)

| Table | Modèle | Colonnes |
|---|---|---:|
| `NEPH_HemodialysisRecord` | HemodialysisModel | 84 |
| `BIL_CFG_Scheme` | BillingSchemeModel | 66 |
| `BIL_TXN_BillingTransactionItems` | BillingTransactionItemModel | 65 |
| `LAB_TestRequisition` | LabRequisitionModel | 63 |
| `INV_TXN_GoodsReceipt` | GoodsReceiptModel | 60 |
| `BIL_TXN_BillingTransaction` | BillingTransactionModel | 58 |
| `PAT_Patient` | PatientModel | 57 |
| `INV_TXN_FixedAssetStock` | FixedAssetStockModel | 55 |
| `ADT_DischargeSummary` | DischargeSummaryModel | 47 |
| `EMP_Employee` | EmployeeModel | 46 |

## Entités non générées (à traiter à la main)

- `INV_TXN_PurchaseOrder` (PurchaseOrderModel) : aucune clé primaire détectée
- `PHRM_MST_Stock` (PHRMStockMaster) : aucune clé primaire détectée
- `PHRM_MST_StockBarcode` (PHRMStockBarcode) : aucune clé primaire détectée
- `WARD_TXN_ReturnItems_FixedAssetStock` (MAP_ReturnItems_FixedAssetStock) : aucune clé primaire détectée

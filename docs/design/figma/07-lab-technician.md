# PART 7 — PROFILE 6 · LABORATORY TECHNICIAN (and lab verifier/pathologist actions) — `LAB-xx`

**Who:** lab technicians, senior technologists, pathologist/biologist who validates. **MFA mandatory.** **Goal:** run the full lab cycle — receive orders, collect and track samples, enter or import results, quality control, verify, release, and report — fast, error-free and traceable. **Sees:** patient identity (name, age, sex, MRN), ordered tests, clinical info relevant to the test; **not** the rest of the chart. **Safety patterns to make visible:** two-identifier patient check at collection (scan wristband), barcode chain of custody, delta checks and critical-value call-back documentation, result amendments with reason and versions. Desktop 1440 (bench PC) + **tablet 1024 for bedside collection** and **TV-style worklist** optional. ★ = proposed.

**Sidebar:** Tableau de bord · Liste de travail · Prélèvements · Réception · Résultats · Validation · Rapports · Catalogue · Qualité · Équipements · Réactifs · Sous-traitance · Statistiques.

## Flows
- **F-LAB-01 Main cycle:** LAB-01 → LAB-02 → LAB-03 → LAB-05 → LAB-06 → LAB-08 → LAB-12 (or LAB-13 / LAB-14 import) → LAB-19 → LAB-20 → LAB-24 (release; appears in doctor DOC- results and patient PAT-15).
- **F-LAB-02 Rejection & recollection:** LAB-07 or LAB-08 → LAB-09 (reason, notify) → LAB-05 (recollection task appears) → LAB-06.
- **F-LAB-03 Critical value:** LAB-12/LAB-20 (critical flag) → LAB-21 (call-back documented) → release LAB-24.
- **F-LAB-04 Analyzer import:** LAB-33 (connection status) → LAB-14 (review incoming, resolve mapping errors) → LAB-20.
- **F-LAB-05 Microbiology:** LAB-02 → LAB-16 (culture → organism → antibiogram) → LAB-19 → LAB-20 → LAB-24 (preliminary & final reports).
- **F-LAB-06 Amend a released result:** LAB-25 → LAB-22 (reason, new version, notify clinician) → LAB-24.
- **F-LAB-07 Repeat test:** LAB-15 (delta alert) or LAB-20 → LAB-23 → LAB-12.
- **F-LAB-08 Daily QC:** LAB-30 → LAB-31 → (violation → LAB-32 corrective action → release run) .
- **F-LAB-09 Outsourced tests:** LAB-37 → LAB-38 (manifest) → result import → LAB-19.
- **F-LAB-10 Reagents:** LAB-34 (low stock) → LAB-35 (request) → LAB-36 (lot change/validation).
- **F-LAB-11 History & trends:** LAB-26 from any result → LAB-24.
- **F-LAB-12 Histology ★:** LAB-17 (gross → micro → diagnosis → sign) → LAB-19 → LAB-24.

## Screens
### Home & worklists
- **LAB-01 Dashboard** — pending by status, STAT queue with timers, TAT gauges, critical results awaiting call-back, analyzer status strip, rejected samples today.
- **LAB-02 Requisition worklist** — dense table: priority (STAT/urgent/routine), patient, tests, section, source (OPD/IPD/ER), ordered time, TAT timer, status chip (ordered → collected → received → in analysis → resulted → verified → released); section tabs (haematology, biochemistry, immunology, microbiology, histology…); bulk actions.
- **LAB-03 Requisition detail** — patient identity strip, ordered tests/panels, clinical notes, ordering doctor/location, status stepper, specimen list, actions.
- **LAB-04 Lab-initiated request ★** — create request from an external prescription/walk-in; test picker; sends to billing.

### Collection & receipt
- **LAB-05 Collection worklist** — ward-round list (inpatients by ward/bed) and OPD collection-point queue; tablet variant.
- **LAB-06 Collect sample** — scan wristband → **identity verification screen** (photo, name, DOB, mismatch error state) → tubes to collect with colors → print labels (PRN-03) → confirm collected (time, collector).
- **LAB-07 Collection issues** — hemolysed, insufficient volume, wrong tube, patient refused/unavailable → recollection or cancel.
- **LAB-08 Sample receiving** — batch barcode scanning, accept/reject per sample, discrepancy highlighting (missing, mislabelled).
- **LAB-09 Reject sample** — reason list, notify requester, auto-create recollection, rejection log.
- **LAB-10 Storage & aliquots** — rack/freezer map, assign location, aliquot creation, retention until date.
- **LAB-11 Sample tracking** — chain-of-custody timeline per barcode (who, when, where, temperature if tracked).

### Results
- **LAB-12 Result entry by test (worksheet)** — grid of samples × analytes, reference ranges per age/sex, auto flags (L/H/critical), units, keyboard-first entry, comments, "enregistrer & suivant".
- **LAB-13 Result entry by patient** — panel view for one patient across sections.
- **LAB-14 Analyzer import review** — incoming results table, mapping errors (unknown test code, wrong sample ID), accept/reject/rerun, auto-verification rules applied.
- **LAB-15 Delta check & calculated tests** — previous value comparison, delta alert reasons, formula-derived values (e.g. eGFR, LDL) with inputs shown.
- **LAB-16 Microbiology** — culture reading entry, organism picker, **antibiogram grid (S/I/R)** by antibiotic, preliminary vs final.
- **LAB-17 Histology/cytology report editor ★** — templates, gross/microscopic description, diagnosis, ICD-O coding, images, sign-off.

- **LAB-18 Interpretive comments & result templates** — library of standard comments/phrases (per test, per flag), insert into results and reports, usage stats.

### Verification & release
- **LAB-19 Verification queue** — results awaiting review (filter by section/technician/age), flags, bulk-verify safe normals.
- **LAB-20 Verification detail** — current vs previous results, flags, instrument QC status, comments; actions approve / return / request re-run.
- **LAB-21 Critical-value notification** — who was notified (name/role), time, read-back confirmed, method; blocks release until documented; timer.
- **LAB-22 Amend released result** — reason, old vs new, new version, clinician notification, audit.
- **LAB-23 Repeat / re-run request** — reason, dilution, new aliquot, links to original.
- **LAB-24 Report preview & release** — report preview (PRN-05), single/batch release, print, send to portal (patient/doctor), signature of verifier.
- **LAB-25 Reports history** — search by patient/test/date/status, reprint, amendments badge.
- **LAB-26 Patient history & cumulative trends** — table + charts per analyte with reference bands.

### Catalog
- **LAB-27 Test catalog** — tests by section, sample type, TAT, container, price, methods; search.
- **LAB-28 Test detail & reference ranges** — age/sex-specific ranges, critical limits, units, instructions; **request change** (admin approves) ★.
- **LAB-29 Panels & profiles** — panel composition view.

### Quality & equipment
- **LAB-30 QC dashboard** — Levey-Jennings charts per analyte & level, Westgard flags, run status.
- **LAB-31 QC data entry** — enter control results per run, accept/reject run.
- **LAB-32 QC violations & corrective actions** — rule violated, investigation, corrective action, release/hold run.
- **LAB-33 Equipment** — analyzers list (status, last calibration, interface connection), calibration & maintenance logs, downtime.

### Reagents & outsourcing
- **LAB-34 Reagent & consumable stock** — levels, lots, expiry, reorder alerts.
- **LAB-35 Reagent requisition** — request to store, status.
- **LAB-36 Lot change & validation log** — new lot verification results.
- **LAB-37 Outsourced tests** — send-out list, partner lab, courier status, expected TAT, result import.
- **LAB-38 Send-out manifest** — printable manifest, sample list, signatures.

### Statistics & misc
- **LAB-39 TAT report** · **LAB-40 Workload by section/technician** · **LAB-41 Test volume & revenue** · **LAB-42 Rejection analysis** · **LAB-43 Critical results report** · **LAB-44 Worksheet print/daily worklist**.
- **LAB-45 Notifications** — new STAT, critical returns, rejected-sample feedback, low reagents.
- **LAB-46 My bench & shift** — choose section/bench/analyzer, shift handover notes.
- **LAB-47 Add-on test request** — add test to an existing sample (sample-volume check, doctor approval status).

**Required extra states:** identity mismatch at collection (blocking), unreadable barcode, analyzer disconnected, QC failed (results on hold banner), result out of analytic range, duplicate sample ID, STAT overdue (pulsing red), session timeout mid-entry (draft preserved), offline entry on tablet.

**Screen count — Part 7:** **47 screens** (LAB-01 … LAB-47).

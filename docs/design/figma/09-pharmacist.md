# PART 9 — PROFILE 8 · PHARMACIST (dispensary, ward supply, stock, procurement, clinical pharmacy) — `PHA-xx`

**Who:** pharmacists, pharmacy assistants (reduced actions), store keepers of the pharmacy. **MFA mandatory.** **Goal:** verify and dispense prescriptions safely, sell over the counter, supply wards, control stock/expiry and controlled drugs, procure, and provide clinical pharmacy services. **Sees:** patient identity, medications, allergies, relevant diagnoses/renal data for verification; billing hand-off; **not** the rest of the chart. **Safety patterns to make visible:** allergy/interaction/duplicate/dose alerts with severity and **override-with-reason**, FEFO batch selection, expiry warnings, two-person verification for controlled drugs, barcode scanning, label printing with pictograms. Desktop 1440 + **tablet 1024 counter variant** + TV-03 pick-up screen. ★ = proposed.

**Sidebar:** Tableau de bord · Ordonnances · Vente au comptoir · Retours · Hospitalisation (pharmacie de service) · Substances contrôlées · Stock · Approvisionnement · Catalogue & prix · Pharmacie clinique · Rapports.

## Flows
- **F-PHA-01 Outpatient prescription (main):** PHA-01 → PHA-02 → PHA-03 → PHA-04 (alerts → PHA-05 override | PHA-06 substitute | contact prescriber) → PHA-07 (FEFO batches; out-of-stock → PHA-08) → PHA-10 (billing hand-off) → PHA-09 (counseling & labels PRN-14) → PHA-11 (hand-over; TV-03).
- **F-PHA-02 Inpatient supply:** PHA-14 → PHA-15 (unit-dose cart prep) → PHA-17 (issue to ward with signature) → nurse receipt (NUR-xx) → PHA-18 (returns).
- **F-PHA-03 Ward requisition:** PHA-16 (inbox) → approve/adjust → PHA-17 → PHA-19 (par-level update).
- **F-PHA-04 Counter sale:** PHA-20 → PHA-21 (receipt) → PHA-22 (return, if any) ; hold → PHA-24 ; credit → PHA-23.
- **F-PHA-05 Controlled drug dispensing:** PHA-26 (second verifier) → PHA-25 (register entry) → PHA-27 (periodic audit & discrepancy report).
- **F-PHA-06 Expiry management:** PHA-30 → (return to supplier PHA-42 | quarantine PHA-35 | markdown PHA-48) .
- **F-PHA-07 Replenishment to receipt:** PHA-31 → PHA-38 (requisition) → PHA-39 (PO, approval) → PHA-40 (status) → PHA-41 (GRN) → PHA-42 (discrepancy/return if any) → PHA-45 (hand-off to accounting) → PHA-28 stock updated.
- **F-PHA-08 Stock count:** PHA-33 (count sheets, scan) → variance review → PHA-32 (approved adjustment) → PHA-28.
- **F-PHA-09 Transfer between stores:** PHA-34 (request → dispatch → receive).
- **F-PHA-10 New drug / price change:** PHA-47 (request, committee approval) → PHA-46 → PHA-48 (price & margin).
- **F-PHA-11 Clinical pharmacy:** PHA-51 (medication review) → PHA-52 (intervention logged, prescriber response) ; ADR: PHA-53 ; stewardship: PHA-54 ; error: PHA-55.
- **F-PHA-12 Shift:** PHA-66 (open counter, cash float) → operations → close & handover.
- **F-PHA-13 Cold chain ★:** PHA-36 (excursion alert) → quarantine PHA-35 → decision.

## Screens
### Home & prescriptions
- **PHA-01 Dashboard** — prescription queue count & wait, pending verifications, low-stock & expiring-soon counters, controlled-drug balance status, sales today, ward requisitions pending.
- **PHA-02 Prescription queue** — OPD + IPD tabs, status (new, in verification, awaiting stock, ready, dispensed, cancelled), priority, patient, prescriber, age; search/scan prescription QR.
- **PHA-03 Prescription detail** — patient banner (allergies in red), items with dose/route/frequency/duration, prescriber, diagnosis snippet, previous dispenses, alerts summary.
- **PHA-04 Clinical verification** — per-item checks: dose range, duplicate therapy, **drug–drug & drug–allergy interactions**, renal/hepatic/pregnancy considerations, max daily dose; actions: approve / modify / contact prescriber / reject (reason).
- **PHA-05 Alert override** — severity, evidence, mandatory reason, second-pharmacist approval for severe.
- **PHA-06 Substitution** — generic/therapeutic alternatives with price & stock, prescriber-approval requirement flag.
- **PHA-07 Dispense items** — per item batch selection (**FEFO suggested**, expiry colors), quantity, partial dispense, price/discount, barcode scan confirm, running total.
- **PHA-08 Out-of-stock handling** — alternatives, partial dispense, procure/transfer, refer externally, notify prescriber & patient.
- **PHA-09 Counseling & labels** — counseling checklist (how to take, side effects, storage), leaflet, print labels (PRN-14) with pictograms, language choice.
- **PHA-10 Billing at dispensing** — insurance coverage, copay, totals; send to cashier (CSH-) or collect at pharmacy counter.
- **PHA-11 Hand-over** — patient identity check, signature/confirmation, pick-up QR, updates TV-03; dispensed summary.
- **PHA-12 Dispensing history** — per patient medication dispenses timeline, adherence gaps.
- **PHA-13 Medication reconciliation ★** — compare active inpatient/outpatient meds, discrepancy flags.

### Inpatient & ward supply
- **PHA-14 Inpatient medication orders** — active orders by ward, due-for-supply list, stat orders.
- **PHA-15 Unit-dose cart preparation** — per ward checklist, scan-to-pick, completeness verification.
- **PHA-16 Ward requisitions inbox** — requests from nurses, approve/adjust/reject, urgency.
- **PHA-17 Issue to ward** — issue list, scan items, batch capture, receiver signature, delivery note.
- **PHA-18 Ward returns** — returned meds, reason, reintegrate/quarantine decision.
- **PHA-19 Ward stock levels** — par levels per ward, replenishment suggestions, consumption trends.

### Counter sales
- **PHA-20 OTC counter sale** — scan/search items, cart, customer (walk-in/patient), discounts, payment methods, hold.
- **PHA-21 Sale receipt** — receipt preview (PRN-08), reprint, send SMS.
- **PHA-22 Sales return** — against invoice, reason, restock vs quarantine, refund method (approval).
- **PHA-23 Credit sales** — pending credit by company/staff, settle.
- **PHA-24 Held sales** — parked baskets, resume/cancel.

### Controlled substances
- **PHA-25 Controlled-drug register** — per drug running balance, entries (receipt, dispense, waste, return), witness co-signature, immutable.
- **PHA-26 Controlled dispensing** — extra checks: prescriber licence/prescription validity, patient ID verification, **second verifier e-signature**, retained prescription copy.
- **PHA-27 Controlled stock audit** — count vs register, discrepancy investigation form, regulatory report.

### Stock
- **PHA-28 Stock overview** — by item/store/batch, quantity, value, status chips (ok/low/out/expiring), filters, export.
- **PHA-29 Item detail** — batches, movement ledger, reorder levels, pricing, suppliers, substitutes, storage conditions, consumption chart.
- **PHA-30 Expiry management** — expiring in 30/60/90 days, actions (return to supplier, markdown, quarantine, destroy).
- **PHA-31 Low stock & reorder** — suggestions based on consumption, auto-draft requisition.
- **PHA-32 Stock adjustment** — add/remove with reason, evidence, approval.
- **PHA-33 Physical count** — count sheets, scan/enter, variance table, recount, approval to post.
- **PHA-34 Inter-store transfer** — request, dispatch, in-transit, receive, discrepancies.
- **PHA-35 Quarantine, damage & disposal** — quarantine list, destruction record with witness, certificates.
- **PHA-36 Cold chain ★** — temperature charts per fridge, excursion alerts, affected batches, actions.
- **PHA-37 Shelf & barcode labels** — label designer/print queue.

### Procurement
- **PHA-38 Purchase requisitions** — create from low stock or manual, approval flow.
- **PHA-39 Purchase orders** — list + create (supplier, items, price, terms, delivery), approval, send.
- **PHA-40 PO detail & status** — sent/partially received/closed, amendments, communications log.
- **PHA-41 Goods receipt (GRN)** — scan/enter received items vs PO, batch & expiry capture, quantity/quality checks, reject damaged, attach delivery note, post to stock.
- **PHA-42 GRN discrepancies & supplier returns** — shortage/damage, debit note, return slip.
- **PHA-43 Supplier directory** — profiles, performance score (lead time, fill rate, quality), price lists, contracts, documents.
- **PHA-44 Quotation comparison ★** — RFQ, side-by-side supplier quotes, award.
- **PHA-45 Invoice hand-off** — received-not-invoiced list, status of matching in accounting (ACC-20).

### Catalog & pricing
- **PHA-46 Drug catalog / formulary** — generic/brand, strength, form, ATC class, schedule, restrictions, price, active flag, search & filters.
- **PHA-47 New item request ★** — justification, committee approval workflow, status.
- **PHA-48 Pricing & margins** — price lists, markup rules, effective dates, history, approval for changes, markdown on near-expiry.
- **PHA-49 Substitution groups** — therapeutic/generic equivalence sets.
- **PHA-50 Drug information** — monograph, indications, dosing, interactions, pregnancy/lactation, storage; quick lookup from anywhere.

### Clinical pharmacy
- **PHA-51 Medication therapy review ★** — patient med list, issues found, recommendations, follow-up.
- **PHA-52 Pharmacist interventions** — log (type, severity, prescriber response, outcome), statistics.
- **PHA-53 Adverse drug reaction report** — form (drug, reaction, severity, causality), list/history, export to pharmacovigilance.
- **PHA-54 Antimicrobial stewardship ★** — restricted-antibiotic approval requests, criteria checklist, approve/deny/alternative, usage dashboard.
- **PHA-55 Medication error / near-miss** — report form, classification, review.

### Reports & misc
- **PHA-56 Sales** · **PHA-57 Consumption by ward/department** · **PHA-58 Expiry & wastage** · **PHA-59 ABC/VED analysis** · **PHA-60 Stock valuation** · **PHA-61 Controlled drugs report** · **PHA-62 Prescriber patterns** · **PHA-63 Purchases & supplier performance** · **PHA-64 Margin report** — report viewers (filters, charts, tables, export).
- **PHA-65 Notifications** — new STAT prescription, low stock, expiring, requisitions, approvals.
- **PHA-66 Counter session & shift** — open/close counter, cash float, handover notes, discrepancy.

**Required extra states:** severe interaction (blocking red dialog), out of stock everywhere, expired batch selected (blocked), controlled drug balance mismatch, insurance not covering item, barcode not recognized, printer offline (labels), prescription expired/duplicate dispense, partial delivery, temperature excursion, session timeout mid-dispense (draft kept).

**Screen count — Part 9:** **66 screens** (PHA-01 … PHA-66).
